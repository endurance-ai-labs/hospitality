/* People & HR */
renderPage('People & HR', 'Roster, turnover, hiring and certification currency',
  ['7shifts', 'ADP'], function () {
  var P = activePeriod(), units = activeUnits();
  var wages = can('wages');
  var tot = { headcount: 0, hourly: 0, open: 0, applicants: 0, certs: [] };
  var tenure = { '0-90 days': 0, '90d-1yr': 0, '1-2 yrs': 0, '2+ yrs': 0 };
  var turnSum = 0, retSum = 0, fillSum = 0, trainSum = 0;

  units.forEach(function (u) {
    var pp = RG.periodPeople(u, P);
    tot.headcount += pp.headcount; tot.hourly += pp.hourly;
    tot.open += pp.openRoles; tot.applicants += pp.applicants;
    Object.keys(tenure).forEach(function (k) { tenure[k] += pp.tenure[k]; });
    turnSum += pp.turnoverAnnualised; retSum += pp.ninetyDayRetention;
    fillSum += pp.daysToFill; trainSum += pp.trainingComplete;
    pp.certsExpiring.forEach(function (c) { c.unit = u; tot.certs.push(c); });
  });
  var n = units.length;
  tot.certs.sort(function (a, b) { return a.expires < b.expires ? -1 : 1; });

  var unitRows = units.map(function (u) {
    var pp = RG.periodPeople(u, P), un = RG.unitById[u];
    var tone = pp.turnoverAnnualised > 1.0 ? 'bad' : pp.turnoverAnnualised > 0.75 ? 'warn' : 'good';
    return '<tr><td class="unit-cell"><b>' + esc(un.name) + '</b><span>' + esc(un.city) + '</span></td>' +
      '<td class="num">' + fmtNum(pp.headcount) + '</td>' +
      '<td class="num">' + traced(fmtPct(pp.turnoverAnnualised), {
        value: fmtPct(pp.turnoverAnnualised) + ' annualised turnover',
        formula: 'separations in the period, annualised over average headcount',
        inputs: [['Headcount', fmtNum(pp.headcount)],
                 ['90-day retention', fmtPct(pp.ninetyDayRetention)],
                 ['Open roles', fmtNum(pp.openRoles)],
                 ['Cost per hire', fmt$(pp.costPerHire)]],
        source: ['ADP', '7shifts'], period: periodLabel(P),
        note: 'Full-service hourly turnover runs 70–110% industry-wide. The number that matters is ' +
              'the 90-day figure — most of the cost is in people who leave before they are productive.' }) + '</td>' +
      '<td style="width:16%"><div class="rg-bar"><i class="' + tone + '" style="width:' +
        Math.min(100, pp.turnoverAnnualised / 1.4 * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(pp.ninetyDayRetention) + '</td>' +
      '<td class="num">' + fmtNum(pp.openRoles) + '</td>' +
      '<td class="num">' + fmtNum(pp.daysToFill) + '</td>' +
      (wages ? '<td class="num">' + fmt$(pp.costPerHire) + '</td>' : '') +
      '<td class="num">' + fmtPct(pp.trainingComplete) + '</td></tr>';
  }).join('');

  var certRows = tot.certs.slice(0, 18).map(function (c) {
    var days = Math.round((RG.CAL.toTs(c.expires) - RG.CAL.toTs(RG.CAL.TODAY)) / 86400000);
    return '<tr><td><b>' + esc(c.name) + '</b>' +
      '<div style="font-size:10px;color:var(--color-slate-hint)">' + esc(c.role) + ' · ' +
      esc(RG.unitById[c.unit].short) + '</div></td>' +
      '<td>' + esc(c.cert) + '</td>' +
      '<td>' + usDate(c.expires) + '</td>' +
      '<td class="num">' + days + ' days</td>' +
      '<td>' + pill(days < 14 ? 'urgent' : days < 30 ? 'soon' : 'scheduled',
        days < 14 ? 'bad' : days < 30 ? 'warn' : 'neutral') + '</td></tr>';
  }).join('');

  var maxT = Math.max.apply(null, Object.keys(tenure).map(function (k) { return tenure[k]; })) || 1;
  var tenureRows = Object.keys(tenure).map(function (k) {
    return '<tr><td><b>' + esc(k) + '</b></td>' +
      '<td class="num">' + fmtNum(tenure[k]) + '</td>' +
      '<td style="width:44%"><div class="rg-bar"><i class="' +
        (k === '0-90 days' ? 'warn' : k === '2+ yrs' ? 'good' : '') +
        '" style="width:' + (tenure[k] / maxT * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(tenure[k] / (tot.hourly || 1)) + '</td></tr>';
  }).join('');

  /* roster for the unit in scope */
  var focus = units[0];
  var roster = RG.rosterFor(focus).slice().sort(function (a, b) { return b.tenureDays - a.tenureDays; });
  var rosterRows = roster.slice(0, 25).map(function (e) {
    return '<tr><td><b>' + esc(e.name) + '</b></td>' +
      '<td>' + esc(e.jobLabel) + '</td>' +
      '<td>' + (e.salaried ? pill('salaried', 'info') : e.ft ? pill('full time', 'neutral') :
        pill('part time', 'neutral')) + '</td>' +
      '<td>' + usDate(e.hired) + '</td>' +
      '<td class="num">' + (e.tenureDays != null ? fmtNum(e.tenureDays) + ' days' : '—') + '</td>' +
      (wages ? '<td class="num">' + (e.salaried ? fmt$(e.annual) + ' /yr' : fmt$c(e.rate) + ' /hr') + '</td>' : '') +
      '</tr>';
  }).join('');

  return '<div class="stat-row">' +
    [['Headcount', fmtNum(tot.headcount), fmtNum(tot.hourly) + ' hourly'],
     ['Turnover', fmtPct(turnSum / n), 'annualised'],
     ['90-day retention', fmtPct(retSum / n), 'the number that costs money'],
     ['Open roles', fmtNum(tot.open), fmtNum(Math.round(fillSum / n)) + ' days to fill'],
     ['Applicants', fmtNum(tot.applicants), 'this period'],
     ['Certs expiring', fmtNum(tot.certs.length), 'next 75 days']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'By restaurant', sub: 'Turnover, retention and hiring throughput',
      tools: gridTools('hru', 'People by unit ' + P), sources: ['ADP', '7shifts'],
      body: table({ id: 'hru', cols: [{ label: 'Restaurant' }, { label: 'Headcount', num: true },
        { label: 'Turnover', num: true }, { label: '' }, { label: '90-day', num: true },
        { label: 'Open', num: true }, { label: 'Days to fill', num: true }]
        .concat(wages ? [{ label: 'Cost/hire', num: true }] : [])
        .concat([{ label: 'Training', num: true }]), rows: [unitRows] }) }) +

    '<div class="two-col">' +
      card({ title: 'Tenure distribution', sub: 'Hourly team only', sources: ['ADP'],
        body: table({ id: 'ten', cols: [{ label: 'Tenure band' }, { label: 'People', num: true },
          { label: '' }, { label: 'Share', num: true }], rows: [tenureRows] }) +
          '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
          'A heavy 0–90 day band is the expensive kind of turnover: recruiting cost, training hours, ' +
          'and a period of lower productivity that shows up in the labor line and in service-speed ' +
          'complaints on the ' +
          '<a href="/hospitality/guest" style="color:var(--color-blue);font-weight:700;text-decoration:none">' +
          'reputation page</a>.</div>' }) +
      card({ title: 'Certification expiry', sub: 'Food handler and alcohol service currency',
        sources: ['ADP'],
        body: table({ id: 'certs', cols: [{ label: 'Team member' }, { label: 'Certification' },
          { label: 'Expires' }, { label: 'In', num: true }, { label: '' }], rows: [certRows] }) }) +
    '</div>' +

    card({ title: 'Roster — ' + esc(RG.unitById[focus].name), sub: 'Longest tenure first',
      tools: gridTools('ros', 'Roster'), sources: ['7shifts', 'ADP'],
      body: table({ id: 'ros', cols: [{ label: 'Name' }, { label: 'Role' }, { label: 'Status' },
        { label: 'Hired' }, { label: 'Tenure', num: true }]
        .concat(wages ? [{ label: 'Rate', num: true }] : []), rows: [rosterRows] }) });
});
