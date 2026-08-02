/* Cross-Analysis — any measure against any two dimensions */
renderPage('Cross-Analysis', 'Any measure, any two dimensions, down to the line',
  ['Toast', 'R365', '7shifts', 'Sysco', 'QBO'], function () {
  var P = activePeriod(), units = activeUnits();

  var measures = RGPivot.measuresFor();
  var measure = measures.indexOf(qs('ms', '')) >= 0 ? qs('ms', '') : 'sales';
  var domain = RGPivot.MEAS[measure].domain;
  var allowed = RGPivot.dimsFor(domain);

  var row = allowed.indexOf(qs('rw', '')) >= 0 ? qs('rw', '')
    : (domain === 'cost' ? 'ingredient' : domain === 'labor' ? 'employee'
      : domain === 'finance' ? 'period' : 'item');
  var col = qs('cl', '') === 'none' ? '' :
    (allowed.indexOf(qs('cl', '')) >= 0 ? qs('cl', '') : 'unit');
  if (col === row) col = allowed.filter(function (d) { return d !== row; })[0] || '';
  var topN = parseInt(qs('tn', '25'), 10) || 25;
  var shade = qs('sh', '1') !== '0';

  window.pvSet = function (k, v) { setQs(k, v); };

  var pv = RGPivot.build({ measure: measure, row: row, col: col, units: units, period: P });
  var shownRows = pv.rowKeys.slice(0, topN);
  var hidden = pv.rowKeys.length - shownRows.length;
  var hiddenTotal = pv.rowKeys.slice(topN).reduce(function (a, k) { return a + pv.rowTot[k]; }, 0);

  /* ---- controls ---- */
  function sel(k, cur, opts, on) {
    return '<select class="scn-sel' + (on ? ' on' : '') + '" onchange="pvSet(\'' + k + '\',this.value)">' +
      opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') +
          (o[2] ? ' disabled' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
  }
  var controls =
    sel('ms', measure, measures.map(function (k) {
      return [k, 'Measure: ' + RGPivot.MEAS[k].label]; }), true) +
    sel('rw', row, allowed.map(function (k) {
      return [k, 'Rows: ' + RGPivot.DIMS[k].label]; })) +
    sel('cl', col || 'none', [['none', 'Columns: none (list)']].concat(
      allowed.filter(function (k) { return k !== row; }).map(function (k) {
        return [k, 'Columns: ' + RGPivot.DIMS[k].label]; }))) +
    sel('tn', String(topN), [['10', 'Top 10'], ['25', 'Top 25'], ['50', 'Top 50'],
      ['500', 'All rows']]) +
    sel('sh', shade ? '1' : '0', [['1', 'Heatmap: on'], ['0', 'Heatmap: off']], !shade);

  /* ---- the cross-tab ---- */
  var maxCell = 0;
  shownRows.forEach(function (rk) {
    (pv.colKeys.length ? pv.colKeys : ['Total']).forEach(function (ck) {
      var v = (pv.grid[rk] || {})[ck] || 0;
      if (v > maxCell) maxCell = v;
    });
  });

  function cell(rk, ck) {
    var v = (pv.grid[rk] || {})[ck];
    var bg = '';
    if (shade && v > 0 && maxCell > 0) {
      bg = ';background:rgba(39,102,214,' + (0.05 + (v / maxCell) * 0.42).toFixed(3) + ')';
    }
    return '<td class="num pv-cell" style="white-space:nowrap' + bg + '"' +
      (v ? exp({ value: RGPivot.fmtVal(pv.measure, v),
                 formula: pv.measure.label + ' for ' + rk + (pv.colDim ? ' × ' + ck : ''),
                 inputs: [['Share of row', fmtPct(v / (pv.rowTot[rk] || 1))],
                          ['Share of column', fmtPct(v / (pv.colTot[ck] || 1))],
                          ['Share of grand total', fmtPct(v / (pv.total || 1))]],
                 source: [domain === 'cost' ? 'R365' : domain === 'labor' ? '7shifts' : 'Toast'],
                 period: periodLabel(P),
                 note: 'Aggregated from ' + fmtNum(pv.factCount) + ' fact rows at the ' +
                       domain + ' grain.' }) : '') + '>' +
      RGPivot.fmtVal(pv.measure, v) + '</td>';
  }

  var cols = pv.colKeys.length ? pv.colKeys : ['Total'];
  var bodyRows = shownRows.map(function (rk) {
    return '<tr><td class="pv-row"><b>' + esc(rk) + '</b></td>' +
      cols.map(function (ck) { return cell(rk, ck); }).join('') +
      '<td class="num pv-tot"><b>' + RGPivot.fmtVal(pv.measure, pv.rowTot[rk]) + '</b></td>' +
      '<td class="num pv-share">' + fmtPct(pv.rowTot[rk] / (pv.total || 1)) + '</td></tr>';
  }).join('') +
  (hidden > 0 ? '<tr class="pv-other"><td><b>All other ' + esc(pv.rowDim.label.toLowerCase()) +
    ' (' + fmtNum(hidden) + ')</b></td>' +
    cols.map(function (ck) {
      var v = pv.rowKeys.slice(topN).reduce(function (a, k) { return a + ((pv.grid[k] || {})[ck] || 0); }, 0);
      return '<td class="num">' + RGPivot.fmtVal(pv.measure, v) + '</td>';
    }).join('') +
    '<td class="num pv-tot"><b>' + RGPivot.fmtVal(pv.measure, hiddenTotal) + '</b></td>' +
    '<td class="num pv-share">' + fmtPct(hiddenTotal / (pv.total || 1)) + '</td></tr>' : '');

  var head = '<tr><th style="text-align:left">' + esc(pv.rowDim.label) + '</th>' +
    cols.map(function (c) { return '<th class="num">' + esc(c) + '</th>'; }).join('') +
    '<th class="num">Total</th><th class="num">Share</th></tr>';

  var foot = '<tr><td><b>Total — ' + esc(pv.measure.label) + '</b></td>' +
    cols.map(function (c) {
      return '<td class="num">' + RGPivot.fmtVal(pv.measure, pv.colTot[c]) + '</td>';
    }).join('') +
    '<td class="num">' + RGPivot.fmtVal(pv.measure, pv.total) + '</td>' +
    '<td class="num">100%</td></tr>';

  var grid = '<div class="demo-tbl-wrap grid-scroll"><table class="demo-tbl pv-tbl" id="pv">' +
    '<thead>' + head + '</thead><tbody>' + bodyRows + '</tbody>' +
    '<tfoot>' + foot + '</tfoot></table></div>';

  /* ---- top-N chart of the row dimension ---- */
  var chartRows = pv.rowKeys.slice(0, 12);
  var chart = RGChart.bar('pv-chart', {
    labels: chartRows.map(function (k) { return k.length > 26 ? k.slice(0, 25) + '…' : k; }),
    series: [{ label: pv.measure.label, data: chartRows.map(function (k) { return pv.rowTot[k]; }) }],
    horizontal: true, height: Math.max(220, chartRows.length * 26 + 40), legend: false,
    plain: pv.measure.fmt !== 'money'
  });

  /* ---- concentration: how much sits in the top rows ---- */
  function topShare(n) {
    return pv.rowKeys.slice(0, n).reduce(function (a, k) { return a + pv.rowTot[k]; }, 0) / (pv.total || 1);
  }

  return '<div class="demo-panel" style="margin-bottom:var(--space-4)">' +
      '<div class="section-head"><div><h2>Build the cross-tab</h2>' +
      '<div class="sub">A measure only exists at the grain it was recorded at, so the dimension ' +
      'lists change with the measure. Nothing here returns a silent zero.</div></div></div>' +
      '<div class="card-gutter"><div style="display:flex;gap:7px;flex-wrap:wrap">' + controls + '</div>' +
      '<div class="chart-note"><b>' + esc(pv.measure.label) + '</b> by <b>' +
      esc(pv.rowDim.label.toLowerCase()) + '</b>' +
      (pv.colDim ? ' across <b>' + esc(pv.colDim.label.toLowerCase()) + '</b>' : '') +
      ' · ' + fmtNum(pv.rowKeys.length) + ' rows × ' + fmtNum(cols.length) + ' columns · ' +
      'aggregated from ' + fmtNum(pv.factCount) + ' fact records at the ' + domain + ' grain.</div></div>' +
    '</div>' +

    '<div class="stat-row">' +
      [['Grand total', RGPivot.fmtVal(pv.measure, pv.total), esc(pv.measure.label)],
       [pv.rowDim.label + 's', fmtNum(pv.rowKeys.length), 'distinct'],
       ['Largest', shownRows[0] ? esc(shownRows[0]) : '—',
        shownRows[0] ? RGPivot.fmtVal(pv.measure, pv.rowTot[shownRows[0]]) : ''],
       ['Top 5 share', fmtPct(topShare(5)), 'of the total'],
       ['Top 10 share', fmtPct(topShare(10)), 'of the total'],
       ['Fact records', fmtNum(pv.factCount), domain + ' grain']
      ].map(function (r) {
        return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
      }).join('') +
    '</div>' +

    card({ title: 'Top ' + Math.min(12, pv.rowKeys.length) + ' by ' + pv.measure.label.toLowerCase(),
      sub: 'Ranked ' + esc(pv.rowDim.label.toLowerCase()), sources: ['Model'], body: chart }) +

    card({ title: pv.measure.label + ' — ' + pv.rowDim.label +
        (pv.colDim ? ' × ' + pv.colDim.label : ''),
      sub: 'Cell shading is share of the largest cell. Hover any figure for its share of row, ' +
        'column and grand total. Sort any column.',
      tools: gridTools('pv', 'Cross-analysis ' + P),
      body: grid +
        (hidden > 0 ? '<div class="chart-note">Showing the top ' + topN + ' of ' +
          fmtNum(pv.rowKeys.length) + '. The remaining ' + fmtNum(hidden) + ' are rolled into ' +
          '“All other”, not dropped — the column totals still foot to the grand total.</div>'
          : '<div class="chart-note">All ' + fmtNum(pv.rowKeys.length) +
            ' rows shown. Column totals foot to the grand total exactly.</div>') });
});
