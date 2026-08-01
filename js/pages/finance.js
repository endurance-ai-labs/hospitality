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
