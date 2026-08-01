/* Food Safety & Compliance */
renderPage('Food Safety & Compliance', 'Line checks, inspections, licences and incidents',
  ['R365', 'Docs'], function () {
  var P = activePeriod(), units = activeUnits();
  var allChecks = [], correctives = [], inspections = [];
  var completeSum = 0, onTimeSum = 0;
  units.forEach(function (u) {
    var sf = RG.periodSafety(u, P);
    sf.checks.forEach(function (c) { c.unitId = u; allChecks.push(c); });
    sf.correctives.forEach(function (c) { c.unitId = u; correctives.push(c); });
    sf.inspections.forEach(function (i) { inspections.push(i); });
    completeSum += sf.completeRate; onTimeSum += sf.onTimeRate;
  });
  inspections.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var n = units.length;
  var missed = allChecks.filter(function (c) { return !c.complete; });

  var unitRows = units.map(function (u) {
    var sf = RG.periodSafety(u, P);
    var latest = sf.inspections[0];
    var ex = RG.periodExcursions(u, P);
    var tone = sf.completeRate > 0.94 ? 'good' : sf.completeRate > 0.88 ? 'warn' : 'bad';
    return '<tr><td class="unit-cell"><b>' + esc(RG.unitById[u].name) + '</b>' +
      '<span>' + esc(RG.unitById[u].city) + ', ' + esc(RG.unitById[u].state) + '</span></td>' +
      '<td class="num">' + traced(fmtPct(sf.completeRate), {
        value: fmtPct(sf.completeRate) + ' checklist completion',
        formula: 'completed line checks ÷ required line checks in the period',
        inputs: [['Required', fmtNum(sf.checks.length)],
                 ['Completed', fmtNum(sf.checks.filter(function (c) { return c.complete; }).length)],
                 ['On time', fmtPct(sf.onTimeRate)],
                 ['Corrective actions', fmtNum(sf.correctives.length)]],
        source: ['R365'], period: periodLabel(P),
        note: 'Three checks a day — open, mid-shift and close. A completion rate below 90% is the ' +
              'leading indicator that shows up as an inspection finding a quarter later.' }) + '</td>' +
      '<td style="width:16%"><div class="rg-bar"><i class="' + tone + '" style="width:' +
        (sf.completeRate * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(sf.onTimeRate) + '</td>' +
      '<td class="num">' + fmtNum(sf.correctives.length) + '</td>' +
      '<td class="num">' + fmtNum(ex.length) + '</td>' +
      '<td class="num">' + (latest ? latest.score : '—') + '</td>' +
      '<td>' + (latest ? pill(latest.grade, latest.grade === 'A' ? 'good' :
        latest.grade === 'A-' ? 'good' : latest.grade === 'B' ? 'warn' : 'bad') : '—') + '</td>' +
      '<td>' + (latest ? usDate(latest.date) : '—') + '</td></tr>';
  }).join('');

  var inspRows = inspections.map(function (i) {
    return '<tr><td>' + usDate(i.date) + '</td>' +
      '<td>' + esc(RG.unitById[i.unit].name) + '</td>' +
      '<td class="num"><b>' + i.score + '</b></td>' +
      '<td>' + pill(i.grade, i.grade === 'A' || i.grade === 'A-' ? 'good' :
        i.grade === 'B' ? 'warn' : 'bad') + '</td>' +
      '<td class="num">' + (i.critical || '—') + '</td>' +
      '<td style="font-size:11.5px;color:var(--color-text-muted)">' + esc(i.note) + '</td></tr>';
  }).join('');

  /* licence & permit calendar */
  var LICENCES = [['Health permit', 210], ['Business licence', 150], ['Alcohol licence (ABC)', 95],
                  ['Fire / hood suppression', 60], ['Weights & measures', 300]];
  var licRows = [];
  units.forEach(function (u) {
    LICENCES.forEach(function (l, i) {
      var days = Math.round(RG.rand.between('lic:' + u + i, 5, l[1]));
      licRows.push({ unit: u, name: l[0], days: days,
        expires: RG.CAL.iso(RG.CAL.toTs(RG.CAL.TODAY) + days * 86400000) });
    });
  });
  licRows.sort(function (a, b) { return a.days - b.days; });
  var licHtml = licRows.slice(0, 14).map(function (l) {
    return '<tr><td><b>' + esc(l.name) + '</b></td>' +
      '<td>' + esc(RG.unitById[l.unit].short) + '</td>' +
      '<td>' + usDate(l.expires) + '</td>' +
      '<td class="num">' + l.days + ' days</td>' +
      '<td>' + pill(l.days < 30 ? 'renew now' : l.days < 60 ? 'due soon' : 'current',
        l.days < 30 ? 'bad' : l.days < 60 ? 'warn' : 'good') + '</td></tr>';
  }).join('');

  var corrRows = correctives.slice(0, 14).map(function (c) {
    return '<tr><td>' + usDate(c.date) + '</td>' +
      '<td>' + esc(RG.unitById[c.unitId].short) + '</td>' +
      '<td>' + esc(c.name) + '</td>' +
      '<td style="font-size:11.5px;color:var(--color-text-muted)">' + esc(c.corrective) + '</td></tr>';
  }).join('');

  var worstScore = inspections.length ? Math.min.apply(null, inspections.map(function (i) { return i.score; })) : null;

  return '<div class="stat-row">' +
    [['Checklist completion', fmtPct(completeSum / n), 'open, mid-shift, close'],
     ['On time', fmtPct(onTimeSum / n), 'within the window'],
     ['Missed checks', fmtNum(missed.length), 'in the period'],
     ['Corrective actions', fmtNum(correctives.length), 'product discarded or re-prepped'],
     ['Inspections on file', fmtNum(inspections.length), 'trailing'],
     ['Lowest score', worstScore == null ? '—' : worstScore, worstScore != null && worstScore < 90 ?
        'below the A threshold' : '']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'By restaurant', sub: 'Execution and inspection standing',
      tools: gridTools('cmpl', 'Compliance ' + P), sources: ['R365', 'Docs'],
      body: table({ id: 'cmpl', cols: [{ label: 'Restaurant' }, { label: 'Completion', num: true },
        { label: '' }, { label: 'On time', num: true }, { label: 'Correctives', num: true },
        { label: 'Temp events', num: true }, { label: 'Last score', num: true },
        { label: 'Grade' }, { label: 'Inspected' }], rows: [unitRows] }) }) +

    '<div class="two-col">' +
      card({ title: 'Inspection history', sub: 'County health inspections. A grade of C or below is a ' +
        'hard flag — it goes to the top of the executive triage feed, not into a report.',
        sources: ['Docs'],
        body: inspections.length ? table({ id: 'insp', cols: [{ label: 'Date' }, { label: 'Restaurant' },
          { label: 'Score', num: true }, { label: 'Grade' }, { label: 'Critical', num: true },
          { label: 'Notes' }], rows: [inspRows] }) :
          '<div style="padding:20px;color:var(--color-text-muted)">No inspections on file for the ' +
          'units in scope.</div>' }) +
      card({ title: 'Licence & permit calendar', sub: 'Soonest expiry first', sources: ['Docs'],
        body: table({ id: 'lic', cols: [{ label: 'Licence' }, { label: 'Unit' }, { label: 'Expires' },
          { label: 'In', num: true }, { label: '' }], rows: [licHtml] }) +
          '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
          'A lapsed alcohol licence closes the bar; a lapsed health permit closes the restaurant. ' +
          'This is a small module that exists purely to make a very expensive mistake impossible.</div>' }) +
    '</div>' +

    card({ title: 'Corrective action log', sub: 'What was found on a line check and what was done about it',
      tools: gridTools('corr', 'Corrective actions ' + P), sources: ['R365'],
      body: correctives.length ? table({ id: 'corr', cols: [{ label: 'Date' }, { label: 'Unit' },
        { label: 'Check' }, { label: 'Action taken' }], rows: [corrRows] }) :
        '<div style="padding:20px;color:var(--color-text-muted)">No corrective actions recorded.</div>' });
});
