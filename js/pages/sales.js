/* Sales & Traffic */
renderPage('Sales & Traffic', 'Volume, mix and what moved', ['Toast', 'Square', 'Deliverect'], function () {
  var P = activePeriod(), units = activeUnits();
  var M = RG.model();
  var prior = RG.CAL.priorPeriod(P), py = RG.CAL.priorYear(P);
  var s = RG.sumDays(units, RG.CAL.daysIn(P));
  var sPrior = prior ? RG.sumDays(units, RG.CAL.daysIn(prior.key)) : null;
  var sPY = py ? RG.sumDays(units, RG.CAL.daysIn(py.key)) : null;

  /* ---- stat row ---- */
  var stats =
    '<div class="stat-row">' +
    [['Net sales', fmt$(s.net), sPrior ? deltaChip((s.net - sPrior.net) / sPrior.net) : ''],
     ['Covers', fmtNum(s.covers), sPY ? deltaChip((s.covers - sPY.covers) / sPY.covers) : ''],
     ['Checks', fmtNum(s.checks), ''],
     ['Average check', fmt$c(s.avgCheck), ''],
     ['Per-person average', fmt$c(s.ppa), ''],
     ['Comp sales', sPY ? fmtPct((s.net - sPY.net) / sPY.net) : '—', 'vs. ' + (py ? periodLabel(py.key) : '—')]
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>';

  /* ---- daily series ---- */
  var days = RG.CAL.daysIn(P);
  var daily = days.map(function (d) {
    var tot = 0, cov = 0, closed = true;
    units.forEach(function (u) {
      var x = RG.daySales(u, d.iso);
      if (!x.closed) { closed = false; tot += x.net; cov += x.covers; }
    });
    var pyd = RG.CAL.priorYearDay(d.iso);
    var pyTot = 0;
    if (pyd) units.forEach(function (u) { pyTot += RG.daySales(u, pyd.iso).net; });
    return { d: d, net: RG.rand.cents(tot), covers: cov, closed: closed, py: RG.rand.cents(pyTot) };
  });
  var maxDay = Math.max.apply(null, daily.map(function (x) { return Math.max(x.net, x.py); })) || 1;

  var dailyRows = daily.map(function (x) {
    var w = RG.weatherOf(RG.unitById[units[0]].region, x.d.iso);
    var hol = RG.CAL.holidayOf(x.d.iso);
    var vs = x.py ? (x.net - x.py) / x.py : null;
    return '<tr>' +
      '<td>' + usDate(x.d.iso) + '<div style="font-size:10px;color:var(--color-slate-hint)">' +
        x.d.dowName + (hol ? ' · ' + esc(hol.name) : '') + '</div></td>' +
      '<td class="num">' + traced(fmt$(x.net), {
        value: fmt$c(x.net), formula: 'Σ item quantity × menu price − discounts − comps, for this business day',
        inputs: [['Covers', fmtNum(x.covers)], ['Same day last year', fmt$(x.py)],
                 ['Weather', w.label]],
        source: ['Toast', 'Square'], period: usDate(x.d.iso) + ' · ' + x.d.dowName,
        note: 'Business day cuts at 4am, so late-night sales roll back to this date.' }) + '</td>' +
      '<td style="width:34%"><div class="rg-bar"><i style="width:' +
        (x.net / maxDay * 100).toFixed(1) + '%"></i></div></td>' +
      '<td class="num">' + fmtNum(x.covers) + '</td>' +
      '<td class="num">' + fmt$(x.py) + '</td>' +
      '<td class="num">' + (vs == null ? '—' : deltaChip(vs)) + '</td>' +
      '<td>' + (w.rain || w.heat ? pill(w.label, w.heavy ? 'bad' : 'warn') : '') + '</td>' +
      '</tr>';
  }).join('');

  /* ---- daypart × day-of-week heatmap ---- */
  var dps = RG.CAL.DAYPARTS;
  var grid = {};
  days.forEach(function (d) {
    units.forEach(function (u) {
      var x = RG.daySales(u, d.iso);
      if (x.closed) return;
      dps.forEach(function (dp) {
        var k = d.dow + ':' + dp.id;
        grid[k] = RG.rand.cents((grid[k] || 0) + (x.byDaypart[dp.id] || 0));
      });
    });
  });
  var maxCell = Math.max.apply(null, Object.keys(grid).map(function (k) { return grid[k]; })) || 1;
  var heat = '<div class="heat" style="grid-template-columns:90px repeat(7,1fr)">' +
    '<div class="heat-lbl"></div>' +
    RG.CAL.DOW.map(function (d) { return '<div class="heat-lbl">' + d + '</div>'; }).join('') +
    dps.map(function (dp) {
      return '<div class="heat-lbl" style="justify-content:flex-start">' + dp.label + '</div>' +
        RG.CAL.DOW.map(function (_, i) {
          var v = grid[i + ':' + dp.id] || 0;
          var a = v / maxCell;
          return '<div class="heat-cell" style="background:rgba(39,102,214,' + (0.10 + a * 0.85).toFixed(2) + ')"' +
            exp({ value: fmt$c(v), formula: dp.label + ' sales on every ' + RG.CAL.DOW[i] + ' in the period',
                  inputs: [['Share of period', fmtPct(v / (s.gross || 1))],
                           ['Daypart window', dp.from + ':00 – ' + (dp.to > 24 ? (dp.to - 24) + ':00 next day' : dp.to + ':00')]],
                  source: ['Toast', 'Square'], period: periodLabel(P) }) +
            '>' + (a > 0.35 ? fmtK(v) : '') + '</div>';
        }).join('');
    }).join('') + '</div>';

  /* ---- channel mix ---- */
  var chRows = RG.CHANNELS.map(function (c) {
    var v = s.byChannel[c.id] || 0;
    var pv = sPrior ? (sPrior.byChannel[c.id] || 0) : 0;
    return '<tr><td><b>' + esc(c.label) + '</b><div style="font-size:10px;color:var(--color-slate-hint)">' +
      (c.commission ? fmtPct(c.commission) + ' marketplace commission' : 'no commission') + '</div></td>' +
      '<td class="num">' + fmt$(v) + '</td>' +
      '<td style="width:30%"><div class="rg-bar"><i style="width:' +
        (v / (s.gross || 1) * 100).toFixed(1) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(v / (s.gross || 1)) + '</td>' +
      '<td class="num">' + (pv ? deltaChip((v - pv) / pv) : '—') + '</td></tr>';
  }).join('');

  /* ---- bridge ---- */
  var b = RG.salesBridge(units, prior.key, P);
  var bYoY = py ? RG.salesBridge(units, py.key, P) : null;

  return stats +
    card({ title: 'Why sales moved', sub: periodLabel(prior.key) + ' → ' + periodLabel(P),
      sources: ['Toast', 'Square'],
      body: waterfall([
        ['Traffic', b.traffic, { value: fmt$c(b.traffic),
          formula: '(checks this period − checks last period) × prior average check',
          inputs: [['Checks', fmtNum(b.fromChecks) + ' → ' + fmtNum(b.toChecks)],
                   ['Prior average check', fmt$c(b.fromAvgCheck)]],
          source: ['Toast', 'Square'], period: periodLabel(prior.key) + ' → ' + periodLabel(P) }],
        ['Menu price', b.price, { value: fmt$c(b.price),
          formula: 'checks × prior average check × scheduled price increase in the window',
          inputs: [['Price moves in window', b.price ? 'yes' : 'none']],
          source: ['Model'], period: periodLabel(P) }],
        ['Mix & behaviour', b.mix, { value: fmt$c(b.mix),
          formula: 'check effect − price effect: what guests actually ordered',
          inputs: [['Average check', fmt$c(b.fromAvgCheck) + ' → ' + fmt$c(b.toAvgCheck)]],
          source: ['Toast'], period: periodLabel(P) }]
      ], b.total) +
      '<div style="font-size:11px;color:var(--color-slate-hint);margin-top:11px;line-height:1.55">' +
      'The three drivers sum to ' + fmt$(b.total) + ' exactly.' +
      (b.price === 0 ? ' <b>No scheduled menu price move landed in this window</b>, so the entire ' +
        'check effect is mix and guest behaviour.' : '') + '</div>' +
      (bYoY ? '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--glass-border)">' +
        '<div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--color-slate-hint);margin-bottom:10px">' +
        'Versus ' + esc(periodLabel(py.key)) + ' — the comp view</div>' +
        waterfall([['Traffic', bYoY.traffic], ['Menu price', bYoY.price], ['Mix & behaviour', bYoY.mix]],
          bYoY.total) + '</div>' : '')
    }) +

    '<div class="two-col">' +
      card({ title: 'Daypart × day of week', sub: 'Where the volume actually sits',
        sources: ['Toast'], body: heat }) +
      card({ title: 'Channel mix', sub: 'Gross sales by order channel', sources: ['Deliverect', 'Toast'],
        body: table({ id: 'ch', cols: [{ label: 'Channel' }, { label: 'Gross', num: true },
          { label: '' }, { label: 'Share', num: true }, { label: 'vs. prior', num: true }],
          rows: [chRows] }) }) +
    '</div>' +

    card({ title: 'Daily register', sub: 'Every business day in the period, against the same day last year',
      tools: gridTools('daily', 'Daily sales ' + P), sources: ['Toast', 'Square'],
      body: table({ id: 'daily',
        cols: [{ label: 'Date' }, { label: 'Net sales', num: true }, { label: '' },
               { label: 'Covers', num: true }, { label: 'Same day LY', num: true },
               { label: 'vs. LY', num: true }, { label: 'Conditions' }],
        rows: [dailyRows],
        foot: '<tr><td><b>Period total</b></td>' +
          '<td class="num"><b>' + fmt$(s.net) + '</b></td><td></td>' +
          '<td class="num"><b>' + fmtNum(s.covers) + '</b></td>' +
          '<td class="num"><b>' + fmt$(sPY ? sPY.net : 0) + '</b></td>' +
          '<td class="num">' + (sPY ? deltaChip((s.net - sPY.net) / sPY.net) : '') + '</td><td></td></tr>' }) });
});
