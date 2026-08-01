/* Reservations, Covers & RevPASH */
renderPage('Reservations & Covers', 'Booking pace, no-shows, turns and seat productivity',
  ['OpenTable', 'Toast'], function () {
  var P = activePeriod(), units = activeUnits();
  var totals = { booked: 0, walkIn: 0, noShow: 0, cancelled: 0, lost: 0, covers: 0 };
  units.forEach(function (u) {
    var r = RG.periodReservations(u, P);
    totals.booked += r.booked; totals.walkIn += r.walkIn;
    totals.noShow += r.noShow; totals.cancelled += r.cancelled;
    totals.lost = RG.rand.cents(totals.lost + r.lostRevenue);
  });
  totals.covers = totals.booked + totals.walkIn;

  var unitRows = units.map(function (u) {
    var r = RG.periodReservations(u, P), un = RG.unitById[u];
    var s = RG.periodSales(u, P);
    return '<tr><td class="unit-cell"><b>' + esc(un.name) + '</b><span>' + esc(un.city) +
      ' · ' + fmtNum(un.seats) + ' seats</span></td>' +
      '<td>' + (r.takesRes ? pill('OpenTable', 'info') : pill('walk-in only', 'neutral')) + '</td>' +
      '<td class="num">' + fmtNum(r.booked + r.walkIn) + '</td>' +
      '<td class="num">' + fmtNum(r.booked) + '</td>' +
      '<td class="num">' + fmtNum(r.walkIn) + '</td>' +
      '<td class="num">' + (r.booked ? fmtPct(r.noShowRate) : '—') + '</td>' +
      '<td class="num">' + (r.booked ? fmt$(r.lostRevenue) : '—') + '</td>' +
      '<td class="num">' + r.avgTurns.toFixed(2) + '</td>' +
      '<td class="num">' + traced(fmt$c(r.revpash), {
        value: fmt$c(r.revpash) + ' RevPASH',
        formula: 'dine-in revenue ÷ (seats × service hours available)',
        inputs: [['Dine-in revenue', fmt$(s.byChannel.dinein || 0)], ['Seats', fmtNum(un.seats)],
                 ['Service hours/day', '6'], ['Average turns', r.avgTurns.toFixed(2)]],
        source: ['Toast', 'OpenTable'], period: periodLabel(P),
        note: 'Revenue per available seat hour — the restaurant equivalent of RevPAR. It catches ' +
              'a room that is full at the wrong times.' }) + '</td></tr>';
  }).join('');

  /* daily detail for the first unit in scope */
  var focus = units[0];
  var res = RG.periodReservations(focus, P);
  var dayRows = res.rows.map(function (r) {
    var waitGap = r.actualWait - r.quotedWait;
    return '<tr><td>' + usDate(r.date) +
      '<div style="font-size:10px;color:var(--color-slate-hint)">' + r.dow + '</div></td>' +
      '<td class="num">' + fmtNum(r.covers) + '</td>' +
      '<td class="num">' + fmtNum(r.booked) + '</td>' +
      '<td class="num">' + fmtNum(r.walkIn) + '</td>' +
      '<td class="num">' + fmtNum(r.noShow) + '</td>' +
      '<td class="num">' + fmtNum(r.cancelled) + '</td>' +
      '<td class="num">' + r.quotedWait + ' min</td>' +
      '<td class="num">' + r.actualWait + ' min</td>' +
      '<td class="num"><span class="chip ' + (Math.abs(waitGap) <= 5 ? 'chip-good' :
        waitGap > 15 ? 'chip-bad' : 'chip-flat') + '">' + (waitGap > 0 ? '+' : '') + waitGap + '</span></td>' +
      '<td class="num">' + r.turns.toFixed(2) + '</td></tr>';
  }).join('');

  /* deposit policy simulator */
  var depositRecovery = RG.rand.cents(totals.lost * 0.62);

  return '<div class="stat-row">' +
    [['Total covers', fmtNum(totals.covers), ''],
     ['Reserved', fmtNum(totals.booked), fmtPct(totals.booked / (totals.covers || 1)) + ' of covers'],
     ['Walk-in', fmtNum(totals.walkIn), fmtPct(totals.walkIn / (totals.covers || 1))],
     ['No-shows', fmtNum(totals.noShow), fmtPct(totals.noShow / (totals.booked || 1)) + ' of bookings'],
     ['Lost revenue', fmt$(totals.lost), 'no-show covers at PPA'],
     ['Cancellations', fmtNum(totals.cancelled), 'released in time']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'By restaurant', sub: 'Seat productivity, not just cover counts',
      tools: gridTools('rz', 'Reservations ' + P), sources: ['OpenTable', 'Toast'],
      body: table({ id: 'rz', cols: [{ label: 'Restaurant' }, { label: 'Booking' },
        { label: 'Covers', num: true }, { label: 'Reserved', num: true }, { label: 'Walk-in', num: true },
        { label: 'No-show', num: true }, { label: 'Lost', num: true }, { label: 'Turns', num: true },
        { label: 'RevPASH', num: true }], rows: [unitRows] }) }) +

    '<div class="two-col">' +
      card({ title: 'Deposit policy simulator',
        sub: 'What a card-on-file hold would recover', sources: ['OpenTable'],
        body: '<div style="padding:4px 0">' +
          [['No-show covers this period', fmtNum(totals.noShow)],
           ['Revenue lost', fmt$(totals.lost)],
           ['Annualised (13 periods)', fmt$(RG.rand.cents(totals.lost * 13))],
           ['Typical deterrence with a hold', '55 – 70%'],
           ['Estimated annual recovery', fmt$(RG.rand.cents(depositRecovery * 13))]
          ].map(function (r) {
            return '<div style="display:flex;justify-content:space-between;padding:9px 0;' +
              'border-bottom:1px solid var(--glass-border);font-size:13px">' +
              '<span style="color:var(--color-text-muted)">' + esc(r[0]) + '</span>' +
              '<b style="font-variant-numeric:tabular-nums">' + r[1] + '</b></div>';
          }).join('') + '</div>' +
          '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
          'A deposit policy trades a small amount of booking friction for a large amount of recovered ' +
          'covers. The trade is only worth making where no-show rates justify it — which is why this ' +
          'sits next to the per-unit rate rather than as a blanket recommendation.</div>' }) +
      card({ title: 'Wait-quote accuracy', sub: 'Quoted against actual, ' + esc(RG.unitById[focus].name),
        sources: ['OpenTable'],
        body: (function () {
          var acc = res.rows.filter(function (r) { return Math.abs(r.actualWait - r.quotedWait) <= 5; }).length;
          var over = res.rows.filter(function (r) { return r.actualWait - r.quotedWait > 15; }).length;
          return '<div class="stat-row" style="margin-bottom:14px">' +
            '<div class="stat"><span>Within 5 min</span><b>' + fmtPct(acc / (res.rows.length || 1)) + '</b></div>' +
            '<div class="stat"><span>Over by 15+ min</span><b>' + fmtNum(over) + ' days</b></div>' +
            '<div class="stat"><span>Avg quoted</span><b>' +
              Math.round(res.rows.reduce(function (a, r) { return a + r.quotedWait; }, 0) / (res.rows.length || 1)) +
              ' min</b></div>' +
            '</div>' +
            '<div style="font-size:11.5px;color:var(--color-text-muted);line-height:1.6">' +
            'An inaccurate quote is the single most reliable producer of a one-star review about ' +
            '“wait time” — and it costs nothing to fix. Cross-referenced on the ' +
            '<a href="/hospitality/guest/" style="color:var(--color-blue);font-weight:700;text-decoration:none">' +
            'Experience &amp; Reputation</a> page.</div>';
        })() }) +
    '</div>' +

    card({ title: 'Daily detail — ' + esc(RG.unitById[focus].name),
      sub: 'Covers, bookings and wait accuracy by business day',
      tools: gridTools('rday', 'Reservations daily ' + P), sources: ['OpenTable', 'Toast'],
      body: table({ id: 'rday', cols: [{ label: 'Date' }, { label: 'Covers', num: true },
        { label: 'Reserved', num: true }, { label: 'Walk-in', num: true }, { label: 'No-show', num: true },
        { label: 'Cancelled', num: true }, { label: 'Quoted', num: true }, { label: 'Actual', num: true },
        { label: 'Gap', num: true }, { label: 'Turns', num: true }], rows: [dayRows] }) });
});
