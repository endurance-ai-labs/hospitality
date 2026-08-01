/* Facilities, Equipment & Energy */
renderPage('Facilities & Energy', 'Assets, work orders, refrigeration and utilities',
  ['QBO', 'R365'], function () {
  var P = activePeriod(), units = activeUnits();
  var wos = [], excursions = [], energy = { total: 0, electric: 0, gas: 0, water: 0, waste: 0, kwh: 0, therms: 0 };
  var assets = [];
  units.forEach(function (u) {
    RG.periodWorkOrders(u, P).forEach(function (w) { wos.push(w); });
    RG.periodExcursions(u, P).forEach(function (e) { excursions.push(e); });
    RG.assetsFor(u).forEach(function (a) { assets.push(a); });
    var e = RG.periodEnergy(u, P);
    ['total', 'electric', 'gas', 'water', 'waste', 'kwh', 'therms'].forEach(function (k) {
      energy[k] = RG.rand.cents(energy[k] + e[k]);
    });
  });
  wos.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  excursions.sort(function (a, b) { return b.minutes - a.minutes; });

  var open = wos.filter(function (w) { return w.status === 'Open'; });
  var repairSpend = wos.reduce(function (a, w) { return RG.rand.cents(a + w.cost); }, 0);
  var productRisk = excursions.reduce(function (a, e) { return RG.rand.cents(a + e.productRisk); }, 0);
  var s = RG.sumDays(units, RG.CAL.daysIn(P));

  var woRows = wos.slice(0, 24).map(function (w) {
    return '<tr><td><code style="font-size:10.5px">' + esc(w.id) + '</code></td>' +
      '<td>' + usDate(w.date) + '</td>' +
      '<td>' + esc(RG.unitById[w.unit].short) + '</td>' +
      '<td><b>' + esc(w.asset) + '</b><div style="font-size:10px;color:var(--color-slate-hint)">' +
        esc(w.issue) + '</div></td>' +
      '<td>' + esc(w.vendor) + '</td>' +
      '<td>' + pill(w.priority, w.priority === 'Urgent' ? 'bad' : w.priority === 'High' ? 'warn' : 'neutral') + '</td>' +
      '<td class="num">' + fmt$(w.cost) + '</td>' +
      '<td class="num">' + w.ageDays + ' d</td>' +
      '<td>' + (w.status === 'Open' ? pill('open', 'warn') : pill('closed', 'good')) +
        (w.warranty ? ' ' + pill('warranty', 'info') : '') + '</td></tr>';
  }).join('');

  /* repair vs replace: lifetime spend against replacement cost */
  var assetSpend = {};
  wos.forEach(function (w) {
    assetSpend[w.assetId] = RG.rand.cents((assetSpend[w.assetId] || 0) + w.cost);
  });
  var replaceRows = assets.map(function (a) {
    /* annualise the period spend as a lifetime proxy */
    var lifetime = RG.rand.cents((assetSpend[a.id] || 0) * 13 * Math.max(1, a.ageYears * 0.35));
    return { a: a, lifetime: lifetime, ratio: lifetime / a.cost };
  }).filter(function (r) { return r.lifetime > 0; })
    .sort(function (x, y) { return y.ratio - x.ratio; }).slice(0, 12)
    .map(function (r) {
      var rec = r.ratio > 0.55 || r.a.ageYears > r.a.life ? 'Replace' :
                r.ratio > 0.30 ? 'Plan replacement' : 'Repair';
      return '<tr><td><b>' + esc(r.a.name) + '</b>' +
        '<div style="font-size:10px;color:var(--color-slate-hint)">' +
        esc(RG.unitById[r.a.unit].short) + ' · installed ' + usDate(r.a.installed) + '</div></td>' +
        '<td class="num">' + r.a.ageYears.toFixed(1) + ' / ' + r.a.life + ' yrs</td>' +
        '<td class="num">' + fmt$(r.a.cost) + '</td>' +
        '<td class="num">' + traced(fmt$(r.lifetime), {
          value: fmt$c(r.lifetime) + ' lifetime repair spend',
          formula: 'repair spend on this asset, annualised across its service life',
          inputs: [['Replacement cost', fmt$(r.a.cost)],
                   ['Repair-to-replace ratio', fmtPct(r.ratio)],
                   ['Age', r.a.ageYears.toFixed(1) + ' of ' + r.a.life + ' years'],
                   ['Condition', r.a.condition]],
          source: ['QBO'], period: 'lifetime to date',
          note: 'Past roughly 50% of replacement cost, repairing is usually the more expensive choice — ' +
                'and that is before counting downtime.' }) + '</td>' +
        '<td class="num">' + fmtPct(r.ratio) + '</td>' +
        '<td>' + pill(r.a.condition, r.a.condition === 'End of life' ? 'bad' :
          r.a.condition === 'Watch' ? 'warn' : 'good') + '</td>' +
        '<td>' + pill(rec, rec === 'Replace' ? 'bad' : rec === 'Plan replacement' ? 'warn' : 'neutral') +
        '</td></tr>';
    }).join('');

  var exRows = excursions.slice(0, 16).map(function (e) {
    return '<tr><td>' + usDate(e.date) + '</td>' +
      '<td>' + esc(RG.unitById[e.unit].short) + '</td>' +
      '<td><b>' + esc(e.asset) + '</b></td>' +
      '<td class="num">' + e.target + '°F</td>' +
      '<td class="num">' + e.peak + '°F</td>' +
      '<td class="num">' + e.minutes + ' min</td>' +
      '<td class="num">' + (e.productRisk ? fmt$(e.productRisk) : '—') + '</td>' +
      '<td>' + (e.acknowledged ? pill('acknowledged', 'good') : pill('no response', 'bad')) + '</td></tr>';
  }).join('');

  var energyRows = units.map(function (u) {
    var e = RG.periodEnergy(u, P), un = RG.unitById[u];
    return '<tr><td class="unit-cell"><b>' + esc(un.name) + '</b><span>' +
      fmtNum(un.sqft) + ' sq ft</span></td>' +
      '<td class="num">' + fmt$(e.total) + '</td>' +
      '<td class="num">' + fmtNum(e.kwh) + '</td>' +
      '<td class="num">' + fmtNum(e.therms) + '</td>' +
      '<td class="num">' + fmt$c(e.costPerSqft) + '</td>' +
      '<td class="num">' + traced(fmt$c(e.costPerCover), {
        value: fmt$c(e.costPerCover) + ' per cover',
        formula: 'total utilities ÷ covers served',
        inputs: [['Utilities', fmt$c(e.total)], ['Covers', fmtNum(RG.periodSales(u, P).covers)],
                 ['Square feet', fmtNum(un.sqft)],
                 ['HVAC schedule adherence', fmtPct(e.hvacAdherence)]],
        source: ['QBO'], period: periodLabel(P),
        note: 'Benchmarked across the group this is the fastest way to spot a unit running its ' +
              'hood or HVAC outside trading hours.' }) + '</td>' +
      '<td class="num">' + fmtPct(e.hvacAdherence) + '</td></tr>';
  }).join('');

  return '<div class="stat-row">' +
    [['Repair spend', fmt$(repairSpend), fmtPct(repairSpend / (s.net || 1)) + ' of sales'],
     ['Open work orders', fmtNum(open.length), 'of ' + fmtNum(wos.length)],
     ['Assets tracked', fmtNum(assets.length), fmtNum(assets.filter(function (a) {
        return a.condition === 'End of life'; }).length) + ' end of life'],
     ['Temperature excursions', fmtNum(excursions.length), 'this period'],
     ['Product at risk', fmt$(productRisk), 'from excursions over 2 hrs'],
     ['Utilities', fmt$(energy.total), fmtPct(energy.total / (s.net || 1)) + ' of sales']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'Work order board', sub: 'Repair spend foots exactly to the P&L repairs line of ' +
      fmt$(repairSpend) + '.',
      tools: gridTools('wo', 'Work orders ' + P), sources: ['QBO'],
      body: table({ id: 'wo', cols: [{ label: 'Work order' }, { label: 'Opened' }, { label: 'Unit' },
        { label: 'Asset / issue' }, { label: 'Vendor' }, { label: 'Priority' },
        { label: 'Cost', num: true }, { label: 'Age', num: true }, { label: 'Status' }],
        rows: [woRows] }) }) +

    '<div class="two-col">' +
      card({ title: 'Repair versus replace', sub: 'Lifetime repair spend against replacement cost',
        sources: ['QBO'],
        body: table({ id: 'rr', cols: [{ label: 'Asset' }, { label: 'Age', num: true },
          { label: 'Replacement', num: true }, { label: 'Lifetime repairs', num: true },
          { label: 'Ratio', num: true }, { label: 'Condition' }, { label: 'Call' }],
          rows: [replaceRows] }) }) +
      card({ title: 'Refrigeration excursions', sub: 'Temperature events and product exposure',
        sources: ['R365'],
        body: table({ id: 'ex', cols: [{ label: 'Date' }, { label: 'Unit' }, { label: 'Asset' },
          { label: 'Target', num: true }, { label: 'Peak', num: true }, { label: 'Duration', num: true },
          { label: 'Product risk', num: true }, { label: '' }], rows: [exRows] }) +
          '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
          'Excursions cluster on end-of-life boxes. An unacknowledged alarm over two hours is both a ' +
          'product-loss event and a food-safety exposure — it shows up again on the ' +
          '<a href="/hospitality/compliance" style="color:var(--color-blue);font-weight:700;text-decoration:none">' +
          'compliance page</a>.</div>' }) +
    '</div>' +

    card({ title: 'Energy by restaurant', sub: 'Cost per cover benchmarked across the group. ' +
      'Utilities foot exactly to the P&L line of ' + fmt$(energy.total) + '.',
      tools: gridTools('en', 'Energy ' + P), sources: ['QBO'],
      body: table({ id: 'en', cols: [{ label: 'Restaurant' }, { label: 'Utilities', num: true },
        { label: 'kWh', num: true }, { label: 'Therms', num: true }, { label: '$ / sq ft', num: true },
        { label: '$ / cover', num: true }, { label: 'HVAC adherence', num: true }],
        rows: [energyRows] }) });
});
