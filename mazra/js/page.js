/* ============================================================
   Restaurant OS — page bootstrap
   Shared scaffolding every module page uses: header, unit and period
   selectors, cards, tables. Pages supply only their own content so
   they stay short and consistent.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  /* ---- URL state ---- */
  function qs(k, d) {
    var m = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : d;
  }
  function setQs(k, v) {
    var p = new URLSearchParams(location.search);
    if (v == null || v === '') p.delete(k); else p.set(k, v);
    location.search = p.toString();
  }
  global.qs = qs;
  global.setQs = setQs;

  /* the unit currently in scope: URL param, else all units the user may see */
  function activeUnit() {
    var u = qs('unit', '');
    var mine = myUnits();
    if (u && mine.indexOf(u) >= 0) return u;
    return mine.length === 1 ? mine[0] : '';
  }
  function activeUnits() {
    var u = activeUnit();
    if (u) return [u];
    return (global.RGScope ? RGScope.scope().units : myUnits());
  }
  function activePeriod() {
    var p = qs('period', '');
    return RG.CAL.periodByKey[p] ? p : RG.model().current;
  }
  /* the comparison basis chosen in the scenario bar */
  function activeCompare() {
    return global.RGScope ? RGScope.scope().compare : 'prior';
  }
  global.activeCompare = activeCompare;
  global.activeUnit = activeUnit;
  global.activeUnits = activeUnits;
  global.activePeriod = activePeriod;

  /* ---- selectors ---- */
  function unitSelect() {
    var mine = myUnits();
    if (mine.length < 2) return '';
    var cur = activeUnit();
    return '<select class="pa-btn" onchange="setQs(\'unit\',this.value)">' +
      '<option value=""' + (cur ? '' : ' selected') + '>All ' + mine.length + ' restaurants</option>' +
      mine.map(function (id) {
        var u = RG.unitById[id];
        return '<option value="' + id + '"' + (cur === id ? ' selected' : '') + '>' +
          esc(u.name) + '</option>';
      }).join('') + '</select>';
  }
  function periodSelect() {
    var cur = activePeriod();
    var opts = RG.model().periods.slice().reverse();
    return '<select class="pa-btn" onchange="setQs(\'period\',this.value)">' +
      opts.map(function (k) {
        return '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' +
          esc(periodLabel(k)) + ' · ' + esc(periodRange(k)) + '</option>';
      }).join('') + '</select>';
  }
  global.unitSelect = unitSelect;
  global.periodSelect = periodSelect;

  /* ---- page header ---- */
  function pageHead(title, sub, sources) {
    var scope = activeUnit() ? RG.unitById[activeUnit()].name
      : myUnits().length + ' restaurants';
    return '<div class="rg-masthead">' +
      '<div><div class="rg-eyebrow">' + esc(RG.COMPANY.name) + ' · Operating System</div>' +
      '<h1>' + esc(title) + '</h1>' +
      '<div class="sub">' + esc(sub) + ' · ' + esc(scope) + '</div></div>' +
      '<div class="rg-stamp"><b>' + esc(periodLabel(activePeriod())) + '</b>' +
      esc(periodRange(activePeriod())) + '<br>' +
      (sources ? srcChips.apply(null, sources) : '') + '</div></div>' +
      (global.RGScope ? RGScope.render() : '');
  }
  global.pageHead = pageHead;

  /* ---- card ---- */
  function card(opts) {
    return '<div class="demo-panel">' +
      '<div class="section-head"><div><h2>' + esc(opts.title) + '</h2>' +
      (opts.sub ? '<div class="sub">' + opts.sub + '</div>' : '') + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      (opts.tools || '') + (opts.sources ? srcChips.apply(null, opts.sources) : '') +
      '</div></div>' +
      '<div class="card-gutter">' + opts.body + '</div></div>';
  }
  global.card = card;

  /* ---- table ---- */
  function table(opts) {
    var head = '<thead><tr>' + opts.cols.map(function (c) {
      return '<th' + (c.num ? ' class="num"' : '') + (c.w ? ' style="width:' + c.w + '"' : '') +
        '>' + esc(c.label) + '</th>';
    }).join('') + '</tr></thead>';
    var body = '<tbody>' + opts.rows.join('') + '</tbody>';
    var foot = opts.foot ? '<tfoot>' + opts.foot + '</tfoot>' : '';
    return '<div class="demo-tbl-wrap grid-scroll"><table class="demo-tbl" id="' + opts.id + '">' +
      head + body + foot + '</table></div>';
  }
  global.table = table;

  /* horizontal bar used in ranked lists */
  function bar(pct, tone) {
    return '<div class="rg-bar"><i class="' + (tone || '') + '" style="width:' +
      Math.max(0, Math.min(100, pct * 100)).toFixed(1) + '%"></i></div>';
  }
  global.bar = bar;

  /* stars for review ratings */
  function stars(n) {
    var full = Math.round(n);
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= full ? '★' : '☆';
    return '<span class="rg-stars" title="' + n + '">' + s + '</span>';
  }
  global.stars = stars;

  /* generic waterfall used by every bridge on the site */
  function waterfall(rows, total, totalLabel) {
    var max = Math.max.apply(null, rows.map(function (r) { return Math.abs(r[1]); })
      .concat([Math.abs(total)]));
    function trk(v, cls) {
      var w = max ? (Math.abs(v) / max) * 50 : 0;
      var left = v >= 0 ? 50 : 50 - w;
      return '<div class="bridge-track"><div class="bridge-zero" style="left:50%"></div>' +
        '<div class="bridge-fill ' + cls + '" style="left:' + left + '%;width:' + w + '%"></div></div>';
    }
    return '<div class="bridge">' + rows.map(function (r) {
      return '<div class="bridge-row"><div class="bridge-label"' +
        (r[2] ? exp(r[2]) : '') + (r[2] ? ' style="cursor:help"' : '') + '>' + esc(r[0]) + '</div>' +
        trk(r[1], r[1] >= 0 ? 'pos' : 'neg') +
        '<div class="bridge-amt">' + (r[1] >= 0 ? '+' : '') + fmt$(r[1]) + '</div></div>';
    }).join('') +
      '<div class="bridge-row total"><div class="bridge-label">' + esc(totalLabel || 'Total change') +
      '</div>' + trk(total, 'tot') + '<div class="bridge-amt">' +
      (total >= 0 ? '+' : '') + fmt$(total) + '</div></div></div>';
  }
  global.waterfall = waterfall;

  /* aggregate a getter across the units in scope */
  function agg(fn) {
    return activeUnits().map(fn);
  }
  global.agg = agg;

  /* the standard page footer */
  function pageFoot() {
    return '<div style="font-size:11px;color:var(--color-slate-hint);text-align:center;' +
      'padding:20px 0 8px;line-height:1.6">Demo environment. Restaurant names, brands, cities ' +
      'and leadership are real and public; every operating figure is fictional.<br>' +
      'Built by Endurance AI Labs · dataset verified by <code style="font-size:10.5px">npm run verify</code>.</div>';
  }
  global.pageFoot = pageFoot;

  /* mount: pages call renderPage(fn) */
  global.renderPage = function (title, sub, sources, fn) {
    RGNav.renderTopbar({ subtitle: 'Operating System' });
    if (!isSignedIn()) return;
    var app = document.getElementById('app');
    app.innerHTML = pageHead(title, sub, sources) + fn() + pageFoot();
    /* charts and filters are declared inside the markup, built after it lands */
    if (global.RGChart) RGChart.flush();
    if (global.RGFilter) RGFilter.autoAttachAll();
  };
})(typeof window !== 'undefined' ? window : globalThis);
