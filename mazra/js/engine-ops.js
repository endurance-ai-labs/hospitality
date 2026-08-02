/* ============================================================
   Restaurant OS — operations engine
   Facilities, equipment, energy, food safety, compliance, cash control
   and people analytics.

   Work-order spend is generated to foot EXACTLY to the P&L repairs line,
   and energy to the utilities line, so the facilities page and the P&L
   can never disagree. Same discipline as purchasing.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand, CAL = RG.CAL;

  /* ---- asset registry ---- */
  var ASSET_TYPES = [
    ['Walk-in cooler', 18000, 15, 'refrigeration'],
    ['Walk-in freezer', 22000, 15, 'refrigeration'],
    ['Reach-in refrigerator', 4200, 10, 'refrigeration'],
    ['Ice machine', 5600, 8, 'refrigeration'],
    ['Range / flat top', 9800, 12, 'cooking'],
    ['Convection oven', 12500, 15, 'cooking'],
    ['Vertical shawarma broiler', 14500, 12, 'cooking'],
    ['Fryer', 5400, 8, 'cooking'],
    ['Dishmachine', 14000, 12, 'warewashing'],
    ['Exhaust hood & make-up air', 21000, 20, 'hvac'],
    ['HVAC rooftop unit', 17500, 15, 'hvac'],
    ['Cold-brew & juice station', 6400, 10, 'bar'],
    ['Espresso machine', 7400, 10, 'bar'],
    ['POS terminals', 6200, 6, 'technology']
  ];

  RG.assetsFor = R.memo(function (unitId) {
    var u = RG.unitById[unitId];
    var out = [];
    ASSET_TYPES.forEach(function (a, i) {
      /* pizza units carry deck ovens; bar-led units carry more draft */
      if (a[0] === 'Vertical shawarma broiler' && false) return;
      /* the La Marzocco espresso program exists only where there is a cafe */
      if (a[0] === 'Espresso machine' && !u.cafe) return;
      if (a[0] === 'Cold-brew & juice station' && !u.cafe) return;
      var n = (a[3] === 'refrigeration' && u.seats > 90) ? 2 : 1;
      for (var k = 0; k < n; k++) {
        var seed = 'as:' + unitId + i + k;
        var life = a[2];
        var age = R.between(seed + 'a', 0.5, life * 1.25);
        out.push({
          id: unitId + '-A' + i + k, unit: unitId, name: a[0] + (n > 1 ? ' #' + (k + 1) : ''),
          category: a[3], cost: a[1], life: life,
          ageYears: Math.round(age * 10) / 10,
          installed: CAL.iso(CAL.toTs(CAL.END) - Math.round(age * 365) * 86400000),
          warranty: age < 2,
          condition: age / life > 1 ? 'End of life' : age / life > 0.75 ? 'Watch' : 'Serviceable'
        });
      }
    });
    return out;
  });

  var WO_ISSUES = {
    refrigeration: ['Not holding temperature', 'Compressor short-cycling', 'Door gasket failure', 'Condenser coil service'],
    cooking: ['Pilot / ignition failure', 'Thermostat out of calibration', 'Gas valve replacement', 'Burner service'],
    warewashing: ['Not reaching sanitising temperature', 'Pump seal leak', 'Chemical dosing failure'],
    hvac: ['No cooling in dining room', 'Hood fan belt', 'Make-up air imbalance', 'Quarterly filter service'],
    bar: ['Line cleaning overdue', 'Glycol pump fault', 'CO2 regulator leak'],
    technology: ['Terminal offline', 'Printer not firing to kitchen', 'Card reader intermittent']
  };
  var VENDORS_FM = ['Bay Mechanical Services', 'Coast Refrigeration', 'Alameda Kitchen Repair',
                    'Pacific Hood & Fire', 'Northgate Electrical'];

  /* Work orders whose costs sum EXACTLY to the P&L repairs line. */
  RG.periodWorkOrders = R.memo(function (unitId, periodKey) {
    var pl = RG.periodPL(unitId, periodKey);
    var days = CAL.daysIn(periodKey);
    var assets = RG.assetsFor(unitId);
    var n = R.intBetween('won:' + unitId + periodKey, 4, 11);
    var seeds = [];
    for (var i = 0; i < n; i++) seeds.push('wo:' + unitId + periodKey + i);
    var amts = R.allocate(pl.repairs, seeds.map(function (s) { return 0.3 + R.u(s + 'w') * 2; }));
    return seeds.map(function (seed, i) {
      /* older assets break more often */
      var a = assets.sort(function (x, y) {
        return (R.u(seed + y.id) * (1 + y.ageYears / y.life)) - (R.u(seed + x.id) * (1 + x.ageYears / x.life));
      })[0];
      var day = days[R.hash(seed + 'd') % days.length];
      var issues = WO_ISSUES[a.category] || ['Service call'];
      var openDays = Math.round(R.between(seed + 'o', 0, 14));
      var closed = day.ts + openDays * 86400000 < CAL.toTs(CAL.TODAY);
      var pri = a.category === 'refrigeration' && R.chance(seed + 'p', 0.4) ? 'Urgent' :
                R.chance(seed + 'p2', 0.3) ? 'High' : 'Routine';
      return {
        id: 'WO-' + unitId.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) + '-' +
            day.iso.replace(/-/g, '').slice(4) + '-' + (i + 1),
        unit: unitId, date: day.iso, asset: a.name, assetId: a.id, category: a.category,
        issue: issues[R.hash(seed + 'i') % issues.length],
        vendor: VENDORS_FM[R.hash(seed + 'v') % VENDORS_FM.length],
        cost: amts[i], priority: pri,
        status: closed ? 'Closed' : 'Open', ageDays: closed ? openDays : Math.round(
          (CAL.toTs(CAL.TODAY) - day.ts) / 86400000),
        warranty: a.warranty
      };
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  });

  /* ---- refrigeration temperature excursions ---- */
  RG.periodExcursions = R.memo(function (unitId, periodKey) {
    var days = CAL.daysIn(periodKey);
    var assets = RG.assetsFor(unitId).filter(function (a) { return a.category === 'refrigeration'; });
    var out = [];
    days.forEach(function (d) {
      assets.forEach(function (a) {
        var seed = 'ex:' + a.id + d.iso;
        /* end-of-life boxes drift far more often */
        var p = 0.012 + (a.ageYears / a.life) * 0.055;
        if (!R.chance(seed, p)) return;
        var target = a.name.indexOf('freezer') >= 0 ? 0 : 38;
        var peak = target + R.between(seed + 't', 6, 21);
        var mins = Math.round(R.between(seed + 'm', 25, 260));
        out.push({
          asset: a.name, assetId: a.id, unit: unitId, date: d.iso,
          target: target, peak: Math.round(peak * 10) / 10, minutes: mins,
          productRisk: R.cents(mins > 120 ? R.between(seed + 'p', 300, 2400) : 0),
          acknowledged: R.chance(seed + 'a', 0.81)
        });
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  });

  /* ---- energy: foots to the P&L utilities line ---- */
  RG.periodEnergy = R.memo(function (unitId, periodKey) {
    var pl = RG.periodPL(unitId, periodKey);
    var u = RG.unitById[unitId];
    var s = RG.periodSales(unitId, periodKey);
    var parts = R.allocate(pl.utilities, [0.58, 0.24, 0.13, 0.05]);
    return {
      unit: unitId, period: periodKey, total: pl.utilities,
      electric: parts[0], gas: parts[1], water: parts[2], waste: parts[3],
      kwh: Math.round(parts[0] / 0.284),
      therms: Math.round(parts[1] / 1.92),
      costPerCover: s.covers ? R.cents(pl.utilities / s.covers) : 0,
      costPerSqft: R.cents(pl.utilities / u.sqft),
      hvacAdherence: R.between('hv:' + unitId + periodKey, 0.72, 0.98)
    };
  });

  /* ---- food safety: line checks and inspections ---- */
  RG.periodSafety = R.memo(function (unitId, periodKey) {
    var days = CAL.daysIn(periodKey);
    var checks = [];
    days.forEach(function (d) {
      ['Opening line check', 'Mid-shift temp log', 'Closing checklist'].forEach(function (c, i) {
        var seed = 'sf:' + unitId + d.iso + i;
        var done = R.chance(seed, unitId === 'mz-rwc' ? 0.88 : 0.96);
        checks.push({
          date: d.iso, name: c, unit: unitId, complete: done,
          onTime: done && R.chance(seed + 't', 0.88),
          corrective: done && R.chance(seed + 'c', 0.09) ? 'Product discarded and re-prepped' : null
        });
      });
    });
    var complete = checks.filter(function (c) { return c.complete; }).length;
    /* health inspections happen a couple of times a year */
    var inspections = [];
    var p = CAL.periodByKey[periodKey];
    [0, 1, 2, 3].forEach(function (back) {
      var idx = CAL.PERIODS.findIndex(function (q) { return q.key === periodKey; }) - back * 6;
      if (idx < 0) return;
      var q = CAL.PERIODS[idx];
      var seed = 'insp:' + unitId + q.key;
      if (!R.chance(seed, 0.55)) return;
      var score = Math.round(R.between(seed + 's', unitId === 'mz-rwc' ? 88 : 92, 100));
      inspections.push({
        date: q.end, unit: unitId, score: score,
        grade: score >= 95 ? 'A' : score >= 90 ? 'A-' : score >= 85 ? 'B' : 'C',
        critical: score < 90 ? R.intBetween(seed + 'c', 1, 3) : 0,
        note: score < 90 ? 'Holding temperature and hand-wash access cited' : 'No critical violations'
      });
    });
    return {
      unit: unitId, period: periodKey, checks: checks,
      completeRate: checks.length ? complete / checks.length : 0,
      onTimeRate: checks.length ? checks.filter(function (c) { return c.onTime; }).length / checks.length : 0,
      correctives: checks.filter(function (c) { return c.corrective; }),
      inspections: inspections.sort(function (a, b) { return a.date < b.date ? 1 : -1; })
    };
  });

  /* ---- cash control & loss prevention ---- */
  RG.periodCash = R.memo(function (unitId, periodKey) {
    var days = CAL.daysIn(periodKey);
    var pl = RG.periodPL(unitId, periodKey);
    var roster = RG.rosterFor(unitId).filter(function (e) {
      return e.job === 'server' || e.job === 'barista';
    });
    var overShort = 0, rows = [];
    days.forEach(function (d) {
      var s = RG.daySales(unitId, d.iso);
      if (s.closed) return;
      var os = R.cents(R.gauss('os:' + unitId + d.iso) * 14);
      overShort = R.cents(overShort + os);
      rows.push({
        date: d.iso, dow: d.dowName, net: s.net, cash: R.cents(s.net * 0.07),
        overShort: os, voids: s.voids, voidCount: s.voidCount,
        comps: s.comps, discounts: s.discounts,
        noSale: R.intBetween('nsl:' + unitId + d.iso, 0, 9)
      });
    });
    /* server-level outlier index: z-score of comp rate against peers */
    var servers = roster.map(function (e) {
      var rate = Math.max(0, R.between('svc:' + e.id + periodKey, 0.004, 0.022) *
        (unitId === 'mz-rwc' && R.hash(e.id) % 7 === 0 ? 3.4 : 1));
      var sales = R.cents(pl.grossSales / roster.length * R.between('svs:' + e.id + periodKey, 0.55, 1.6));
      return {
        emp: e.id, name: e.name, job: e.jobLabel, sales: sales,
        comps: R.cents(sales * rate), compRate: rate,
        voids: R.cents(sales * rate * 0.7),
        checks: Math.round(sales / Math.max(1, pl.avgCheck))
      };
    });
    var mean = servers.reduce(function (a, s) { return a + s.compRate; }, 0) / (servers.length || 1);
    var sd = Math.sqrt(servers.reduce(function (a, s) {
      return a + Math.pow(s.compRate - mean, 2);
    }, 0) / (servers.length || 1)) || 1;
    servers.forEach(function (s) { s.z = (s.compRate - mean) / sd; });
    servers.sort(function (a, b) { return b.z - a.z; });
    return {
      unit: unitId, period: periodKey, rows: rows, servers: servers,
      overShort: overShort, peerMean: mean, peerSd: sd,
      voids: pl.grossSales ? R.cents(rows.reduce(function (a, r) { return a + r.voids; }, 0)) : 0,
      comps: pl.comps, discounts: pl.discounts,
      compRate: pl.grossSales ? pl.comps / pl.grossSales : 0
    };
  });

  /* ---- people analytics, derived from the roster ---- */
  RG.periodPeople = R.memo(function (unitId, periodKey) {
    var roster = RG.rosterFor(unitId);
    var hourly = roster.filter(function (e) { return !e.salaried; });
    var buckets = { '0-90 days': 0, '90d-1yr': 0, '1-2 yrs': 0, '2+ yrs': 0 };
    hourly.forEach(function (e) {
      if (e.tenureDays < 90) buckets['0-90 days']++;
      else if (e.tenureDays < 365) buckets['90d-1yr']++;
      else if (e.tenureDays < 730) buckets['1-2 yrs']++;
      else buckets['2+ yrs']++;
    });
    var turnover = R.between('to:' + unitId + periodKey, 0.44, 0.92) *
      (unitId === 'mz-rwc' ? 1.38 : 1);
    var openRoles = R.intBetween('or:' + unitId + periodKey, 0, 6);
    return {
      unit: unitId, period: periodKey,
      headcount: roster.length, hourly: hourly.length,
      tenure: buckets,
      turnoverAnnualised: turnover,
      ninetyDayRetention: R.between('r90:' + unitId + periodKey, 0.51, 0.82),
      openRoles: openRoles,
      daysToFill: Math.round(R.between('dtf:' + unitId + periodKey, 9, 34)),
      costPerHire: R.cents(R.between('cph:' + unitId + periodKey, 380, 1250)),
      applicants: Math.round(R.between('app:' + unitId + periodKey, 18, 96)),
      trainingComplete: R.between('trn:' + unitId + periodKey, 0.62, 0.97),
      certsExpiring: roster.filter(function (e) {
        return R.chance('cert:' + e.id + periodKey, 0.07);
      }).map(function (e) {
        return {
          name: e.name, role: e.jobLabel,
          cert: R.chance('ct:' + e.id, 0.6) ? 'Food Handler' : 'Alcohol Service',
          expires: CAL.iso(CAL.toTs(CAL.TODAY) + R.intBetween('ce:' + e.id, 3, 75) * 86400000)
        };
      }),
      roster: roster
    };
  });

  /* ---- integrations health ---- */
  RG.connectorHealth = R.memo(function (systemId) {
    var sys = null;
    RG.SYSTEMS.forEach(function (s) { if (s.id === systemId) sys = s; });
    if (!sys) return null;
    var seed = 'conn:' + systemId;
    var latency = sys.tier === 1 ? R.intBetween(seed + 'l', 1, 9) :
                  sys.tier === 2 ? R.intBetween(seed + 'l', 45, 420) :
                  sys.tier === 3 ? R.intBetween(seed + 'l', 380, 900) :
                                   R.intBetween(seed + 'l', 700, 2600);
    var rows = Math.round(R.between(seed + 'r', 400, 220000));
    var errs = Math.round(rows * R.between(seed + 'e', 0, sys.tier >= 3 ? 0.014 : 0.002));
    return {
      id: systemId, name: sys.name, domain: sys.domain, tier: sys.tier,
      units: sys.units === 'all' ? RG.UNITS.length : sys.units.length,
      assumed: sys.assumed,
      latencyMin: latency, rows: rows, errors: errs,
      status: errs / Math.max(1, rows) > 0.008 ? 'degraded' : latency > 1440 ? 'stale' : 'healthy',
      lastSync: latency
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
