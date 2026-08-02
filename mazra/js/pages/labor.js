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

  /* ================= SCHEDULE CALENDAR =================
     A schedule is only readable one restaurant at a time, so this section
     always resolves to a single unit even when the page scope is wider. */
  var schedUnit = qs('su', '') && myUnits().indexOf(qs('su', '')) >= 0 ? qs('su', '') : units[0];
  var weeksInPeriod = [];
  RG.CAL.daysIn(P).forEach(function (d) {
    var w = RG.weekStart(d.iso);
    if (weeksInPeriod.indexOf(w) < 0) weeksInPeriod.push(w);
  });
  var schedWeek = weeksInPeriod.indexOf(qs('sw', '')) >= 0 ? qs('sw', '') : weeksInPeriod[0];
  /* default to the first day the unit actually trades — Bar Camino is dark
     on Mondays, and opening the timeline on a closed day reads as a bug */
  var schedDay = qs('sd', '') && RG.CAL.byIso[qs('sd', '')] ? qs('sd', '') : (function () {
    var wd = RG.CAL.DAYS.slice(RG.CAL.byIso[schedWeek].i, RG.CAL.byIso[schedWeek].i + 7);
    for (var i = 0; i < wd.length; i++) {
      if (!RG.daySales(schedUnit, wd[i].iso).closed) return wd[i].iso;
    }
    return schedWeek;
  })();
  var schedView = qs('sv', 'week');
  var schedFam = qs('sf', '');
  var schedFlag = qs('sfl', '');
  var schedQ = (qs('sq', '') || '').toLowerCase();
  window.scSet = function (k, v) { setQs(k, v); };

  function shiftMatch(sh) {
    if (schedFam && sh.family !== schedFam) return false;
    if (schedFlag === 'ot' && !sh.otHours) return false;
    if (schedFlag === 'brk' && sh.breakOk) return false;
    if (schedFlag === 'long' && sh.hours < 8) return false;
    if (schedQ && (sh.name + ' ' + sh.jobLabel).toLowerCase().indexOf(schedQ) < 0) return false;
    return true;
  }

  function opt(v, cur, label) {
    return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') +
      '>' + esc(label) + '</option>';
  }
  function pick(key, cur, opts, highlight) {
    return '<select class="scn-sel' + (highlight ? ' on' : '') +
      '" onchange="scSet(\'' + key + '\',this.value)">' +
      opts.map(function (o) { return opt(o[0], cur, o[1]); }).join('') + '</select>';
  }

  var weekDays = RG.CAL.DAYS.slice(RG.CAL.byIso[schedWeek].i, RG.CAL.byIso[schedWeek].i + 7);

  var schedControls =
    pick('su', schedUnit, myUnits().map(function (u) {
      return [u, RG.unitById[u].name]; })) +
    pick('sw', schedWeek, weeksInPeriod.map(function (w, i) {
      return [w, 'Week ' + (i + 1) + ' · ' + RG.CAL.usDate(w)]; })) +
    pick('sv', schedView, [['week', 'View: week grid'], ['day', 'View: day timeline']],
      schedView !== 'week') +
    (schedView === 'day'
      ? pick('sd', schedDay, weekDays.map(function (d) {
          return [d.iso, d.dowName + ' ' + RG.CAL.usDate(d.iso)]; }))
      : '') +
    pick('sf', schedFam, [['', 'Section: all']].concat(
      Object.keys(RGSched.FAMILY_LABEL).map(function (f) {
        return [f, 'Section: ' + RGSched.FAMILY_LABEL[f]]; })), !!schedFam) +
    pick('sfl', schedFlag, [['', 'Flag: none'], ['ot', 'Flag: overtime only'],
      ['brk', 'Flag: missed breaks only'], ['long', 'Flag: 8+ hour shifts']], !!schedFlag) +
    '<label class="exf-search" style="flex:0 1 170px"><input type="search" ' +
      'placeholder="Find a person…" value="' + esc(qs('sq', '')) +
      '" onchange="scSet(\'sq\',this.value)"></label>';

  var schedBody = schedView === 'day'
    ? RGSched.timeline(RGSched.daySheet(schedUnit, schedDay), { match: shiftMatch, wages: wages })
    : RGSched.weekGrid(schedUnit, schedWeek, { match: shiftMatch, wages: wages });

  var wkTot = { hours: 0, cost: 0, ot: 0, prem: 0, net: 0, shifts: 0, people: {} };
  weekDays.forEach(function (d) {
    var sh = RGSched.daySheet(schedUnit, d.iso);
    wkTot.hours = RG.rand.cents(wkTot.hours + sh.hours);
    wkTot.cost = RG.rand.cents(wkTot.cost + sh.cost);
    wkTot.ot = RG.rand.cents(wkTot.ot + sh.otHours);
    wkTot.prem = RG.rand.cents(wkTot.prem + sh.premiums);
    wkTot.net = RG.rand.cents(wkTot.net + sh.net);
    sh.shifts.forEach(function (x) { wkTot.shifts++; wkTot.people[x.emp] = 1; });
  });

  var schedStats = '<div class="stat-row" style="margin-bottom:14px">' +
    [['People scheduled', fmtNum(Object.keys(wkTot.people).length), fmtNum(wkTot.shifts) + ' shifts'],
     ['Hours', fmtNum(wkTot.hours, 0), 'this week'],
     ['Overtime', fmtNum(wkTot.ot, 1) + ' hrs', wages ? 'at 1.5x the base rate' : ''],
     ['Break premiums', wages ? fmt$(wkTot.prem) : '—', 'California exposure'],
     ['Labor cost', wages ? fmt$(wkTot.cost) : '—',
       wkTot.net ? fmtPct(wkTot.cost / wkTot.net) + ' of sales' : ''],
     ['SPLH', fmt$c(wkTot.hours ? wkTot.net / wkTot.hours : 0), 'sales per labor hour']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' +
        esc(r[2]) + '</i></div>';
    }).join('') + '</div>';

  var scheduleCard = card({
    title: 'Schedule — ' + RG.unitById[schedUnit].name,
    sub: schedView === 'day'
      ? 'Every shift on ' + RG.CAL.byIso[schedDay].dowName + ' ' + RG.CAL.usDate(schedDay) +
        ', on a real clock. Click any bar for the full shift record.'
      : 'Week of ' + RG.CAL.usDate(schedWeek) + '. Click any shift for the full record.',
    tools: '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' +
      schedControls + '</div>',
    sources: ['7shifts', 'ADP', RG.unitById[schedUnit].pos],
    body: schedStats + schedBody +
      '<div class="chart-note">Overtime accrues <b>weekly per employee</b> at 40 hours, so a Saturday ' +
      'shift is flagged on the strength of the whole week behind it, not its own length. The coverage ' +
      'and sales strips under the day timeline share one time axis — that is how you spot a room ' +
      'staffed at the wrong hours rather than simply over-staffed.</div>'
  });

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

  return stats + scheduleCard +
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
