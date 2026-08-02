/* Cash Control & Loss Prevention */
renderPage('Cash & Loss Prevention', 'Voids, comps, drawer variance and server outliers',
  ['Toast', 'Square', 'Plaid'], function () {
  if (!can('money') && !can('margins')) return card({ title: 'Restricted',
    body: '<div style="padding:20px;color:var(--color-text-muted)">Loss-prevention detail is limited ' +
      'to managers and above.</div>' });

  var P = activePeriod(), units = activeUnits();
  var s = RG.sumDays(units, RG.CAL.daysIn(P));
  var overShort = 0, allServers = [], dayRows = [];

  units.forEach(function (u) {
    var c = RG.periodCash(u, P);
    overShort = RG.rand.cents(overShort + c.overShort);
    c.servers.forEach(function (sv) { sv.unit = u; allServers.push(sv); });
  });
  allServers.sort(function (a, b) { return b.z - a.z; });

  /* group-level daily register */
  RG.CAL.daysIn(P).forEach(function (d) {
    var net = 0, voids = 0, comps = 0, disc = 0, os = 0, ns = 0, closed = true;
    units.forEach(function (u) {
      var x = RG.daySales(u, d.iso);
      if (x.closed) return;
      closed = false;
      net += x.net; voids += x.voids; comps += x.comps; disc += x.discounts;
      var cRow = RG.periodCash(u, P).rows.filter(function (r) { return r.date === d.iso; })[0];
      if (cRow) { os += cRow.overShort; ns += cRow.noSale; }
    });
    if (closed) return;
    dayRows.push('<tr><td>' + usDate(d.iso) +
      '<div style="font-size:10px;color:var(--color-slate-hint)">' + d.dowName + '</div></td>' +
      '<td class="num">' + fmt$(net) + '</td>' +
      '<td class="num">' + fmt$(voids) + '</td>' +
      '<td class="num">' + fmt$(comps) + '</td>' +
      '<td class="num">' + fmt$(disc) + '</td>' +
      '<td class="num">' + fmtPct((voids + comps + disc) / (net || 1)) + '</td>' +
      '<td class="num"><span class="chip ' + (Math.abs(os) < 10 ? 'chip-flat' :
        os < 0 ? 'chip-bad' : 'chip-good') + '">' + fmt$c(os) + '</span></td>' +
      '<td class="num">' + fmtNum(ns) + '</td></tr>');
  });

  /* outliers: z-score against peers */
  var outliers = allServers.filter(function (sv) { return sv.z > 1.5; });
  var svRows = allServers.slice(0, 16).map(function (sv) {
    var flag = sv.z > 2.5 ? 'bad' : sv.z > 1.5 ? 'warn' : 'neutral';
    return '<tr><td><b>' + esc(sv.name) + '</b>' +
      '<div style="font-size:10px;color:var(--color-slate-hint)">' + esc(sv.job) + ' · ' +
      esc(RG.unitById[sv.unit].short) + '</div></td>' +
      '<td class="num">' + fmt$(sv.sales) + '</td>' +
      '<td class="num">' + fmtNum(sv.checks) + '</td>' +
      '<td class="num">' + fmt$(sv.comps) + '</td>' +
      '<td class="num">' + traced(fmtPct(sv.compRate), {
        value: fmtPct(sv.compRate) + ' comp rate',
        formula: 'comps issued ÷ that server’s own sales',
        inputs: [['Peer mean', fmtPct(RG.periodCash(sv.unit, P).peerMean)],
                 ['Standard deviations from peers', sv.z.toFixed(2)],
                 ['Comps issued', fmt$c(sv.comps)], ['Checks', fmtNum(sv.checks)]],
        source: [RG.unitById[sv.unit].pos], period: periodLabel(P),
        note: 'Compared against peers in the same restaurant, so a generous house policy does not ' +
              'flag the whole floor. Two standard deviations is worth a conversation, not an accusation.' }) + '</td>' +
      '<td class="num"><span class="chip ' + (sv.z > 1.5 ? 'chip-bad' : 'chip-flat') + '">' +
        (sv.z >= 0 ? '+' : '') + sv.z.toFixed(2) + 'σ</span></td>' +
      '<td>' + (sv.z > 1.5 ? pill('review', flag) : '') + '</td></tr>';
  }).join('');

  /* by unit */
  var unitRows = units.map(function (u) {
    var c = RG.periodCash(u, P), pl = RG.periodPL(u, P);
    var rate = (pl.comps + pl.discounts) / (pl.grossSales || 1);
    return '<tr><td class="unit-cell"><b>' + esc(RG.unitById[u].name) + '</b>' +
      '<span>' + esc(RG.unitById[u].pos) + '</span></td>' +
      '<td class="num">' + fmt$(pl.grossSales) + '</td>' +
      '<td class="num">' + fmt$(pl.discounts) + '</td>' +
      '<td class="num">' + fmt$(pl.comps) + '</td>' +
      '<td style="width:20%"><div class="rg-bar"><i class="' +
        (rate > 0.032 ? 'bad' : rate > 0.024 ? 'warn' : 'good') + '" style="width:' +
        Math.min(100, rate / 0.05 * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(rate) + '</td>' +
      '<td class="num"><span class="chip ' + (Math.abs(c.overShort) < 60 ? 'chip-flat' :
        c.overShort < 0 ? 'chip-bad' : 'chip-good') + '">' + fmt$c(c.overShort) + '</span></td>' +
      '<td class="num">' + fmtNum(c.servers.filter(function (x) { return x.z > 1.5; }).length) + '</td></tr>';
  }).join('');

  var groupRate = (s.comps + s.discounts) / (s.gross || 1);

  return '<div class="stat-row">' +
    [['Gross sales', fmt$(s.gross), ''],
     ['Discounts', fmt$(s.discounts), fmtPct(s.discounts / (s.gross || 1))],
     ['Comps', fmt$(s.comps), fmtPct(s.comps / (s.gross || 1))],
     ['Voids', fmt$(s.voids), fmtPct(s.voids / (s.gross || 1))],
     ['Cash over / short', fmt$c(overShort), 'period cumulative'],
     ['Servers flagged', fmtNum(outliers.length), 'above 1.5σ from peers']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'Server outlier index',
      sub: 'Comp rate as standard deviations from peers <b>in the same restaurant</b>. ' +
        'Group discount and comp rate is ' + fmtPct(groupRate) + '.',
      tools: gridTools('sv', 'Server outliers ' + P), sources: ['Toast', 'Square'],
      body: table({ id: 'sv', cols: [{ label: 'Server' }, { label: 'Sales', num: true },
        { label: 'Checks', num: true }, { label: 'Comps', num: true }, { label: 'Comp rate', num: true },
        { label: 'vs. peers', num: true }, { label: '' }], rows: [svRows] }) +
        '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
        'A high comp rate is not proof of anything. It is a reason to pull the transactions and the ' +
        'video for those checks — which is exactly what a POS-linked camera integration ' +
        '(Solink, DTiQ) makes a two-minute job instead of an afternoon.</div>' }) +

    '<div class="two-col">' +
      card({ title: 'By restaurant', sub: 'Discount and comp exposure', sources: ['Toast', 'Square'],
        body: table({ id: 'cu', cols: [{ label: 'Restaurant' }, { label: 'Gross', num: true },
          { label: 'Discounts', num: true }, { label: 'Comps', num: true }, { label: '' },
          { label: 'Rate', num: true }, { label: 'Over/short', num: true },
          { label: 'Flagged', num: true }], rows: [unitRows] }) }) +
      card({ title: 'Deposit reconciliation', sub: 'Settlement against the bank feed',
        sources: ['Plaid', 'Toast'],
        body: '<div style="padding:4px 0">' +
          [['Net sales', s.net], ['Card volume (93%)', RG.rand.cents(s.net * 0.93)],
           ['Processing fees', RG.rand.cents(-s.net * 0.93 * 0.0255)],
           ['Cash deposits (7%)', RG.rand.cents(s.net * 0.07)],
           ['Cash over / short', overShort]].map(function (r) {
            return '<div style="display:flex;justify-content:space-between;padding:8px 0;' +
              'border-bottom:1px solid var(--glass-border);font-size:13px">' +
              '<span style="color:var(--color-text-muted)">' + esc(r[0]) + '</span>' +
              '<b style="font-variant-numeric:tabular-nums">' + fmt$(r[1]) + '</b></div>';
          }).join('') +
          '<div style="display:flex;justify-content:space-between;padding:12px 0 4px;font-size:14px;font-weight:800">' +
          '<span>Expected to bank</span><span>' +
          fmt$(RG.rand.cents(s.net * 0.93 * 0.9745 + s.net * 0.07 + overShort)) + '</span></div>' +
          '</div>' }) +
    '</div>' +

    card({ title: 'Daily register', sub: 'Voids, comps, discounts and drawer variance by business day',
      tools: gridTools('cday', 'Cash control ' + P), sources: ['Toast', 'Square'],
      body: table({ id: 'cday', cols: [{ label: 'Date' }, { label: 'Net sales', num: true },
        { label: 'Voids', num: true }, { label: 'Comps', num: true }, { label: 'Discounts', num: true },
        { label: 'Total rate', num: true }, { label: 'Over/short', num: true },
        { label: 'No-sale', num: true }], rows: [dayRows.join('')] }) });
});
