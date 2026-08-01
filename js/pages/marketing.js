/* Marketing, Loyalty & Gift Cards */
renderPage('Marketing & Loyalty', 'Spend, attribution, loyalty cohorts and gift-card liability',
  ['Google', 'Yelp', 'QBO'], function () {
  var P = activePeriod(), units = activeUnits();
  var s = RG.sumDays(units, RG.CAL.daysIn(P));
  var spend = 0, attributed = 0, campaigns = {}, loyalty = { members: 0, active: 0, redemptions: 0, liability: 0 };
  var liftV = 0, liftS = 0;

  units.forEach(function (u) {
    var m = RG.periodMarketing(u, P);
    spend = RG.rand.cents(spend + m.total);
    attributed = RG.rand.cents(attributed + m.attributed);
    m.rows.forEach(function (r) {
      var c = campaigns[r.name] || (campaigns[r.name] = { name: r.name, channel: r.channel,
        cadence: r.cadence, spend: 0, attributedSales: 0, covers: 0, impressions: 0 });
      c.spend = RG.rand.cents(c.spend + r.spend);
      c.attributedSales = RG.rand.cents(c.attributedSales + r.attributedSales);
      c.covers += r.covers; c.impressions += r.impressions;
    });
    loyalty.members += m.loyalty.members; loyalty.active += m.loyalty.active;
    loyalty.redemptions += m.loyalty.redemptions;
    loyalty.liability = RG.rand.cents(loyalty.liability + m.loyalty.liability);
    liftV += m.loyalty.visitLift; liftS += m.loyalty.spendLift;
  });

  var campList = Object.keys(campaigns).map(function (k) {
    var c = campaigns[k]; c.roas = c.spend ? c.attributedSales / c.spend : 0; return c;
  }).sort(function (a, b) { return b.attributedSales - a.attributedSales; });

  var maxRoas = Math.max.apply(null, campList.map(function (c) { return c.roas; })) || 1;
  var campRows = campList.map(function (c) {
    return '<tr><td><b>' + esc(c.name) + '</b>' +
      '<div style="font-size:10px;color:var(--color-slate-hint)">' + esc(c.channel) + ' · ' +
      esc(c.cadence) + '</div></td>' +
      '<td class="num">' + fmt$(c.spend) + '</td>' +
      '<td class="num">' + fmtNum(c.impressions) + '</td>' +
      '<td class="num">' + fmtNum(c.covers) + '</td>' +
      '<td class="num">' + traced(fmt$(c.attributedSales), {
        value: fmt$c(c.attributedSales) + ' attributed',
        formula: 'sales the platform or offer code claims credit for in the window',
        inputs: [['Spend', fmt$c(c.spend)], ['Return on ad spend', c.roas.toFixed(2) + 'x'],
                 ['Covers', fmtNum(c.covers)],
                 ['Cost per cover', fmt$c(c.covers ? c.spend / c.covers : 0)]],
        source: [c.channel === 'Google' ? 'Google' : c.channel === 'Deliverect' ? 'Deliverect' : 'QBO'],
        period: periodLabel(P),
        note: 'Attribution is claimed, not proven. Two platforms will both claim the same cover — ' +
              'treat these as directional against each other, not as additive truth.' }) + '</td>' +
      '<td style="width:16%"><div class="rg-bar"><i class="' +
        (c.roas > 4 ? 'good' : c.roas > 2.4 ? '' : 'warn') + '" style="width:' +
        (c.roas / maxRoas * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num">' + c.roas.toFixed(2) + 'x</td>' +
      '<td class="num">' + fmt$c(c.covers ? c.spend / c.covers : 0) + '</td></tr>';
  }).join('');

  var unitRows = units.map(function (u) {
    var m = RG.periodMarketing(u, P), us = RG.periodSales(u, P);
    return '<tr><td class="unit-cell"><b>' + esc(RG.unitById[u].name) + '</b>' +
      '<span>' + esc(RG.unitById[u].city) + '</span></td>' +
      '<td class="num">' + fmt$(m.total) + '</td>' +
      '<td class="num">' + fmtPct(m.total / (us.net || 1)) + '</td>' +
      '<td class="num">' + fmt$(m.attributed) + '</td>' +
      '<td class="num">' + (m.total ? (m.attributed / m.total).toFixed(2) + 'x' : '—') + '</td>' +
      '<td class="num">' + fmtNum(m.loyalty.members) + '</td>' +
      '<td class="num">' + fmtPct(m.loyalty.active / (m.loyalty.members || 1)) + '</td>' +
      '<td class="num">' + fmt$(m.loyalty.liability) + '</td></tr>';
  }).join('');

  var n = units.length;

  return '<div class="stat-row">' +
    [['Marketing spend', fmt$(spend), fmtPct(spend / (s.net || 1)) + ' of net sales'],
     ['Attributed sales', fmt$(attributed), (attributed / (spend || 1)).toFixed(2) + 'x blended'],
     ['Loyalty members', fmtNum(loyalty.members), fmtNum(loyalty.active) + ' active'],
     ['Visit lift', fmtPct(liftV / n), 'members vs. non-members'],
     ['Spend lift', fmtPct(liftS / n), 'per visit'],
     ['Gift-card liability', fmt$(loyalty.liability), 'on the balance sheet']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    card({ title: 'Campaign performance', sub: 'Spend against claimed attribution. ' +
      'Marketing spend foots exactly to the P&L marketing line of ' + fmt$(spend) + '.',
      tools: gridTools('camp', 'Campaigns ' + P), sources: ['Google', 'QBO'],
      body: table({ id: 'camp', cols: [{ label: 'Campaign' }, { label: 'Spend', num: true },
        { label: 'Impressions', num: true }, { label: 'Covers', num: true },
        { label: 'Attributed', num: true }, { label: '' }, { label: 'ROAS', num: true },
        { label: 'Cost / cover', num: true }], rows: [campRows],
        foot: '<tr><td><b>Total</b></td>' +
          '<td class="num"><b>' + fmt$(spend) + '</b></td><td></td>' +
          '<td class="num"><b>' + fmtNum(campList.reduce(function (a, c) { return a + c.covers; }, 0)) + '</b></td>' +
          '<td class="num"><b>' + fmt$(attributed) + '</b></td><td></td>' +
          '<td class="num"><b>' + (attributed / (spend || 1)).toFixed(2) + 'x</b></td><td></td></tr>' }) +
        '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
        'These figures are what each platform <b>claims</b>. Two channels will both take credit for ' +
        'the same guest, so the column does not sum to incremental revenue. The honest read is ' +
        'relative — which line is trending better than the others — not absolute.</div>' }) +

    '<div class="two-col">' +
      card({ title: 'Loyalty cohort', sub: 'What membership is actually worth', sources: ['Google'],
        body: '<div style="padding:4px 0">' +
          [['Members enrolled', fmtNum(loyalty.members)],
           ['Active in period', fmtNum(loyalty.active) + ' (' + fmtPct(loyalty.active / (loyalty.members || 1)) + ')'],
           ['Visit frequency lift', fmtPct(liftV / n)],
           ['Spend lift per visit', fmtPct(liftS / n)],
           ['Redemptions', fmtNum(loyalty.redemptions)],
           ['Estimated incremental sales', fmt$(RG.rand.cents(s.net * (liftV / n) * 0.18))]
          ].map(function (r) {
            return '<div style="display:flex;justify-content:space-between;padding:9px 0;' +
              'border-bottom:1px solid var(--glass-border);font-size:13px">' +
              '<span style="color:var(--color-text-muted)">' + esc(r[0]) + '</span>' +
              '<b style="font-variant-numeric:tabular-nums">' + r[1] + '</b></div>';
          }).join('') + '</div>' }) +
      card({ title: 'Local search performance', sub: 'Google Business Profile, all units',
        sources: ['Google'],
        body: (function () {
          var imp = Math.round(s.covers * RG.rand.between('gbp:' + P, 14, 26));
          var dir = Math.round(imp * RG.rand.between('gbpd:' + P, 0.02, 0.05));
          var calls = Math.round(imp * RG.rand.between('gbpc:' + P, 0.004, 0.012));
          return '<div class="stat-row" style="margin-bottom:0">' +
            [['Search impressions', fmtNum(imp)], ['Direction requests', fmtNum(dir)],
             ['Calls', fmtNum(calls)], ['Website clicks', fmtNum(Math.round(imp * 0.031))]
            ].map(function (r) {
              return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>';
            }).join('') + '</div>' +
            '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:14px;line-height:1.6">' +
            'Direction requests are the highest-intent free signal a restaurant gets. They move with ' +
            'review rating, which is why this panel sits one click from the ' +
            '<a href="/hospitality/guest/" style="color:var(--color-blue);font-weight:700;text-decoration:none">' +
            'reputation module</a>.</div>';
        })() }) +
    '</div>' +

    card({ title: 'By restaurant', sub: 'Spend, return and loyalty penetration',
      tools: gridTools('mku', 'Marketing by unit ' + P), sources: ['QBO', 'Google'],
      body: table({ id: 'mku', cols: [{ label: 'Restaurant' }, { label: 'Spend', num: true },
        { label: '% of sales', num: true }, { label: 'Attributed', num: true },
        { label: 'ROAS', num: true }, { label: 'Members', num: true },
        { label: 'Active', num: true }, { label: 'Gift liability', num: true }], rows: [unitRows] }) });
});
