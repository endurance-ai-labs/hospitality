/* Real Estate & Leases */
renderPage('Real Estate & Leases', 'Occupancy cost, percentage rent and option deadlines',
  ['Lease', 'QBO', 'Toast'], function () {
  if (!can('money')) return card({ title: 'Restricted',
    body: '<div style="padding:20px;color:var(--color-text-muted)">Lease economics are limited to ' +
      'finance and executive roles.</div>' });

  var P = activePeriod(), units = myUnits();
  var p = RG.CAL.periodByKey[P];

  function fytd(u) {
    return RG.CAL.PERIODS.filter(function (q) { return q.fy === p.fy && q.period <= p.period; })
      .reduce(function (s, q) { return RG.rand.cents(s + RG.periodSales(u, q.key).net); }, 0);
  }

  var rows = units.map(function (u) {
    var un = RG.unitById[u];
    var pl = RG.periodPL(u, P);
    var ytd = fytd(u);
    var prox = un.pctRentBreak ? ytd / un.pctRentBreak : null;
    var daysToExpiry = Math.round((RG.CAL.toTs(un.leaseEnd) - RG.CAL.toTs(RG.CAL.TODAY)) / 86400000);
    var yearsToExpiry = daysToExpiry / 365;
    return { u: u, un: un, pl: pl, ytd: ytd, prox: prox,
      yearsToExpiry: yearsToExpiry, annualOcc: RG.rand.cents(pl.occupancy * 13),
      rentPerSqft: RG.rand.cents(un.rent * 12 / un.sqft) };
  });

  var totalOcc = rows.reduce(function (a, r) { return RG.rand.cents(a + r.pl.occupancy); }, 0);
  var totalSales = rows.reduce(function (a, r) { return RG.rand.cents(a + r.pl.netSales); }, 0);

  var leaseRows = rows.map(function (r) {
    var expTone = r.yearsToExpiry < 1.5 ? 'bad' : r.yearsToExpiry < 3 ? 'warn' : 'neutral';
    return '<tr><td class="unit-cell"><b>' + esc(r.un.name) + '</b>' +
      '<span>' + esc(r.un.corridor) + ', ' + esc(r.un.city) + '</span></td>' +
      '<td class="num">' + fmtNum(r.un.sqft) + '</td>' +
      '<td class="num">' + fmt$(r.un.rent) + '</td>' +
      '<td class="num">' + fmt$c(r.rentPerSqft) + '</td>' +
      '<td class="num">' + traced(fmtPct(r.pl.occupancyPct), {
        value: fmtPct(r.pl.occupancyPct) + ' of net sales',
        formula: '(base rent + CAM + percentage rent + insurance) ÷ net sales',
        inputs: [['Base rent', fmt$(r.pl.rent)], ['CAM & triple net', fmt$(r.pl.cam)],
                 ['Percentage rent', fmt$(r.pl.pctRent)], ['Insurance', fmt$(r.pl.insurance)],
                 ['Net sales', fmt$(r.pl.netSales)]],
        source: ['Lease', 'QBO'], period: periodLabel(P),
        note: 'Above roughly 10% of sales, occupancy starts dictating the P&L rather than following it.' }) + '</td>' +
      '<td>' + usDate(r.un.leaseEnd) + '<div style="font-size:10px;color:var(--color-slate-hint)">' +
        esc(r.un.options) + '</div></td>' +
      '<td>' + pill(r.yearsToExpiry.toFixed(1) + ' yrs', expTone) + '</td>' +
      '<td>' + (r.prox == null ? '<span style="color:var(--color-slate-hint)">none</span>' :
        pill(fmtPct(r.prox), r.prox > 1 ? 'bad' : r.prox > 0.8 ? 'warn' : 'info')) + '</td></tr>';
  }).join('');

  /* percentage-rent detail */
  var pctUnits = rows.filter(function (r) { return r.un.pctRentBreak; });
  var pctHtml = pctUnits.length ? pctUnits.map(function (r) {
    var over = Math.max(0, r.ytd - r.un.pctRentBreak);
    var remaining = Math.max(0, r.un.pctRentBreak - r.ytd);
    var periodsLeft = 13 - p.period;
    var runRate = RG.rand.cents(r.pl.netSales * periodsLeft);
    var willTrigger = r.ytd + runRate > r.un.pctRentBreak;
    return '<div style="padding:16px 0;border-bottom:1px solid var(--glass-border)">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
      '<b style="font-size:14px">' + esc(r.un.name) + '</b>' +
      pill(fmtPct(r.un.pctRentRate) + ' above breakpoint', 'info') +
      (r.prox > 1 ? pill('triggered', 'bad') : willTrigger ? pill('will trigger', 'warn') : pill('clear', 'good')) +
      '</div>' +
      '<div class="rg-bar" style="height:14px;margin-bottom:8px"><i class="' +
        (r.prox > 1 ? 'bad' : r.prox > 0.8 ? 'warn' : '') + '" style="width:' +
        Math.min(100, r.prox * 100).toFixed(1) + '%"></i></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;font-size:12px">' +
      [['FY-to-date net sales', fmt$(r.ytd)], ['Breakpoint', fmt$(r.un.pctRentBreak)],
       [over ? 'Sales above breakpoint' : 'Headroom remaining', fmt$(over || remaining)],
       ['Percentage rent accrued', fmt$(r.pl.pctRent)],
       ['Projected FY sales', fmt$(RG.rand.cents(r.ytd + runRate))],
       ['Cost of the next $100k', fmt$(RG.rand.cents(100000 * r.un.pctRentRate))]
      ].map(function (x) {
        return '<div><div style="font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;' +
          'color:var(--color-slate-hint)">' + esc(x[0]) + '</div><b style="font-variant-numeric:tabular-nums">' +
          x[1] + '</b></div>';
      }).join('') + '</div></div>';
  }).join('') : '<div style="padding:20px;color:var(--color-text-muted)">No unit in scope carries a ' +
    'percentage-rent clause.</div>';

  /* option calendar */
  var calRows = rows.slice().sort(function (a, b) { return a.yearsToExpiry - b.yearsToExpiry; })
    .map(function (r) {
      var decisionBy = RG.CAL.iso(RG.CAL.toTs(r.un.leaseEnd) - 270 * 86400000);
      var urgent = r.yearsToExpiry < 2;
      return '<tr><td class="unit-cell"><b>' + esc(r.un.name) + '</b><span>' + esc(r.un.city) + '</span></td>' +
        '<td>' + usDate(r.un.leaseEnd) + '</td>' +
        '<td>' + usDate(decisionBy) + '</td>' +
        '<td>' + esc(r.un.options) + '</td>' +
        '<td class="num">' + fmtPct(r.pl.fourWallPct) + '</td>' +
        '<td class="num">' + fmt$(RG.rand.cents(r.pl.fourWall * 13)) + '</td>' +
        '<td>' + (r.un.options === 'none — renewal decision due'
          ? pill('negotiate now', 'bad')
          : r.pl.fourWallPct > 0.13 ? pill('exercise', 'good')
          : urgent ? pill('review', 'warn') : pill('monitor', 'neutral')) + '</td></tr>';
    }).join('');

  return '<div class="stat-row">' +
    [['Occupancy cost', fmt$(totalOcc), 'this period'],
     ['As % of sales', fmtPct(totalOcc / (totalSales || 1)), 'target ≤ 9.0%'],
     ['Annualised', fmt$(RG.rand.cents(totalOcc * 13)), '13 periods'],
     ['Units with % rent', fmtNum(pctUnits.length), 'of ' + units.length],
     ['Nearest expiry', rows.slice().sort(function (a, b) { return a.yearsToExpiry - b.yearsToExpiry; })[0].yearsToExpiry.toFixed(1) + ' yrs',
      rows.slice().sort(function (a, b) { return a.yearsToExpiry - b.yearsToExpiry; })[0].un.short],
     ['Avg rent / sq ft', fmt$c(rows.reduce(function (a, r) { return a + r.rentPerSqft; }, 0) / rows.length),
      'per year']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'Percentage-rent watch',
      sub: 'The one place in the business where growing sales costs money. ' +
        'Worth knowing before you push a promotion at these units.',
      sources: ['Lease', 'Toast'], body: pctHtml }) +

    card({ title: 'Lease register', sub: 'Every unit, with occupancy load against sales',
      tools: gridTools('lz', 'Lease register'), sources: ['Lease'],
      body: table({ id: 'lz', cols: [{ label: 'Restaurant' }, { label: 'Sq ft', num: true },
        { label: 'Base rent /mo', num: true }, { label: 'Rent / sq ft', num: true },
        { label: 'Occupancy %', num: true }, { label: 'Lease end' }, { label: 'Term left' },
        { label: '% rent status' }], rows: [leaseRows],
        foot: '<tr><td><b>Portfolio</b></td>' +
          '<td class="num"><b>' + fmtNum(rows.reduce(function (a, r) { return a + r.un.sqft; }, 0)) + '</b></td>' +
          '<td class="num"><b>' + fmt$(rows.reduce(function (a, r) { return a + r.un.rent; }, 0)) + '</b></td>' +
          '<td></td><td class="num"><b>' + fmtPct(totalOcc / (totalSales || 1)) + '</b></td>' +
          '<td></td><td></td><td></td></tr>' }) }) +

    card({ title: 'Option & renewal calendar',
      sub: 'Decision dates assume nine months of notice. A unit with no option left is a negotiation, not a formality.',
      sources: ['Lease', 'QBO'],
      body: table({ id: 'opt', cols: [{ label: 'Restaurant' }, { label: 'Lease end' },
        { label: 'Decide by' }, { label: 'Options' }, { label: 'Four-wall margin', num: true },
        { label: 'Annualised profit', num: true }, { label: 'Recommendation' }], rows: [calRows] }) });
});
