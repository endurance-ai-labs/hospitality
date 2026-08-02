/* Today — sales so far, by store and cumulative */
renderPage('Today', 'Live trading across every restaurant', ['Toast', 'Square', 'Deliverect', '7shifts'], function () {
  /* The demo clock: the last day with data, read at 7:40pm — late enough
     that dinner is in progress and the day is not yet closed. */
  var TODAY = RG.CAL.END;
  var NOW = 19.67;
  var day = RG.CAL.byIso[TODAY];
  var units = activeUnits();
  var money = can('money');

  var lastWeek = RG.CAL.DAYS[day.i - 7];
  var lastYear = RG.CAL.priorYearDay(TODAY);

  /* hourly build for one unit-day, cut at the current hour */
  function hourly(uid, iso) {
    var s = RG.daySales(uid, iso);
    var out = {};
    for (var h = 8; h < 26; h++) out[h] = 0;
    if (s.closed) return { by: out, closed: true, total: 0 };
    RG.CAL.DAYPARTS.forEach(function (dp) {
      var v = s.byDaypart[dp.id] || 0;
      var n = Math.max(1, dp.to - dp.from);
      for (var h = dp.from; h < dp.to; h++) out[h] = RG.rand.cents((out[h] || 0) + v / n);
    });
    return { by: out, closed: false, total: s.net };
  }
  function soFar(uid, iso, upto) {
    var h = hourly(uid, iso);
    if (h.closed) return { v: 0, closed: true, full: 0 };
    var acc = 0;
    for (var x = 8; x < upto; x++) acc += h.by[x] || 0;
    if (upto % 1) acc += (h.by[Math.floor(upto)] || 0) * (upto % 1);
    return { v: RG.rand.cents(acc), closed: false, full: h.total, by: h.by };
  }

  /* ---- per-store board ---- */
  var board = units.map(function (u) {
    var t = soFar(u, TODAY, NOW);
    var lw = lastWeek ? soFar(u, lastWeek.iso, NOW) : null;
    var ly = lastYear ? soFar(u, lastYear.iso, NOW) : null;
    var s = RG.daySales(u, TODAY);
    var L = RG.dayLabor(u, TODAY);
    var onClock = (L.shifts || []).filter(function (sh) { return sh.start <= NOW && sh.end > NOW; });
    var projPct = t.full ? t.v / t.full : 0;
    return {
      u: u, unit: RG.unitById[u], soFar: t.v, closed: t.closed, projected: t.full,
      pctOfDay: projPct,
      vsLW: lw && lw.v ? (t.v - lw.v) / lw.v : null,
      vsLY: ly && ly.v ? (t.v - ly.v) / ly.v : null,
      covers: Math.round(s.covers * projPct),
      onClock: onClock.length,
      laborNow: RG.rand.cents(onClock.reduce(function (a, x) { return a + x.rate; }, 0)),
      byHour: t.by
    };
  }).sort(function (a, b) { return b.soFar - a.soFar; });

  var groupSoFar = board.reduce(function (a, b) { return RG.rand.cents(a + b.soFar); }, 0);
  var groupProj = board.reduce(function (a, b) { return RG.rand.cents(a + b.projected); }, 0);
  var groupLW = units.reduce(function (a, u) {
    return RG.rand.cents(a + (lastWeek ? soFar(u, lastWeek.iso, NOW).v : 0)); }, 0);
  var groupLY = units.reduce(function (a, u) {
    return RG.rand.cents(a + (lastYear ? soFar(u, lastYear.iso, NOW).v : 0)); }, 0);
  var groupCovers = board.reduce(function (a, b) { return a + b.covers; }, 0);
  var groupOnClock = board.reduce(function (a, b) { return a + b.onClock; }, 0);
  var openCount = board.filter(function (b) { return !b.closed; }).length;

  /* ---- cumulative curve, today vs last week vs last year ---- */
  var hours = [], cumNow = [], cumLW = [], cumLY = [];
  var aN = 0, aW = 0, aY = 0;
  for (var h = 10; h < 26; h++) {
    var n = 0, w = 0, y = 0;
    units.forEach(function (u) {
      var t = hourly(u, TODAY); if (!t.closed) n += t.by[h] || 0;
      if (lastWeek) { var tw = hourly(u, lastWeek.iso); if (!tw.closed) w += tw.by[h] || 0; }
      if (lastYear) { var ty = hourly(u, lastYear.iso); if (!ty.closed) y += ty.by[h] || 0; }
    });
    aN += n; aW += w; aY += y;
    hours.push(RGSched.hourLabel(h));
    cumNow.push(h <= NOW ? RG.rand.cents(aN) : null);   /* the future is blank, not zero */
    cumLW.push(RG.rand.cents(aW));
    cumLY.push(RG.rand.cents(aY));
  }
  var curve = RGChart.line('t-curve', {
    labels: hours, height: 300,
    series: [
      { label: 'Today, so far', data: cumNow, fill: true },
      { label: 'Same day last week', data: cumLW, dashed: true, color: '#8b93a3' },
      { label: 'Same day last year', data: cumLY, dashed: true, color: '#eda100' }
    ]
  });

  var byStore = RGChart.bar('t-store', {
    labels: board.map(function (b) { return b.unit.short; }),
    series: [
      { label: 'So far today', data: board.map(function (b) { return b.soFar; }) },
      { label: 'Rest of day (projected)', data: board.map(function (b) {
          return Math.max(0, RG.rand.cents(b.projected - b.soFar)); }) }
    ], stacked: true, height: 300
  });

  /* ---- store cards ---- */
  var cards = board.map(function (b) {
    var tone = b.vsLW == null ? '' : b.vsLW >= 0 ? 'good' : 'bad';
    return '<div class="td-card' + (b.closed ? ' closed' : '') + '">' +
      '<div class="td-head"><span class="brand-dot" style="background:var(--rg-' + b.unit.brand + ')"></span>' +
        '<b>' + esc(b.unit.name) + '</b>' +
        (b.closed ? pill('closed today', 'neutral') : pill('open', 'good')) + '</div>' +
      '<div class="td-val">' + traced(fmt$(b.soFar), {
        value: fmt$c(b.soFar) + ' so far today',
        formula: 'sales recorded between open and ' + RGSched.hourLabel(NOW),
        inputs: [['Projected full day', fmt$(b.projected)],
                 ['Day complete', fmtPct(b.pctOfDay)],
                 ['Same time last week', fmt$(b.soFar / (1 + (b.vsLW || 0)))],
                 ['Covers so far', fmtNum(b.covers)],
                 ['On the clock now', fmtNum(b.onClock) + ' people']],
        source: [b.unit.pos], period: usDate(TODAY) + ' · ' + day.dowName,
        note: 'Business day cuts at 4am; late-night sales roll back to this date.' }) + '</div>' +
      '<div class="td-meta">' +
        (b.vsLW == null ? '' : deltaChip(b.vsLW)) +
        '<span class="kpi-sub">vs. last ' + day.dowName + '</span></div>' +
      '<div class="td-bar"><i style="width:' + Math.min(100, b.pctOfDay * 100).toFixed(0) + '%"></i></div>' +
      '<div class="td-foot"><span>' + fmtPct(b.pctOfDay) + ' of day</span>' +
        '<span>' + fmtNum(b.covers) + ' covers</span>' +
        '<span>' + fmtNum(b.onClock) + ' on shift</span></div>' +
      '</div>';
  }).join('');

  /* ---- store table ---- */
  var rows = board.map(function (b) {
    return '<tr>' +
      '<td class="unit-cell"><span class="brand-dot" style="background:var(--rg-' + b.unit.brand + ')"></span>' +
        '<b>' + esc(b.unit.name) + '</b><span>' + esc(b.unit.city) + ' · ' + esc(b.unit.pos) + '</span></td>' +
      '<td>' + (b.closed ? pill('closed', 'neutral') : pill('trading', 'good')) + '</td>' +
      '<td class="num">' + fmt$(b.soFar) + '</td>' +
      '<td class="num">' + (b.vsLW == null ? '—' : deltaChip(b.vsLW)) + '</td>' +
      '<td class="num">' + (b.vsLY == null ? '—' : deltaChip(b.vsLY)) + '</td>' +
      '<td class="num">' + fmtNum(b.covers) + '</td>' +
      '<td class="num">' + fmtNum(b.onClock) + '</td>' +
      '<td class="num">' + fmt$(b.projected) + '</td>' +
      '<td style="width:14%"><div class="rg-bar"><i style="width:' +
        Math.min(100, b.pctOfDay * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(b.pctOfDay) + '</td></tr>';
  }).join('');

  return '<div class="td-live">' +
      '<span class="td-dot"></span>' +
      '<b>' + esc(day.dowName) + ' ' + usDate(TODAY) + '</b>' +
      '<span>trading as at ' + RGSched.hourLabel(NOW) + '</span>' +
      '<span class="scn-spacer"></span>' +
      '<span>' + openCount + ' of ' + units.length + ' restaurants open · ' +
      fmtNum(groupOnClock) + ' people on shift</span>' +
    '</div>' +

    '<div class="kpi-band">' +
      [['Group sales so far', fmt$(groupSoFar), 'var(--color-blue)',
        groupLW ? deltaChip((groupSoFar - groupLW) / groupLW) : '', 'vs. last ' + day.dowName],
       ['Projected full day', fmt$(groupProj), '#eda100', '',
        fmtPct(groupSoFar / (groupProj || 1)) + ' complete'],
       ['Covers so far', fmtNum(groupCovers), '#eb6834', '',
        fmt$c(groupCovers ? groupSoFar / groupCovers : 0) + ' per cover'],
       ['vs. same day last year', groupLY ? fmtPct((groupSoFar - groupLY) / groupLY) : '—', '#1baf7a',
        groupLY ? deltaChip((groupSoFar - groupLY) / groupLY) : '', fmt$(groupLY) + ' then'],
       ['On shift now', fmtNum(groupOnClock), '#e87ba4', '', 'across ' + openCount + ' open restaurants']
      ].map(function (r) {
        return '<div class="kpi-tile" style="--kpi-accent:' + r[2] + '"><div class="kpi-inner">' +
          '<div class="kpi-label">' + esc(r[0]) + '</div>' +
          '<div class="kpi-value">' + r[1] + '</div>' +
          '<div class="kpi-foot">' + (r[3] || '') + '<span class="kpi-sub">' + esc(r[4]) + '</span></div>' +
          '</div></div>';
      }).join('') +
    '</div>' +

    '<div class="td-grid">' + cards + '</div>' +

    '<div class="chart-grid-2">' +
      card({ title: 'Cumulative sales today', sub: 'Against the same day last week and last year. ' +
        'The line stops at ' + RGSched.hourLabel(NOW) + ' because the rest of the day has not happened.',
        sources: ['Toast', 'Square'], body: curve }) +
      card({ title: 'By restaurant', sub: 'Booked so far and the projected balance of the day',
        sources: ['Toast', 'Square'], body: byStore }) +
    '</div>' +

    card({ title: 'Store board', sub: 'Every restaurant, live. Sort any column; filter below.',
      tools: gridTools('td', 'Today ' + TODAY), sources: ['Toast', 'Square', '7shifts'],
      body: table({ id: 'td',
        cols: [{ label: 'Restaurant' }, { label: 'Status' }, { label: 'Sales so far', num: true },
               { label: 'vs. last week', num: true }, { label: 'vs. last year', num: true },
               { label: 'Covers', num: true }, { label: 'On shift', num: true },
               { label: 'Projected day', num: true }, { label: '' }, { label: '% of day', num: true }],
        rows: [rows],
        foot: '<tr><td><b>Group</b></td><td>' + openCount + ' open</td>' +
          '<td class="num"><b>' + fmt$(groupSoFar) + '</b></td>' +
          '<td class="num">' + (groupLW ? deltaChip((groupSoFar - groupLW) / groupLW) : '—') + '</td>' +
          '<td class="num">' + (groupLY ? deltaChip((groupSoFar - groupLY) / groupLY) : '—') + '</td>' +
          '<td class="num"><b>' + fmtNum(groupCovers) + '</b></td>' +
          '<td class="num"><b>' + fmtNum(groupOnClock) + '</b></td>' +
          '<td class="num"><b>' + fmt$(groupProj) + '</b></td><td></td>' +
          '<td class="num"><b>' + fmtPct(groupSoFar / (groupProj || 1)) + '</b></td></tr>' }) });
});
