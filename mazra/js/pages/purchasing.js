/* Purchasing & Vendor Price Watch */
renderPage('Purchasing & Price Watch', 'Invoices, price moves and vendor performance',
  ['Sysco', 'USFoods', 'R365', 'Docs'], function () {
  if (!can('margins')) return card({ title: 'Restricted',
    body: '<div style="padding:20px;color:var(--color-text-muted)">Purchasing detail is limited to ' +
      'managers and above.</div>' });

  var P = activePeriod(), units = activeUnits();
  var p = RG.CAL.periodByKey[P];
  var invoices = [], byVendor = {}, total = 0;
  units.forEach(function (u) {
    var pu = RG.periodPurchases(u, P);
    total = RG.rand.cents(total + pu.total);
    invoices = invoices.concat(pu.invoices);
    Object.keys(pu.byVendor).forEach(function (v) {
      byVendor[v] = RG.rand.cents((byVendor[v] || 0) + pu.byVendor[v]);
    });
  });
  invoices.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

  /* ---- price watch: in-period move against the commodity benchmark ---- */
  var ingCost = {};
  units.forEach(function (u) {
    var c = RG.periodCogs(u, P);
    Object.keys(c.byIng).forEach(function (k) {
      ingCost[k] = RG.rand.cents((ingCost[k] || 0) + c.byIng[k].cost);
    });
  });
  var watch = Object.keys(ingCost).map(function (k) {
    var ing = RG.ingById[k];
    if (!ing) return null;
    var a = RG.ingCost(k, p.start), b = RG.ingCost(k, p.end);
    var yrAgo = RG.CAL.priorYear(P);
    var y = yrAgo ? RG.ingCost(k, RG.CAL.periodByKey[yrAgo.key].end) : a;
    return { id: k, name: ing.name, family: ing.family, unit: ing.unit, vendor: ing.vendor,
      spend: ingCost[k], start: a, end: b,
      move: a ? (b - a) / a : 0, yoy: y ? (b - y) / y : 0,
      annualImpact: RG.rand.cents((b - a) * (ingCost[k] / (b || 1)) * 13) };
  }).filter(Boolean).sort(function (x, y2) { return Math.abs(y2.annualImpact) - Math.abs(x.annualImpact); });

  var watchRows = watch.slice(0, 16).map(function (w) {
    var idx = RG.familyIndex(w.family, p.end) - 1;
    var beating = w.yoy < idx;
    return '<tr><td><b>' + esc(w.name) + '</b>' +
      '<div style="font-size:10px;color:var(--color-slate-hint)">' + esc(w.family) + ' · ' +
      esc(RG.vendorById[w.vendor] ? RG.vendorById[w.vendor].name : w.vendor) + '</div></td>' +
      '<td class="num">' + fmt$(w.spend) + '</td>' +
      '<td class="num">' + fmt$c(w.end) + ' /' + esc(w.unit) + '</td>' +
      '<td class="num">' + deltaChip(w.move, { lowerIsBetter: true }) + '</td>' +
      '<td class="num">' + deltaChip(w.yoy, { lowerIsBetter: true }) + '</td>' +
      '<td class="num">' + fmtPct(idx) + '</td>' +
      '<td class="num">' + traced(fmt$(w.annualImpact), {
        value: fmt$c(w.annualImpact) + ' annualised',
        formula: 'in-period unit price move × annual usage at current volume',
        inputs: [['Price at period start', fmt$c(w.start)], ['Price at period end', fmt$c(w.end)],
                 ['Period spend', fmt$c(w.spend)],
                 ['Commodity family index vs. 2024', fmtPct(idx)]],
        source: ['Sysco', 'R365'], period: periodLabel(P),
        note: beating ? 'You are beating the market on this line — the vendor is holding better than the index.'
                      : 'You are trailing the market index here. Worth a contract conversation.' }) + '</td>' +
      '<td>' + (beating ? pill('beating market', 'good') : pill('trailing market', 'warn')) + '</td></tr>';
  }).join('');

  /* ---- vendor scorecard ---- */
  var vendorRows = Object.keys(byVendor).sort(function (a, b) { return byVendor[b] - byVendor[a]; })
    .map(function (v) {
      var vd = RG.vendorById[v];
      if (!vd) return '';
      var invs = invoices.filter(function (i) { return i.vendor === v; });
      var fill = RG.rand.between('fill:' + v + P, 0.91, 0.998);
      var credits = RG.rand.cents(byVendor[v] * RG.rand.between('cr:' + v + P, 0.001, 0.018));
      var subs = RG.rand.between('sub:' + v + P, 0.002, 0.042);
      return '<tr><td><b>' + esc(vd.name) + '</b>' +
        '<div style="font-size:10px;color:var(--color-slate-hint)">' + esc(vd.cat) + ' · ' +
        esc(vd.terms) + '</div></td>' +
        '<td>' + srcChip(vd.feed.indexOf('EDI') >= 0 ? 'Sysco' : vd.feed.indexOf('API') >= 0 ||
          vd.feed.indexOf('MOX') >= 0 ? 'USFoods' : 'Docs') +
          '<div style="font-size:10px;color:var(--color-slate-hint);margin-top:3px">' +
          esc(vd.feed) + '</div></td>' +
        '<td class="num">' + fmtNum(invs.length) + '</td>' +
        '<td class="num">' + fmt$(byVendor[v]) + '</td>' +
        '<td style="width:16%"><div class="rg-bar"><i style="width:' +
          (byVendor[v] / (total || 1) * 100).toFixed(1) + '%"></i></div></td>' +
        '<td class="num">' + fmtPct(byVendor[v] / (total || 1)) + '</td>' +
        '<td class="num">' + fmtPct(fill) + '</td>' +
        '<td class="num">' + fmtPct(subs) + '</td>' +
        '<td class="num">' + fmt$(credits) + '</td></tr>';
    }).join('');

  /* ---- invoice register ---- */
  var invRows = invoices.slice(0, 40).map(function (i) {
    return '<tr><td><code style="font-size:10.5px">' + esc(i.id) + '</code></td>' +
      '<td>' + usDate(i.date) + '</td>' +
      '<td><b>' + esc(i.vendorName) + '</b></td>' +
      '<td>' + esc(RG.unitById[i.unit].short) + '</td>' +
      '<td class="num">' + fmtNum(i.lines.length) + '</td>' +
      '<td class="num">' + traced(fmt$(i.total), {
        value: fmt$c(i.total), formula: 'sum of every line extension on the invoice',
        inputs: i.lines.slice(0, 6).map(function (l) {
          return [l.name, fmtNum(l.qty, 2) + ' ' + l.unit + ' @ ' + fmt$c(l.price) + ' = ' + fmt$c(l.ext)];
        }), source: [i.feed.indexOf('EDI') >= 0 ? 'Sysco' : 'Docs'], period: usDate(i.date),
        note: i.feed === 'PDF invoice'
          ? 'Arrived as a PDF and was OCR-extracted into line items, then human-reviewed.'
          : 'Arrived structured over ' + i.feed + '.' }) + '</td>' +
      '<td>' + esc(i.terms) + '</td>' +
      '<td>' + (i.approved ? pill('approved', 'good') : pill('pending', 'warn')) + '</td></tr>';
  }).join('');

  var pending = invoices.filter(function (i) { return !i.approved; });
  var docFeed = invoices.filter(function (i) { return i.feed === 'PDF invoice'; });

  return '<div class="stat-row">' +
    [['Purchases', fmt$(total), 'this period'],
     ['Invoices', fmtNum(invoices.length), fmtNum(docFeed.length) + ' as PDFs'],
     ['Vendors', fmtNum(Object.keys(byVendor).length), ''],
     ['Pending approval', fmtNum(pending.length), fmt$(pending.reduce(function (a, i) {
        return RG.rand.cents(a + i.total); }, 0))],
     ['Largest price move', watch[0] ? fmt$(watch[0].annualImpact) : '—',
      watch[0] ? watch[0].name + ' annualised' : ''],
     ['Avg invoice', fmt$(total / (invoices.length || 1)), '']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'Price watch',
      sub: 'Every line benchmarked against its commodity index. "Your beef is up 8%" only matters ' +
        'once you know the market is up 11%.',
      tools: gridTools('pw', 'Price watch ' + P), sources: ['Sysco', 'USFoods', 'R365'],
      body: table({ id: 'pw', cols: [{ label: 'Ingredient' }, { label: 'Period spend', num: true },
        { label: 'Unit price', num: true }, { label: 'In period', num: true },
        { label: 'Year on year', num: true }, { label: 'Market index', num: true },
        { label: 'Annualised impact', num: true }, { label: '' }], rows: [watchRows] }) }) +

    card({ title: 'Vendor scorecard', sub: 'Spend concentration, fill rate and how the data actually arrives',
      tools: gridTools('vs', 'Vendor scorecard ' + P), sources: ['Sysco', 'USFoods', 'Docs'],
      body: table({ id: 'vs', cols: [{ label: 'Vendor' }, { label: 'Feed' },
        { label: 'Invoices', num: true }, { label: 'Spend', num: true }, { label: '' },
        { label: 'Share', num: true }, { label: 'Fill rate', num: true },
        { label: 'Substitutions', num: true }, { label: 'Credits', num: true }], rows: [vendorRows] }) }) +

    card({ title: 'Invoice register', sub: 'Most recent 40. Hover a total to see the line items behind it.',
      tools: gridTools('inv', 'Invoices ' + P), sources: ['Sysco', 'Docs', 'R365'],
      body: table({ id: 'inv', cols: [{ label: 'Invoice' }, { label: 'Date' }, { label: 'Vendor' },
        { label: 'Unit' }, { label: 'Lines', num: true }, { label: 'Total', num: true },
        { label: 'Terms' }, { label: 'Status' }], rows: [invRows] }) +
        '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
        '<b>' + fmtNum(docFeed.length) + ' of ' + fmtNum(invoices.length) + '</b> invoices arrive as ' +
        'PDFs from local and specialty vendors. Those are OCR-extracted into structured line items and ' +
        'routed to a review queue — that pipeline is what separates this from a reporting dashboard, ' +
        'because without it those vendors are invisible to price watch entirely.</div>' });
});
