/* P&L by Unit — restaurant-industry format */
renderPage('P&L by Unit', 'Restaurant format, drillable to source', ['QBO', 'R365', '7shifts', 'Lease'], function () {
  if (!can('money')) return card({ title: 'Restricted',
    body: '<div style="padding:20px;color:var(--color-text-muted)">The profit and loss statement is ' +
      'limited to finance and executive roles. You are signed in as ' +
      esc(currentPersona().title) + '.</div>' });

  var P = activePeriod(), units = activeUnits();
  var prior = RG.CAL.priorPeriod(P), py = RG.CAL.priorYear(P);

  function roll(pk, ids) {
    var keys = ['grossSales','discounts','comps','netSales','netFood','netBev','cogsFood','cogsBev','cogs',
      'cogsTheo','cogsVariance','wages','mgrSalary','payrollBurden','labor','laborHours','otCost',
      'breakPremiums','primeCost','deliveryFees','cardFees','directOperating','marketing','repairs',
      'admin','utilities','controllables','rent','cam','pctRent','insurance','occupancy','fourWall','ga','net','covers'];
    var o = {}; keys.forEach(function (k) { o[k] = 0; });
    ids.forEach(function (u) {
      var pl = RG.periodPL(u, pk);
      keys.forEach(function (k) { o[k] = RG.rand.cents(o[k] + pl[k]); });
    });
    return o;
  }
  var cur = roll(P, units);
  var pri = prior ? roll(prior.key, units) : null;
  var lyr = py ? roll(py.key, units) : null;

  /* the statement, in the order an operator reads it */
  var LINES = [
    ['h', 'Sales'],
    ['l', 'Food sales', 'netFood', 'Toast'],
    ['l', 'Beverage sales', 'netBev', 'Toast'],
    ['s', 'Net sales', 'netSales'],
    ['h', 'Cost of goods sold'],
    ['l', 'Food cost', 'cogsFood', 'R365'],
    ['l', 'Beverage cost', 'cogsBev', 'R365'],
    ['s', 'Total cost of goods', 'cogs'],
    ['h', 'Labor'],
    ['l', 'Hourly wages', 'wages', '7shifts'],
    ['l', 'Management salaries', 'mgrSalary', 'ADP'],
    ['l', 'Payroll taxes & benefits', 'payrollBurden', 'ADP'],
    ['s', 'Total labor', 'labor'],
    ['S', 'PRIME COST', 'primeCost'],
    ['h', 'Controllable expenses'],
    ['l', 'Delivery commissions', 'deliveryFees', 'Deliverect'],
    ['l', 'Credit card fees', 'cardFees', 'Plaid'],
    ['l', 'Direct operating', 'directOperating', 'QBO'],
    ['l', 'Marketing', 'marketing', 'QBO'],
    ['l', 'Repairs & maintenance', 'repairs', 'QBO'],
    ['l', 'Utilities', 'utilities', 'QBO'],
    ['l', 'Administrative & general', 'admin', 'QBO'],
    ['s', 'Total controllables', 'controllables'],
    ['h', 'Occupancy'],
    ['l', 'Base rent', 'rent', 'Lease'],
    ['l', 'CAM & triple net', 'cam', 'Lease'],
    ['l', 'Percentage rent', 'pctRent', 'Lease'],
    ['l', 'Insurance', 'insurance', 'QBO'],
    ['s', 'Total occupancy', 'occupancy'],
    ['S', 'FOUR-WALL EBITDA', 'fourWall'],
    ['l', 'Corporate G&A allocation', 'ga', 'QBO'],
    ['S', 'NET PROFIT', 'net']
  ];

  var FORMULA = {
    netSales: 'gross sales − discounts − comps',
    cogs: 'food cost + beverage cost, at actual',
    labor: 'hourly wages + management salaries + payroll burden',
    primeCost: 'cost of goods + total labor',
    controllables: 'delivery + card fees + direct operating + marketing + repairs + utilities + admin',
    occupancy: 'base rent + CAM + percentage rent + insurance',
    fourWall: 'net sales − prime cost − controllables − occupancy',
    net: 'four-wall EBITDA − corporate G&A allocation',
    cogsFood: 'theoretical food cost + its share of the five variance drivers',
    wages: 'Σ (hours × rate) + overtime premium + California break premiums',
    payrollBurden: 'wages and salaries × ' + fmtPct(RG.PL_RATES.payrollBurden),
    deliveryFees: 'delivery channel gross × 23.8% blended marketplace take rate',
    cardFees: 'net sales × ' + fmtPct(RG.PL_RATES.cardShare) + ' card share × ' + fmtPct(RG.PL_RATES.cardFeeRate),
    pctRent: 'fiscal-year-to-date net sales above the lease breakpoint × the percentage rate',
    utilities: 'square feet × rate per period, with a seasonal swing'
  };

  var plRows = LINES.map(function (L) {
    if (L[0] === 'h') {
      return '<tr class="pl-head"><td colspan="7" style="padding-top:14px;font-size:10px;' +
        'letter-spacing:.1em;text-transform:uppercase;color:var(--color-slate-hint);font-weight:800">' +
        esc(L[1]) + '</td></tr>';
    }
    var k = L[2], v = cur[k];
    var pv = pri ? pri[k] : null, lv = lyr ? lyr[k] : null;
    var pctSales = cur.netSales ? v / cur.netSales : 0;
    var bold = L[0] === 'S', sub = L[0] === 's';
    var style = bold ? 'font-weight:800;border-top:1.5px solid var(--glass-border)' :
                sub ? 'font-weight:700' : '';
    var cell = FORMULA[k] ? traced(fmt$(v), {
      value: fmt$c(v), formula: FORMULA[k],
      inputs: [['% of net sales', fmtPct(pctSales)],
               ['Prior period', pv == null ? '—' : fmt$(pv)],
               ['Same period last year', lv == null ? '—' : fmt$(lv)]],
      source: [L[3] || 'Model'], period: periodLabel(P),
      drill: k === 'cogs' || k === 'cogsFood' ? 'Food & Beverage Cost' :
             k === 'labor' || k === 'wages' ? 'Labor & Scheduling' :
             k === 'pctRent' || k === 'rent' ? 'Real Estate & Leases' : '' }) : fmt$(v);
    return '<tr style="' + style + '"><td>' + (sub || bold ? '<b>' + esc(L[1]) + '</b>' : esc(L[1])) + '</td>' +
      '<td class="num">' + cell + '</td>' +
      '<td class="num">' + fmtPct(pctSales) + '</td>' +
      '<td class="num">' + (pv == null ? '—' : fmt$(pv)) + '</td>' +
      '<td class="num">' + (pv == null || !pv ? '—' :
        deltaChip((v - pv) / Math.abs(pv), { lowerIsBetter: k !== 'netSales' && k !== 'netFood' &&
          k !== 'netBev' && k !== 'fourWall' && k !== 'net' })) + '</td>' +
      '<td class="num">' + (lv == null ? '—' : fmt$(lv)) + '</td>' +
      '<td>' + (L[3] ? srcChip(L[3]) : '') + '</td></tr>';
  }).join('');

  /* ---- unit comparison ---- */
  var cmpRows = myUnits().map(function (u) {
    var pl = RG.periodPL(u, P);
    var un = RG.unitById[u];
    return '<tr><td class="unit-cell"><b>' + esc(un.name) + '</b><span>' + esc(un.city) + '</span></td>' +
      '<td class="num">' + fmt$(pl.netSales) + '</td>' +
      '<td class="num">' + fmtPct(pl.cogsPct) + '</td>' +
      '<td class="num">' + fmtPct(pl.laborPct) + '</td>' +
      '<td class="num"><b>' + fmtPct(pl.primePct) + '</b></td>' +
      '<td class="num">' + fmtPct(pl.occupancyPct) + '</td>' +
      '<td class="num">' + fmt$(pl.fourWall) + '</td>' +
      '<td style="width:16%"><div class="rg-bar"><i class="' +
        (pl.fourWallPct > 0.15 ? 'good' : pl.fourWallPct > 0.09 ? '' : 'bad') + '" style="width:' +
        Math.min(100, pl.fourWallPct / 0.22 * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num"><b>' + fmtPct(pl.fourWallPct) + '</b></td></tr>';
  }).join('');

  /* ---- profit bridge ---- */
  var pb = prior ? RG.profitBridge(prior.key, P) : null;

  /* ---- 13-period trend ---- */
  var trend = RG.model().trailing13.map(function (k) {
    var r = roll(k, units);
    return '<tr><td>' + esc(periodLabel(k)) + '<div style="font-size:10px;color:var(--color-slate-hint)">' +
      esc(periodRange(k)) + '</div></td>' +
      '<td class="num">' + fmt$(r.netSales) + '</td>' +
      '<td class="num">' + fmtPct(r.cogs / r.netSales) + '</td>' +
      '<td class="num">' + fmtPct(r.labor / r.netSales) + '</td>' +
      '<td class="num">' + fmtPct(r.primeCost / r.netSales) + '</td>' +
      '<td class="num">' + fmt$(r.fourWall) + '</td>' +
      '<td class="num">' + fmtPct(r.fourWall / r.netSales) + '</td></tr>';
  }).join('');

  /* ---- financial exhibits ---- */
  var t13 = RG.model().trailing13;
  var t13Rows = t13.map(function (k) { return roll(k, units); });
  var lab13 = t13.map(function (k) { return periodLabel(k).replace('FY', ''); });

  var chartPL = RGChart.line('f-pl', {
    labels: lab13,
    series: [
      { label: 'Net sales', data: t13Rows.map(function (r) { return r.netSales; }), fill: true },
      { label: 'Prime cost', data: t13Rows.map(function (r) { return r.primeCost; }) },
      { label: 'Controllables', data: t13Rows.map(function (r) { return r.controllables; }) },
      { label: 'Occupancy', data: t13Rows.map(function (r) { return r.occupancy; }) },
      { label: 'Four-wall EBITDA', data: t13Rows.map(function (r) { return r.fourWall; }) }
    ], height: 300
  });

  var chartRatio = RGChart.line('f-ratio', {
    labels: lab13, pct: true,
    series: [
      { label: 'COGS %', data: t13Rows.map(function (r) { return r.cogs / r.netSales; }) },
      { label: 'Labor %', data: t13Rows.map(function (r) { return r.labor / r.netSales; }) },
      { label: 'Prime %', data: t13Rows.map(function (r) { return r.primeCost / r.netSales; }) },
      { label: 'Four-wall %', data: t13Rows.map(function (r) { return r.fourWall / r.netSales; }) }
    ], height: 300
  });

  var chartStack = RGChart.bar('f-stack', {
    labels: lab13, stacked: true,
    series: [
      { label: 'Cost of goods', data: t13Rows.map(function (r) { return r.cogs; }) },
      { label: 'Labor', data: t13Rows.map(function (r) { return r.labor; }) },
      { label: 'Controllables', data: t13Rows.map(function (r) { return r.controllables; }) },
      { label: 'Occupancy', data: t13Rows.map(function (r) { return r.occupancy; }) },
      { label: 'Four-wall EBITDA', data: t13Rows.map(function (r) { return Math.max(0, r.fourWall); }) }
    ], height: 300
  });

  var unitBars = myUnits().map(function (u) { return { u: u, pl: RG.periodPL(u, P) }; })
    .sort(function (a, b) { return b.pl.fourWall - a.pl.fourWall; });
  var chartUnits = RGChart.bar('f-units', {
    labels: unitBars.map(function (r) { return RG.unitById[r.u].short; }),
    series: [
      { label: 'Four-wall EBITDA', data: unitBars.map(function (r) { return r.pl.fourWall; }) },
      { label: 'Occupancy', data: unitBars.map(function (r) { return r.pl.occupancy; }) }
    ], height: 300
  });

  var controlSplit = RGChart.doughnut('f-ctrl', {
    labels: ['Delivery commission', 'Card fees', 'Direct operating', 'Marketing', 'Repairs', 'Utilities', 'Admin'],
    data: [cur.deliveryFees, cur.cardFees, cur.directOperating, cur.marketing,
           cur.repairs, cur.utilities, cur.admin],
    height: 250
  });

  var exhibits =
    '<div class="chart-grid-2">' +
      card({ title: 'P&L lines over 13 periods',
        sub: 'One axis, five measures in the same unit — no dual scales',
        sources: ['QBO'], body: chartPL }) +
      card({ title: 'Cost ratios over 13 periods',
        sub: 'The same story as a share of sales, which is how it is managed',
        sources: ['QBO', 'R365'], body: chartRatio }) +
    '</div>' +
    '<div class="chart-grid-2">' +
      card({ title: 'Where every sales dollar went', sub: 'Stacked by period — the bar height is net sales',
        sources: ['QBO'], body: chartStack }) +
      card({ title: 'Profit against occupancy by restaurant',
        sub: 'Ranked by four-wall EBITDA for ' + esc(periodLabel(P)),
        sources: ['QBO', 'Lease'], body: chartUnits }) +
    '</div>' +
    '<div class="chart-grid-2">' +
      card({ title: 'Controllable expense split', sub: esc(periodLabel(P)) + ' · ' + fmt$(cur.controllables) + ' total',
        sources: ['QBO'], body: controlSplit }) +
      card({ title: 'Flow-through', sub: 'Incremental profit on incremental sales — the test of operating leverage',
        sources: ['QBO'],
        body: (function () {
          var rows = [];
          for (var i = 1; i < t13Rows.length; i++) {
            var ds = t13Rows[i].netSales - t13Rows[i - 1].netSales;
            var dp = t13Rows[i].fourWall - t13Rows[i - 1].fourWall;
            rows.push({ k: lab13[i], ds: ds, dp: dp, ft: ds ? dp / ds : 0 });
          }
          return table({ id: 'ft', cols: [{ label: 'Period' }, { label: 'Δ net sales', num: true },
            { label: 'Δ four-wall', num: true }, { label: 'Flow-through', num: true }],
            rows: [rows.map(function (r) {
              return '<tr><td><b>' + esc(r.k) + '</b></td>' +
                '<td class="num">' + fmt$(r.ds) + '</td>' +
                '<td class="num">' + fmt$(r.dp) + '</td>' +
                '<td class="num">' + (Math.abs(r.ds) < 1000 ? '—' :
                  '<span class="chip ' + (r.ft > 0.25 ? 'chip-good' : r.ft > 0 ? 'chip-flat' : 'chip-bad') +
                  '">' + fmtPct(r.ft) + '</span>') + '</td></tr>';
            }).join('')] }) +
            '<div class="chart-note">Healthy full-service flow-through runs 25–35%. Below zero means ' +
            'sales grew and profit did not — usually labor or food cost moving faster than volume.</div>';
        })() }) +
    '</div>';

  return '<div class="stat-row">' +
    [['Net sales', fmt$(cur.netSales), pri ? fmtPct((cur.netSales - pri.netSales) / pri.netSales) + ' vs. prior' : ''],
     ['Prime cost', fmtPct(cur.primeCost / cur.netSales), 'target ≤ 62.0%'],
     ['Four-wall EBITDA', fmt$(cur.fourWall), fmtPct(cur.fourWall / cur.netSales) + ' margin'],
     ['Occupancy', fmtPct(cur.occupancy / cur.netSales), 'of net sales'],
     ['Net profit', fmt$(cur.net), 'after G&A allocation'],
     ['Flow-through', pri && (cur.netSales - pri.netSales) ?
        fmtPct((cur.fourWall - pri.fourWall) / (cur.netSales - pri.netSales)) : '—',
        'incremental profit on incremental sales']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    exhibits +
    (pb ? card({ title: 'Why profit moved', sub: periodLabel(prior.key) + ' → ' + periodLabel(P) +
      '. These five lines are exhaustive — nothing sits between net sales and four-wall EBITDA that is not here.',
      sources: ['QBO', 'R365', '7shifts'],
      body: waterfall([
        ['Sales flow-through', pb.parts.sales], ['Cost of goods', pb.parts.cogs],
        ['Labor', pb.parts.labor], ['Controllables', pb.parts.controllables],
        ['Occupancy', pb.parts.occupancy]
      ], pb.total, 'Change in four-wall EBITDA') }) : '') +

    card({ title: 'Profit & loss statement',
      sub: 'Restaurant format · ' + esc(periodLabel(P)) + ' · hover any figure for its derivation',
      tools: gridTools('pl', 'P&L ' + P), sources: ['QBO', 'R365'],
      body: table({ id: 'pl',
        cols: [{ label: '' }, { label: periodLabel(P), num: true }, { label: '% sales', num: true },
               { label: prior ? periodLabel(prior.key) : '—', num: true }, { label: 'Δ', num: true },
               { label: py ? periodLabel(py.key) : '—', num: true }, { label: 'Source' }],
        rows: [plRows] }) }) +

    card({ title: 'All restaurants', sub: 'Same period, ranked structure', sources: ['QBO'],
      tools: gridTools('cmp', 'Unit P&L comparison ' + P),
      body: table({ id: 'cmp', cols: [{ label: 'Restaurant' }, { label: 'Net sales', num: true },
        { label: 'COGS', num: true }, { label: 'Labor', num: true }, { label: 'Prime', num: true },
        { label: 'Occupancy', num: true }, { label: 'Four-wall', num: true }, { label: '' },
        { label: 'Margin', num: true }], rows: [cmpRows] }) }) +

    card({ title: 'Trailing 13 periods', sub: 'A full fiscal year of comparable four-week periods',
      tools: gridTools('trend', 'P&L trend'), sources: ['QBO'],
      body: table({ id: 'trend', cols: [{ label: 'Period' }, { label: 'Net sales', num: true },
        { label: 'COGS', num: true }, { label: 'Labor', num: true }, { label: 'Prime', num: true },
        { label: 'Four-wall', num: true }, { label: 'Margin', num: true }], rows: [trend] }) });
});
