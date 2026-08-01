/* ============================================================
   Restaurant OS — MODEL assembly
   One shared object every page reads. Computed once, cached, never
   re-derived per page. If a page needs a number that is not here, add
   it here rather than computing it locally — that is how the portal
   stays internally consistent.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand, CAL = RG.CAL;

  var ALL = RG.UNITS.map(function (u) { return u.id; });

  /* the reporting window the portal defaults to */
  var COMPLETE = CAL.COMPLETE;
  var CUR = CAL.LAST_COMPLETE;                       /* last closed period */
  var PRIOR = CAL.priorPeriod(CUR.key);
  var PRIOR_YEAR = CAL.priorYear(CUR.key);
  var TRAILING13 = COMPLETE.slice(-13);
  var TRAILING26 = COMPLETE.slice(-26);

  function build() {
    var M = {
      generated: CAL.TODAY,
      units: ALL,
      periods: TRAILING26.map(function (p) { return p.key; }),
      current: CUR.key, prior: PRIOR ? PRIOR.key : null,
      priorYear: PRIOR_YEAR ? PRIOR_YEAR.key : null,
      unit: {}, group: {}, trailing13: TRAILING13.map(function (p) { return p.key; })
    };

    TRAILING26.forEach(function (p) {
      M.group[p.key] = RG.groupPL(p.key);
    });

    ALL.forEach(function (uid) {
      M.unit[uid] = {};
      TRAILING26.forEach(function (p) {
        M.unit[uid][p.key] = RG.periodPL(uid, p.key);
      });
    });

    /* ---- unit scorecard for the exec leaderboard ---- */
    M.scorecard = ALL.map(function (uid) {
      var cur = M.unit[uid][CUR.key];
      var py = PRIOR_YEAR ? M.unit[uid][PRIOR_YEAR.key] : null;
      var t13 = TRAILING13.reduce(function (s, p) {
        return R.cents(s + M.unit[uid][p.key].netSales);
      }, 0);
      var t13Profit = TRAILING13.reduce(function (s, p) {
        return R.cents(s + M.unit[uid][p.key].fourWall);
      }, 0);
      var u = RG.unitById[uid];
      return {
        unit: uid, name: u.name, short: u.short, brand: u.brand,
        city: u.city, state: u.state, pos: u.pos,
        netSales: cur.netSales,
        compPct: py && py.netSales ? (cur.netSales - py.netSales) / py.netSales : null,
        covers: cur.covers, avgCheck: cur.avgCheck,
        primePct: cur.primePct, cogsPct: cur.cogsPct, laborPct: cur.laborPct,
        fourWall: cur.fourWall, fourWallPct: cur.fourWallPct,
        occupancyPct: cur.occupancyPct, splh: cur.splh,
        cogsVariance: cur.cogsVariance,
        ttmSales: t13, ttmFourWall: t13Profit,
        salesPerSeat: R.cents(cur.netSales / u.seats)
      };
    });

    /* composite rank: profit margin, comp growth and cost control */
    var maxVar = Math.max.apply(null, M.scorecard.map(function (s) { return s.cogsVariance; })) || 1;
    M.scorecard.forEach(function (s) {
      s.score = Math.round(
        (s.fourWallPct * 100) * 3 +
        ((s.compPct || 0) * 100) * 2 -
        (s.primePct * 100) * 0.8 -
        (s.cogsVariance / maxVar) * 8
      );
    });
    M.scorecard.sort(function (a, b) { return b.score - a.score; });
    M.scorecard.forEach(function (s, i) { s.rank = i + 1; });

    /* ---- bridges for the current period ---- */
    M.bridges = {
      sales: RG.salesBridge(ALL, PRIOR.key, CUR.key),
      salesYoY: PRIOR_YEAR ? RG.salesBridge(ALL, PRIOR_YEAR.key, CUR.key) : null,
      labor: RG.laborBridge(ALL, PRIOR.key, CUR.key),
      profit: RG.profitBridge(PRIOR.key, CUR.key)
    };

    /* ---- anomaly triage, ranked by dollar impact ----
       This is what the exec dashboard opens on. */
    var flags = [];
    ALL.forEach(function (uid) {
      var u = RG.unitById[uid];
      var cur = M.unit[uid][CUR.key];
      var prev = M.unit[uid][PRIOR.key];
      var cogs = RG.periodCogs(uid, CUR.key);

      if (cogs.variancePct > 0.035 && cogs.variance > 2500) {
        var top = Object.keys(cogs.drivers).sort(function (a, b) {
          return cogs.drivers[b] - cogs.drivers[a];
        })[0];
        flags.push({
          unit: uid, unitName: u.name, module: 'Food & Beverage Cost',
          impact: cogs.variance, severity: cogs.variancePct > 0.06 ? 'high' : 'med',
          title: 'Theoretical-vs-actual variance ' + fmtPct(cogs.variancePct),
          detail: 'Largest driver: ' + driverLabel(top) + ' at ' + fmt$(cogs.drivers[top]) +
                  ' of ' + fmt$(cogs.variance) + ' total variance.',
          link: '/hospitality/cogs?unit=' + uid, sources: ['Toast', 'R365']
        });
      }
      var laborDelta = cur.laborPct - prev.laborPct;
      if (laborDelta > 0.010) {
        flags.push({
          unit: uid, unitName: u.name, module: 'Labor & Scheduling',
          impact: R.cents((cur.laborPct - prev.laborPct) * cur.netSales),
          severity: laborDelta > 0.03 ? 'high' : 'med',
          title: 'Labor up ' + fmtPct(laborDelta) + ' of sales vs. prior period',
          detail: 'Overtime ' + fmt$(cur.otCost) + ', break premiums ' + fmt$(cur.breakPremiums) +
                  ', SPLH ' + fmt$(cur.splh) + '.',
          link: '/hospitality/labor?unit=' + uid, sources: ['7shifts', 'Toast']
        });
      }
      if (cur.comps / Math.max(1, cur.grossSales) > 0.014) {
        flags.push({
          unit: uid, unitName: u.name, module: 'Cash Control & Loss Prevention',
          impact: cur.comps, severity: 'high',
          title: 'Comps at ' + fmtPct(cur.comps / cur.grossSales) + ' of gross sales',
          detail: 'Group average is ' + fmtPct(M.group[CUR.key].comps / M.group[CUR.key].grossSales) +
                  '. Void count ' + Math.round(cur.grossSales * 0.0005) + '.',
          link: '/hospitality/cash?unit=' + uid, sources: [u.pos]
        });
      }
      if (u.pctRentBreak) {
        var fytd = CAL.PERIODS.filter(function (q) {
          return q.fy === CAL.periodByKey[CUR.key].fy && q.period <= CAL.periodByKey[CUR.key].period;
        }).reduce(function (s, q) { return R.cents(s + RG.periodSales(uid, q.key).net); }, 0);
        var prox = fytd / u.pctRentBreak;
        if (prox > 0.62) {
          flags.push({
            unit: uid, unitName: u.name, module: 'Real Estate & Leases',
            impact: R.cents(Math.max(0, fytd - u.pctRentBreak) * u.pctRentRate),
            severity: prox > 1 ? 'high' : 'low',
            title: prox > 1 ? 'Percentage rent triggered' : 'Approaching percentage-rent breakpoint',
            detail: 'FY-to-date net sales ' + fmt$(fytd) + ' vs. breakpoint ' + fmt$(u.pctRentBreak) +
                    ' (' + fmtPct(prox) + '). Incremental rate ' + fmtPct(u.pctRentRate) + '.',
            link: '/hospitality/leases?unit=' + uid, sources: ['Lease abstract', 'Toast']
          });
        }
      }
      var py = PRIOR_YEAR ? M.unit[uid][PRIOR_YEAR.key] : null;
      if (py && py.netSales) {
        var comp = (cur.netSales - py.netSales) / py.netSales;
        if (comp < 0) {
          flags.push({
            unit: uid, unitName: u.name, module: 'Sales & Traffic',
            impact: R.cents(py.netSales - cur.netSales),
            severity: comp < -0.03 ? 'high' : 'med',
            title: 'Comp sales negative at ' + fmtPct(comp),
            detail: 'Net sales ' + fmt$(cur.netSales) + ' against ' + fmt$(py.netSales) +
                    ' in ' + PRIOR_YEAR.label + '. Covers ' + fmtNum(cur.covers) +
                    ' vs. ' + fmtNum(py.covers) + '.',
            link: '/hospitality/sales?unit=' + uid, sources: [u.pos]
          });
        }
      }
    });
    /* rank by severity first, then dollars — a high-severity $3k problem
       outranks a low-severity $8k one, which is how an operator triages */
    var sevRank = { high: 0, med: 1, low: 2 };
    flags.sort(function (a, b) {
      return (sevRank[a.severity] - sevRank[b.severity]) || (b.impact - a.impact);
    });
    M.flags = flags;

    /* ---- group headline KPIs ---- */
    var g = M.group[CUR.key], gp = M.group[PRIOR.key], gy = M.group[PRIOR_YEAR.key];
    M.kpi = {
      period: CUR.key, label: CUR.label, range: CUR.range,
      netSales: g.netSales,
      netSalesVsPrior: gp ? (g.netSales - gp.netSales) / gp.netSales : null,
      compSales: gy ? (g.netSales - gy.netSales) / gy.netSales : null,
      covers: g.covers,
      coversVsPY: gy ? (g.covers - gy.covers) / gy.covers : null,
      avgCheck: g.avgCheck,
      primePct: g.primePct, primeVsPrior: gp ? g.primePct - gp.primePct : null,
      cogsPct: g.cogsPct, laborPct: g.laborPct,
      fourWall: g.fourWall, fourWallPct: g.fourWallPct,
      fourWallVsPrior: gp ? (g.fourWall - gp.fourWall) / Math.abs(gp.fourWall || 1) : null,
      cogsVariance: g.cogsVariance,
      splh: g.splh,
      ttmSales: TRAILING13.reduce(function (s, p) { return R.cents(s + M.group[p.key].netSales); }, 0),
      ttmFourWall: TRAILING13.reduce(function (s, p) { return R.cents(s + M.group[p.key].fourWall); }, 0)
    };

    return M;
  }

  function driverLabel(k) {
    return { portion: 'portioning', waste: 'waste', spoilage: 'spoilage',
             ppv: 'purchase price', unexplained: 'unexplained shrink' }[k] || k;
  }
  function fmt$(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }
  function fmtNum(n) { return Math.round(n).toLocaleString('en-US'); }

  /* Prefer the precomputed payload when model-precomputed.js is loaded —
     page loads are instant. Fall back to building live, which is what the
     Node verifier and any un-baked page do. */
  var _model = null;
  RG.model = function () {
    if (_model) return _model;
    if (RG.PRECOMPUTED) return (_model = RG.PRECOMPUTED);
    return (_model = build());
  };
  RG.rebuild = function () { return (_model = build()); };
  Object.defineProperty(RG, 'MODEL', { get: function () { return RG.model(); } });
})(typeof window !== 'undefined' ? window : globalThis);
