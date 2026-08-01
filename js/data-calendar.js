/* ============================================================
   Restaurant OS — fiscal calendar
   13 periods x 28 days = 364-day fiscal year, the restaurant-industry
   standard. Weeks always start Monday, so every period is exactly four
   comparable weeks and period-over-period reads clean.

   FY2024 P1 D1 = 2024-01-01 (a Monday — the calendar anchors cleanly).
   Data range runs to 2026-07-31; "today" is 2026-08-01, which lands
   mid-period in FY2026 P8, so the current period is deliberately partial.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  var MS_DAY = 86400000;
  var ANCHOR = Date.UTC(2024, 0, 1);          // FY2024 P1 D1, a Monday
  var TODAY  = Date.UTC(2026, 7, 1);          // 2026-08-01, the demo "now"
  var END    = Date.UTC(2026, 6, 31);         // last day with data

  function iso(ts) { return new Date(ts).toISOString().slice(0, 10); }
  function toTs(isoStr) {
    var p = isoStr.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  /* portal-wide display convention is MM-DD-YYYY */
  function usDate(isoStr) {
    var p = isoStr.split('-');
    return p[1] + '-' + p[2] + '-' + p[0];
  }

  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  /* ---- build the day spine ---- */
  var DAYS = [];
  var byIso = {};
  for (var ts = ANCHOR, idx = 0; ts <= END; ts += MS_DAY, idx++) {
    var fyOffset = Math.floor(idx / 364);
    var dayInFy  = idx - fyOffset * 364;
    var d = new Date(ts);
    var rec = {
      i: idx,
      iso: iso(ts),
      ts: ts,
      fy: 2024 + fyOffset,
      period: Math.floor(dayInFy / 28) + 1,      // 1..13
      weekInPeriod: Math.floor((dayInFy % 28) / 7) + 1,  // 1..4
      fyWeek: Math.floor(dayInFy / 7) + 1,       // 1..52
      dayInFy: dayInFy + 1,
      dow: idx % 7,                              // 0 = Monday
      dowName: DOW[idx % 7],
      isWeekend: (idx % 7) >= 4,                 // Fri/Sat/Sun trade as weekend
      month: d.getUTCMonth(),
      monthName: MONTHS[d.getUTCMonth()],
      dom: d.getUTCDate(),
      year: d.getUTCFullYear(),
      doy: Math.floor((ts - Date.UTC(d.getUTCFullYear(), 0, 1)) / MS_DAY)
    };
    rec.periodKey = 'FY' + rec.fy + '-P' + String(rec.period).padStart(2, '0');
    rec.isFuture = ts >= TODAY;
    DAYS.push(rec);
    byIso[rec.iso] = rec;
  }

  /* ---- roll days up into periods ---- */
  var PERIODS = [];
  var periodByKey = {};
  DAYS.forEach(function (d) {
    var p = periodByKey[d.periodKey];
    if (!p) {
      p = {
        key: d.periodKey, fy: d.fy, period: d.period,
        start: d.iso, end: d.iso, days: 0,
        label: 'FY' + d.fy + ' P' + d.period
      };
      PERIODS.push(p);
      periodByKey[d.periodKey] = p;
    }
    p.end = d.iso;
    p.days++;
  });
  PERIODS.forEach(function (p) {
    p.complete = p.days === 28 && toTs(p.end) < TODAY;
    p.range = usDate(p.start) + ' – ' + usDate(p.end);
  });

  var COMPLETE = PERIODS.filter(function (p) { return p.complete; });
  var CURRENT_PERIOD = PERIODS.filter(function (p) { return toTs(p.start) < TODAY; }).pop();
  var LAST_COMPLETE = COMPLETE[COMPLETE.length - 1];

  /* prior-year comparable period: same period number, fy-1 */
  function priorYear(periodKey) {
    var p = periodByKey[periodKey];
    if (!p) return null;
    return periodByKey['FY' + (p.fy - 1) + '-P' + String(p.period).padStart(2, '0')] || null;
  }
  function priorPeriod(periodKey) {
    var i = PERIODS.findIndex(function (p) { return p.key === periodKey; });
    return i > 0 ? PERIODS[i - 1] : null;
  }
  /* the day exactly 364 days back — same weekday, same period position */
  function priorYearDay(isoStr) {
    var d = byIso[isoStr];
    return d ? DAYS[d.i - 364] || null : null;
  }
  function daysIn(periodKey) {
    return DAYS.filter(function (d) { return d.periodKey === periodKey; });
  }
  function daysBetween(a, b) {
    var lo = toTs(a), hi = toTs(b);
    return DAYS.filter(function (d) { return d.ts >= lo && d.ts <= hi; });
  }
  /* trailing N days ending at (and including) the last day with data */
  function trailing(n, endIso) {
    var end = byIso[endIso || iso(END)];
    return DAYS.slice(Math.max(0, end.i - n + 1), end.i + 1);
  }

  /* ---- dayparts. Business day cuts at 4am so late-night rolls back. ---- */
  var DAYPARTS = [
    { id: 'lunch',   label: 'Lunch',      from: 11, to: 15 },
    { id: 'happy',   label: 'Happy Hour', from: 15, to: 17 },
    { id: 'dinner',  label: 'Dinner',     from: 17, to: 21 },
    { id: 'late',    label: 'Late Night', from: 21, to: 28 }   // 28 = 4am next day
  ];

  /* ---- holidays that actually move restaurant volume ----
     Positive = lift, negative = drag. Closed days handled per-unit. */
  var HOLIDAY = {};
  function setHol(y, m, d, factor, name) {
    HOLIDAY[iso(Date.UTC(y, m - 1, d))] = { f: factor, name: name };
  }
  [2024, 2025, 2026].forEach(function (y) {
    setHol(y, 1, 1, 0.55, "New Year's Day");
    setHol(y, 2, 14, 1.38, "Valentine's Day");
    setHol(y, 3, 17, 1.16, "St. Patrick's Day");
    setHol(y, 7, 4, 0.72, 'Independence Day');
    setHol(y, 10, 31, 0.88, 'Halloween');
    setHol(y, 12, 24, 0.62, 'Christmas Eve');
    setHol(y, 12, 25, 0.05, 'Christmas Day');   // effectively closed
    setHol(y, 12, 31, 1.44, "New Year's Eve");
  });
  /* floating: Thanksgiving = 4th Thursday of November */
  [[2024, 11, 28], [2025, 11, 27], [2026, 11, 26]].forEach(function (t) {
    setHol(t[0], t[1], t[2], 0.10, 'Thanksgiving');
  });
  /* Mother's Day = 2nd Sunday in May, the single biggest restaurant day */
  [[2024, 5, 12], [2025, 5, 11], [2026, 5, 10]].forEach(function (t) {
    setHol(t[0], t[1], t[2], 1.52, "Mother's Day");
  });
  [[2024, 6, 16], [2025, 6, 15], [2026, 6, 21]].forEach(function (t) {
    setHol(t[0], t[1], t[2], 1.34, "Father's Day");
  });

  function holidayOf(isoStr) { return HOLIDAY[isoStr] || null; }

  RG.CAL = {
    DAYS: DAYS, PERIODS: PERIODS, DAYPARTS: DAYPARTS,
    byIso: byIso, periodByKey: periodByKey,
    TODAY: iso(TODAY), END: iso(END), ANCHOR: iso(ANCHOR),
    CURRENT_PERIOD: CURRENT_PERIOD, LAST_COMPLETE: LAST_COMPLETE,
    COMPLETE: COMPLETE,
    iso: iso, toTs: toTs, usDate: usDate,
    priorYear: priorYear, priorPeriod: priorPeriod, priorYearDay: priorYearDay,
    daysIn: daysIn, daysBetween: daysBetween, trailing: trailing,
    holidayOf: holidayOf, DOW: DOW, MONTHS: MONTHS
  };
})(typeof window !== 'undefined' ? window : globalThis);
