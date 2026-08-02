/* Inventory & Waste */
renderPage('Inventory & Waste', 'Counts, turns, waste log and shrink', ['R365', 'Toast'], function () {
  if (!can('margins')) return card({ title: 'Restricted',
    body: '<div style="padding:20px;color:var(--color-text-muted)">Inventory detail is limited to ' +
      'managers and above.</div>' });

  var P = activePeriod(), units = activeUnits();
  var waste = [], theo = 0, actual = 0, variance = 0, purchases = 0, invDelta = 0;
  var drivers = { portion: 0, waste: 0, spoilage: 0, ppv: 0, unexplained: 0 };
  units.forEach(function (u) {
    var c = RG.periodCogs(u, P), pu = RG.periodPurchases(u, P);
    theo = RG.rand.cents(theo + c.theo); actual = RG.rand.cents(actual + c.actual);
    variance = RG.rand.cents(variance + c.variance);
    purchases = RG.rand.cents(purchases + pu.total);
    invDelta = RG.rand.cents(invDelta + pu.invDelta);
    Object.keys(drivers).forEach(function (d) { drivers[d] = RG.rand.cents(drivers[d] + c.drivers[d]); });
    RG.periodWaste(u, P).forEach(function (w) { w.unitId = u; waste.push(w); });
  });
  waste.sort(function (a, b) { return b.cost - a.cost; });

  var wasteTotal = waste.reduce(function (a, w) { return RG.rand.cents(a + w.cost); }, 0);
  var unlogged = waste.filter(function (w) { return !w.logged; });
  var turns = actual ? (actual * 13) / Math.max(1, actual * 0.28) : 0;
  var daysOnHand = 365 / (turns || 1);

  /* reason rollup */
  var reasons = {};
  waste.forEach(function (w) {
    var r = reasons[w.reason] || (reasons[w.reason] = { reason: w.reason, n: 0, cost: 0 });
    r.n++; r.cost = RG.rand.cents(r.cost + w.cost);
  });
  var maxReason = Math.max.apply(null, Object.keys(reasons).map(function (k) { return reasons[k].cost; })) || 1;
  var reasonRows = Object.keys(reasons).map(function (k) { return reasons[k]; })
    .sort(function (a, b) { return b.cost - a.cost; }).map(function (r) {
      return '<tr><td><b>' + esc(r.reason) + '</b></td>' +
        '<td class="num">' + fmtNum(r.n) + '</td>' +
        '<td class="num">' + fmt$(r.cost) + '</td>' +
        '<td style="width:34%"><div class="rg-bar"><i class="' +
          (r.reason === 'Spoilage' || r.reason === 'Expired' ? 'bad' : 'warn') +
          '" style="width:' + (r.cost / maxReason * 100).toFixed(0) + '%"></i></div></td>' +
        '<td class="num">' + fmtPct(r.cost / (wasteTotal || 1)) + '</td></tr>';
    }).join('');

  var wasteRows = waste.slice(0, 30).map(function (w) {
    return '<tr><td>' + usDate(w.date) + '</td>' +
      '<td>' + esc(RG.unitById[w.unitId].short) + '</td>' +
      '<td><b>' + esc(w.name) + '</b></td>' +
      '<td class="num">' + fmtNum(w.qty, 2) + ' ' + esc(w.unitLabel) + '</td>' +
      '<td>' + esc(w.reason) + '</td>' +
      '<td class="num">' + fmt$c(w.cost) + '</td>' +
      '<td>' + (w.logged ? pill('logged', 'good') : pill('not logged', 'bad')) + '</td></tr>';
  }).join('');

  /* inventory reconciliation — the identity that has to hold */
  var recon = [
    ['Opening inventory', RG.rand.cents(actual * 0.28), 'counted at period start'],
    ['Purchases', purchases, 'invoice register'],
    ['Closing inventory', RG.rand.cents(-(actual * 0.28 + invDelta)), 'counted at period end'],
    ['=', 'Actual usage', actual],
    ['Theoretical usage', -theo, 'from recipes and item mix'],
    ['=', 'Variance', variance]
  ].map(function (r) {
    if (r[0] === '=') {
      return '<tr style="font-weight:800;border-top:1.5px solid var(--glass-border)">' +
        '<td><b>' + esc(r[1]) + '</b></td><td class="num"><b>' + fmt$(r[2]) + '</b></td><td></td></tr>';
    }
    return '<tr><td>' + esc(r[0]) + '</td><td class="num">' + fmt$(r[1]) + '</td>' +
      '<td style="font-size:11px;color:var(--color-slate-hint)">' + esc(r[2]) + '</td></tr>';
  }).join('');

  return '<div class="stat-row">' +
    [['Actual usage', fmt$(actual), 'cost of goods'],
     ['Theoretical', fmt$(theo), 'from recipes'],
     ['Variance', fmt$(variance), fmtPct(variance / (theo || 1))],
     ['Waste logged', fmt$(wasteTotal), fmtNum(waste.length) + ' events'],
     ['Unlogged events', fmtNum(unlogged.length), fmt$(unlogged.reduce(function (a, w) {
        return RG.rand.cents(a + w.cost); }, 0)) + ' invisible'],
     ['Days on hand', fmtNum(daysOnHand, 1), 'at current usage']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    '<div class="two-col">' +
      card({ title: 'Inventory reconciliation',
        sub: 'Opening + purchases − closing = actual usage. Theoretical is derived independently, ' +
          'so the gap between them is the variance.',
        sources: ['R365'],
        body: table({ id: 'recon', cols: [{ label: '' }, { label: 'Amount', num: true }, { label: '' }],
          rows: [recon] }) +
          '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
          'Counts are periodic and sales are continuous, so theoretical variance is only meaningful ' +
          '<b>between counts</b>. Comparing a mid-period snapshot to a full-period theoretical is the ' +
          'most common way this number gets misread.</div>' }) +
      card({ title: 'Waste by reason', sub: 'Where the logged loss is coming from', sources: ['R365'],
        body: table({ id: 'wr', cols: [{ label: 'Reason' }, { label: 'Events', num: true },
          { label: 'Cost', num: true }, { label: '' }, { label: 'Share', num: true }],
          rows: [reasonRows] }) }) +
    '</div>' +

    card({ title: 'Waste log', sub: 'Highest-cost events first. Unlogged events are inferred from the ' +
      'variance — they happened, they just never made it onto a sheet.',
      tools: gridTools('wl', 'Waste log ' + P), sources: ['R365'],
      body: table({ id: 'wl', cols: [{ label: 'Date' }, { label: 'Unit' }, { label: 'Item' },
        { label: 'Quantity', num: true }, { label: 'Reason' }, { label: 'Cost', num: true },
        { label: 'Status' }], rows: [wasteRows],
        foot: '<tr><td colspan="5"><b>Total logged waste</b></td>' +
          '<td class="num"><b>' + fmt$(wasteTotal) + '</b></td><td></td></tr>' }) });
});
