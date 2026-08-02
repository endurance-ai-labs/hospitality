/* Off-Premise Economics — what delivery actually earns after fees */
renderPage('Off-Premise Economics', 'Channel P&L after commission, promo and errors',
  ['Deliverect', 'DoorDash', 'UberEats', 'Toast'], function () {
  var P = activePeriod(), units = activeUnits();
  var prior = RG.CAL.priorPeriod(P);
  var s = RG.sumDays(units, RG.CAL.daysIn(P));
  var sp = prior ? RG.sumDays(units, RG.CAL.daysIn(prior.key)) : null;

  var deliveryGross = s.byChannel.delivery || 0;
  var takeoutGross = s.byChannel.takeout || 0;
  var cateringGross = s.byChannel.catering || 0;
  var offGross = RG.rand.cents(deliveryGross + takeoutGross + cateringGross);

  /* marketplace economics — commission, promo funding, error charges, refunds */
  var MARKETPLACES = [
    ['DoorDash', 0.52, 0.242, 'DoorDash'],
    ['Uber Eats', 0.33, 0.238, 'UberEats'],
    ['Grubhub', 0.10, 0.226, 'Deliverect'],
    ['First-party (own site)', 0.05, 0.031, 'Toast']
  ];
  var mkAmts = RG.rand.allocate(deliveryGross, MARKETPLACES.map(function (m) { return m[1]; }));

  var mkRows = MARKETPLACES.map(function (m, i) {
    var gross = mkAmts[i];
    var commission = RG.rand.cents(gross * m[2]);
    var promo = RG.rand.cents(gross * RG.rand.between('promo:' + P + i, 0.008, 0.041));
    var errors = RG.rand.cents(gross * RG.rand.between('err:' + P + i, 0.004, 0.019));
    var refunds = RG.rand.cents(gross * RG.rand.between('rfd:' + P + i, 0.002, 0.011));
    var net = RG.rand.cents(gross - commission - promo - errors - refunds);
    var eff = gross ? (gross - net) / gross : 0;
    return { name: m[0], src: m[3], gross: gross, commission: commission, promo: promo,
      errors: errors, refunds: refunds, net: net, eff: eff };
  });
  var mkTotal = mkRows.reduce(function (a, r) {
    return { gross: RG.rand.cents(a.gross + r.gross), commission: RG.rand.cents(a.commission + r.commission),
      promo: RG.rand.cents(a.promo + r.promo), errors: RG.rand.cents(a.errors + r.errors),
      refunds: RG.rand.cents(a.refunds + r.refunds), net: RG.rand.cents(a.net + r.net) };
  }, { gross: 0, commission: 0, promo: 0, errors: 0, refunds: 0, net: 0 });

  /* channel P&L: delivery baskets carry no alcohol, and packaging is a real cost */
  var deliveryFoodCost = RG.rand.cents(deliveryGross * 0.335);
  var deliveryLabor = RG.rand.cents(deliveryGross * 0.19);
  var deliveryContribution = RG.rand.cents(mkTotal.net - deliveryFoodCost - deliveryLabor);

  var plRows = [
    ['Gross channel sales', mkTotal.gross, '', 'Deliverect'],
    ['Marketplace commission', -mkTotal.commission, 'blended ' + fmtPct(mkTotal.commission / (mkTotal.gross || 1)), 'DoorDash'],
    ['Promotion funding', -mkTotal.promo, 'operator-funded offers', 'Deliverect'],
    ['Error charges', -mkTotal.errors, 'missing item, late, wrong order', 'DoorDash'],
    ['Refunds', -mkTotal.refunds, '', 'Deliverect'],
    ['s', 'Net remitted', mkTotal.net],
    ['Cost of goods', -deliveryFoodCost, 'incl. packaging, no alcohol in the basket', 'R365'],
    ['Kitchen labor', -deliveryLabor, 'allocated on ticket time', '7shifts'],
    ['S', 'Channel contribution', deliveryContribution]
  ].map(function (r) {
    if (r[0] === 's' || r[0] === 'S') {
      return '<tr style="font-weight:' + (r[0] === 'S' ? '800' : '700') +
        ';border-top:1.5px solid var(--glass-border)"><td><b>' + esc(r[1]) + '</b></td>' +
        '<td class="num"><b>' + fmt$(r[2]) + '</b></td>' +
        '<td class="num"><b>' + fmtPct(r[2] / (mkTotal.gross || 1)) + '</b></td><td></td><td></td></tr>';
    }
    return '<tr><td>' + esc(r[0]) + '</td>' +
      '<td class="num">' + fmt$(r[1]) + '</td>' +
      '<td class="num">' + fmtPct(r[1] / (mkTotal.gross || 1)) + '</td>' +
      '<td style="font-size:11px;color:var(--color-slate-hint)">' + esc(r[2]) + '</td>' +
      '<td>' + (r[3] ? srcChip(r[3]) : '') + '</td></tr>';
  }).join('');

  /* store-offline monitor — pure lost revenue */
  var offline = units.map(function (u) {
    var mins = Math.round(RG.rand.between('off:' + u + P, 40, 640));
    var perMin = (RG.periodSales(u, P).byChannel.delivery || 0) / (28 * 11 * 60);
    return { unit: u, mins: mins, lost: RG.rand.cents(mins * perMin),
      events: Math.round(RG.rand.between('offe:' + u + P, 2, 14)) };
  }).sort(function (a, b) { return b.lost - a.lost; });
  var offlineTotal = offline.reduce(function (a, o) { return RG.rand.cents(a + o.lost); }, 0);

  var offRows = offline.map(function (o) {
    return '<tr><td class="unit-cell"><b>' + esc(RG.unitById[o.unit].name) + '</b>' +
      '<span>' + esc(RG.unitById[o.unit].city) + '</span></td>' +
      '<td class="num">' + fmtNum(o.events) + '</td>' +
      '<td class="num">' + fmtNum(o.mins) + ' min</td>' +
      '<td class="num">' + traced(fmt$(o.lost), {
        value: fmt$c(o.lost), formula: 'offline minutes × average delivery revenue per trading minute',
        inputs: [['Offline events', fmtNum(o.events)], ['Total minutes', fmtNum(o.mins)],
                 ['Delivery gross', fmt$(RG.periodSales(o.unit, P).byChannel.delivery || 0)]],
        source: ['Deliverect'], period: periodLabel(P),
        note: 'A paused storefront earns nothing. This is the cheapest revenue in the building to recover.' }) +
      '</td></tr>';
  }).join('');

  /* by unit */
  var unitRows = units.map(function (u) {
    var us = RG.periodSales(u, P);
    var d = us.byChannel.delivery || 0;
    var t = us.byChannel.takeout || 0;
    return '<tr><td class="unit-cell"><b>' + esc(RG.unitById[u].name) + '</b>' +
      '<span>' + esc(RG.unitById[u].city) + '</span></td>' +
      '<td class="num">' + fmt$(d) + '</td>' +
      '<td style="width:20%"><div class="rg-bar"><i class="' +
        (d / (us.gross || 1) > 0.22 ? 'warn' : '') + '" style="width:' +
        (d / (us.gross || 1) * 100 / 0.35 * 100 / 100).toFixed(1) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(d / (us.gross || 1)) + '</td>' +
      '<td class="num">' + fmt$(t) + '</td>' +
      '<td class="num">' + fmtPct(t / (us.gross || 1)) + '</td>' +
      '<td class="num">' + fmt$(RG.rand.cents(d * 0.238)) + '</td>' +
      '<td class="num">' + fmtPct((d + t) / (us.gross || 1)) + '</td></tr>';
  }).join('');

  var pointOfMix = RG.rand.cents(deliveryGross * 0.238 * 0.01);

  return '<div class="stat-row">' +
    [['Off-premise gross', fmt$(offGross), fmtPct(offGross / (s.gross || 1)) + ' of all sales'],
     ['Delivery gross', fmt$(deliveryGross), sp ? fmtPct(deliveryGross / (s.gross || 1)) + ' mix' : ''],
     ['Effective take rate', fmtPct(mkTotal.gross ? (mkTotal.gross - mkTotal.net) / mkTotal.gross : 0),
      'all deductions, not just commission'],
     ['Error charges', fmt$(mkTotal.errors), 'disputable'],
     ['Channel contribution', fmt$(deliveryContribution),
      fmtPct(deliveryContribution / (deliveryGross || 1)) + ' of gross'],
     ['Offline lost sales', fmt$(offlineTotal), 'storefront paused']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    '<div class="two-col">' +
      card({ title: 'Delivery channel P&L', sub: 'Gross to true contribution — the view the marketplace dashboards do not give you',
        sources: ['Deliverect', 'R365'],
        body: table({ id: 'chpl', cols: [{ label: '' }, { label: 'Amount', num: true },
          { label: '% gross', num: true }, { label: '' }, { label: 'Source' }], rows: [plRows] }) +
          '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:12px;line-height:1.6">' +
          'Alcohol does not travel, so the delivery basket carries none of the beverage margin that ' +
          'pays for the dining room. Packaging is charged into cost of goods on every off-premise item. ' +
          'Every point of mix moved from marketplace to first-party is worth roughly <b>' +
          fmt$(pointOfMix) + '</b> a period at current volume.</div>' }) +
      card({ title: 'Store-offline monitor', sub: 'Minutes the storefront was paused, and what it cost',
        sources: ['Deliverect'],
        body: table({ id: 'off', cols: [{ label: 'Restaurant' }, { label: 'Events', num: true },
          { label: 'Offline', num: true }, { label: 'Lost sales', num: true }], rows: [offRows],
          foot: '<tr><td><b>Total</b></td><td></td><td class="num"><b>' +
            fmtNum(offline.reduce(function (a, o) { return a + o.mins; }, 0)) + ' min</b></td>' +
            '<td class="num"><b>' + fmt$(offlineTotal) + '</b></td></tr>' }) }) +
    '</div>' +

    card({ title: 'By marketplace', sub: 'Effective take rate is commission plus promo plus errors plus refunds — not the headline rate',
      tools: gridTools('mk', 'Marketplace economics ' + P), sources: ['DoorDash', 'UberEats', 'Deliverect'],
      body: table({ id: 'mk', cols: [{ label: 'Marketplace' }, { label: 'Gross', num: true },
        { label: 'Commission', num: true }, { label: 'Promo', num: true }, { label: 'Errors', num: true },
        { label: 'Refunds', num: true }, { label: 'Net remitted', num: true },
        { label: 'Effective rate', num: true }],
        rows: [mkRows.map(function (r) {
          return '<tr><td><b>' + esc(r.name) + '</b> ' + srcChip(r.src) + '</td>' +
            '<td class="num">' + fmt$(r.gross) + '</td>' +
            '<td class="num">' + fmt$(r.commission) + '</td>' +
            '<td class="num">' + fmt$(r.promo) + '</td>' +
            '<td class="num">' + fmt$(r.errors) + '</td>' +
            '<td class="num">' + fmt$(r.refunds) + '</td>' +
            '<td class="num"><b>' + fmt$(r.net) + '</b></td>' +
            '<td class="num">' + traced(fmtPct(r.eff), {
              value: fmtPct(r.eff), formula: '(gross − net remitted) ÷ gross',
              inputs: [['Headline commission', fmtPct(r.gross ? r.commission / r.gross : 0)],
                       ['Promo funding', fmtPct(r.gross ? r.promo / r.gross : 0)],
                       ['Errors & refunds', fmtPct(r.gross ? (r.errors + r.refunds) / r.gross : 0)]],
              source: [r.src], period: periodLabel(P),
              note: 'The headline rate is never the real rate.' }) + '</td></tr>';
        }).join('')],
        foot: '<tr><td><b>Total</b></td>' +
          '<td class="num"><b>' + fmt$(mkTotal.gross) + '</b></td>' +
          '<td class="num"><b>' + fmt$(mkTotal.commission) + '</b></td>' +
          '<td class="num"><b>' + fmt$(mkTotal.promo) + '</b></td>' +
          '<td class="num"><b>' + fmt$(mkTotal.errors) + '</b></td>' +
          '<td class="num"><b>' + fmt$(mkTotal.refunds) + '</b></td>' +
          '<td class="num"><b>' + fmt$(mkTotal.net) + '</b></td>' +
          '<td class="num"><b>' + fmtPct((mkTotal.gross - mkTotal.net) / (mkTotal.gross || 1)) + '</b></td></tr>' }) }) +

    card({ title: 'Off-premise mix by restaurant', sub: 'Where the exposure sits',
      tools: gridTools('opu', 'Off-premise by unit ' + P), sources: ['Toast', 'Deliverect'],
      body: table({ id: 'opu', cols: [{ label: 'Restaurant' }, { label: 'Delivery', num: true },
        { label: '' }, { label: 'Delivery mix', num: true }, { label: 'Takeout', num: true },
        { label: 'Takeout mix', num: true }, { label: 'Est. commission', num: true },
        { label: 'Total off-premise', num: true }], rows: [unitRows] }) });
});
