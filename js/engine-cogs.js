/* ============================================================
   Restaurant OS — cost of goods, variance and purchasing

   Theoretical cost is computed bottom-up from PMIX and recipes.
   Actual cost is theoretical PLUS five NAMED drivers. That is the whole
   point: the food-cost bridge closes by construction, so "your variance
   was $4,180" always decomposes into portioning / waste / spoilage /
   purchase-price / unexplained, and the parts sum exactly to the whole.

   Purchases are then generated to reconcile to actual usage plus the
   inventory movement, so the invoice register ties to the P&L.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand, CAL = RG.CAL;

  var BEV_CATS = ['Beer', 'Wine', 'Cocktails', 'Spirits', 'N/A Bev'];

  /* ---- theoretical usage for one unit-day, by ingredient ---- */
  var dayTheo = R.memo(function (unitId, iso) {
    var pm = RG.dayPmix(unitId, iso);
    var out = { byIng: {}, food: 0, bev: 0, total: 0 };
    if (!pm || pm.closed) return out;
    pm.rows.forEach(function (r) {
      var m = RG.menuById[r.item];
      var packaged = (r.channel === 'delivery' || r.channel === 'takeout');
      var lineCost = R.cents(RG.plateCost(r.item, iso, packaged) * r.qty);
      if (m.bev) out.bev = R.cents(out.bev + lineCost);
      else out.food = R.cents(out.food + lineCost);
      var scale = m.bev ? RG.PORTION_SCALE.bev : RG.PORTION_SCALE.food;
      m.recipe.forEach(function (l) {
        var q = l.qty * r.qty * scale;
        var a = out.byIng[l.ing] || (out.byIng[l.ing] = { qty: 0, cost: 0 });
        a.qty = Math.round((a.qty + q) * 1000) / 1000;
        a.cost = R.cents(a.cost + RG.ingCost(l.ing, iso) * q);
      });
      if (packaged && !m.bev) {
        var t = out.byIng.togo || (out.byIng.togo = { qty: 0, cost: 0 });
        t.qty = Math.round((t.qty + 1.4 * r.qty) * 1000) / 1000;
        t.cost = R.cents(t.cost + RG.ingCost('togo', iso) * 1.4 * r.qty);
      }
    });
    out.total = R.cents(out.food + out.bev);
    return out;
  });
  RG.dayTheo = dayTheo;

  /* ---- the five variance drivers ----
     Rates drift by unit and period. The Portland unit runs hot on
     portioning and unexplained shrink — that is the seeded story the
     anomaly feed is meant to surface. */
  function driverRates(unitId, periodKey) {
    var s = unitId + ':' + periodKey;
    var hot = unitId === 'star-pdx';
    var clean = unitId === 'lstar-solano';
    var scale = hot ? 2.35 : clean ? 0.45 : 1;
    return {
      portion:     Math.max(0, R.between('vp:' + s, 0.006, 0.021) * scale),
      waste:       Math.max(0, R.between('vw:' + s, 0.004, 0.013) * (hot ? 1.6 : clean ? 0.6 : 1)),
      spoilage:    Math.max(0, R.between('vs:' + s, 0.002, 0.009) * (hot ? 1.5 : clean ? 0.5 : 1)),
      ppv:         Math.max(0, R.between('vv:' + s, -0.004, 0.014) * (hot ? 1.8 : 1)),
      unexplained: Math.max(0, R.between('vu:' + s, 0.000, 0.010) * (hot ? 2.6 : clean ? 0.3 : 1))
    };
  }
  RG.driverRates = driverRates;

  /* ---- period cost of goods, with the bridge ---- */
  RG.periodCogs = R.memo(function (unitId, periodKey) {
    var days = CAL.daysIn(periodKey);
    var theoFood = 0, theoBev = 0, byIng = {};
    days.forEach(function (d) {
      var t = dayTheo(unitId, d.iso);
      theoFood = R.cents(theoFood + t.food);
      theoBev = R.cents(theoBev + t.bev);
      Object.keys(t.byIng).forEach(function (k) {
        var a = byIng[k] || (byIng[k] = { qty: 0, cost: 0 });
        a.qty = Math.round((a.qty + t.byIng[k].qty) * 1000) / 1000;
        a.cost = R.cents(a.cost + t.byIng[k].cost);
      });
    });
    var theo = R.cents(theoFood + theoBev);
    var rates = driverRates(unitId, periodKey);
    var drivers = {
      portion:     R.cents(theo * rates.portion),
      waste:       R.cents(theo * rates.waste),
      spoilage:    R.cents(theo * rates.spoilage),
      ppv:         R.cents(theo * rates.ppv),
      unexplained: R.cents(theo * rates.unexplained)
    };
    var variance = R.cents(
      drivers.portion + drivers.waste + drivers.spoilage + drivers.ppv + drivers.unexplained
    );
    var actual = R.cents(theo + variance);
    /* split the variance back onto food vs beverage in proportion */
    var foodShare = theo ? theoFood / theo : 1;
    return {
      unit: unitId, period: periodKey,
      theoFood: theoFood, theoBev: theoBev, theo: theo,
      drivers: drivers, variance: variance, actual: actual,
      actualFood: R.cents(theoFood + variance * foodShare),
      actualBev: R.cents(actual - R.cents(theoFood + variance * foodShare)),
      variancePct: theo ? variance / theo : 0,
      byIng: byIng
    };
  });

  /* ---- purchases ----
     Period purchases reconcile to actual usage plus the inventory move,
     so the invoice register foots to the P&L COGS line exactly. */
  RG.periodPurchases = R.memo(function (unitId, periodKey) {
    var cogs = RG.periodCogs(unitId, periodKey);
    var days = CAL.daysIn(periodKey);
    /* inventory drifts a little each period — small relative to usage */
    var invDelta = R.cents(cogs.actual * R.between('inv:' + unitId + periodKey, -0.022, 0.022));
    var purchaseTotal = R.cents(cogs.actual + invDelta);

    /* spend by vendor, from the ingredients each vendor supplies */
    var byVendor = {};
    Object.keys(cogs.byIng).forEach(function (ingId) {
      var ing = RG.ingById[ingId];
      if (!ing) return;
      byVendor[ing.vendor] = R.cents((byVendor[ing.vendor] || 0) + cogs.byIng[ingId].cost);
    });
    var vendorIds = Object.keys(byVendor);
    var vendorAmts = R.allocate(purchaseTotal, vendorIds.map(function (v) { return byVendor[v]; }));

    var invoices = [];
    vendorIds.forEach(function (vid, vi) {
      var vendor = RG.vendorById[vid];
      if (!vendor) return;
      var deliveries = days.filter(function (d) { return vendor.days.indexOf(d.dow) >= 0; });
      if (!deliveries.length) deliveries = [days[0]];
      var amts = R.allocate(vendorAmts[vi], deliveries.map(function (d, i) {
        return 0.7 + R.u('del:' + unitId + vid + d.iso);
      }));
      deliveries.forEach(function (d, di) {
        if (amts[di] <= 0) return;
        /* line items from the ingredients this vendor supplies */
        var ings = Object.keys(cogs.byIng).filter(function (k) {
          return RG.ingById[k] && RG.ingById[k].vendor === vid;
        });
        var lineAmts = R.allocate(amts[di], ings.map(function (k) { return cogs.byIng[k].cost; }));
        var lines = ings.map(function (k, ki) {
          var ing = RG.ingById[k];
          var unitPrice = R.cents(RG.ingCost(k, d.iso) * (1 + driverRates(unitId, periodKey).ppv));
          return {
            ing: k, name: ing.name, unit: ing.unit,
            price: unitPrice,
            qty: unitPrice ? Math.round((lineAmts[ki] / unitPrice) * 100) / 100 : 0,
            ext: lineAmts[ki]
          };
        }).filter(function (l) { return l.ext > 0; });
        invoices.push({
          id: 'INV-' + unitId.toUpperCase().replace(/[^A-Z]/g, '') + '-' + d.iso.replace(/-/g, '') + '-' + vid.slice(0, 3).toUpperCase(),
          unit: unitId, vendor: vid, vendorName: vendor.name, feed: vendor.feed,
          date: d.iso, terms: vendor.terms,
          total: amts[di], lines: lines,
          approved: d.ts < CAL.toTs(CAL.TODAY) - 5 * 86400000
        });
      });
    });
    return {
      unit: unitId, period: periodKey, total: purchaseTotal,
      invDelta: invDelta, invoices: invoices, byVendor: byVendor
    };
  });

  /* ---- waste log: the driver made visible line by line ---- */
  RG.periodWaste = R.memo(function (unitId, periodKey) {
    var cogs = RG.periodCogs(unitId, periodKey);
    var days = CAL.daysIn(periodKey);
    var reasons = ['Over-prep', 'Spoilage', 'Dropped / mishandled', 'Cook error', 'Expired', '86 / quality'];
    var target = R.cents(cogs.drivers.waste + cogs.drivers.spoilage);
    var ings = Object.keys(cogs.byIng).sort(function (a, b) {
      return cogs.byIng[b].cost - cogs.byIng[a].cost;
    }).slice(0, 18);
    var events = [];
    days.forEach(function (d) {
      var n = R.intBetween('wn:' + unitId + d.iso, 1, 4);
      for (var i = 0; i < n; i++) events.push({ day: d.iso, seed: 'we:' + unitId + d.iso + i });
    });
    var amts = R.allocate(target, events.map(function (e) { return 0.4 + R.u(e.seed); }));
    return events.map(function (e, i) {
      var ing = ings[R.hash(e.seed) % ings.length];
      var meta = RG.ingById[ing];
      var price = RG.ingCost(ing, e.day) || 1;
      return {
        date: e.day, unit: unitId, ing: ing, name: meta.name,
        reason: reasons[R.hash(e.seed + 'r') % reasons.length],
        qty: Math.round((amts[i] / price) * 100) / 100,
        unitLabel: meta.unit, cost: amts[i],
        logged: R.chance(e.seed + 'l', 0.86)   /* not every event gets logged */
      };
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
