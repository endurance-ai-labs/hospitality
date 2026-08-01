/* ============================================================
   Restaurant OS — universal exhibit filter

   Every table on the site gets a filter bar. Rather than hand-wiring
   18 pages, this reads the rendered rows and derives the controls from
   the data itself: low-cardinality text columns become dropdown facets,
   money/percent columns become min–max ranges, everything is searchable,
   and every header sorts. One attach call per table.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var pending = [];
  var seq = 0;

  /* first line of a cell — most cells carry a sub-label div underneath */
  function cellText(td) {
    if (!td) return '';
    var t = (td.innerText || '').split('\n')[0];
    return t.replace(/\s+/g, ' ').trim();
  }
  function numOf(s) {
    if (!s) return null;
    var neg = /^\(|^-|^−/.test(s);
    var m = s.replace(/[^0-9.]/g, '');
    if (!m || isNaN(parseFloat(m))) return null;
    var v = parseFloat(m);
    if (/%/.test(s)) v = v / 100;
    return neg ? -v : v;
  }
  function isNumericCol(vals) {
    var n = 0, seen = 0;
    vals.forEach(function (v) { if (v !== '' && v !== '—') { seen++; if (numOf(v) !== null) n++; } });
    return seen > 0 && n / seen >= 0.75;
  }

  function attach(tableId, opts) { pending.push({ id: tableId, opts: opts || {} }); }

  function flush() {
    pending.forEach(function (p) { build(p.id, p.opts); });
    pending = [];
  }

  function build(tableId, opts) {
    var table = document.getElementById(tableId);
    if (!table || table._rgFiltered) return;
    var wrap = table.closest('.demo-tbl-wrap') || table.parentNode;
    if (!wrap) return;
    table._rgFiltered = true;

    var heads = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'))
      .filter(function (r) { return r.querySelectorAll('td').length === heads.length; });
    if (rows.length < 3) { table._rgFiltered = true; return; }

    /* column profile */
    var cols = heads.map(function (h, i) {
      var vals = rows.map(function (r) { return cellText(r.children[i]); });
      var uniq = [];
      vals.forEach(function (v) { if (v && v !== '—' && uniq.indexOf(v) < 0) uniq.push(v); });
      return {
        i: i, label: cellText(h) || ('Col ' + (i + 1)),
        vals: vals, uniq: uniq, numeric: isNumericCol(vals)
      };
    });

    var uid = 'f' + (++seq);
    var facets = cols.filter(function (c) {
      if (opts.facets) return opts.facets.indexOf(c.i) >= 0;
      return !c.numeric && c.label && c.uniq.length >= 2 && c.uniq.length <= 14 &&
             c.uniq.length < rows.length * 0.8;
    }).slice(0, 4);
    var ranges = cols.filter(function (c) {
      if (opts.ranges) return opts.ranges.indexOf(c.i) >= 0;
      return c.numeric && c.label;
    }).slice(0, 2);

    /* ---- build the bar ---- */
    var bar = document.createElement('div');
    bar.className = 'exf';
    bar.innerHTML =
      '<div class="exf-row">' +
        '<label class="exf-search">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
          'stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/>' +
          '<path d="M20 20l-3.5-3.5"/></svg>' +
          '<input type="search" placeholder="Search ' + rows.length + ' rows…" data-exf="q">' +
        '</label>' +
        facets.map(function (c) {
          return '<select class="exf-sel" data-exf-col="' + c.i + '">' +
            '<option value="">' + esc(c.label) + ': all</option>' +
            c.uniq.slice().sort().map(function (v) {
              return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
            }).join('') + '</select>';
        }).join('') +
        ranges.map(function (c) {
          return '<span class="exf-range" data-exf-rcol="' + c.i + '">' +
            '<span class="exf-rlbl">' + esc(c.label) + '</span>' +
            '<input type="number" placeholder="min" data-exf="min">' +
            '<span class="exf-dash">–</span>' +
            '<input type="number" placeholder="max" data-exf="max"></span>';
        }).join('') +
        '<span class="exf-spacer"></span>' +
        '<span class="exf-count" data-exf="count"></span>' +
        '<button class="exf-reset" type="button">Reset</button>' +
      '</div>';
    wrap.parentNode.insertBefore(bar, wrap);

    /* ---- sortable headers ---- */
    var sortState = { col: -1, dir: 1 };
    heads.forEach(function (h, i) {
      if (!cellText(h)) return;
      h.classList.add('exf-sortable');
      h.addEventListener('click', function () {
        sortState.dir = sortState.col === i ? -sortState.dir : (cols[i].numeric ? -1 : 1);
        sortState.col = i;
        heads.forEach(function (x) { x.classList.remove('sort-asc', 'sort-desc'); });
        h.classList.add(sortState.dir > 0 ? 'sort-asc' : 'sort-desc');
        var tb = table.querySelector('tbody');
        rows.slice().sort(function (a, b) {
          var av = cellText(a.children[i]), bv = cellText(b.children[i]);
          if (cols[i].numeric) {
            var an = numOf(av), bn = numOf(bv);
            an = an === null ? -Infinity : an; bn = bn === null ? -Infinity : bn;
            return (an - bn) * sortState.dir;
          }
          return av.localeCompare(bv) * sortState.dir;
        }).forEach(function (r) { tb.appendChild(r); });
      });
    });

    /* ---- apply ---- */
    var q = bar.querySelector('[data-exf="q"]');
    var count = bar.querySelector('[data-exf="count"]');

    function apply() {
      var term = (q.value || '').toLowerCase().trim();
      var sels = Array.prototype.slice.call(bar.querySelectorAll('[data-exf-col]'));
      var rgs = Array.prototype.slice.call(bar.querySelectorAll('[data-exf-rcol]'));
      var shown = 0;
      rows.forEach(function (r) {
        var ok = true;
        if (term && (r.innerText || '').toLowerCase().indexOf(term) < 0) ok = false;
        if (ok) sels.forEach(function (s) {
          if (s.value && cellText(r.children[+s.getAttribute('data-exf-col')]) !== s.value) ok = false;
        });
        if (ok) rgs.forEach(function (g) {
          var ci = +g.getAttribute('data-exf-rcol');
          var v = numOf(cellText(r.children[ci]));
          var mn = g.querySelector('[data-exf="min"]').value;
          var mx = g.querySelector('[data-exf="max"]').value;
          if (mn !== '' && (v === null || v < parseFloat(mn))) ok = false;
          if (mx !== '' && (v === null || v > parseFloat(mx))) ok = false;
        });
        r.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      count.textContent = shown === rows.length
        ? rows.length + ' rows'
        : shown + ' of ' + rows.length + ' rows';
      count.classList.toggle('on', shown !== rows.length);
      /* a filtered exhibit must say so — a totals row that no longer
         matches what is on screen is worse than no totals row */
      var tf = table.querySelector('tfoot');
      if (tf) tf.style.opacity = shown === rows.length ? '' : '.45';
      var note = bar.querySelector('.exf-note');
      if (shown !== rows.length && !note) {
        var n = document.createElement('div');
        n.className = 'exf-note';
        n.textContent = 'Filtered view — totals below reflect the full period, not the filtered rows.';
        bar.appendChild(n);
      } else if (shown === rows.length && note) { note.remove(); }
    }

    bar.addEventListener('input', apply);
    bar.addEventListener('change', apply);
    bar.querySelector('.exf-reset').addEventListener('click', function () {
      q.value = '';
      Array.prototype.slice.call(bar.querySelectorAll('select')).forEach(function (s) { s.value = ''; });
      Array.prototype.slice.call(bar.querySelectorAll('input[type="number"]')).forEach(function (i) { i.value = ''; });
      apply();
    });
    apply();
  }

  /* attach to every table that has not opted out */
  function autoAttachAll() {
    Array.prototype.slice.call(document.querySelectorAll('table.demo-tbl')).forEach(function (t) {
      if (t.id && !t._rgFiltered && !t.hasAttribute('data-nofilter')) build(t.id, {});
    });
  }

  RG.filter = { attach: attach, flush: flush, autoAttachAll: autoAttachAll };
  global.RGFilter = RG.filter;
})(typeof window !== 'undefined' ? window : globalThis);
