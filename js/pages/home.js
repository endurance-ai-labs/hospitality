/* Executive Command Center */
(function () {
  RGNav.renderTopbar({ subtitle: 'Operating System' });
  if (!isSignedIn()) return;

  var M = RG.model();
  var scope = RGScope.scope();
  var CUR = scope.period, units = scope.units;
  var prior = RG.CAL.priorPeriod(CUR), py = RG.CAL.priorYear(CUR);
  var cmp = scope.compare;
  var money = can('money'), margins = can('margins');
  var me = currentPersona();

  var BRAND_COLOR = { camino: 'var(--rg-camino)', star: 'var(--rg-star)',
                      catos: 'var(--rg-catos)', bnn: 'var(--rg-bnn)' };

  /* ---- roll the P&L across whatever the scenario bar selected ---- */
  var KEYS = ['grossSales','discounts','comps','netSales','netFood','netBev','cogs','cogsTheo',
    'cogsVariance','labor','laborHours','otCost','primeCost','deliveryFees','cardFees',
    'directOperating','marketing','repairs','utilities','admin','controllables','rent','cam',
    'pctRent','insurance','occupancy','fourWall','ga','net','covers','checks'];
  function roll(pk, ids) {
    var o = {}; KEYS.forEach(function (k) { o[k] = 0; });
    o.cogsDrivers = { portion: 0, waste: 0, spoilage: 0, ppv: 0, unexplained: 0 };
    (ids || units).forEach(function (u) {
      var pl = RG.periodPL(u, pk);
      KEYS.forEach(function (k) { o[k] = RG.rand.cents(o[k] + pl[k]); });
      Object.keys(o.cogsDrivers).forEach(function (d) {
        o.cogsDrivers[d] = RG.rand.cents(o.cogsDrivers[d] + pl.cogsDrivers[d]);
      });
    });
    o.covers = Math.round(o.covers); o.checks = Math.round(o.checks);
    o.avgCheck = o.checks ? RG.rand.cents(o.netSales / o.checks) : 0;
    o.cogsPct = o.netSales ? o.cogs / o.netSales : 0;
    o.laborPct = o.netSales ? o.labor / o.netSales : 0;
    o.primePct = o.netSales ? o.primeCost / o.netSales : 0;
    o.fourWallPct = o.netSales ? o.fourWall / o.netSales : 0;
    o.occPct = o.netSales ? o.occupancy / o.netSales : 0;
    o.splh = o.laborHours ? RG.rand.cents(o.netSales / o.laborHours) : 0;
    return o;
  }

  var g = roll(CUR);
  var t13 = M.trailing13;
  var seriesCache = {};
  function trend(fn) {
    var k = fn.toString();
    if (!seriesCache[k]) seriesCache[k] = t13.map(function (pk) { return fn(roll(pk)); });
    return seriesCache[k];
  }

  /* comparison basis chosen in the scenario bar */
  var basis = RGScope.comparison(CUR, cmp);
  function compareValue(metric) {
    if (!basis) return null;
    if (basis.key) return metric(roll(basis.key));
    if (basis.ttm) {
      var vals = t13.map(function (pk) { return metric(roll(pk)); });
      return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    }
    if (basis.avg || basis.best) {
      var per = units.map(function (u) { return metric(roll(CUR, [u])); });
      if (!per.length) return null;
      return basis.best ? Math.max.apply(null, per)
                        : per.reduce(function (a, b) { return a + b; }, 0) / per.length;
    }
    return null;
  }
  function delta(metric, lowerBetter) {
    var b = compareValue(metric);
    if (b == null || !b) return '';
    var v = metric(g);
    return deltaChip((v - b) / Math.abs(b), { lowerIsBetter: lowerBetter });
  }

  /* ---- KPI tiles ---- */
  function tile(c) {
    return '<div class="kpi-tile" style="--kpi-accent:' + (c.accent || 'var(--color-blue)') + '">' +
      '<div class="kpi-inner">' +
        '<div class="kpi-label">' + esc(c.label) + '</div>' +
        '<div class="kpi-value">' + traced(c.value, c.exp) + '</div>' +
        '<div class="kpi-foot">' + (c.chip || '') +
          (c.sub ? '<span class="kpi-sub">' + esc(c.sub) + '</span>' : '') + '</div>' +
        (c.meter != null ? '<div class="kpi-meter"><i style="width:' +
          Math.max(2, Math.min(100, c.meter * 100)).toFixed(0) + '%"></i></div>' : '') +
      '</div>' +
      (c.spark ? '<span class="kpi-spark">' + c.spark + '</span>' : '') +
      '</div>';
  }

  var basisLabel = basis ? basis.label : 'no comparison';
  var kpis = [
    tile({ label: 'Net sales', value: fmt$(g.netSales), accent: 'var(--color-blue)',
      chip: delta(function (x) { return x.netSales; }), sub: basisLabel,
      spark: sparkArea(trend(function (x) { return x.netSales; }), { color: '#2766d6' }),
      exp: { value: fmt$c(g.netSales),
        formula: 'Σ (item quantity × menu price) − discounts − comps',
        inputs: [['Gross sales', fmt$c(g.grossSales)], ['Discounts', '−' + fmt$c(g.discounts)],
                 ['Comps', '−' + fmt$c(g.comps)], ['Restaurants in scope', fmtNum(units.length)]],
        source: ['Toast', 'Square'], period: periodLabel(CUR) + ' · ' + periodRange(CUR),
        note: 'Built up from item-level PMIX, not entered as a total.', drill: 'Sales & Traffic' } }),

    tile({ label: 'Covers', value: fmtNum(g.covers), accent: '#eb6834',
      chip: delta(function (x) { return x.covers; }), sub: fmt$c(g.avgCheck) + ' avg check',
      spark: sparkArea(trend(function (x) { return x.covers; }), { color: '#eb6834' }),
      exp: { value: fmtNum(g.covers) + ' covers',
        formula: 'dine-in net sales ÷ per-person average, by restaurant',
        inputs: [['Checks', fmtNum(g.checks)], ['Average check', fmt$c(g.avgCheck)]],
        source: ['Toast', 'OpenTable'], period: periodLabel(CUR) } }),

    tile({ label: 'Prime cost', value: fmtPct(g.primePct), accent: g.primePct > 0.62 ? 'var(--color-red)' : 'var(--color-green)',
      chip: delta(function (x) { return x.primePct; }, true), sub: 'target ≤ 62.0%',
      meter: g.primePct / 0.75,
      spark: sparkArea(trend(function (x) { return -x.primePct; }), { color: '#1baf7a' }),
      exp: { value: fmtPct(g.primePct),
        formula: '(cost of goods + total labor) ÷ net sales',
        inputs: [['Cost of goods', fmt$(g.cogs) + '  (' + fmtPct(g.cogsPct) + ')'],
                 ['Total labor', fmt$(g.labor) + '  (' + fmtPct(g.laborPct) + ')'],
                 ['Net sales', fmt$(g.netSales)]],
        source: ['R365', '7shifts'], period: periodLabel(CUR),
        note: 'The number full-service operators actually run the business on.',
        drill: 'P&L by Unit' } }),

    tile({ label: 'Four-wall EBITDA', value: fmt$(g.fourWall), accent: '#eda100',
      chip: delta(function (x) { return x.fourWall; }), sub: fmtPct(g.fourWallPct) + ' margin',
      meter: g.fourWallPct / 0.25,
      spark: sparkArea(trend(function (x) { return x.fourWall; }), { color: '#eda100' }),
      exp: { value: fmt$c(g.fourWall),
        formula: 'net sales − prime cost − controllables − occupancy',
        inputs: [['Net sales', fmt$(g.netSales)], ['Prime cost', '−' + fmt$(g.primeCost)],
                 ['Controllables', '−' + fmt$(g.controllables)], ['Occupancy', '−' + fmt$(g.occupancy)]],
        source: ['QBO', 'Lease'], period: periodLabel(CUR),
        note: 'Before corporate G&A of ' + fmt$(g.ga) + '.', drill: 'P&L by Unit' } }),

    tile({ label: 'Labor', value: fmtPct(g.laborPct), accent: '#e87ba4',
      chip: delta(function (x) { return x.laborPct; }, true), sub: fmt$c(g.splh) + ' per labor hour',
      meter: g.laborPct / 0.45,
      spark: sparkArea(trend(function (x) { return -x.laborPct; }), { color: '#e87ba4' }),
      exp: { value: fmtPct(g.laborPct),
        formula: 'total labor ÷ net sales',
        inputs: [['Wages + salaries + burden', fmt$(g.labor)], ['Hours', fmtNum(g.laborHours, 0)],
                 ['Overtime', fmt$(g.otCost)], ['SPLH', fmt$c(g.splh)]],
        source: ['7shifts', 'ADP'], period: periodLabel(CUR), drill: 'Labor & Scheduling' } })
  ];

  if (margins) kpis.push(tile({
    label: 'Food variance', value: fmt$(g.cogsVariance), accent: 'var(--color-red)',
    chip: delta(function (x) { return x.cogsVariance; }, true),
    sub: fmtPct(g.cogsVariance / (g.cogsTheo || 1)) + ' of theoretical',
    spark: sparkArea(trend(function (x) { return -x.cogsVariance; }), { color: '#C96B57' }),
    exp: { value: fmt$c(g.cogsVariance),
      formula: 'actual cost of goods − theoretical cost from recipes and PMIX',
      inputs: Object.keys(g.cogsDrivers).map(function (k) {
        return [k, fmt$(g.cogsDrivers[k])];
      }), source: ['R365', 'Sysco'], period: periodLabel(CUR),
      note: 'The five drivers sum to the variance exactly.', drill: 'Food & Beverage Cost' } }));

  /* ---- charts ---- */
  var trendChart = RGChart.line('c-trend', {
    labels: t13.map(function (k) { return periodLabel(k).replace('FY', ''); }),
    series: [
      { label: 'Net sales', data: trend(function (x) { return x.netSales; }), fill: true },
      { label: 'Prime cost', data: trend(function (x) { return x.primeCost; }) },
      { label: 'Four-wall EBITDA', data: trend(function (x) { return x.fourWall; }) }
    ], height: 280
  });

  var costChart = RGChart.doughnut('c-cost', {
    labels: ['Cost of goods', 'Labor', 'Controllables', 'Occupancy', 'Four-wall EBITDA'],
    data: [g.cogs, g.labor, g.controllables, g.occupancy, Math.max(0, g.fourWall)],
    height: 250
  });

  var byUnit = units.map(function (u) { return { u: u, pl: RG.periodPL(u, CUR) }; })
    .sort(function (a, b) { return b.pl.fourWallPct - a.pl.fourWallPct; });
  var marginChart = RGChart.bar('c-margin', {
    labels: byUnit.map(function (r) { return RG.unitById[r.u].short; }),
    series: [{ label: 'Four-wall margin', data: byUnit.map(function (r) { return r.pl.fourWallPct; }),
               colors: byUnit.map(function (r) {
                 return r.pl.fourWallPct >= 0.15 ? '#1baf7a' : r.pl.fourWallPct >= 0.09 ? '#eda100' : '#eb6834';
               }) }],
    pct: true, horizontal: true, height: 270, legend: false
  });

  /* daily pace across the period */
  var days = RG.CAL.daysIn(CUR);
  var dayLabels = [], dayNet = [], dayPY = [];
  days.forEach(function (d) {
    var n = 0, p = 0, open = false;
    units.forEach(function (u) {
      var s = RG.daySales(u, d.iso); if (!s.closed) { open = true; n += s.net; }
      var pyd = RG.CAL.priorYearDay(d.iso);
      if (pyd) p += RG.daySales(u, pyd.iso).net;
    });
    if (!open) return;
    dayLabels.push(RG.CAL.usDate(d.iso).slice(0, 5));
    dayNet.push(RG.rand.cents(n)); dayPY.push(RG.rand.cents(p));
  });
  var paceChart = RGChart.line('c-pace', {
    labels: dayLabels,
    series: [
      { label: 'This period', data: dayNet, fill: true },
      { label: 'Same days last year', data: dayPY, dashed: true, color: '#8b93a3' }
    ], height: 260
  });

  /* ---- triage ---- */
  var flags = M.flags.filter(function (f) { return units.indexOf(f.unit) >= 0; });
  var triage = flags.length ? flags.map(function (f) {
    return '<a class="triage-item ' + f.severity + '" href="' + f.link + '">' +
      '<span class="triage-bar"></span><div>' +
      '<div class="triage-head"><span class="triage-title">' + esc(f.title) + '</span>' +
      pill(f.unitName, f.severity === 'high' ? 'bad' : f.severity === 'med' ? 'warn' : 'info') + '</div>' +
      '<div class="triage-detail">' + esc(f.detail) + '</div>' +
      '<div class="triage-meta"><span style="font-size:10.5px;color:var(--color-slate-hint)">' +
      esc(f.module) + '</span>' + srcChips.apply(null, f.sources) + '</div></div>' +
      '<div class="triage-impact"><b>' + fmt$(f.impact) + '</b><span>impact</span></div></a>';
  }).join('') : '<div style="padding:24px;text-align:center;color:var(--color-text-muted);font-size:13px">' +
      'Nothing above threshold in this scope.</div>';

  /* ---- leaderboard ---- */
  var lbRows = M.scorecard.filter(function (s) { return units.indexOf(s.unit) >= 0; })
    .map(function (s) {
    var u = RG.unitById[s.unit];
    var cls = s.rank === 1 ? 'top' : (s.rank === M.scorecard.length ? 'bottom' : '');
    return '<tr>' +
      '<td><span class="rank-badge ' + cls + '">' + s.rank + '</span></td>' +
      '<td class="unit-cell"><span class="brand-dot" style="background:' + BRAND_COLOR[s.brand] + '"></span>' +
        '<b>' + esc(s.name) + '</b><span>' + esc(u.city) + ', ' + esc(u.state) + ' · ' + esc(u.pos) + '</span></td>' +
      '<td>' + esc(RG.BRANDS.filter(function (b) { return b.id === s.brand; })[0].name) + '</td>' +
      '<td>' + esc(u.region) + '</td>' +
      '<td class="num">' + traced(fmt$(s.netSales), {
          value: fmt$c(s.netSales), formula: 'Σ item quantity × menu price − discounts − comps',
          inputs: [['Covers', fmtNum(s.covers)], ['Average check', fmt$c(s.avgCheck)],
                   ['Sales per seat', fmt$(s.salesPerSeat)]],
          source: [u.pos], period: periodLabel(CUR), drill: s.name }) + '</td>' +
      '<td class="num">' + (s.compPct == null ? '—' : deltaChip(s.compPct)) + '</td>' +
      '<td class="num">' + fmtNum(s.covers) + '</td>' +
      (margins ? '<td class="num">' + fmtPct(s.cogsPct) + '</td>' : '') +
      (margins ? '<td class="num">' + fmtPct(s.laborPct) + '</td>' : '') +
      (margins ? '<td class="num"><b>' + fmtPct(s.primePct) + '</b></td>' : '') +
      (money ? '<td class="num">' + fmt$(s.fourWall) + '</td>' : '') +
      (money ? '<td class="num">' + fmtPct(s.fourWallPct) + '</td>' : '') +
      '</tr>';
  }).join('');

  var closeChain = approvalChain('close-' + CUR, [
    { person: 'gm-grand', label: 'Unit counts submitted', doneLabel: 'Unit counts submitted',
      nudge: 'Inventory counts are needed before cost of goods can be locked.' },
    { person: 'rvillalobos', label: 'Recipe & waste review', doneLabel: 'Recipe and waste review complete',
      nudge: 'Theoretical-vs-actual variance needs a culinary sign-off.' },
    { person: 'dnakamura', label: 'Controller review & GL post', doneLabel: 'Posted to the general ledger',
      nudge: 'Period close is waiting on the GL post.' },
    { person: 'sorr', label: 'Executive sign-off', doneLabel: 'Period closed',
      nudge: 'Final sign-off closes the period.' }
  ]);

  document.getElementById('app').innerHTML =
    '<div class="section-head">' +
      '<div><h1 style="font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0">Executive Command Center</h1>' +
      '<div class="sub">' + esc(periodLabel(CUR)) + ' · ' + esc(periodRange(CUR)) + ' · ' +
      units.length + ' of ' + RG.UNITS.length + ' restaurants · signed in as ' + esc(me.name) + '</div></div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      srcChips('Toast', 'Square', '7shifts', 'R365', 'QBO') + '</div>' +
    '</div>' +
    RGScope.render() +
    '<div class="kpi-band">' + kpis.join('') + '</div>' +

    card({ title: 'Needs attention',
      sub: 'Ranked by severity then dollar impact across every module. ' + flags.length + ' open.',
      tools: pill('live triage', 'info'), body: '<div class="triage">' + triage + '</div>' }) +

    '<div class="chart-grid-2">' +
      card({ title: 'Trailing 13 periods', sub: 'Sales against prime cost and four-wall EBITDA — one axis, three measures of the same unit',
        sources: ['QBO', 'R365'], body: trendChart }) +
      card({ title: 'Daily pace', sub: 'Every trading day this period against the same day last year',
        sources: ['Toast', 'Square'], body: paceChart }) +
    '</div>' +

    '<div class="chart-grid-2">' +
      card({ title: 'Where the sales dollar goes', sub: 'Cost structure for ' + esc(periodLabel(CUR)),
        sources: ['R365', '7shifts', 'QBO'],
        body: costChart +
          '<div class="chart-note">Each slice is a real P&amp;L line. Four-wall EBITDA is what survives ' +
          'before corporate G&amp;A of ' + fmt$(g.ga) + '.</div>' }) +
      card({ title: 'Four-wall margin by restaurant', sub: 'Ranked; green clears 15%, amber clears 9%',
        sources: ['QBO'], body: marginChart }) +
    '</div>' +

    '<div class="chart-grid-2">' +
      card({ title: 'Period close', sub: esc(periodLabel(CUR)) + ' · four-step chain, role-locked',
        sources: ['R365', 'QBO'], body: closeChain }) +
      card({ title: 'Scope summary', sub: 'What the scenario bar is currently showing',
        body: '<div style="padding:2px 0">' +
          [['Restaurants', units.length + ' of ' + RG.UNITS.length],
           ['Period', periodLabel(CUR) + ' · ' + periodRange(CUR)],
           ['Comparison basis', basisLabel],
           ['Net sales in scope', fmt$(g.netSales)],
           ['Covers in scope', fmtNum(g.covers)],
           ['Active dimension filters', scope.dims.length ? scope.dims.map(function (d) {
              return d.label + ' = ' + d.value; }).join(', ') : 'none']
          ].map(function (r) {
            return '<div style="display:flex;justify-content:space-between;gap:14px;padding:9px 0;' +
              'border-bottom:1px solid var(--glass-border);font-size:12.5px">' +
              '<span style="color:var(--color-text-muted)">' + esc(r[0]) + '</span>' +
              '<b style="font-variant-numeric:tabular-nums;text-align:right">' + esc(String(r[1])) + '</b></div>';
          }).join('') + '</div>' +
          '<div class="chart-note">Every exhibit on this page reads this one scope, so no two panels ' +
          'can answer different questions. The scope is in the URL — this view is a shareable link.</div>' }) +
    '</div>' +

    card({ title: 'Unit leaderboard',
      sub: 'Composite score weighs four-wall margin, comp growth and cost control. Sort any column; filter below.',
      tools: gridTools('lb', 'Unit leaderboard ' + CUR),
      body: table({ id: 'lb',
        cols: [{ label: '#' }, { label: 'Restaurant' }, { label: 'Brand' }, { label: 'Region' },
               { label: 'Net sales', num: true }, { label: 'Comp', num: true },
               { label: 'Covers', num: true }]
          .concat(margins ? [{ label: 'COGS', num: true }, { label: 'Labor', num: true },
                             { label: 'Prime', num: true }] : [])
          .concat(money ? [{ label: 'Four-wall', num: true }, { label: 'Margin', num: true }] : []),
        rows: [lbRows],
        foot: '<tr><td></td><td><b>Scope total</b></td><td></td><td></td>' +
          '<td class="num"><b>' + fmt$(g.netSales) + '</b></td><td></td>' +
          '<td class="num"><b>' + fmtNum(g.covers) + '</b></td>' +
          (margins ? '<td class="num"><b>' + fmtPct(g.cogsPct) + '</b></td>' +
            '<td class="num"><b>' + fmtPct(g.laborPct) + '</b></td>' +
            '<td class="num"><b>' + fmtPct(g.primePct) + '</b></td>' : '') +
          (money ? '<td class="num"><b>' + fmt$(g.fourWall) + '</b></td>' +
            '<td class="num"><b>' + fmtPct(g.fourWallPct) + '</b></td>' : '') + '</tr>' }) }) +

    pageFoot();

  RGChart.flush();
  RGFilter.autoAttachAll();
})();
