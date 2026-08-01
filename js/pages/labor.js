/* Labor & Scheduling */
renderPage('Labor & Scheduling', 'Hours, productivity, overtime and premium exposure',
  ['7shifts', 'ADP', 'Toast'], function () {
  var P = activePeriod(), units = activeUnits();
  var prior = RG.CAL.priorPeriod(P);
  var days = RG.CAL.daysIn(P);
  var L = RG.sumLabor(units, days);
  var Lp = prior ? RG.sumLabor(units, RG.CAL.daysIn(prior.key)) : null;
  var s = RG.sumDays(units, days);
  var wages = can('wages');

  var burden = RG.rand.cents((L.cost + L.mgr) * RG.PL_RATES.payrollBurden);
  var total = RG.rand.cents(L.cost + L.mgr + burden);

  var stats = '<div class="stat-row">' +
    [['Total labor', wages ? fmt$(total) : '—', fmtPct(total / s.net) + ' of net sales'],
     ['Hours', fmtNum(L.hours), 'scheduled + actual'],
     ['SPLH', fmt$c(s.net / (L.hours || 1)), 'sales per labor hour'],
     ['Overtime', wages ? fmt$(L.otCost) : '—', fmtNum(L.otHours, 1) + ' hrs'],
     ['Break premiums', wages ? fmt$(L.premiums) : '—', 'California exposure'],
     ['vs. prior', Lp ? deltaChip((total - (Lp.total + Lp.total * 0)) / Lp.total, { lowerIsBetter: true }) : '—', '']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>';

  /* ---- bridge ---- */
  var b = prior ? RG.laborBridge(units, prior.key, P) : null;

  /* ---- by job code ---- */
  var jobRows = RG.JOBCODES.filter(function (j) { return !j.salaried; }).map(function (j) {
    var x = L.byJob[j.id] || { hours: 0, cost: 0 };
    return '<tr><td><b>' + esc(j.label) + '</b>' +
      '<div style="font-size:10px;color:var(--color-slate-hint)">' +
      (j.boh ? 'Back of house' : 'Front of house') + (j.tipped ? ' · tipped' : '') + '</div></td>' +
      '<td class="num">' + fmtNum(x.hours, 1) + '</td>' +
      '<td style="width:26%"><div class="rg-bar"><i class="' + (j.boh ? 'warn' : '') + '" style="width:' +
        (x.hours / (L.hours || 1) * 100).toFixed(1) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(x.hours / (L.hours || 1)) + '</td>' +
      (wages ? '<td class="num">' + fmt$(x.cost) + '</td>' : '') +
      (wages ? '<td class="num">' + fmt$c(x.cost / (x.hours || 1)) + '</td>' : '') +
      '</tr>';
  }).join('');

  /* ---- daily schedule vs actual ---- */
  var dayRows = days.map(function (d) {
    var hrs = 0, cost = 0, ot = 0, prem = 0, net = 0, sched = 0, closed = true;
    units.forEach(function (u) {
      var x = RG.dayLabor(u, d.iso), ds = RG.daySales(u, d.iso);
      if (ds.closed) return;
      closed = false;
      hrs += x.hours; cost += x.cost; ot += x.otHours; prem += x.premiums;
      sched += (x.schedHours || 0); net += ds.net;
    });
    if (closed) return '';
    var splh = net / (hrs || 1);
    var varH = hrs - sched;
    return '<tr><td>' + usDate(d.iso) +
      '<div style="font-size:10px;color:var(--color-slate-hint)">' + d.dowName + '</div></td>' +
      '<td class="num">' + fmt$(net) + '</td>' +
      '<td class="num">' + fmtNum(sched, 1) + '</td>' +
      '<td class="num">' + fmtNum(hrs, 1) + '</td>' +
      '<td class="num">' + (Math.abs(varH) < 0.5 ? '—' :
        '<span class="chip ' + (varH > 0 ? 'chip-bad' : 'chip-good') + '">' +
        (varH > 0 ? '+' : '') + fmtNum(varH, 1) + '</span>') + '</td>' +
      '<td class="num">' + traced(fmt$c(splh), {
        value: fmt$c(splh) + ' per labor hour',
        formula: 'net sales ÷ hours worked, for this business day',
        inputs: [['Net sales', fmt$(net)], ['Hours', fmtNum(hrs, 1)],
                 ['Scheduled hours', fmtNum(sched, 1)]],
        source: ['7shifts', 'Toast'], period: usDate(d.iso) + ' · ' + d.dowName,
        note: 'Scheduling target is set off the sales forecast, so variance here is execution.' }) + '</td>' +
      (wages ? '<td class="num">' + fmtNum(ot, 1) + '</td>' : '') +
      (wages ? '<td class="num">' + (prem ? fmt$(prem) : '—') + '</td>' : '') +
      '</tr>';
  }).join('');

  /* ---- overtime watch list ---- */
  var otByEmp = {};
  units.forEach(function (u) {
    days.forEach(function (d) {
      RG.dayLabor(u, d.iso).shifts.forEach(function (sh) {
        if (!sh.otHours) return;
        var e = otByEmp[sh.emp] || (otByEmp[sh.emp] = {
          name: sh.name, job: sh.jobLabel, unit: u, hours: 0, ot: 0, cost: 0 });
        e.ot += sh.otHours;
        e.hours += sh.hours;
        e.cost = RG.rand.cents(e.cost + sh.otHours * sh.rate * 1.5);
      });
    });
  });
  var otList = Object.keys(otByEmp).map(function (k) { return otByEmp[k]; })
    .sort(function (a, b) { return b.ot - a.ot; }).slice(0, 12);
  var otRows = otList.length ? otList.map(function (e) {
    return '<tr><td><b>' + esc(e.name) + '</b><div style="font-size:10px;color:var(--color-slate-hint)">' +
      esc(e.job) + ' · ' + esc(RG.unitById[e.unit].short) + '</div></td>' +
      '<td class="num">' + fmtNum(e.hours, 1) + '</td>' +
      '<td class="num">' + fmtNum(e.ot, 1) + '</td>' +
      '<td class="num">' + fmtPct(e.ot / (e.hours || 1)) + '</td>' +
      (wages ? '<td class="num">' + fmt$(e.cost) + '</td>' : '') + '</tr>';
  }).join('') : '<tr><td colspan="5" style="padding:18px;text-align:center;color:var(--color-text-muted)">' +
    'No overtime recorded in the period.</td></tr>';

  /* ---- CA break-premium exposure ---- */
  var caUnits = units.filter(function (u) { return RG.unitById[u].state === 'CA'; });
  var premNote = caUnits.length
    ? 'California requires a 30-minute unpaid meal break before the end of the fifth hour. A missed ' +
      'break owes one hour at the regular rate. ' + caUnits.length + ' of your ' + units.length +
      ' restaurants sit in California; Portland does not carry this exposure.'
    : 'No California units in scope — meal-break premiums do not apply.';

  return stats +
    '<div class="two-col">' +
      (b ? card({ title: 'Why labor moved', sub: periodLabel(prior.key) + ' → ' + periodLabel(P),
        sources: ['7shifts', 'ADP'],
        body: waterfall([
          ['Volume (hours)', b.volume, { value: fmt$c(b.volume),
            formula: '(hours this period − hours last period) × prior effective rate',
            inputs: [['Hours', fmtNum(b.fromHours, 1) + ' → ' + fmtNum(b.toHours, 1)],
                     ['Prior effective rate', fmt$c(b.fromRate) + '/hr']],
            source: ['7shifts'], period: periodLabel(P) }],
          ['Rate & premium', b.rate, { value: fmt$c(b.rate),
            formula: 'the remainder of the wage movement once volume and management are removed',
            inputs: [['Effective rate', fmt$c(b.fromRate) + ' → ' + fmt$c(b.toRate)],
                     ['Overtime change', fmt$(b.otDelta)],
                     ['Break premium change', fmt$(b.premiumDelta)]],
            source: ['ADP'], period: periodLabel(P) }],
          ['Management', b.manager]
        ], b.total) }) : '') +
      card({ title: 'Hours by job code', sub: 'Front and back of house split',
        sources: ['7shifts'],
        body: table({ id: 'jobs', cols: [{ label: 'Job code' }, { label: 'Hours', num: true },
          { label: '' }, { label: 'Share', num: true }].concat(wages ?
            [{ label: 'Cost', num: true }, { label: 'Eff. rate', num: true }] : []),
          rows: [jobRows] }) }) +
    '</div>' +

    card({ title: 'Overtime watch list', sub: 'Ranked by overtime hours accrued in the period. ' +
      'Overtime is computed weekly per employee at 40 hours, which is how it actually accrues.',
      tools: gridTools('ot', 'Overtime ' + P), sources: ['7shifts', 'ADP'],
      body: table({ id: 'ot', cols: [{ label: 'Employee' }, { label: 'Hours', num: true },
        { label: 'OT hours', num: true }, { label: 'OT share', num: true }].concat(wages ?
          [{ label: 'OT premium', num: true }] : []), rows: [otRows] }) +
        '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
        premNote + ' Premium exposure this period: <b>' + (wages ? fmt$(L.premiums) : 'restricted') +
        '</b>.</div>' }) +

    card({ title: 'Daily schedule versus actual', sub: 'Scheduled hours come off the sales forecast — ' +
      'the variance column is execution, not forecasting',
      tools: gridTools('lday', 'Daily labor ' + P), sources: ['7shifts', 'Toast'],
      body: table({ id: 'lday', cols: [{ label: 'Date' }, { label: 'Net sales', num: true },
        { label: 'Scheduled', num: true }, { label: 'Actual', num: true }, { label: 'Variance', num: true },
        { label: 'SPLH', num: true }].concat(wages ?
          [{ label: 'OT hrs', num: true }, { label: 'Premiums', num: true }] : []),
        rows: [dayRows],
        foot: '<tr><td><b>Period</b></td>' +
          '<td class="num"><b>' + fmt$(s.net) + '</b></td><td></td>' +
          '<td class="num"><b>' + fmtNum(L.hours, 1) + '</b></td><td></td>' +
          '<td class="num"><b>' + fmt$c(s.net / (L.hours || 1)) + '</b></td>' +
          (wages ? '<td class="num"><b>' + fmtNum(L.otHours, 1) + '</b></td>' +
            '<td class="num"><b>' + fmt$(L.premiums) + '</b></td>' : '') + '</tr>' }) });
});
