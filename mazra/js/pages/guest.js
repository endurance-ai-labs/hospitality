/* Experience & Reputation — reviews joined back to the shifts that caused them */
renderPage('Experience & Reputation', 'Reviews, sentiment and the operating conditions behind them',
  ['Google', 'Yelp', 'OpenTable'], function () {
  var P = activePeriod(), units = activeUnits();
  var prior = RG.CAL.priorPeriod(P);

  var all = [], themes = {}, count = 0, starSum = 0, negCount = 0, responded = 0, respHours = 0;
  units.forEach(function (u) {
    var g = RG.periodGuest(u, P);
    all = all.concat(g.reviews);
    count += g.count; starSum += g.rating * g.count; negCount += g.negCount;
    g.reviews.forEach(function (r) {
      if (r.responded) { responded++; respHours += r.responseHours; }
      var t = themes[r.theme] || (themes[r.theme] = { theme: r.theme, n: 0, neg: 0, stars: 0 });
      t.n++; t.stars += r.stars; if (r.negative) t.neg++;
    });
  });
  var rating = count ? starSum / count : 0;
  var priorRating = prior ? (function () {
    var c = 0, s = 0;
    units.forEach(function (u) { var g = RG.periodGuest(u, prior.key); c += g.count; s += g.rating * g.count; });
    return c ? s / c : 0;
  })() : null;

  var themeList = Object.keys(themes).map(function (k) {
    var t = themes[k]; t.avg = t.stars / t.n; t.negRate = t.neg / t.n; return t;
  }).sort(function (a, b) { return b.neg - a.neg; });
  var maxNeg = Math.max.apply(null, themeList.map(function (t) { return t.neg; })) || 1;

  var themeRows = themeList.map(function (t) {
    return '<tr><td><b>' + esc(t.theme) + '</b></td>' +
      '<td class="num">' + fmtNum(t.n) + '</td>' +
      '<td class="num">' + fmtNum(t.neg) + '</td>' +
      '<td style="width:30%"><div class="rg-bar"><i class="' +
        (t.negRate > 0.4 ? 'bad' : t.negRate > 0.22 ? 'warn' : 'good') +
        '" style="width:' + (t.neg / maxNeg * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(t.negRate) + '</td>' +
      '<td class="num">' + t.avg.toFixed(2) + '</td></tr>';
  }).join('');

  /* by unit, with the conditions join */
  var unitRows = units.map(function (u) {
    var g = RG.periodGuest(u, P);
    var pl = RG.periodPL(u, P);
    var top = g.themes[0];
    return '<tr><td class="unit-cell"><b>' + esc(RG.unitById[u].name) + '</b>' +
      '<span>' + esc(RG.unitById[u].city) + '</span></td>' +
      '<td class="num">' + stars(g.rating) + ' <b>' + g.rating.toFixed(2) + '</b></td>' +
      '<td class="num">' + fmtNum(g.count) + '</td>' +
      '<td class="num">' + fmtNum(g.negCount) + '</td>' +
      '<td>' + (top ? pill(top.theme, top.negRate > 0.35 ? 'bad' : 'warn') : '') + '</td>' +
      '<td class="num">' + traced(fmtNum(g.conditions.laborPerCover, 3), {
        value: fmtNum(g.conditions.laborPerCover, 3) + ' labor hours per cover',
        formula: 'labor hours ÷ covers — the coverage a guest actually experienced',
        inputs: [['Labor hours', fmtNum(pl.laborHours, 0)], ['Covers', fmtNum(pl.covers)],
                 ['SPLH', fmt$c(pl.splh)], ['Food variance rate', fmtPct(g.conditions.variancePct)]],
        source: ['7shifts', 'Toast'], period: periodLabel(P),
        note: 'Thin coverage shows up as service-speed and wait-time complaints, not as a labor report.',
        drill: 'Labor & Scheduling' }) + '</td>' +
      '<td class="num">' + fmtPct(g.responseRate) + '</td>' +
      '<td class="num">' + (g.avgResponseHours == null ? '—' : g.avgResponseHours + ' hrs') + '</td></tr>';
  }).join('');

  /* the join: negative reviews against the conditions on their shift */
  var negatives = all.filter(function (r) { return r.negative; })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 14);
  var revHtml = negatives.map(function (r) {
    var u = RG.unitById[r.unit];
    var d = RG.CAL.byIso[r.date];
    var dl = RG.dayLabor(r.unit, r.date);
    var ds = RG.daySales(r.unit, r.date);
    var splh = dl.hours ? ds.net / dl.hours : 0;
    return '<div class="review">' +
      '<div class="review-head">' + stars(r.stars) +
        '<b style="font-size:12.5px">' + esc(r.author) + '</b>' +
        pill(r.platformLabel, 'neutral') + pill(r.theme, 'warn') +
        '<span style="margin-left:auto;font-size:11px;color:var(--color-slate-hint)">' +
        usDate(r.date) + ' · ' + d.dowName + '</span></div>' +
      '<div class="review-text">“' + esc(r.text) + '”</div>' +
      '<div class="review-meta">' + esc(u.short) + ' · ' + esc(r.daypart) +
        ' · <span class="traced"' + exp({
          value: 'That shift: ' + fmt$c(splh) + ' per labor hour',
          formula: 'the operating conditions on the day this review was written',
          inputs: [['Net sales that day', fmt$(ds.net)], ['Labor hours', fmtNum(dl.hours, 1)],
                   ['SPLH', fmt$c(splh)], ['Covers', fmtNum(ds.covers)],
                   ['Weather', ds.weather ? ds.weather.label : '—']],
          source: ['7shifts', 'Toast', 'Google'], period: usDate(r.date),
          note: 'This is the join a review platform cannot make: the complaint next to the shift that produced it.',
          drill: 'Labor & Scheduling' }) + '>what happened that shift</span>' +
        (r.responded ? ' · <span style="color:var(--color-green)">replied in ' + r.responseHours + ' hrs</span>'
                     : ' · <span style="color:var(--color-red)">no reply</span>') +
      '</div></div>';
  }).join('');

  return '<div class="stat-row">' +
    [['Composite rating', rating.toFixed(2), stars(rating)],
     ['vs. prior period', priorRating ? deltaChip((rating - priorRating) / priorRating) : '—',
      priorRating ? priorRating.toFixed(2) + ' last period' : ''],
     ['Reviews', fmtNum(count), 'across all platforms'],
     ['Negative', fmtNum(negCount), fmtPct(negCount / (count || 1)) + ' of volume'],
     ['Response rate', fmtPct(responded / (count || 1)), 'operator replies'],
     ['Avg response time', responded ? Math.round(respHours / responded) + ' hrs' : '—', 'to a review']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    '<div class="two-col">' +
      card({ title: 'Sentiment by theme', sub: 'What guests are actually complaining about',
        sources: ['Google', 'Yelp'],
        body: table({ id: 'th', cols: [{ label: 'Theme' }, { label: 'Mentions', num: true },
          { label: 'Negative', num: true }, { label: '' }, { label: 'Neg rate', num: true },
          { label: 'Avg stars', num: true }], rows: [themeRows] }) }) +
      card({ title: 'By restaurant', sub: 'Rating against the coverage guests experienced',
        sources: ['Google', '7shifts'],
        body: table({ id: 'gu', cols: [{ label: 'Restaurant' }, { label: 'Rating', num: true },
          { label: 'Reviews', num: true }, { label: 'Neg', num: true }, { label: 'Top complaint' },
          { label: 'Hrs/cover', num: true }, { label: 'Replied', num: true },
          { label: 'Response', num: true }], rows: [unitRows] }) }) +
    '</div>' +

    card({ title: 'Negative review inbox',
      sub: 'Every complaint linked to the shift that produced it. This join is the whole point — ' +
        'a review platform can tell you the rating fell; only this can tell you which Friday, and why.',
      sources: ['Google', 'Yelp', 'OpenTable', '7shifts'],
      body: revHtml || '<div style="padding:20px;color:var(--color-text-muted)">No negative reviews this period.</div>' });
});
