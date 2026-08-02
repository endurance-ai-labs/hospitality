/* ============================================================
   Restaurant OS — labor engine
   Roster, schedules, punches, overtime and California break premiums.

   Overtime is computed at the WEEK level (per employee, >40 hrs), which is
   how it actually accrues — a daily model would understate it and the
   overtime watch list is one of the modules that has to be defensible.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand, CAL = RG.CAL;

  var FIRST = ['Adriana','Marcus','Priya','Tobias','Elena','Jamal','Sofia','Devin','Naomi','Rafael',
    'Cleo','Hugo','Mei','Andre','Talia','Owen','Iris','Kwame','Lucia','Bennett',
    'Rosa','Silas','Nadia','Ezra','Camille','Otis','Yara','Felix','Delia','Rune',
    'Imani','Callum','Paloma','Nico','Greta','Amara','Dov','Solene','Tariq','Wren'];
  var LAST = ['Okonkwo','Vasquez','Lindqvist','Baptiste','Ferraro','Nakashima','Oyelaran','Brennan',
    'Salcedo','Whitfield','Kaur','Moreno','Adeyemi','Castellanos','Novak','Dupree','Haddad','Sorensen',
    'Ricci','Marchetti','Villanueva','Bergstrom','Tafoya','Osei','Quintero','Lindgren','Batra','Serrano',
    'Achebe','Kowalski','Duarte','Fontaine','Iyer','Mbeki','Rossi','Nakamura','Bello','Cardoza','Feng','Aliyev'];

  /* Target sales per labor hour, by brand — the scheduling driver.
     Calibrated so hourly wages land near 25-27% of sales, which with the
     18.5% payroll burden and salaried management puts total labor in the
     32-35% band a full-service group actually runs. */
  var SPLH_TARGET = { mazra: 92 };
  /* back-of-house share of hours */
  /* Grill-led kitchen with heavy prep: more of the hours sit in back. */
  var BOH_SHARE = { mazra: 0.55 };

  /* how hours split inside each half of the house */
  var FOH_MIX = { server: 0.38, barista: 0.16, host: 0.22, busser: 0.24 };
  var BOH_MIX = { grill: 0.44, prep: 0.28, dish: 0.19, sous: 0.09 };

  /* ---- roster ---- */
  var rosterFor = R.memo(function (unitId) {
    var unit = RG.unitById[unitId];
    var n = Math.round(unit.seats * 0.46) + 8;         /* fictional headcount */
    var out = [];
    for (var i = 0; i < n; i++) {
      var seed = 'emp:' + unitId + ':' + i;
      var fn = FIRST[R.hash(seed + 'f') % FIRST.length];
      var ln = LAST[R.hash(seed + 'l') % LAST.length];
      /* job code weighted toward the roles that carry the most hours */
      var jobs = RG.JOBCODES.filter(function (j) { return !j.salaried; });
      var jw = jobs.map(function (j) {
        var m = j.boh ? BOH_MIX[j.id] : FOH_MIX[j.id];
        return (m || 0.1) * (j.boh ? BOH_SHARE[unit.brand] : 1 - BOH_SHARE[unit.brand]);
      });
      var job = jobs[pickIdx(seed + 'j', jw)];
      var rate = R.between(seed + 'r', job.rate[0], job.rate[1]);
      /* tenure drives the turnover cohort curves on the People page */
      var tenureDays = Math.round(R.between(seed + 't', 12, 1500));
      out.push({
        id: unitId + '-e' + i, unit: unitId, name: fn + ' ' + ln,
        job: job.id, jobLabel: job.label, boh: job.boh, tipped: job.tipped,
        rate: R.cents(rate),
        hired: CAL.iso(CAL.toTs(CAL.END) - tenureDays * 86400000),
        tenureDays: tenureDays,
        ft: R.chance(seed + 'ft', job.boh ? 0.62 : 0.34),
        reliability: R.between(seed + 'rel', 0.72, 1.0)
      });
    }
    /* Salaried management sits outside the hourly model. One GM and one
       assistant manager per unit, at market salaries for the Bay Area. */
    [['GM', 'General Manager', 88000], ['AM', 'Assistant Manager', 66000]].forEach(function (m, k) {
      var seed = 'mgr:' + unitId + ':' + k;
      out.push({
        id: unitId + '-m' + k, unit: unitId,
        name: FIRST[R.hash(seed + 'f') % FIRST.length] + ' ' + LAST[R.hash(seed + 'l') % LAST.length],
        job: 'mgr', jobLabel: m[1], code: m[0], boh: false, tipped: false, salaried: true,
        annual: Math.round(m[2] * R.between(seed + 'a', 0.94, 1.09)),
        rate: R.cents(m[2] / 2080),
        hired: CAL.iso(CAL.toTs(CAL.END) - Math.round(R.between(seed + 't', 200, 2600)) * 86400000),
        ft: true, reliability: 0.98
      });
    });
    return out;
  });
  RG.rosterFor = rosterFor;

  function pickIdx(seed, weights) {
    var t = 0, i;
    for (i = 0; i < weights.length; i++) t += weights[i];
    var x = R.u(seed) * t;
    for (i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; }
    return weights.length - 1;
  }

  /* ---- one week of shifts for a unit ----
     Generated together so overtime and break premiums are correct. */
  var weekLabor = R.memo(function (unitId, weekStartIso) {
    var unit = RG.unitById[unitId];
    var roster = rosterFor(unitId).filter(function (e) { return !e.salaried; });
    var start = CAL.byIso[weekStartIso];
    var days = CAL.DAYS.slice(start.i, start.i + 7);
    var hourly = {};   /* empId -> running hours this week */
    var byDay = {};

    days.forEach(function (day) {
      var s = RG.daySales(unitId, day.iso);
      byDay[day.iso] = { shifts: [], hours: 0, cost: 0, otHours: 0, otCost: 0, premiums: 0, sales: s.net };
      if (s.closed) return;

      /* hours scheduled off the forecast, then actual drifts from scheduled */
      var target = SPLH_TARGET[unit.brand];
      var schedHours = s.net / target;
      var actualHours = schedHours * R.noise('lab:' + unitId + day.iso, 0.085);
      var bohHours = actualHours * BOH_SHARE[unit.brand];
      var fohHours = actualHours - bohHours;

      var plan = [];
      Object.keys(BOH_MIX).forEach(function (j) { plan.push([j, bohHours * BOH_MIX[j]]); });
      Object.keys(FOH_MIX).forEach(function (j) { plan.push([j, fohHours * FOH_MIX[j]]); });

      plan.forEach(function (p) {
        var job = p[0], hrs = p[1];
        if (hrs < 0.5) return;
        var pool = roster.filter(function (e) { return e.job === job; });
        if (!pool.length) return;
        /* shift length ~6.5h, so hours convert into a believable headcount */
        var nShifts = Math.max(1, Math.round(hrs / 6.5));
        var each = R.allocate(hrs, new Array(nShifts).fill(1));
        var chosen = R.shuffle('sh:' + unitId + day.iso + job, pool).slice(0, nShifts);
        for (var k = 0; k < nShifts; k++) {
          var e = chosen[k % chosen.length];
          var h = Math.round(each[k] * 100) / 100;
          if (h <= 0) continue;
          var prior = hourly[e.id] || 0;
          var otH = Math.max(0, (prior + h) - 40) - Math.max(0, prior - 40);
          otH = Math.min(h, Math.max(0, otH));
          hourly[e.id] = prior + h;
          var reg = h - otH;
          var cost = R.cents(reg * e.rate + otH * e.rate * 1.5);
          /* CA meal-break premium: one hour at rate when a >5h shift is
             worked without a recorded break. Not applicable in Oregon. */
          var prem = 0;
          if (unit.state === 'CA' && h > 5 && R.chance('brk:' + e.id + day.iso, 0.052)) {
            prem = R.cents(e.rate);
          }
          var startHr = job === 'prep' ? 8 : (job === 'dish' ? 15 : 11) +
            Math.round(R.between('st:' + e.id + day.iso, 0, 6));
          byDay[day.iso].shifts.push({
            emp: e.id, name: e.name, job: job, jobLabel: e.jobLabel,
            hours: h, otHours: R.cents(otH), rate: e.rate,
            cost: R.cents(cost + prem), premium: prem,
            start: startHr, end: R.cents(startHr + h), boh: e.boh
          });
          byDay[day.iso].hours = R.cents(byDay[day.iso].hours + h);
          byDay[day.iso].otHours = R.cents(byDay[day.iso].otHours + otH);
          byDay[day.iso].otCost = R.cents(byDay[day.iso].otCost + otH * e.rate * 0.5);
          byDay[day.iso].cost = R.cents(byDay[day.iso].cost + cost + prem);
          byDay[day.iso].premiums = R.cents(byDay[day.iso].premiums + prem);
        }
      });
      byDay[day.iso].splh = byDay[day.iso].hours ? R.cents(s.net / byDay[day.iso].hours) : 0;
      byDay[day.iso].schedHours = R.cents(schedHours);
    });
    return byDay;
  });

  /* Monday of the week containing iso */
  function weekStart(iso) {
    var d = CAL.byIso[iso];
    return CAL.DAYS[d.i - d.dow].iso;
  }
  RG.weekStart = weekStart;

  RG.dayLabor = function (unitId, iso) {
    var wk = weekLabor(unitId, weekStart(iso));
    return wk[iso] || { shifts: [], hours: 0, cost: 0, otHours: 0, otCost: 0, premiums: 0 };
  };

  /* salaried management, spread evenly across the period */
  RG.mgrDailyCost = R.memo(function (unitId) {
    var mgrs = rosterFor(unitId).filter(function (e) { return e.salaried; });
    var annual = mgrs.reduce(function (s, m) { return s + m.annual; }, 0);
    return R.cents(annual / 364);
  });

  RG.sumLabor = function (unitIds, days) {
    var out = { hours: 0, cost: 0, otHours: 0, otCost: 0, premiums: 0, mgr: 0, byJob: {} };
    unitIds.forEach(function (uid) {
      days.forEach(function (d) {
        var L = RG.dayLabor(uid, d.iso);
        out.hours = R.cents(out.hours + L.hours);
        out.cost = R.cents(out.cost + L.cost);
        out.otHours = R.cents(out.otHours + L.otHours);
        out.otCost = R.cents(out.otCost + L.otCost);
        out.premiums = R.cents(out.premiums + L.premiums);
        out.mgr = R.cents(out.mgr + RG.mgrDailyCost(uid));
        (L.shifts || []).forEach(function (s) {
          var j = out.byJob[s.job] || (out.byJob[s.job] = { hours: 0, cost: 0 });
          j.hours = R.cents(j.hours + s.hours);
          j.cost = R.cents(j.cost + s.cost);
        });
      });
    });
    out.total = R.cents(out.cost + out.mgr);
    return out;
  };

  RG.periodLabor = R.memo(function (unitId, periodKey) {
    return RG.sumLabor([unitId], CAL.daysIn(periodKey));
  });
})(typeof window !== 'undefined' ? window : globalThis);
