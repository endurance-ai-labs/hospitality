/* KPI Explorer — layer any metrics over any dimension, side by side.

   Two measures on different scales never share an axis. When mixed
   scales are selected the chart switches to INDEXED mode (period 1 = 100)
   so growth is comparable without a second y-axis. */
renderPage('KPI Explorer', 'Any metrics, any dimension, side by side', ['Toast', 'R365', '7shifts', 'QBO'], function () {
  var P = activePeriod(), units = activeUnits();
  var money = can('money'), margins = can('margins');
  var M = RG.model();

  /* ---- the metric dictionary the whole page renders from ---- */
  var METRICS = [
    { k: 'netSales',   label: 'Net sales',        unit: '$',  perm: null,      get: function (r) { return r.netSales; } },
    { k: 'covers',     label: 'Covers',           unit: 'n',  perm: null,      get: function (r) { return r.covers; } },
    { k: 'avgCheck',   label: 'Average check',    unit: '$',  perm: null,      get: function (r) { return r.avgCheck; } },
    { k: 'checks',     label: 'Checks',           unit: 'n',  perm: null,      get: function (r) { return r.checks; } },
    { k: 'cogs',       label: 'Cost of goods',    unit: '$',  perm: 'margins', get: function (r) { return r.cogs; } },
    { k: 'cogsPct',    label: 'COGS % of sales',  unit: '%',  perm: 'margins', get: function (r) { return r.cogsPct; } },
    { k: 'cogsVariance', label: 'Food variance',  unit: '$',  perm: 'margins', get: function (r) { return r.cogsVariance; } },
    { k: 'labor',      label: 'Total labor',      unit: '$',  perm: 'margins', get: function (r) { return r.labor; } },
    { k: 'laborPct',   label: 'Labor % of sales', unit: '%',  perm: 'margins', get: function (r) { return r.laborPct; } },
    { k: 'laborHours', label: 'Labor hours',      unit: 'n',  perm: 'margins', get: function (r) { return r.laborHours; } },
    { k: 'splh',       label: 'Sales per labor hour', unit: '$', perm: 'margins', get: function (r) { return r.splh; } },
    { k: 'primePct',   label: 'Prime cost %',     unit: '%',  perm: 'margins', get: function (r) { return r.primePct; } },
    { k: 'fourWall',   label: 'Four-wall EBITDA', unit: '$',  perm: 'money',   get: function (r) { return r.fourWall; } },
    { k: 'fourWallPct',label: 'Four-wall margin', unit: '%',  perm: 'money',   get: function (r) { return r.fourWallPct; } },
    { k: 'occPct',     label: 'Occupancy %',      unit: '%',  perm: 'money',   get: function (r) { return r.occPct; } },
    { k: 'marketing',  label: 'Marketing spend',  unit: '$',  perm: 'money',   get: function (r) { return r.marketing; } },
    { k: 'deliveryFees', label: 'Delivery commission', unit: '$', perm: 'money', get: function (r) { return r.deliveryFees; } },
    { k: 'utilities',  label: 'Utilities',        unit: '$',  perm: 'money',   get: function (r) { return r.utilities; } },
    { k: 'repairs',    label: 'Repairs',          unit: '$',  perm: 'money',   get: function (r) { return r.repairs; } }
  ].filter(function (m) { return !m.perm || can(m.perm); });

  var byKey = {}; METRICS.forEach(function (m) { byKey[m.k] = m; });

  /* selection lives in the URL — the whole analysis is a shareable link */
  var picked = (qs('m', 'netSales,primePct,fourWallPct') || '').split(',')
    .filter(function (k) { return byKey[k]; }).slice(0, 5);
  if (!picked.length) picked = ['netSales'];
  var dim = qs('dim', 'period');
  var view = qs('view', 'auto');

  window.exToggle = function (k) {
    var s = picked.slice();
    var i = s.indexOf(k);
    if (i >= 0) { if (s.length > 1) s.splice(i, 1); }
    else { if (s.length >= 5) s.shift(); s.push(k); }
    setQs('m', s.join(','));
  };
  window.exSet = function (k, v) { setQs(k, v); };

  /* ---- roll a P&L for an arbitrary set of units + period ---- */
  var KEYS = ['netSales','covers','checks','cogs','cogsVariance','labor','laborHours',
    'primeCost','fourWall','occupancy','marketing','deliveryFees','utilities','repairs'];
  function roll(pk, ids) {
    var o = {}; KEYS.forEach(function (k) { o[k] = 0; });
    ids.forEach(function (u) {
      var pl = RG.periodPL(u, pk);
      KEYS.forEach(function (k) { o[k] = RG.rand.cents(o[k] + pl[k]); });
    });
    o.covers = Math.round(o.covers); o.checks = Math.round(o.checks);
    o.avgCheck = o.checks ? RG.rand.cents(o.netSales / o.checks) : 0;
    o.cogsPct = o.netSales ? o.cogs / o.netSales : 0;
    o.laborPct = o.netSales ? o.labor / o.netSales : 0;
    o.primePct = o.netSales ? o.primeCost / o.netSales : 0;
    o.fourWallPct = o.netSales ? o.fourWall / o.netSales : 0;
    o.occPct = o.netSales ? o.occupancy / o.netSales : 0;
    o.splh = o.laborHours ? RG.rand.cents(o.netSales / o.laborHours) : 0;
    return o;
  }

  /* ---- build the series for the chosen dimension ---- */
  var labels, rows;
  if (dim === 'period') {
    labels = M.trailing13.map(function (k) { return periodLabel(k).replace('FY', ''); });
    rows = M.trailing13.map(function (k) { return roll(k, units); });
  } else if (dim === 'unit') {
    labels = units.map(function (u) { return RG.unitById[u].short; });
    rows = units.map(function (u) { return roll(P, [u]); });
  } else if (dim === 'brand') {
    var brands = [];
    units.forEach(function (u) { var b = RG.unitById[u].brand; if (brands.indexOf(b) < 0) brands.push(b); });
    labels = brands.map(function (b) { return RG.BRANDS.filter(function (x) { return x.id === b; })[0].name; });
    rows = brands.map(function (b) {
      return roll(P, units.filter(function (u) { return RG.unitById[u].brand === b; }));
    });
  } else { /* region */
    var regs = [];
    units.forEach(function (u) { var r = RG.unitById[u].region; if (regs.indexOf(r) < 0) regs.push(r); });
    labels = regs;
    rows = regs.map(function (r) {
      return roll(P, units.filter(function (u) { return RG.unitById[u].region === r; }));
    });
  }

  /* ---- mixed scales force indexed mode. Never two y-axes. ---- */
  var uniqUnits = [];
  picked.forEach(function (k) { if (uniqUnits.indexOf(byKey[k].unit) < 0) uniqUnits.push(byKey[k].unit); });
  var mixed = uniqUnits.length > 1;
  var indexed = view === 'indexed' || (view === 'auto' && mixed);

  var chartSeries = picked.map(function (k) {
    var m = byKey[k];
    var raw = rows.map(function (r) { return m.get(r); });
    if (!indexed) return { label: m.label, data: raw, fill: picked.length === 1 };
    var base = raw.find(function (v) { return v !== 0; }) || 1;
    return { label: m.label, data: raw.map(function (v) { return (v / base) * 100; }) };
  });

  var chartId = 'c-explore';
  var chart = (dim === 'period')
    ? RGChart.line(chartId, { labels: labels, series: chartSeries, height: 330,
        plain: indexed, pct: !indexed && uniqUnits[0] === '%' })
    : RGChart.bar(chartId, { labels: labels, series: chartSeries, height: 330,
        plain: indexed, pct: !indexed && uniqUnits[0] === '%' });

  /* ---- metric picker ---- */
  var chips = METRICS.map(function (m) {
    var on = picked.indexOf(m.k) >= 0;
    var slot = picked.indexOf(m.k);
    return '<button class="mx-chip' + (on ? ' on' : '') + '" onclick="exToggle(\'' + m.k + '\')">' +
      (on ? '<i style="background:' + RGChart.series(slot) + '"></i>' : '') +
      esc(m.label) + '<span class="mx-u">' + (m.unit === '$' ? '$' : m.unit === '%' ? '%' : '#') + '</span>' +
      '</button>';
  }).join('');

  /* ---- matrix: every picked metric × every dimension member ---- */
  function fmtBy(m, v) {
    return m.unit === '$' ? fmt$(v) : m.unit === '%' ? fmtPct(v) : fmtNum(v);
  }
  var matrixRows = labels.map(function (lab, i) {
    return '<tr><td><b>' + esc(lab) + '</b></td>' +
      picked.map(function (k) {
        var m = byKey[k], v = m.get(rows[i]);
        var all = rows.map(function (r) { return m.get(r); });
        var max = Math.max.apply(null, all), min = Math.min.apply(null, all);
        var span = (max - min) || 1;
        var share = (v - min) / span;
        return '<td class="num">' + traced(fmtBy(m, v), {
          value: fmtBy(m, v) + ' · ' + m.label,
          formula: 'metric "' + m.label + '" evaluated for ' + lab,
          inputs: [['Best in view', fmtBy(m, max)], ['Worst in view', fmtBy(m, min)],
                   ['Position in range', fmtPct(share)],
                   ['Dimension', dim]],
          source: ['Model'], period: dim === 'period' ? lab : periodLabel(P),
          note: 'Every metric here is defined once in the dictionary and read by the chart, ' +
                'the matrix and the Brain alike.' }) + '</td>';
      }).join('') + '</tr>';
  }).join('');

  var scenarioCount = (function () {
    /* how many distinct views this page can produce, stated honestly */
    var metricCombos = 0, n = METRICS.length;
    for (var r = 1; r <= 5; r++) {
      var c = 1;
      for (var i = 0; i < r; i++) c = c * (n - i) / (i + 1);
      metricCombos += Math.round(c);
    }
    return metricCombos * 4 * M.periods.length;
  })();

  return '<div class="demo-panel" style="margin-bottom:var(--space-4)">' +
      '<div class="section-head"><div><h2>Build a view</h2>' +
      '<div class="sub">Pick up to five metrics, choose what to break them out by, and the chart ' +
      'and matrix follow. Your selection is in the URL.</div></div>' +
      '<div style="display:flex;gap:7px;flex-wrap:wrap">' +
        '<select class="scn-sel" onchange="exSet(\'dim\',this.value)">' +
          [['period','Break out by: period'],['unit','Break out by: restaurant'],
           ['brand','Break out by: brand'],['region','Break out by: region']].map(function (o) {
            return '<option value="' + o[0] + '"' + (dim === o[0] ? ' selected' : '') + '>' +
              o[1] + '</option>'; }).join('') + '</select>' +
        '<select class="scn-sel' + (view !== 'auto' ? ' on' : '') + '" onchange="exSet(\'view\',this.value)">' +
          [['auto','Scale: automatic'],['indexed','Scale: indexed to 100'],['raw','Scale: raw values']]
            .map(function (o) {
              return '<option value="' + o[0] + '"' + (view === o[0] ? ' selected' : '') + '>' +
                o[1] + '</option>'; }).join('') + '</select>' +
      '</div></div>' +
      '<div class="card-gutter"><div class="mx-chips">' + chips + '</div>' +
      '<div class="chart-note">' + picked.length + ' of 5 metric slots used · ' +
      METRICS.length + ' metrics available · ' + fmtNum(scenarioCount) +
      ' distinct views reachable from this page alone.</div></div>' +
    '</div>' +

    card({ title: picked.map(function (k) { return byKey[k].label; }).join(' · '),
      sub: (indexed
        ? '<b>Indexed to 100</b> — the selected metrics are on different scales, so they are rebased ' +
          'rather than forced onto a second axis. A dual-axis chart can be made to show any ' +
          'correlation you like; this cannot.'
        : 'Raw values, one axis') + ' · broken out by ' + esc(dim),
      sources: ['Model'], body: chart }) +

    card({ title: 'Matrix', sub: 'Every selected metric against every member of the dimension. ' +
      'Sort any column; filter below.',
      tools: gridTools('mx', 'KPI matrix'),
      body: table({ id: 'mx',
        cols: [{ label: dim === 'period' ? 'Period' : dim === 'unit' ? 'Restaurant' :
                        dim === 'brand' ? 'Brand' : 'Region' }]
          .concat(picked.map(function (k) { return { label: byKey[k].label, num: true }; })),
        rows: [matrixRows] }) });
});
