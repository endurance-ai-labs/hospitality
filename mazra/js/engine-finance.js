/* ============================================================
   Restaurant OS — P&L engine
   Restaurant-industry format: sales -> COGS -> labor -> PRIME COST ->
   controllables -> occupancy -> four-wall EBITDA -> G&A -> net.

   Every line either comes from another engine (sales, labor, cogs) or is
   derived from one with a stated rate. Nothing here is a free-floating
   number, so any figure on the finance page can drill to its source.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand, CAL = RG.CAL;

  var BEV_CATS = RG.BEV_CATS || ['Cafe', 'N/A Bev'];

  /* rates that drive the controllable block — stated, not hidden */
  var RATES = {
    payrollBurden: 0.185,     /* taxes + workers comp + benefits on wages */
    directOperating: 0.0325,  /* smallwares, cleaning, laundry, uniforms */
    cardFeeRate: 0.0255,      /* on card volume */
    cardShare: 0.93,          /* share of net sales taken on card */
    marketing: 0.016,
    repairs: 0.011,
    adminGeneral: 0.014,
    utilitiesPerSqft: 1.42,   /* per sq ft per 28-day period */
    insurancePerSeat: 6.10,   /* per seat per period */
    gaAllocation: 0.041       /* corporate G&A allocated on net sales */
  };
  RG.PL_RATES = RATES;

  /* food vs beverage split, straight off the period PMIX */
  var salesSplit = R.memo(function (unitId, periodKey) {
    var pm = RG.periodPmix(unitId, periodKey);
    var food = 0, bev = 0;
    pm.forEach(function (r) {
      if (BEV_CATS.indexOf(r.cat) >= 0) bev = R.cents(bev + r.sales);
      else food = R.cents(food + r.sales);
    });
    return { food: food, bev: bev, gross: R.cents(food + bev) };
  });
  RG.salesSplit = salesSplit;

  /* percentage rent accrues on fiscal-year-to-date sales over the breakpoint */
  function pctRent(unitId, periodKey) {
    var unit = RG.unitById[unitId];
    if (!unit.pctRentBreak) return 0;
    var p = CAL.periodByKey[periodKey];
    var fyPeriods = CAL.PERIODS.filter(function (q) {
      return q.fy === p.fy && q.period <= p.period;
    });
    var ytd = 0, prior = 0;
    fyPeriods.forEach(function (q) {
      var n = RG.periodSales(unitId, q.key).net;
      if (q.period < p.period) prior = R.cents(prior + n);
      ytd = R.cents(ytd + n);
    });
    var due = Math.max(0, ytd - unit.pctRentBreak) * unit.pctRentRate;
    var already = Math.max(0, prior - unit.pctRentBreak) * unit.pctRentRate;
    return R.cents(Math.max(0, due - already));
  }
  RG.pctRent = pctRent;

  RG.periodPL = R.memo(function (unitId, periodKey) {
    var unit = RG.unitById[unitId];
    var s = RG.periodSales(unitId, periodKey);
    var split = salesSplit(unitId, periodKey);
    var cogs = RG.periodCogs(unitId, periodKey);
    var labor = RG.periodLabor(unitId, periodKey);
    var days = CAL.daysIn(periodKey);
    var periodsPerYear = 13;

    /* net sales, split food/bev in proportion to gross */
    var gross = s.gross;
    var netSales = s.net;
    var foodShare = gross ? split.food / gross : 0.75;
    var netFood = R.cents(netSales * foodShare);
    var netBev = R.cents(netSales - netFood);

    /* labor */
    var wages = labor.cost;                    /* hourly incl. OT + premiums */
    var mgr = labor.mgr;
    var burden = R.cents((wages + mgr) * RATES.payrollBurden);
    var totalLabor = R.cents(wages + mgr + burden);

    var primeCost = R.cents(cogs.actual + totalLabor);

    /* controllables */
    var deliverySales = s.byChannel.delivery || 0;
    /* The delivery fee line is the SUM of each marketplace's actual
       commission, not a flat blended rate — DoorDash at 27% and
       first-party at 3.1% are not the same expense. */
    var deliveryFees = RG.periodDeliveryFees
      ? RG.periodDeliveryFees(unitId, periodKey)
      : R.cents(deliverySales * 0.238);
    var cardFees = R.cents(netSales * RATES.cardShare * RATES.cardFeeRate);
    var directOp = R.cents(netSales * RATES.directOperating);
    var marketing = R.cents(netSales * RATES.marketing *
      R.noise('mk:' + unitId + periodKey, 0.22));
    var repairs = R.cents(netSales * RATES.repairs *
      R.noise('rp:' + unitId + periodKey, 0.55));
    var admin = R.cents(netSales * RATES.adminGeneral);
    /* utilities carry a real seasonal swing — summer cooling, winter gas */
    var p = CAL.periodByKey[periodKey];
    var seas = 1 + 0.20 * Math.cos(((p.period - 1) / 13) * 2 * Math.PI - 0.6);
    var utilities = R.cents(unit.sqft * RATES.utilitiesPerSqft * seas *
      R.noise('ut:' + unitId + periodKey, 0.07));
    var controllables = R.cents(
      deliveryFees + cardFees + directOp + marketing + repairs + admin + utilities
    );

    /* occupancy */
    var rent = R.cents(unit.rent * 12 / periodsPerYear);
    var cam = R.cents(unit.camMonthly * 12 / periodsPerYear);
    var percentage = pctRent(unitId, periodKey);
    var insurance = R.cents(unit.seats * RATES.insurancePerSeat);
    var occupancy = R.cents(rent + cam + percentage + insurance);

    var fourWall = R.cents(netSales - primeCost - controllables - occupancy);
    var ga = R.cents(netSales * RATES.gaAllocation);
    var net = R.cents(fourWall - ga);

    return {
      unit: unitId, period: periodKey, days: days.length,
      grossSales: gross, discounts: s.discounts, comps: s.comps, netSales: netSales,
      netFood: netFood, netBev: netBev,
      covers: s.covers, checks: s.checks, avgCheck: s.avgCheck,

      cogsFood: cogs.actualFood, cogsBev: cogs.actualBev, cogs: cogs.actual,
      cogsTheo: cogs.theo, cogsVariance: cogs.variance, cogsDrivers: cogs.drivers,

      wages: wages, mgrSalary: mgr, payrollBurden: burden, labor: totalLabor,
      laborHours: labor.hours, otCost: labor.otCost, breakPremiums: labor.premiums,

      primeCost: primeCost,

      deliveryFees: deliveryFees, cardFees: cardFees, directOperating: directOp,
      marketing: marketing, repairs: repairs, admin: admin, utilities: utilities,
      controllables: controllables,

      rent: rent, cam: cam, pctRent: percentage, insurance: insurance, occupancy: occupancy,

      fourWall: fourWall, ga: ga, net: net,

      /* ratios the whole portal reads from */
      foodPct: netFood ? cogs.actualFood / netFood : 0,
      bevPct: netBev ? cogs.actualBev / netBev : 0,
      cogsPct: netSales ? cogs.actual / netSales : 0,
      laborPct: netSales ? totalLabor / netSales : 0,
      primePct: netSales ? primeCost / netSales : 0,
      occupancyPct: netSales ? occupancy / netSales : 0,
      fourWallPct: netSales ? fourWall / netSales : 0,
      splh: labor.hours ? R.cents(netSales / labor.hours) : 0
    };
  });

  /* consolidated group P&L — additive across units, ratios recomputed */
  RG.groupPL = R.memo(function (periodKey) {
    var keys = ['grossSales','discounts','comps','netSales','netFood','netBev','covers','checks',
      'cogsFood','cogsBev','cogs','cogsTheo','cogsVariance','wages','mgrSalary','payrollBurden',
      'labor','laborHours','otCost','breakPremiums','primeCost','deliveryFees','cardFees',
      'directOperating','marketing','repairs','admin','utilities','controllables','rent','cam',
      'pctRent','insurance','occupancy','fourWall','ga','net'];
    var out = { period: periodKey, cogsDrivers: { portion: 0, waste: 0, spoilage: 0, ppv: 0, unexplained: 0 } };
    keys.forEach(function (k) { out[k] = 0; });
    RG.UNITS.forEach(function (u) {
      var pl = RG.periodPL(u.id, periodKey);
      keys.forEach(function (k) { out[k] = R.cents(out[k] + pl[k]); });
      Object.keys(out.cogsDrivers).forEach(function (d) {
        out.cogsDrivers[d] = R.cents(out.cogsDrivers[d] + pl.cogsDrivers[d]);
      });
    });
    out.covers = Math.round(out.covers);
    out.checks = Math.round(out.checks);
    out.avgCheck = out.checks ? R.cents(out.netSales / out.checks) : 0;
    out.cogsPct = out.netSales ? out.cogs / out.netSales : 0;
    out.laborPct = out.netSales ? out.labor / out.netSales : 0;
    out.primePct = out.netSales ? out.primeCost / out.netSales : 0;
    out.occupancyPct = out.netSales ? out.occupancy / out.netSales : 0;
    out.fourWallPct = out.netSales ? out.fourWall / out.netSales : 0;
    out.splh = out.laborHours ? R.cents(out.netSales / out.laborHours) : 0;
    return out;
  });

  /* ---- variance bridges ----
     Named drivers whose dollars sum EXACTLY to the total movement.
     This is the feature the demo is built around. */
  RG.salesBridge = function (unitIds, fromKey, toKey) {
    var a = { net: 0, covers: 0, checks: 0 }, b = { net: 0, covers: 0, checks: 0 };
    unitIds.forEach(function (uid) {
      var x = RG.periodSales(uid, fromKey), y = RG.periodSales(uid, toKey);
      a.net = R.cents(a.net + x.net); a.covers += x.covers; a.checks += x.checks;
      b.net = R.cents(b.net + y.net); b.covers += y.covers; b.checks += y.checks;
    });
    var total = R.cents(b.net - a.net);
    var checkA = a.checks ? a.net / a.checks : 0;
    var checkB = b.checks ? b.net / b.checks : 0;

    /* Exact decomposition — these three sum to the total by construction:
         traffic = (Nb - Na) x Ca          volume at the old average check
         check   = Nb x (Cb - Ca)          rate on the new volume
       traffic + check = Nb*Cb - Na*Ca = total.
       The check effect is then split into the part explained by menu price
       increases inside the window, and mix (everything else the guest did). */
    var traffic = (b.checks - a.checks) * checkA;
    var checkEffect = b.checks * (checkB - checkA);
    var priceRatio = priceLift(unitIds, fromKey, toKey);
    var price = b.checks * checkA * priceRatio;
    var mix = checkEffect - price;

    /* absorb any cent-level rounding into mix so the bridge always foots */
    var t = R.cents(traffic), p = R.cents(price);
    var m = R.cents(total - t - p);
    return {
      from: fromKey, to: toKey, fromNet: a.net, toNet: b.net, total: total,
      fromChecks: a.checks, toChecks: b.checks,
      fromAvgCheck: R.cents(checkA), toAvgCheck: R.cents(checkB),
      traffic: t, price: p, mix: m,
      check: R.cents(p + m)   /* display subtotal: the whole check effect */
    };
  };

  function priceLift(unitIds, fromKey, toKey) {
    var from = CAL.periodByKey[fromKey], to = CAL.periodByKey[toKey];
    var lift = 0, n = 0;
    unitIds.forEach(function (uid) {
      var brand = RG.unitById[uid].brand;
      var moves = RG.PRICE_MOVES[brand] || [];
      var f = 1;
      moves.forEach(function (m) {
        var ts = CAL.toTs(m[0]);
        if (ts > CAL.toTs(from.end) && ts <= CAL.toTs(to.end)) f *= 1 + m[1];
      });
      lift += f - 1; n++;
    });
    return n ? lift / n : 0;
  }

  RG.laborBridge = function (unitIds, fromKey, toKey) {
    var a = RG.sumLabor(unitIds, CAL.daysIn(fromKey));
    var b = RG.sumLabor(unitIds, CAL.daysIn(toKey));
    var total = R.cents(b.total - a.total);
    var rateA = a.hours ? a.cost / a.hours : 0;
    var rateB = b.hours ? b.cost / b.hours : 0;
    /* volume + rate = (b.cost - a.cost) exactly; manager closes to the total */
    var volume = R.cents((b.hours - a.hours) * rateA);
    var mgr = R.cents(b.mgr - a.mgr);
    var rate = R.cents(total - volume - mgr);
    return {
      from: fromKey, to: toKey, fromTotal: a.total, toTotal: b.total, total: total,
      fromHours: a.hours, toHours: b.hours,
      fromRate: R.cents(rateA), toRate: R.cents(rateB),
      volume: volume, rate: rate, manager: mgr,
      otDelta: R.cents(b.otCost - a.otCost),
      premiumDelta: R.cents(b.premiums - a.premiums)
    };
  };

  RG.profitBridge = function (fromKey, toKey) {
    var a = RG.groupPL(fromKey), b = RG.groupPL(toKey);
    var total = R.cents(b.fourWall - a.fourWall);
    var raw = {
      sales: R.cents(b.netSales - a.netSales),
      cogs: R.cents(-(b.cogs - a.cogs)),
      labor: R.cents(-(b.labor - a.labor)),
      controllables: R.cents(-(b.controllables - a.controllables)),
      occupancy: R.cents(-(b.occupancy - a.occupancy))
    };
    /* these five are exhaustive by construction of the P&L */
    return {
      from: fromKey, to: toKey, fromFourWall: a.fourWall, toFourWall: b.fourWall,
      total: total, parts: raw,
      check: R.cents(raw.sales + raw.cogs + raw.labor + raw.controllables + raw.occupancy - total)
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
