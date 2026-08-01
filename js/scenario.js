/* ============================================================
   Restaurant OS — scenario bar

   One control strip on every page that decides WHAT you are looking at
   and WHAT you are comparing it against. State lives in the URL, so any
   view is a shareable link, and every exhibit on the page reads the same
   scope — you can never have two panels answering different questions.

   Dimensions stack: brand ∩ region ∩ POS ∩ liquor ∩ unit, then a period
   and a comparison basis. Seven controls give 2,000+ distinct scopes.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  var DIMS = [
    { k: 'brand',  label: 'Brand',   of: function (u) { return RG.BRANDS.filter(function (b) { return b.id === u.brand; })[0].name; } },
    { k: 'region', label: 'Region',  of: function (u) { return u.region; } },
    { k: 'state',  label: 'State',   of: function (u) { return u.state; } },
    { k: 'pos',    label: 'POS',     of: function (u) { return u.pos; } },
    { k: 'liquor', label: 'Licence', of: function (u) { return u.liquor === 'full' ? 'Full bar' : 'Beer & wine'; } },
    { k: 'unit',   label: 'Restaurant', of: function (u) { return u.name; } }
  ];

  var COMPARE = [
    { k: 'prior', label: 'vs. prior period' },
    { k: 'py',    label: 'vs. same period last year' },
    { k: 'ttm',   label: 'vs. trailing-13 average' },
    { k: 'best',  label: 'vs. best in group' },
    { k: 'avg',   label: 'vs. group average' },
    { k: 'none',  label: 'no comparison' }
  ];

  function get(k, d) {
    var m = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : d;
  }
  function set(k, v) {
    var p = new URLSearchParams(location.search);
    if (v == null || v === '') p.delete(k); else p.set(k, v);
    var qs = p.toString();
    location.href = location.pathname + (qs ? '?' + qs : '');
  }
  global.scnSet = set;

  /* the units surviving every active dimension filter, intersected with
     whatever the signed-in user is allowed to see */
  function scopedUnits() {
    var allowed = myUnits();
    return RG.UNITS.filter(function (u) {
      if (allowed.indexOf(u.id) < 0) return false;
      for (var i = 0; i < DIMS.length; i++) {
        var d = DIMS[i], v = get(d.k, '');
        if (v && d.of(u) !== v) return false;
      }
      return true;
    }).map(function (u) { return u.id; });
  }

  function scope() {
    var units = scopedUnits();
    return {
      units: units.length ? units : myUnits(),
      empty: units.length === 0,
      period: RG.CAL.periodByKey[get('period', '')] ? get('period', '') : RG.model().current,
      compare: get('cmp', 'prior'),
      dims: DIMS.map(function (d) { return { k: d.k, label: d.label, value: get(d.k, '') }; })
        .filter(function (d) { return d.value; })
    };
  }

  /* resolve the comparison basis into a comparable period key or synthetic set */
  function comparison(period, compare) {
    var CAL = RG.CAL;
    if (compare === 'py')    { var p = CAL.priorYear(period);   return p ? { key: p.key, label: p.label } : null; }
    if (compare === 'prior') { var q = CAL.priorPeriod(period); return q ? { key: q.key, label: q.label } : null; }
    if (compare === 'ttm')   return { key: null, label: 'trailing-13 average', ttm: true };
    if (compare === 'best')  return { key: null, label: 'best in group', best: true };
    if (compare === 'avg')   return { key: null, label: 'group average', avg: true };
    return null;
  }

  function render() {
    var allowed = myUnits();
    var pool = RG.UNITS.filter(function (u) { return allowed.indexOf(u.id) >= 0; });
    var s = scope();

    var chips = DIMS.map(function (d) {
      /* options are computed against the OTHER active filters, so a
         dropdown never offers a combination that yields nothing */
      var others = RG.UNITS.filter(function (u) {
        if (allowed.indexOf(u.id) < 0) return false;
        for (var i = 0; i < DIMS.length; i++) {
          var o = DIMS[i]; if (o.k === d.k) continue;
          var v = get(o.k, '');
          if (v && o.of(u) !== v) return false;
        }
        return true;
      });
      var uniq = [];
      others.forEach(function (u) { var v = d.of(u); if (uniq.indexOf(v) < 0) uniq.push(v); });
      if (uniq.length < 2 && !get(d.k, '')) return '';
      var cur = get(d.k, '');
      return '<select class="scn-sel' + (cur ? ' on' : '') + '" onchange="scnSet(\'' + d.k + '\',this.value)">' +
        '<option value="">' + esc(d.label) + ': all</option>' +
        uniq.sort().map(function (v) {
          return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>';
        }).join('') + '</select>';
    }).join('');

    var periods = RG.model().periods.slice().reverse();
    var periodSel = '<select class="scn-sel" onchange="scnSet(\'period\',this.value)">' +
      periods.map(function (k) {
        return '<option value="' + k + '"' + (s.period === k ? ' selected' : '') + '>' +
          esc(periodLabel(k)) + ' · ' + esc(periodRange(k)) + '</option>';
      }).join('') + '</select>';

    var cmpSel = '<select class="scn-sel' + (s.compare !== 'prior' ? ' on' : '') +
      '" onchange="scnSet(\'cmp\',this.value)">' +
      COMPARE.map(function (c) {
        return '<option value="' + c.k + '"' + (s.compare === c.k ? ' selected' : '') + '>' +
          esc(c.label) + '</option>';
      }).join('') + '</select>';

    var active = s.dims.length;
    return '<div class="scn">' +
      '<span class="scn-lbl">Scope</span>' +
      periodSel + chips + cmpSel +
      '<span class="scn-spacer"></span>' +
      '<span class="scn-count">' + s.units.length + ' of ' + pool.length + ' restaurants' +
        (active ? ' · ' + active + ' filter' + (active > 1 ? 's' : '') : '') + '</span>' +
      (active ? '<button class="exf-reset" onclick="scnClear()">Clear</button>' : '') +
      '</div>' +
      (s.empty ? '<div class="scn-empty">No restaurant matches every filter — showing your full scope instead.</div>' : '');
  }

  global.scnClear = function () {
    var p = new URLSearchParams(location.search);
    DIMS.forEach(function (d) { p.delete(d.k); });
    var qs = p.toString();
    location.href = location.pathname + (qs ? '?' + qs : '');
  };

  RG.scenario = { scope: scope, render: render, comparison: comparison, DIMS: DIMS, COMPARE: COMPARE };
  global.RGScope = RG.scenario;
})(typeof window !== 'undefined' ? window : globalThis);
