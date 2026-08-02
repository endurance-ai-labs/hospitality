/* Menu Engineering — PMIX, contribution margin, the four-quadrant matrix */
renderPage('Menu Engineering', 'Item mix, true plate cost and contribution', ['Toast', 'R365'], function () {
  var P = activePeriod(), units = activeUnits();
  var endIso = RG.CAL.periodByKey[P].end;

  /* PMIX rolled across the units in scope */
  var acc = {};
  units.forEach(function (u) {
    RG.periodPmix(u, P).forEach(function (r) {
      var a = acc[r.item] || (acc[r.item] = { item: r.item, name: r.name, cat: r.cat,
        qty: 0, sales: 0, cost: 0, brand: RG.menuById[r.item].brand });
      a.qty += r.qty; a.sales = RG.rand.cents(a.sales + r.sales);
      a.cost = RG.rand.cents(a.cost + r.cost);
    });
  });
  var items = Object.keys(acc).map(function (k) {
    var a = acc[k];
    a.margin = RG.rand.cents(a.sales - a.cost);
    a.marginEach = a.qty ? RG.rand.cents(a.margin / a.qty) : 0;
    a.foodPct = a.sales ? a.cost / a.sales : 0;
    a.price = a.qty ? RG.rand.cents(a.sales / a.qty) : 0;
    return a;
  }).sort(function (x, y) { return y.sales - x.sales; });

  var totQty = items.reduce(function (s, i) { return s + i.qty; }, 0);
  var totSales = items.reduce(function (s, i) { return RG.rand.cents(s + i.sales); }, 0);
  var totMargin = items.reduce(function (s, i) { return RG.rand.cents(s + i.margin); }, 0);
  var avgMargin = totQty ? totMargin / totQty : 0;
  var avgMix = items.length ? 1 / items.length : 0;

  /* menu-engineering quadrant: popularity vs contribution margin */
  items.forEach(function (i) {
    i.mix = totQty ? i.qty / totQty : 0;
    var popular = i.mix >= avgMix * 0.7;
    var profitable = i.marginEach >= avgMargin;
    i.quad = popular && profitable ? 'Star' : popular ? 'Plow horse' :
             profitable ? 'Puzzle' : 'Dog';
  });
  var QUAD_TONE = { 'Star': 'good', 'Plow horse': 'warn', 'Puzzle': 'info', 'Dog': 'bad' };

  var maxMix = Math.max.apply(null, items.map(function (i) { return i.mix; })) || 1;
  var maxMar = Math.max.apply(null, items.map(function (i) { return i.marginEach; })) || 1;
  var dots = items.map(function (i) {
    return '<div class="quad-dot" style="left:' + (i.mix / maxMix * 88 + 6).toFixed(1) + '%;top:' +
      (100 - (i.marginEach / maxMar * 88 + 6)).toFixed(1) + '%;background:' +
      (i.quad === 'Star' ? 'var(--color-green)' : i.quad === 'Dog' ? 'var(--color-red)' :
       i.quad === 'Puzzle' ? 'var(--color-blue)' : 'var(--color-amber)') + '"' +
      exp({ value: i.name, formula: i.quad + ' — ' +
              (i.quad === 'Star' ? 'popular and profitable: protect it' :
               i.quad === 'Plow horse' ? 'popular but thin: re-engineer the cost or nudge the price' :
               i.quad === 'Puzzle' ? 'profitable but nobody orders it: merchandise or cut' :
               'unpopular and unprofitable: a candidate to remove'),
            inputs: [['Sold', fmtNum(i.qty)], ['Menu mix', fmtPct(i.mix)],
                     ['Contribution each', fmt$c(i.marginEach)], ['Food cost', fmtPct(i.foodPct)]],
            source: ['Toast', 'R365'], period: periodLabel(P) }) + '></div>';
  }).join('');

  var quadrant =
    '<div class="quad">' +
      '<div class="quad-line" style="left:0;right:0;top:50%;height:1px"></div>' +
      '<div class="quad-line" style="top:0;bottom:0;left:50%;width:1px"></div>' +
      '<div class="quad-tag" style="left:10px;top:8px">Puzzle — profitable, unpopular</div>' +
      '<div class="quad-tag" style="right:10px;top:8px">Star — popular, profitable</div>' +
      '<div class="quad-tag" style="left:10px;bottom:8px">Dog — unpopular, unprofitable</div>' +
      '<div class="quad-tag" style="right:10px;bottom:8px">Plow horse — popular, thin</div>' +
      dots +
    '</div>' +
    '<div style="display:flex;gap:14px;margin-top:12px;font-size:11px;flex-wrap:wrap;color:var(--color-text-muted)">' +
    ['Star', 'Plow horse', 'Puzzle', 'Dog'].map(function (q) {
      var n = items.filter(function (i) { return i.quad === q; }).length;
      return pill(q + ' · ' + n, QUAD_TONE[q]);
    }).join('') + '</div>' +
    '<div style="font-size:11px;color:var(--color-slate-hint);margin-top:10px;line-height:1.55">' +
    'Horizontal axis is menu mix (units sold as a share of everything sold). Vertical is contribution ' +
    'margin per plate at true recipe cost — not food-cost percentage, which flatters cheap items.</div>';

  var rows = items.map(function (i) {
    return '<tr>' +
      '<td><b>' + esc(i.name) + '</b><div style="font-size:10px;color:var(--color-slate-hint)">' +
        esc(i.cat) + ' · ' + esc(RG.BRANDS.filter(function (b) { return b.id === i.brand; })[0].name) +
        '</div></td>' +
      '<td class="num">' + fmtNum(i.qty) + '</td>' +
      '<td class="num">' + fmtPct(i.mix) + '</td>' +
      '<td class="num">' + fmt$c(i.price) + '</td>' +
      '<td class="num">' + traced(fmt$c(i.cost / (i.qty || 1)), {
        value: fmt$c(i.cost / (i.qty || 1)) + ' per plate',
        formula: 'Σ (recipe quantity × ingredient market price on the day sold)',
        inputs: RG.menuById[i.item].recipe.slice(0, 6).map(function (l) {
          var ing = RG.ingById[l.ing];
          return [ing.name, (l.qty * RG.PORTION_SCALE[RG.menuById[i.item].bev ? 'bev' : 'food']).toFixed(3) +
            ' ' + ing.unit + ' @ ' + fmt$c(RG.ingCost(l.ing, endIso))];
        }), source: ['R365'], period: periodLabel(P),
        note: 'Off-premise orders also carry packaging cost.' }) + '</td>' +
      '<td class="num">' + fmtPct(i.foodPct) + '</td>' +
      '<td class="num">' + fmt$c(i.marginEach) + '</td>' +
      '<td class="num"><b>' + fmt$(i.margin) + '</b></td>' +
      '<td>' + pill(i.quad, QUAD_TONE[i.quad]) + '</td></tr>';
  }).join('');

  /* category rollup */
  var cats = {};
  items.forEach(function (i) {
    var c = cats[i.cat] || (cats[i.cat] = { cat: i.cat, qty: 0, sales: 0, margin: 0, cost: 0 });
    c.qty += i.qty; c.sales = RG.rand.cents(c.sales + i.sales);
    c.margin = RG.rand.cents(c.margin + i.margin); c.cost = RG.rand.cents(c.cost + i.cost);
  });
  var catRows = Object.keys(cats).map(function (k) { return cats[k]; })
    .sort(function (a, b) { return b.sales - a.sales; }).map(function (c) {
    return '<tr><td><b>' + esc(c.cat) + '</b></td>' +
      '<td class="num">' + fmtNum(c.qty) + '</td>' +
      '<td class="num">' + fmt$(c.sales) + '</td>' +
      '<td style="width:24%"><div class="rg-bar"><i style="width:' +
        (c.sales / (totSales || 1) * 100).toFixed(1) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(c.sales / (totSales || 1)) + '</td>' +
      '<td class="num">' + fmtPct(c.cost / (c.sales || 1)) + '</td>' +
      '<td class="num">' + fmt$(c.margin) + '</td></tr>';
  }).join('');

  /* ================= ITEM x DAY =================
     The lowest grain the business records. Every other number on the
     site is an aggregation of these rows. */
  var idMeasure = qs('idm', 'qty');
  var idChannel = qs('idc', '');
  var idDaypart = qs('idd', '');
  var idCategory = qs('idcat', '');
  var idTop = parseInt(qs('idn', '30'), 10) || 30;
  window.idSet = function (k, v) { setQs(k, v); };

  var idCats = [];
  RG.menuFor(RG.unitById[units[0]].brand).forEach(function (m) {
    if (idCats.indexOf(m.category) < 0) idCats.push(m.category);
  });

  function idSel(k, cur, opts, on) {
    return '<select class="scn-sel' + (on ? ' on' : '') + '" onchange="idSet(\'' + k + '\',this.value)">' +
      opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' +
          (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
  }

  var idExhibit = RGItemDay.render({
    units: units, period: P, id: 'idm', measure: idMeasure,
    channel: idChannel, daypart: idDaypart, category: idCategory, topN: idTop
  });

  var idControls =
    idSel('idm', idMeasure, Object.keys(RGItemDay.MEASURES)
      .filter(function (k) {
        var m = RGItemDay.MEASURES[k]; return !m.perm || can(m.perm);
      })
      .map(function (k) { return [k, 'Measure: ' + RGItemDay.MEASURES[k].label]; }), true) +
    idSel('idcat', idCategory, [['', 'Category: all']].concat(idCats.map(function (c) {
      return [c, 'Category: ' + c]; })), !!idCategory) +
    idSel('idc', idChannel, [['', 'Channel: all']].concat(RG.CHANNELS.map(function (c) {
      return [c.id, 'Channel: ' + c.label]; })), !!idChannel) +
    idSel('idd', idDaypart, [['', 'Daypart: all']].concat(RG.CAL.DAYPARTS.map(function (d) {
      return [d.id, 'Daypart: ' + d.label]; })), !!idDaypart) +
    idSel('idn', String(idTop), [['15', 'Top 15 items'], ['30', 'Top 30 items'],
      ['60', 'Top 60 items'], ['500', 'Every item']]);

  var itemDayCard = card({
    title: 'Item sales by day',
    sub: idExhibit.measureLabel + ' for every item on every trading day' +
      (idCategory ? ' · ' + esc(idCategory) : '') +
      (idChannel ? ' · ' + esc(RG.CHANNELS.filter(function (c) { return c.id === idChannel; })[0].label) : '') +
      (idDaypart ? ' · ' + esc(RG.CAL.DAYPARTS.filter(function (d) { return d.id === idDaypart; })[0].label) : '') +
      ' · ' + fmtNum(idExhibit.data.items.length) + ' items × ' +
      fmtNum(idExhibit.data.days.length) + ' days',
    tools: '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' +
      idControls + '</div>',
    sources: ['Toast', 'R365'],
    body: idExhibit.html +
      '<div class="chart-note">Cell shading is share of the largest cell. Hover any figure for ' +
      'its share of that item’s period and of that day. This is the grain the POS actually ' +
      'records — the P&amp;L, the menu matrix and the food-cost bridge are all sums of these ' +
      'same rows.</div>'
  });

  return '<div class="stat-row">' +
    [['Items on menu', fmtNum(items.length), 'in scope'],
     ['Units sold', fmtNum(totQty), 'this period'],
     ['Menu sales', fmt$(totSales), ''],
     ['Contribution', fmt$(totMargin), fmtPct(totMargin / (totSales || 1)) + ' of menu sales'],
     ['Avg contribution', fmt$c(avgMargin), 'per plate'],
     ['Dogs', fmtNum(items.filter(function (i) { return i.quad === 'Dog'; }).length),
      'candidates to remove']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    '<div class="two-col">' +
      card({ title: 'Menu engineering matrix', sub: 'Popularity against contribution margin',
        sources: ['Toast', 'R365'], body: quadrant }) +
      card({ title: 'By category', sub: 'Where the sales and the margin actually sit',
        sources: ['Toast'],
        body: table({ id: 'cats', cols: [{ label: 'Category' }, { label: 'Sold', num: true },
          { label: 'Sales', num: true }, { label: '' }, { label: 'Mix', num: true },
          { label: 'Cost %', num: true }, { label: 'Contribution', num: true }], rows: [catRows] }) }) +
    '</div>' +

    card({ title: 'Product mix', sub: 'Every item, at true recipe cost. Hover a plate cost to see the recipe.',
      tools: gridTools('pmix', 'PMIX ' + P), sources: ['Toast', 'R365'],
      body: table({ id: 'pmix',
        cols: [{ label: 'Item' }, { label: 'Sold', num: true }, { label: 'Mix', num: true },
               { label: 'Avg price', num: true }, { label: 'Plate cost', num: true },
               { label: 'Cost %', num: true }, { label: 'Contribution', num: true },
               { label: 'Total', num: true }, { label: 'Class' }],
        rows: [rows],
        foot: '<tr><td><b>Total</b></td>' +
          '<td class="num"><b>' + fmtNum(totQty) + '</b></td><td></td><td></td><td></td>' +
          '<td class="num"><b>' + fmtPct((totSales - totMargin) / (totSales || 1)) + '</b></td>' +
          '<td class="num"><b>' + fmt$c(avgMargin) + '</b></td>' +
          '<td class="num"><b>' + fmt$(totMargin) + '</b></td><td></td></tr>' }) }) +
    itemDayCard;
});
