/* ============================================================
   Restaurant OS — item × day matrix

   The lowest grain the business actually records: how many of each
   dish sold, on each trading day, in each restaurant — and what that
   was worth. Everything else on the site is an aggregation of this.

   Reused by Menu Engineering and Sales & Traffic so the two can never
   disagree, and filterable down to a single channel or daypart.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  var MEASURES = {
    qty:    { label: 'Units sold',    fmt: function (v) { return v ? fmtNum(v) : '·'; } },
    sales:  { label: 'Net sales',     fmt: function (v) { return v ? fmt$(v) : '·'; } },
    margin: { label: 'Contribution',  fmt: function (v) { return v ? fmt$(v) : '·'; }, perm: 'margins' },
    cost:   { label: 'Plate cost',    fmt: function (v) { return v ? fmt$(v) : '·'; }, perm: 'margins' }
  };

  /* one pass over the period's PMIX, filtered, keyed by item and day */
  function build(units, period, opt) {
    opt = opt || {};
    var days = RG.CAL.daysIn(period);
    var grid = {}, itemMeta = {}, dayTot = {}, itemTot = {}, total = 0;

    units.forEach(function (u) {
      days.forEach(function (d) {
        var pm = RG.dayPmix(u, d.iso);
        if (!pm || pm.closed) return;
        pm.rows.forEach(function (r) {
          if (opt.channel && r.channel !== opt.channel) return;
          if (opt.daypart && r.daypart !== opt.daypart) return;
          if (opt.category && r.cat !== opt.category) return;
          var m = RG.menuById[r.item];
          var packaged = r.channel === 'delivery' || r.channel === 'takeout';
          var cost = RG.plateCost(r.item, d.iso, packaged) * r.qty;
          var v = opt.measure === 'qty' ? r.qty
                : opt.measure === 'cost' ? cost
                : opt.measure === 'margin' ? (r.ext - cost)
                : r.ext;
          if (!itemMeta[r.item]) {
            itemMeta[r.item] = { id: r.item, name: r.name, cat: r.cat, bev: m ? m.bev : false };
            itemTot[r.item] = 0;
          }
          grid[r.item] = grid[r.item] || {};
          grid[r.item][d.iso] = (grid[r.item][d.iso] || 0) + v;
          itemTot[r.item] += v;
          dayTot[d.iso] = (dayTot[d.iso] || 0) + v;
          total += v;
        });
      });
    });

    var items = Object.keys(itemMeta).sort(function (a, b) { return itemTot[b] - itemTot[a]; });
    return { days: days, items: items, meta: itemMeta, grid: grid,
             itemTot: itemTot, dayTot: dayTot, total: total };
  }

  /* the exhibit: controls + wide matrix + a per-day summary strip */
  function render(cfg) {
    var units = cfg.units, period = cfg.period, id = cfg.id || 'itemday';
    var measure = cfg.measure || 'qty';
    if (MEASURES[measure] && MEASURES[measure].perm && !can(MEASURES[measure].perm)) measure = 'qty';
    var M = MEASURES[measure];

    var data = build(units, period, {
      measure: measure, channel: cfg.channel, daypart: cfg.daypart, category: cfg.category
    });
    var topN = cfg.topN || 30;
    var shown = data.items.slice(0, topN);
    var hidden = data.items.length - shown.length;

    var maxCell = 0;
    shown.forEach(function (it) {
      data.days.forEach(function (d) {
        var v = (data.grid[it] || {})[d.iso] || 0;
        if (v > maxCell) maxCell = v;
      });
    });

    var head = '<tr><th style="text-align:left;min-width:190px">Item</th>' +
      data.days.map(function (d) {
        return '<th class="num idm-dh"><span>' + d.dowName.slice(0, 1) + '</span>' +
          RG.CAL.usDate(d.iso).slice(0, 5) + '</th>';
      }).join('') +
      '<th class="num">Total</th><th class="num">Share</th></tr>';

    var body = shown.map(function (it) {
      var meta = data.meta[it];
      return '<tr><td class="idm-item"><b>' + esc(meta.name) + '</b>' +
        '<span>' + esc(meta.cat) + '</span></td>' +
        data.days.map(function (d) {
          var v = (data.grid[it] || {})[d.iso] || 0;
          var a = maxCell ? v / maxCell : 0;
          var bg = v ? ';background:rgba(39,102,214,' + (0.05 + a * 0.40).toFixed(3) + ')' : '';
          return '<td class="num idm-cell" style="white-space:nowrap' + bg + '"' +
            (v ? exp({ value: M.fmt(v) + ' — ' + meta.name,
                       formula: meta.name + ' on ' + d.dowName + ' ' + usDate(d.iso),
                       inputs: [['Measure', M.label],
                                ['Share of the item’s period', fmtPct(v / (data.itemTot[it] || 1))],
                                ['Share of that day', fmtPct(v / (data.dayTot[d.iso] || 1))],
                                ['Restaurants in scope', fmtNum(units.length)]],
                       source: ['Toast'], period: usDate(d.iso),
                       note: 'Item-level PMIX is the atom of this model — every other ' +
                             'number on the site is an aggregation of these rows.' }) : '') +
            '>' + M.fmt(v) + '</td>';
        }).join('') +
        '<td class="num idm-tot"><b>' + M.fmt(data.itemTot[it]) + '</b></td>' +
        '<td class="num idm-share">' + fmtPct(data.itemTot[it] / (data.total || 1)) + '</td></tr>';
    }).join('') +
    (hidden > 0 ? '<tr class="pv-other"><td><b>All other items (' + fmtNum(hidden) + ')</b></td>' +
      data.days.map(function (d) {
        var v = data.items.slice(topN).reduce(function (a, it) {
          return a + ((data.grid[it] || {})[d.iso] || 0); }, 0);
        return '<td class="num">' + M.fmt(v) + '</td>';
      }).join('') +
      '<td class="num idm-tot"><b>' + M.fmt(data.items.slice(topN)
        .reduce(function (a, it) { return a + data.itemTot[it]; }, 0)) + '</b></td>' +
      '<td class="num idm-share">' + fmtPct(data.items.slice(topN)
        .reduce(function (a, it) { return a + data.itemTot[it]; }, 0) / (data.total || 1)) +
      '</td></tr>' : '');

    var foot = '<tr><td><b>All items</b></td>' +
      data.days.map(function (d) {
        return '<td class="num">' + M.fmt(data.dayTot[d.iso] || 0) + '</td>';
      }).join('') +
      '<td class="num">' + M.fmt(data.total) + '</td><td class="num">100%</td></tr>';

    var table = '<div class="demo-tbl-wrap grid-scroll idm-wrap">' +
      '<table class="demo-tbl idm" id="' + id + '" data-nofilter>' +
      '<thead>' + head + '</thead><tbody>' + body + '</tbody>' +
      '<tfoot>' + foot + '</tfoot></table></div>';

    return { html: table, data: data, measure: measure, measureLabel: M.label };
  }

  RG.itemDay = { build: build, render: render, MEASURES: MEASURES };
  global.RGItemDay = RG.itemDay;
})(typeof window !== 'undefined' ? window : globalThis);
