/* Food & Beverage Cost — theoretical vs actual, with the five-driver bridge */
renderPage('Food & Beverage Cost', 'Theoretical versus actual, decomposed', ['R365', 'Toast', 'Sysco'], function () {
  if (!can('margins')) return card({ title: 'Restricted',
    body: '<div style="padding:20px;color:var(--color-text-muted)">Cost detail is limited to ' +
      'managers and above. You are signed in as ' + esc(currentPersona().title) + '.</div>' });

  var P = activePeriod(), units = activeUnits();
  var prior = RG.CAL.priorPeriod(P);

  /* aggregate the bridge across the units in scope */
  function roll(pk) {
    var out = { theo: 0, actual: 0, variance: 0, theoFood: 0, theoBev: 0,
      drivers: { portion: 0, waste: 0, spoilage: 0, ppv: 0, unexplained: 0 }, byIng: {} };
    units.forEach(function (u) {
      var c = RG.periodCogs(u, pk);
      out.theo = RG.rand.cents(out.theo + c.theo);
      out.theoFood = RG.rand.cents(out.theoFood + c.theoFood);
      out.theoBev = RG.rand.cents(out.theoBev + c.theoBev);
      out.actual = RG.rand.cents(out.actual + c.actual);
      out.variance = RG.rand.cents(out.variance + c.variance);
      Object.keys(out.drivers).forEach(function (d) {
        out.drivers[d] = RG.rand.cents(out.drivers[d] + c.drivers[d]);
      });
      Object.keys(c.byIng).forEach(function (k) {
        var a = out.byIng[k] || (out.byIng[k] = { qty: 0, cost: 0 });
        a.qty = Math.round((a.qty + c.byIng[k].qty) * 100) / 100;
        a.cost = RG.rand.cents(a.cost + c.byIng[k].cost);
      });
    });
    return out;
  }
  var c = roll(P), cp = prior ? roll(prior.key) : null;
  var sales = RG.sumDays(units, RG.CAL.daysIn(P));

  var DRIVER_META = {
    portion:     ['Portioning', 'Plates going out heavier than the recipe spec', 'floor'],
    waste:       ['Waste', 'Over-prep, cook errors and mishandling', 'floor'],
    spoilage:    ['Spoilage', 'Product expiring before it is sold', 'floor'],
    ppv:         ['Purchase price', 'Paid above market — off-guide buying and contract slippage', 'supplier'],
    unexplained: ['Unexplained shrink', 'Counted usage with no recipe, waste or purchase explanation', 'floor']
  };

  /* Food and pour cost each need their OWN revenue denominator — food cost
     against food sales, beverage cost against beverage sales. Dividing both
     by total sales is the most common way these two numbers get misquoted. */
  var netFood = 0, netBev = 0, cogsFood = 0, cogsBev = 0;
  units.forEach(function (u) {
    var pl = RG.periodPL(u, P);
    netFood = RG.rand.cents(netFood + pl.netFood);
    netBev = RG.rand.cents(netBev + pl.netBev);
    cogsFood = RG.rand.cents(cogsFood + pl.cogsFood);
    cogsBev = RG.rand.cents(cogsBev + pl.cogsBev);
  });

  var stats = '<div class="stat-row">' +
    [['Theoretical cost', fmt$(c.theo), fmtPct(c.theo / sales.net) + ' of net sales'],
     ['Actual cost', fmt$(c.actual), fmtPct(c.actual / sales.net) + ' of net sales'],
     ['Variance', fmt$(c.variance), fmtPct(c.variance / c.theo) + ' of theoretical'],
     ['Food cost', fmtPct(netFood ? cogsFood / netFood : 0), 'of food sales · target 30.0%'],
     ['Pour cost', fmtPct(netBev ? cogsBev / netBev : 0), 'of beverage sales · target 21.0%'],
     ['vs. prior period', cp ? deltaChip((c.variance - cp.variance) / Math.max(1, cp.variance), { lowerIsBetter: true }) : '—',
      cp ? fmt$(cp.variance) + ' last period' : '']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>';

  /* ---- the bridge ---- */
  var bridgeRows = Object.keys(DRIVER_META).map(function (k) {
    return [DRIVER_META[k][0], c.drivers[k], {
      value: fmt$c(c.drivers[k]), formula: DRIVER_META[k][1],
      inputs: [['Share of variance', fmtPct(c.drivers[k] / (c.variance || 1))],
               ['Of theoretical cost', fmtPct(c.drivers[k] / (c.theo || 1))],
               ['Owner', DRIVER_META[k][2] === 'supplier' ? 'Purchasing' : 'Kitchen / floor']],
      source: ['R365', 'Sysco'], period: periodLabel(P),
      note: DRIVER_META[k][2] === 'supplier'
        ? 'A supplier problem — start with the order guide and contract pricing.'
        : 'A floor problem — start with spec sheets and the line, not the vendor.' }];
  });

  /* ---- by unit ---- */
  var unitRows = units.map(function (u) {
    var x = RG.periodCogs(u, P);
    var us = RG.periodSales(u, P);
    var top = Object.keys(x.drivers).sort(function (a, b) { return x.drivers[b] - x.drivers[a]; })[0];
    var tone = x.variancePct > 0.055 ? 'bad' : x.variancePct > 0.035 ? 'warn' : 'good';
    return '<tr>' +
      '<td class="unit-cell"><b>' + esc(RG.unitById[u].name) + '</b>' +
        '<span>' + esc(RG.unitById[u].city) + ' · ' + esc(RG.unitById[u].pos) + '</span></td>' +
      '<td class="num">' + fmt$(x.theo) + '</td>' +
      '<td class="num">' + fmt$(x.actual) + '</td>' +
      '<td class="num">' + traced(fmt$(x.variance), {
        value: fmt$c(x.variance), formula: 'actual − theoretical, decomposed into five named drivers',
        inputs: Object.keys(DRIVER_META).map(function (k) {
          return [DRIVER_META[k][0], fmt$(x.drivers[k])];
        }), source: ['R365'], period: periodLabel(P),
        note: 'The five drivers sum to the variance exactly.', drill: 'unit detail' }) + '</td>' +
      '<td style="width:20%"><div class="rg-bar"><i class="' + tone + '" style="width:' +
        Math.min(100, x.variancePct / 0.08 * 100).toFixed(0) + '%"></i></div></td>' +
      '<td class="num">' + fmtPct(x.variancePct) + '</td>' +
      '<td>' + pill(DRIVER_META[top][0], tone) + '</td>' +
      '<td class="num">' + fmtPct(x.actual / us.net) + '</td>' +
      '</tr>';
  }).join('');

  /* ---- top ingredients by usage ---- */
  var ings = Object.keys(c.byIng).map(function (k) {
    var meta = RG.ingById[k];
    return { id: k, name: meta ? meta.name : k, unit: meta ? meta.unit : '',
      family: meta ? meta.family : '', qty: c.byIng[k].qty, cost: c.byIng[k].cost };
  }).sort(function (a, b) { return b.cost - a.cost; }).slice(0, 18);
  var endIso = RG.CAL.periodByKey[P].end, startIso = RG.CAL.periodByKey[P].start;
  var ingRows = ings.map(function (i) {
    var pStart = RG.ingCost(i.id, startIso), pEnd = RG.ingCost(i.id, endIso);
    var move = pStart ? (pEnd - pStart) / pStart : 0;
    var idxNow = RG.familyIndex(i.family, endIso);
    return '<tr><td><b>' + esc(i.name) + '</b><div style="font-size:10px;color:var(--color-slate-hint)">' +
        esc(i.family) + '</div></td>' +
      '<td class="num">' + fmtNum(i.qty, 1) + ' ' + esc(i.unit) + '</td>' +
      '<td class="num">' + traced(fmt$(i.cost), {
        value: fmt$c(i.cost), formula: 'recipe quantity × PMIX quantity × market price that day, summed',
        inputs: [['Price at period start', fmt$c(pStart)], ['Price at period end', fmt$c(pEnd)],
                 ['Commodity index vs. 2024', fmtPct(idxNow - 1)]],
        source: ['R365', 'Sysco'], period: periodLabel(P),
        note: 'Usage is derived from recipes and item mix, not from a count sheet.' }) + '</td>' +
      '<td class="num">' + fmt$c(pEnd) + '</td>' +
      '<td class="num">' + deltaChip(move, { lowerIsBetter: true }) + '</td>' +
      '<td class="num">' + fmtPct(idxNow - 1) + '</td></tr>';
  }).join('');

  return stats +
    card({ title: 'Where the variance came from',
      sub: 'Five named drivers. They sum to ' + fmt$(c.variance) + ' exactly — nothing is left unattributed.',
      sources: ['R365', 'Sysco', 'Toast'],
      body: waterfall(bridgeRows, c.variance, 'Total variance') +
        '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:14px;line-height:1.6">' +
        '<b>Purchase price</b> is a supplier problem — it is settled with the order guide and the ' +
        'contract. <b>Portioning, waste, spoilage and shrink</b> are floor problems, settled with ' +
        'spec sheets, prep discipline and cash control. Knowing which of those two buckets ' +
        'a dollar sits in is the difference between calling your rep and walking the line.</div>' }) +

    card({ title: 'By restaurant', sub: 'Ranked by variance rate against theoretical',
      tools: gridTools('cogsu', 'Food cost by unit ' + P), sources: ['R365'],
      body: table({ id: 'cogsu',
        cols: [{ label: 'Restaurant' }, { label: 'Theoretical', num: true }, { label: 'Actual', num: true },
               { label: 'Variance', num: true }, { label: '' }, { label: 'Rate', num: true },
               { label: 'Top driver' }, { label: '% of sales', num: true }],
        rows: [unitRows],
        foot: '<tr><td><b>Total</b></td>' +
          '<td class="num"><b>' + fmt$(c.theo) + '</b></td>' +
          '<td class="num"><b>' + fmt$(c.actual) + '</b></td>' +
          '<td class="num"><b>' + fmt$(c.variance) + '</b></td><td></td>' +
          '<td class="num"><b>' + fmtPct(c.variance / c.theo) + '</b></td><td></td>' +
          '<td class="num"><b>' + fmtPct(c.actual / sales.net) + '</b></td></tr>' }) }) +

    card({ title: 'Highest-cost ingredients', sub: 'Usage derived from recipes and item mix, priced at market',
      tools: gridTools('ings', 'Ingredient usage ' + P), sources: ['R365', 'Sysco'],
      body: table({ id: 'ings',
        cols: [{ label: 'Ingredient' }, { label: 'Usage', num: true }, { label: 'Cost', num: true },
               { label: 'Unit price', num: true }, { label: 'In-period move', num: true },
               { label: 'vs. 2024 index', num: true }],
        rows: [ingRows] }) });
});
