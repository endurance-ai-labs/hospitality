/* Off-Premise Economics — revenue and true profit by marketplace */
renderPage('Off-Premise Economics', 'Every delivery marketplace, priced to the bottom line',
  ['Deliverect', 'DoorDash', 'UberEats', 'Toast'], function () {
  var P = activePeriod(), units = activeUnits();
  var prior = RG.CAL.priorPeriod(P);
  var s = RG.sumDays(units, RG.CAL.daysIn(P));

  /* ---- roll every marketplace across the units in scope ---- */
  function roll(pk) {
    var acc = {}, tot = { gross: 0, commission: 0, promo: 0, errors: 0, refunds: 0, net: 0, orders: 0 };
    units.forEach(function (u) {
      RG.periodMarketplace(u, pk).rows.forEach(function (r) {
        var a = acc[r.id] || (acc[r.id] = { id: r.id, name: r.name, kind: r.kind, color: r.color,
          gross: 0, commission: 0, promo: 0, errors: 0, refunds: 0, net: 0, orders: 0,
          prep: [], wait: [], rating: [] });
        ['gross','commission','promo','errors','refunds','net'].forEach(function (k) {
          a[k] = RG.rand.cents(a[k] + r[k]);
          tot[k] = RG.rand.cents(tot[k] + r[k]);
        });
        a.orders += r.orders; tot.orders += r.orders;
        a.prep.push(r.prepAvg); a.wait.push(r.waitAvg); a.rating.push(r.rating);
      });
    });
    var rows = Object.keys(acc).map(function (k) {
      var a = acc[k];
      function avg(x) { return x.length ? x.reduce(function (p, c) { return p + c; }, 0) / x.length : 0; }
      a.effectiveRate = a.gross ? (a.gross - a.net) / a.gross : 0;
      a.aov = a.orders ? RG.rand.cents(a.gross / a.orders) : 0;
      a.share = tot.gross ? a.gross / tot.gross : 0;
      a.prepAvg = Math.round(avg(a.prep)); a.waitAvg = Math.round(avg(a.wait));
      a.ratingAvg = Math.round(avg(a.rating) * 100) / 100;
      /* true contribution: what is left after the platform, the food and
         the kitchen labour that made it */
      a.foodCost = RG.rand.cents(a.gross * 0.335);
      a.labor = RG.rand.cents(a.gross * 0.19);
      a.contribution = RG.rand.cents(a.net - a.foodCost - a.labor);
      a.contributionPct = a.gross ? a.contribution / a.gross : 0;
      return a;
    }).sort(function (x, y) { return y.gross - x.gross; });
    tot.effectiveRate = tot.gross ? (tot.gross - tot.net) / tot.gross : 0;
    tot.aov = tot.orders ? RG.rand.cents(tot.gross / tot.orders) : 0;
    return { rows: rows, total: tot };
  }

  var cur = roll(P);
  var pri = prior ? roll(prior.key) : null;
  function priorOf(id) {
    if (!pri) return null;
    return pri.rows.filter(function (r) { return r.id === id; })[0] || null;
  }

  var firstParty = cur.rows.filter(function (r) { return r.kind === 'first-party'; });
  var fpGross = firstParty.reduce(function (a, r) { return RG.rand.cents(a + r.gross); }, 0);
  var fpShare = cur.total.gross ? fpGross / cur.total.gross : 0;

  /* ---- headline stats ---- */
  var stats = '<div class="stat-row">' +
    [['Marketplace gross', fmt$(cur.total.gross), fmtPct(cur.total.gross / (s.gross || 1)) + ' of all sales'],
     ['Orders', fmtNum(cur.total.orders), fmt$c(cur.total.aov) + ' average order'],
     ['Effective take rate', fmtPct(cur.total.effectiveRate), 'all deductions, not the headline rate'],
     ['Net remitted', fmt$(cur.total.net), fmt$(cur.total.gross - cur.total.net) + ' withheld'],
     ['Error charges', fmt$(cur.total.errors), 'disputable'],
     ['First-party mix', fmtPct(fpShare), fmt$(fpGross) + ' at near-zero commission']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + esc(r[2]) + '</i></div>';
    }).join('') + '</div>';

  /* ---- charts ---- */
  var revChart = RGChart.bar('mp-rev', {
    labels: cur.rows.map(function (r) { return r.name; }),
    series: [{ label: 'Gross', data: cur.rows.map(function (r) { return r.gross; }),
               colors: cur.rows.map(function (r) { return r.color; }) }],
    horizontal: true, legend: false, height: Math.max(220, cur.rows.length * 34 + 40)
  });

  var stackChart = RGChart.bar('mp-stack', {
    labels: cur.rows.map(function (r) { return r.name; }), stacked: true, height: 300,
    series: [
      { label: 'Net remitted', data: cur.rows.map(function (r) { return r.net; }) },
      { label: 'Commission', data: cur.rows.map(function (r) { return r.commission; }) },
      { label: 'Promo funding', data: cur.rows.map(function (r) { return r.promo; }) },
      { label: 'Error charges', data: cur.rows.map(function (r) { return r.errors; }) },
      { label: 'Refunds', data: cur.rows.map(function (r) { return r.refunds; }) }
    ]
  });

  var rateChart = RGChart.bar('mp-rate', {
    labels: cur.rows.map(function (r) { return r.name; }),
    series: [{ label: 'Effective take rate', data: cur.rows.map(function (r) { return r.effectiveRate; }),
               colors: cur.rows.map(function (r) {
                 return r.effectiveRate > 0.28 ? '#eb6834' : r.effectiveRate > 0.15 ? '#eda100' : '#1baf7a';
               }) }],
    pct: true, horizontal: true, legend: false, height: Math.max(220, cur.rows.length * 34 + 40)
  });

  /* trailing trend by marketplace */
  var t13 = RG.model().trailing13.slice(-8);
  var trendRows = t13.map(function (k) { return roll(k); });
  var mpIds = cur.rows.slice(0, 5).map(function (r) { return r.id; });
  var trendChart = RGChart.line('mp-trend', {
    labels: t13.map(function (k) { return periodLabel(k).replace('FY', ''); }), height: 300,
    series: mpIds.map(function (id) {
      var mp = cur.rows.filter(function (r) { return r.id === id; })[0];
      return { label: mp.name, color: mp.color,
        data: trendRows.map(function (rr) {
          var row = rr.rows.filter(function (x) { return x.id === id; })[0];
          return row ? row.gross : 0; }) };
    })
  });

  /* ---- the register ---- */
  var rows = cur.rows.map(function (r) {
    var p = priorOf(r.id);
    var kindPill = r.kind === 'first-party' ? pill('first-party', 'good')
      : r.kind === 'catering' ? pill('catering', 'info') : pill('marketplace', 'neutral');
    return '<tr>' +
      '<td><span class="brand-dot" style="background:' + r.color + '"></span><b>' + esc(r.name) + '</b>' +
        '<div style="font-size:10px;color:var(--color-slate-hint)">' +
        fmtPct(r.share) + ' of delivery</div></td>' +
      '<td>' + kindPill + '</td>' +
      '<td class="num">' + fmtNum(r.orders) + '</td>' +
      '<td class="num">' + fmt$c(r.aov) + '</td>' +
      '<td class="num">' + traced(fmt$(r.gross), {
        value: fmt$c(r.gross) + ' gross on ' + r.name,
        formula: 'sum of every delivery order attributed to this marketplace',
        inputs: [['Orders', fmtNum(r.orders)], ['Average order', fmt$c(r.aov)],
                 ['Share of delivery', fmtPct(r.share)],
                 ['Headline commission', fmtPct(r.commission / (r.gross || 1))]],
        source: [r.id === 'doordash' ? 'DoorDash' : r.id === 'ubereats' ? 'UberEats' : 'Deliverect'],
        period: periodLabel(P),
        note: 'Marketplace gross sums exactly to the delivery channel on the P&L.' }) + '</td>' +
      '<td class="num">' + (p && p.gross ? deltaChip((r.gross - p.gross) / p.gross) : '—') + '</td>' +
      '<td class="num">' + fmt$(r.commission) + '</td>' +
      '<td class="num">' + fmt$(r.promo) + '</td>' +
      '<td class="num">' + fmt$(r.errors) + '</td>' +
      '<td class="num">' + fmt$(r.refunds) + '</td>' +
      '<td class="num"><b>' + fmt$(r.net) + '</b></td>' +
      '<td class="num">' + traced(fmtPct(r.effectiveRate), {
        value: fmtPct(r.effectiveRate) + ' effective',
        formula: '(gross − net remitted) ÷ gross',
        inputs: [['Headline commission', fmtPct(r.commission / (r.gross || 1))],
                 ['Promo funding', fmtPct(r.promo / (r.gross || 1))],
                 ['Errors & refunds', fmtPct((r.errors + r.refunds) / (r.gross || 1))]],
        source: ['Deliverect'], period: periodLabel(P),
        note: 'The headline rate is never the real rate.' }) + '</td>' +
      '<td class="num">' + fmt$(r.contribution) + '</td>' +
      '<td class="num">' + fmtPct(r.contributionPct) + '</td>' +
      '</tr>';
  }).join('');

  var foot = '<tr><td><b>All marketplaces</b></td><td></td>' +
    '<td class="num"><b>' + fmtNum(cur.total.orders) + '</b></td>' +
    '<td class="num"><b>' + fmt$c(cur.total.aov) + '</b></td>' +
    '<td class="num"><b>' + fmt$(cur.total.gross) + '</b></td><td></td>' +
    '<td class="num"><b>' + fmt$(cur.total.commission) + '</b></td>' +
    '<td class="num"><b>' + fmt$(cur.total.promo) + '</b></td>' +
    '<td class="num"><b>' + fmt$(cur.total.errors) + '</b></td>' +
    '<td class="num"><b>' + fmt$(cur.total.refunds) + '</b></td>' +
    '<td class="num"><b>' + fmt$(cur.total.net) + '</b></td>' +
    '<td class="num"><b>' + fmtPct(cur.total.effectiveRate) + '</b></td>' +
    '<td class="num"><b>' + fmt$(cur.rows.reduce(function (a, r) {
      return RG.rand.cents(a + r.contribution); }, 0)) + '</b></td><td></td></tr>';

  /* ---- marketplace × restaurant matrix ---- */
  var mxRows = units.map(function (u) {
    var pm = RG.periodMarketplace(u, P);
    var by = {}; pm.rows.forEach(function (r) { by[r.id] = r; });
    return '<tr><td class="unit-cell"><b>' + esc(RG.unitById[u].name) + '</b>' +
      '<span>' + esc(RG.unitById[u].city) + '</span></td>' +
      cur.rows.map(function (m) {
        var r = by[m.id];
        return '<td class="num">' + (r ? fmt$(r.gross) : '—') + '</td>';
      }).join('') +
      '<td class="num"><b>' + fmt$(pm.total.gross) + '</b></td>' +
      '<td class="num">' + fmtPct(pm.total.effectiveRate) + '</td></tr>';
  }).join('');

  /* ---- switching value ---- */
  var worst = cur.rows.filter(function (r) { return r.kind === 'marketplace'; })[0];
  var best = cur.rows.filter(function (r) { return r.kind === 'first-party'; })
    .sort(function (a, b) { return a.effectiveRate - b.effectiveRate; })[0];
  var switchValue = worst && best
    ? RG.rand.cents(worst.gross * 0.10 * (worst.effectiveRate - best.effectiveRate)) : 0;

  return stats +

    '<div class="chart-grid-2">' +
      card({ title: 'Revenue by marketplace', sub: 'Gross for ' + esc(periodLabel(P)),
        sources: ['Deliverect'], body: revChart }) +
      card({ title: 'Effective take rate', sub: 'Commission plus promo plus errors plus refunds — ' +
        'green is under 15%, amber under 28%',
        sources: ['Deliverect'], body: rateChart }) +
    '</div>' +

    '<div class="chart-grid-2">' +
      card({ title: 'Where the gross goes', sub: 'Net remitted against every deduction, by marketplace',
        sources: ['DoorDash', 'UberEats'], body: stackChart }) +
      card({ title: 'Marketplace mix over time', sub: 'Trailing 8 periods, top 5 marketplaces',
        sources: ['Deliverect'], body: trendChart }) +
    '</div>' +

    card({ title: 'Marketplace register',
      sub: 'Contribution is what survives after the platform takes its cut, the food is paid for and ' +
        'the kitchen labour is charged. It is the only column that answers "is this worth serving".',
      tools: gridTools('mp', 'Marketplaces ' + P), sources: ['Deliverect', 'DoorDash', 'UberEats'],
      body: table({ id: 'mp',
        cols: [{ label: 'Marketplace' }, { label: 'Type' }, { label: 'Orders', num: true },
               { label: 'Avg order', num: true }, { label: 'Gross', num: true },
               { label: 'vs. prior', num: true }, { label: 'Commission', num: true },
               { label: 'Promo', num: true }, { label: 'Errors', num: true },
               { label: 'Refunds', num: true }, { label: 'Net remitted', num: true },
               { label: 'Effective rate', num: true }, { label: 'Contribution', num: true },
               { label: 'Contribution %', num: true }],
        rows: [rows], foot: foot }) +
      '<div class="chart-note">Marketplace gross foots exactly to the delivery channel on the P&amp;L, ' +
      'and the commission column IS the delivery-fee line — not a blended assumption. Moving ten ' +
      'points of ' + (worst ? esc(worst.name) : 'marketplace') + ' volume to ' +
      (best ? esc(best.name) : 'first-party') + ' is worth about <b>' + fmt$(switchValue) +
      '</b> a period at current volume.</div>' }) +

    card({ title: 'Marketplace by restaurant', sub: 'Where each platform actually earns',
      tools: gridTools('mpx', 'Marketplace by unit ' + P), sources: ['Deliverect'],
      body: table({ id: 'mpx',
        cols: [{ label: 'Restaurant' }]
          .concat(cur.rows.map(function (m) { return { label: m.name, num: true }; }))
          .concat([{ label: 'Total', num: true }, { label: 'Eff. rate', num: true }]),
        rows: [mxRows] }) }) +

    card({ title: 'Service quality by marketplace',
      sub: 'Prep time, courier wait and guest rating — the operational cost of each platform',
      sources: ['Deliverect', 'DoorDash'],
      body: table({ id: 'mpq',
        cols: [{ label: 'Marketplace' }, { label: 'Orders', num: true },
               { label: 'Prep time', num: true }, { label: 'Courier wait', num: true },
               { label: 'Rating', num: true }, { label: 'Error rate', num: true },
               { label: 'Refund rate', num: true }],
        rows: [cur.rows.map(function (r) {
          return '<tr><td><span class="brand-dot" style="background:' + r.color + '"></span><b>' +
            esc(r.name) + '</b></td>' +
            '<td class="num">' + fmtNum(r.orders) + '</td>' +
            '<td class="num">' + r.prepAvg + ' min</td>' +
            '<td class="num">' + r.waitAvg + ' min</td>' +
            '<td class="num">' + stars(r.ratingAvg) + ' ' + r.ratingAvg.toFixed(2) + '</td>' +
            '<td class="num">' + fmtPct(r.errors / (r.gross || 1)) + '</td>' +
            '<td class="num">' + fmtPct(r.refunds / (r.gross || 1)) + '</td></tr>';
        }).join('')] }) +
        '<div class="chart-note">A long courier wait is the platform holding finished food under a ' +
        'heat lamp — it shows up later as a one-star review about cold delivery that the kitchen ' +
        'gets blamed for. Cross-referenced on the ' +
        '<a href="/hospitality/guest" style="color:var(--color-blue);font-weight:700;text-decoration:none">' +
        'reputation page</a>.</div>' });
});
