/* ============================================================
   Restaurant OS — schedule calendar

   The view an actual scheduling manager works in: a Gantt timeline of
   every shift on a day, a week grid of every employee, a coverage curve
   against the hour-by-hour sales it is meant to serve, and a detail
   drawer that shows why each shift costs what it costs.

   Everything is derived from RG.dayLabor(), which computes overtime at
   the WEEK level per employee — so the OT flag on a Saturday shift knows
   about the hours worked Monday through Friday.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  var JOB_FAMILY = {
    server: 'foh', barista: 'bar', host: 'foh', busser: 'foh',
    grill: 'boh', prep: 'boh', dish: 'dish', sous: 'boh', mgr: 'mgr'
  };
  var FAMILY_COLOR = {
    foh:  '#2766d6', bar: '#e87ba4', boh: '#eb6834',
    dish: '#1baf7a', mgr: '#eda100'
  };
  var FAMILY_LABEL = { foh: 'Front of house', bar: 'Cafe', boh: 'Grill & prep', dish: 'Dish', mgr: 'Management' };

  var HOUR0 = 8, HOUR1 = 26;           /* 8am to 2am next day */
  /* Shifts end on fractional hours — 17.65 is 5:39p, not "5.649999999p".
     Minutes round to the nearest 5, the way a schedule is actually written. */
  function hourLabel(h) {
    var total = Math.round((((h % 24) + 24) % 24) * 60 / 5) * 5;
    var hh = Math.floor(total / 60) % 24, mm = total % 60;
    var ap = hh < 12 ? 'a' : 'p';
    var t = hh % 12 === 0 ? 12 : hh % 12;
    return t + (mm ? ':' + String(mm).padStart(2, '0') : '') + ap;
  }
  function pct(h) { return ((h - HOUR0) / (HOUR1 - HOUR0)) * 100; }

  /* sales spread across the hours each daypart actually covers */
  function hourlySales(unitId, iso) {
    var s = RG.daySales(unitId, iso);
    var out = {};
    for (var h = HOUR0; h < HOUR1; h++) out[h] = 0;
    if (s.closed) return out;
    RG.CAL.DAYPARTS.forEach(function (dp) {
      var v = s.byDaypart[dp.id] || 0;
      var from = Math.max(HOUR0, dp.from), to = Math.min(HOUR1, dp.to);
      var n = Math.max(1, to - from);
      for (var h = from; h < to; h++) out[h] = RG.rand.cents((out[h] || 0) + v / n);
    });
    return out;
  }

  /* every shift on a day, enriched with the context a manager needs */
  function daySheet(unitId, iso) {
    var L = RG.dayLabor(unitId, iso);
    var s = RG.daySales(unitId, iso);
    var roster = {};
    RG.rosterFor(unitId).forEach(function (e) { roster[e.id] = e; });
    var wkStart = RG.weekStart(iso);
    var wkDays = RG.CAL.DAYS.slice(RG.CAL.byIso[wkStart].i, RG.CAL.byIso[wkStart].i + 7);

    /* running weekly hours per employee up to and including this day */
    var weekly = {};
    wkDays.forEach(function (d) {
      if (d.iso > iso) return;
      (RG.dayLabor(unitId, d.iso).shifts || []).forEach(function (sh) {
        weekly[sh.emp] = RG.rand.cents((weekly[sh.emp] || 0) + sh.hours);
      });
    });

    var hs = hourlySales(unitId, iso);
    /* total labor hours on the clock in each hour — the denominator for
       any productivity read. Dividing the restaurant's sales by ONE
       person's hours would say a dishwasher earns $2,000 an hour. */
    var staffedHours = {};
    for (var hh = HOUR0; hh < HOUR1; hh++) {
      staffedHours[hh] = (L.shifts || []).reduce(function (a, x) {
        return a + (x.start <= hh && x.end > hh ? 1 : 0);
      }, 0);
    }
    var shifts = (L.shifts || []).map(function (sh, i) {
      var e = roster[sh.emp] || {};
      var fam = JOB_FAMILY[sh.job] || 'foh';
      /* sales that happened while this person was on the clock */
      var during = 0, coHours = 0;
      for (var h = Math.floor(sh.start); h < Math.min(HOUR1, Math.ceil(sh.end)); h++) {
        during = RG.rand.cents(during + (hs[h] || 0));
        coHours += staffedHours[h] || 0;
      }
      var needsBreak = sh.hours > 5;
      return {
        idx: i, id: unitId + ':' + iso + ':' + i,
        emp: sh.emp, name: sh.name, job: sh.job, jobLabel: sh.jobLabel,
        family: fam, color: FAMILY_COLOR[fam],
        start: sh.start, end: sh.end, hours: sh.hours,
        rate: sh.rate, cost: sh.cost, otHours: sh.otHours, premium: sh.premium,
        weeklyHours: weekly[sh.emp] || sh.hours,
        tenureDays: e.tenureDays, ft: e.ft, hired: e.hired,
        needsBreak: needsBreak,
        breakOk: !needsBreak || !sh.premium,
        salesDuring: during,
        /* the restaurant's productivity while this person was on, not theirs */
        splh: coHours ? RG.rand.cents(during / coHours) : 0,
        coHours: RG.rand.cents(coHours),
        boh: sh.boh
      };
    }).sort(function (a, b) {
      return (a.family === b.family)
        ? (a.start - b.start || a.name.localeCompare(b.name))
        : Object.keys(FAMILY_COLOR).indexOf(a.family) - Object.keys(FAMILY_COLOR).indexOf(b.family);
    });

    /* coverage: heads on the clock each hour */
    var coverage = {};
    for (var h = HOUR0; h < HOUR1; h++) {
      coverage[h] = shifts.filter(function (x) { return x.start <= h && x.end > h; }).length;
    }

    return {
      unit: unitId, iso: iso, shifts: shifts, coverage: coverage, hourly: hs,
      hours: L.hours, cost: L.cost, otHours: L.otHours, premiums: L.premiums,
      schedHours: L.schedHours || 0, net: s.net, covers: s.covers, closed: !!s.closed,
      splh: L.hours ? RG.rand.cents(s.net / L.hours) : 0
    };
  }

  /* ---- day timeline (Gantt) ---- */
  function timeline(sheet, opts) {
    opts = opts || {};
    var shifts = sheet.shifts.filter(opts.match || function () { return true; });
    if (!shifts.length) {
      return '<div style="padding:26px;text-align:center;color:var(--color-text-muted);font-size:13px">' +
        (sheet.closed ? 'Closed — no shifts scheduled.' : 'No shifts match the current filters.') + '</div>';
    }
    var ruler = '';
    for (var h = HOUR0; h < HOUR1; h += 2) {
      ruler += '<span class="sc-tick" style="left:' + pct(h).toFixed(2) + '%">' + hourLabel(h) + '</span>';
    }
    /* dinner band, so the eye finds peak trade without reading axes */
    var band = '<span class="sc-band" style="left:' + pct(17).toFixed(2) + '%;width:' +
      (pct(21) - pct(17)).toFixed(2) + '%"></span>';

    var lastFam = null;
    var rows = shifts.map(function (s) {
      var head = '';
      if (s.family !== lastFam) {
        lastFam = s.family;
        head = '<div class="sc-fam"><i style="background:' + s.color + '"></i>' +
          esc(FAMILY_LABEL[s.family]) + '</div>';
      }
      var left = pct(s.start), width = Math.max(1.5, pct(s.end) - pct(s.start));
      var flags = '';
      if (s.otHours > 0) flags += '<span class="sc-flag ot" title="Overtime">OT</span>';
      if (!s.breakOk) flags += '<span class="sc-flag br" title="Meal-break premium owed">BRK</span>';
      return head +
        '<div class="sc-row">' +
          '<div class="sc-who"><span class="sc-av" style="background:' + s.color + '">' +
            esc(s.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2)) + '</span>' +
            '<span class="sc-nm"><b>' + esc(s.name) + '</b><i>' + esc(s.jobLabel) + '</i></span></div>' +
          '<div class="sc-track">' + band +
            '<button class="sc-bar" style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) +
              '%;background:' + s.color + '" onclick="RGSched.detail(\'' + esc(sheet.unit) + '\',\'' +
              sheet.iso + '\',' + s.idx + ')"' +
              exp({ value: s.name + ' · ' + s.jobLabel,
                    formula: hourLabel(s.start) + ' – ' + hourLabel(s.end) + ' · ' + fmtNum(s.hours, 1) + ' hrs',
                    inputs: [['Rate', fmt$c(s.rate) + '/hr'], ['Shift cost', fmt$c(s.cost)],
                             ['Week to date', fmtNum(s.weeklyHours, 1) + ' hrs'],
                             ['Restaurant sales while on', fmt$(s.salesDuring)]],
                    source: ['7shifts'], period: usDate(sheet.iso),
                    drill: 'shift detail' }) + '>' +
              '<span class="sc-lab">' + hourLabel(s.start) + '–' + hourLabel(s.end) + ' · ' +
              fmtNum(s.hours, 1) + 'h</span>' + flags +
            '</button>' +
          '</div>' +
          '<div class="sc-end">' + (opts.wages ? fmt$(s.cost) : fmtNum(s.hours, 1) + 'h') + '</div>' +
        '</div>';
    }).join('');

    /* coverage strip + hourly sales, sharing the same x scale */
    var maxCov = Math.max.apply(null, Object.keys(sheet.coverage).map(function (k) { return sheet.coverage[k]; })) || 1;
    var maxSal = Math.max.apply(null, Object.keys(sheet.hourly).map(function (k) { return sheet.hourly[k]; })) || 1;
    var cov = '', sal = '';
    for (var q = HOUR0; q < HOUR1; q++) {
      var w = 100 / (HOUR1 - HOUR0);
      cov += '<span class="sc-cov" style="left:' + pct(q).toFixed(2) + '%;width:' + w.toFixed(2) +
        '%;height:' + ((sheet.coverage[q] / maxCov) * 100).toFixed(0) + '%" title="' +
        sheet.coverage[q] + ' on the clock at ' + hourLabel(q) + '"></span>';
      sal += '<span class="sc-sal" style="left:' + pct(q).toFixed(2) + '%;width:' + w.toFixed(2) +
        '%;height:' + ((sheet.hourly[q] / maxSal) * 100).toFixed(0) + '%" title="' +
        fmt$(sheet.hourly[q]) + ' at ' + hourLabel(q) + '"></span>';
    }

    return '<div class="sc">' +
      '<div class="sc-ruler"><div class="sc-who"></div><div class="sc-track">' + ruler +
        '</div><div class="sc-end"></div></div>' +
      '<div class="sc-body">' + rows + '</div>' +
      '<div class="sc-foot">' +
        '<div class="sc-who"><b>Coverage</b><i>heads on the clock</i></div>' +
        '<div class="sc-track sc-cov-track">' + cov + '</div><div class="sc-end">' +
        Math.max.apply(null, Object.keys(sheet.coverage).map(function (k) { return sheet.coverage[k]; })) +
        ' peak</div></div>' +
      '<div class="sc-foot">' +
        '<div class="sc-who"><b>Sales</b><i>by hour</i></div>' +
        '<div class="sc-track sc-sal-track">' + sal + '</div><div class="sc-end">' +
        fmt$(sheet.net) + '</div></div>' +
      '</div>';
  }

  /* ---- week grid: every employee against every day ---- */
  function weekGrid(unitId, weekStartIso, opts) {
    opts = opts || {};
    var start = RG.CAL.byIso[weekStartIso];
    var days = RG.CAL.DAYS.slice(start.i, start.i + 7);
    var byEmp = {};
    days.forEach(function (d) {
      daySheet(unitId, d.iso).shifts.forEach(function (s) {
        if (opts.match && !opts.match(s)) return;
        var e = byEmp[s.emp] || (byEmp[s.emp] = {
          emp: s.emp, name: s.name, jobLabel: s.jobLabel, family: s.family, color: s.color,
          days: {}, hours: 0, ot: 0, cost: 0, shifts: 0, premium: 0
        });
        (e.days[d.iso] = e.days[d.iso] || []).push(s);
        e.hours = RG.rand.cents(e.hours + s.hours);
        e.ot = RG.rand.cents(e.ot + s.otHours);
        e.cost = RG.rand.cents(e.cost + s.cost);
        e.premium = RG.rand.cents(e.premium + s.premium);
        e.shifts++;
      });
    });
    var list = Object.keys(byEmp).map(function (k) { return byEmp[k]; })
      .sort(function (a, b) {
        return (a.family === b.family) ? b.hours - a.hours
          : Object.keys(FAMILY_COLOR).indexOf(a.family) - Object.keys(FAMILY_COLOR).indexOf(b.family);
      });
    if (!list.length) return '<div style="padding:26px;text-align:center;color:var(--color-text-muted);' +
      'font-size:13px">No shifts match the current filters this week.</div>';

    var head = '<tr><th style="text-align:left">Employee</th>' +
      days.map(function (d) {
        var s = RG.daySales(unitId, d.iso);
        return '<th>' + d.dowName + '<span class="sc-dh">' + RG.CAL.usDate(d.iso).slice(0, 5) +
          (s.closed ? ' · closed' : '') + '</span></th>';
      }).join('') +
      '<th class="num">Hours</th><th class="num">OT</th>' +
      (opts.wages ? '<th class="num">Cost</th>' : '') + '</tr>';

    var lastFam = null;
    var body = list.map(function (e) {
      var sep = '';
      if (e.family !== lastFam) {
        lastFam = e.family;
        sep = '<tr class="sc-grp"><td colspan="' + (10 + (opts.wages ? 1 : 0)) + '">' +
          '<i style="background:' + e.color + '"></i>' + esc(FAMILY_LABEL[e.family]) + '</td></tr>';
      }
      return sep + '<tr>' +
        '<td class="sc-gname"><b>' + esc(e.name) + '</b><span>' + esc(e.jobLabel) + ' · ' +
          e.shifts + ' shift' + (e.shifts > 1 ? 's' : '') + '</span></td>' +
        days.map(function (d) {
          var ss = e.days[d.iso];
          if (!ss) return '<td class="sc-off">·</td>';
          return '<td>' + ss.map(function (s) {
            return '<button class="sc-cell" style="border-left-color:' + s.color + '" onclick="RGSched.detail(\'' +
              esc(unitId) + '\',\'' + d.iso + '\',' + s.idx + ')"' +
              exp({ value: s.name + ' · ' + usDate(d.iso),
                    formula: hourLabel(s.start) + ' – ' + hourLabel(s.end),
                    inputs: [['Hours', fmtNum(s.hours, 2)], ['Rate', fmt$c(s.rate) + '/hr'],
                             ['Cost', fmt$c(s.cost)],
                             ['Overtime', s.otHours ? fmtNum(s.otHours, 2) + ' hrs' : 'none']],
                    source: ['7shifts'], period: usDate(d.iso) }) + '>' +
              hourLabel(s.start) + '–' + hourLabel(s.end) +
              '<span>' + fmtNum(s.hours, 1) + 'h' + (s.otHours ? ' · OT' : '') +
              (!s.breakOk ? ' · BRK' : '') + '</span></button>';
          }).join('') + '</td>';
        }).join('') +
        '<td class="num"><b>' + fmtNum(e.hours, 1) + '</b></td>' +
        '<td class="num">' + (e.ot ? '<span class="chip chip-bad">' + fmtNum(e.ot, 1) + '</span>' : '—') + '</td>' +
        (opts.wages ? '<td class="num">' + fmt$(e.cost) + '</td>' : '') +
        '</tr>';
    }).join('');

    var tot = list.reduce(function (a, e) {
      return { h: a.h + e.hours, ot: a.ot + e.ot, c: a.c + e.cost };
    }, { h: 0, ot: 0, c: 0 });

    return '<div class="demo-tbl-wrap grid-scroll"><table class="demo-tbl sc-grid" id="sc-week" data-nofilter>' +
      '<thead>' + head + '</thead><tbody>' + body + '</tbody>' +
      '<tfoot><tr><td><b>' + list.length + ' scheduled</b></td>' +
      days.map(function (d) {
        var dl = RG.dayLabor(unitId, d.iso);
        return '<td class="num">' + (dl.hours ? fmtNum(dl.hours, 0) + 'h' : '—') + '</td>';
      }).join('') +
      '<td class="num"><b>' + fmtNum(tot.h, 0) + '</b></td>' +
      '<td class="num"><b>' + fmtNum(tot.ot, 1) + '</b></td>' +
      (opts.wages ? '<td class="num"><b>' + fmt$(tot.c) + '</b></td>' : '') +
      '</tr></tfoot></table></div>';
  }

  /* ---- shift detail drawer ---- */
  function detail(unitId, iso, idx) {
    var sheet = daySheet(unitId, iso);
    var s = sheet.shifts[idx];
    if (!s) return;
    var u = RG.unitById[unitId];
    var d = RG.CAL.byIso[iso];
    var wages = can('wages');

    var rows = [
      ['Shift', hourLabel(s.start) + ' – ' + hourLabel(s.end) + '  (' + fmtNum(s.hours, 2) + ' hrs)'],
      ['Role', s.jobLabel + ' · ' + FAMILY_LABEL[s.family]],
      ['Employment', (s.ft ? 'Full time' : 'Part time') +
        (s.tenureDays != null ? ' · ' + fmtNum(s.tenureDays) + ' days tenure' : '')],
      ['Hired', s.hired ? usDate(s.hired) : '—'],
      ['Week to date', fmtNum(s.weeklyHours, 2) + ' hrs' +
        (s.weeklyHours > 40 ? '  — over the 40-hour overtime threshold' : '')],
      ['Overtime on this shift', s.otHours ? fmtNum(s.otHours, 2) + ' hrs at 1.5×' : 'none']
    ];
    if (wages) rows.push(
      ['Rate', fmt$c(s.rate) + ' / hr'],
      ['Shift cost', fmt$c(s.cost)],
      ['Meal-break premium', s.premium ? fmt$c(s.premium) + ' owed' : 'none']
    );
    rows.push(
      ['Meal break', !s.needsBreak ? 'Not required (shift under 5 hours)'
        : s.breakOk ? 'Taken and recorded' : 'MISSED — one hour at the regular rate is owed'],
      ['Restaurant sales while they were on', fmt$(s.salesDuring)],
      ['Total labor hours on the clock then', fmtNum(s.coHours, 1) + ' hrs (all staff)'],
      ['Restaurant sales per labor hour then', fmt$c(s.splh)]
    );

    var ov = document.createElement('div');
    ov.className = 'sc-ov';
    ov.innerHTML =
      '<div class="sc-drawer">' +
        '<div class="sc-dhead" style="--fam:' + s.color + '">' +
          '<span class="sc-av lg" style="background:' + s.color + '">' +
            esc(s.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2)) + '</span>' +
          '<div><b>' + esc(s.name) + '</b><i>' + esc(s.jobLabel) + ' · ' + esc(u.name) + '</i>' +
          '<i>' + esc(d.dowName) + ' ' + usDate(iso) + '</i></div>' +
          '<button class="slk-x" onclick="this.closest(\'.sc-ov\').remove()">✕</button>' +
        '</div>' +
        (s.otHours || !s.breakOk ? '<div class="sc-alert">' +
          (s.otHours ? '<span>⚠ Overtime — ' + fmtNum(s.otHours, 2) + ' hrs at 1.5×. Overtime accrues ' +
            'weekly per employee, so this is driven by the whole week, not this shift alone.</span>' : '') +
          (!s.breakOk ? '<span>⚠ Meal break missed on a ' + fmtNum(s.hours, 1) + '-hour shift. In ' +
            'California that owes one hour at the regular rate.</span>' : '') +
          '</div>' : '') +
        '<div class="sc-drows">' + rows.map(function (r) {
          return '<div class="sc-drow"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
        }).join('') + '</div>' +
        '<div class="sc-dfoot">Punch and schedule data from 7shifts · wages from ADP · sales from ' +
          esc(u.pos) + '. Demo environment, fictional data.</div>' +
      '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  RG.sched = {
    daySheet: daySheet, timeline: timeline, weekGrid: weekGrid, detail: detail,
    FAMILY_COLOR: FAMILY_COLOR, FAMILY_LABEL: FAMILY_LABEL, hourLabel: hourLabel
  };
  global.RGSched = RG.sched;
})(typeof window !== 'undefined' ? window : globalThis);
