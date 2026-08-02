/* ============================================================
   Restaurant OS — cross-analysis engine

   Pick a measure, a row dimension and a column dimension, and get a
   cross-tab. Store × ingredient. Vendor × brand. Employee × day.
   Menu item × channel. Any measure against any two dimensions it
   actually has a grain for.

   Four fact tables, because a measure only exists at the grain it was
   recorded at — pretending otherwise is how BI tools produce numbers
   that foot to nothing:
     sales   unit × item × category × channel × daypart × day
     cost    unit × ingredient × family × vendor
     labor   unit × employee × jobcode × day
     finance unit × period   (the P&L itself)
   A dimension that does not exist in a measure's domain is disabled in
   the picker rather than silently returning zeros.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var cache = {};

  /* ---------- dimensions ---------- */
  var DIMS = {
    unit:     { label: 'Restaurant', domains: ['sales', 'cost', 'labor', 'finance'],
                of: function (f) { return RG.unitById[f.unit].name; },
                sort: function (a, b) { return a.localeCompare(b); } },
    brand:    { label: 'Brand', domains: ['sales', 'cost', 'labor', 'finance'],
                of: function (f) { return RG.BRANDS.filter(function (b) { return b.id === RG.unitById[f.unit].brand; })[0].name; } },
    region:   { label: 'Region', domains: ['sales', 'cost', 'labor', 'finance'],
                of: function (f) { return RG.unitById[f.unit].region; } },
    state:    { label: 'State', domains: ['sales', 'cost', 'labor', 'finance'],
                of: function (f) { return RG.unitById[f.unit].state; } },
    pos:      { label: 'POS system', domains: ['sales', 'cost', 'labor', 'finance'],
                of: function (f) { return RG.unitById[f.unit].pos; } },
    item:     { label: 'Menu item', domains: ['sales'], of: function (f) { return f.itemName; } },
    category: { label: 'Menu category', domains: ['sales'], of: function (f) { return f.cat; } },
    channel:  { label: 'Order channel', domains: ['sales'], of: function (f) { return f.channelLabel; } },
    daypart:  { label: 'Daypart', domains: ['sales'], of: function (f) { return f.daypartLabel; } },
    ingredient: { label: 'Ingredient', domains: ['cost'], of: function (f) { return f.ingName; } },
    family:   { label: 'Commodity family', domains: ['cost'], of: function (f) { return f.family; } },
    vendor:   { label: 'Vendor', domains: ['cost'], of: function (f) { return f.vendorName; } },
    employee: { label: 'Employee', domains: ['labor'], of: function (f) { return f.empName; } },
    jobcode:  { label: 'Job code', domains: ['labor'], of: function (f) { return f.jobLabel; } },
    section:  { label: 'Section', domains: ['labor'], of: function (f) { return f.boh ? 'Back of house' : 'Front of house'; } },
    dow:      { label: 'Day of week', domains: ['sales', 'labor'], of: function (f) { return f.dowName; },
                order: RG.CAL.DOW },
    date:     { label: 'Date', domains: ['sales', 'labor'], of: function (f) { return RG.CAL.usDate(f.iso); } },
    week:     { label: 'Week of period', domains: ['sales', 'labor'],
                of: function (f) { return 'Week ' + RG.CAL.byIso[f.iso].weekInPeriod; } },
    period:   { label: 'Period', domains: ['finance'], of: function (f) { return periodLabel(f.period); } }
  };

  /* ---------- measures ---------- */
  var MEAS = {
    sales:      { label: 'Net sales', domain: 'sales', fmt: 'money', perm: null, of: function (f) { return f.sales; } },
    qty:        { label: 'Units sold', domain: 'sales', fmt: 'num', perm: null, of: function (f) { return f.qty; } },
    plateCost:  { label: 'Plate cost', domain: 'sales', fmt: 'money', perm: 'margins', of: function (f) { return f.cost; } },
    margin:     { label: 'Contribution margin', domain: 'sales', fmt: 'money', perm: 'margins', of: function (f) { return f.sales - f.cost; } },
    usageCost:  { label: 'Ingredient cost', domain: 'cost', fmt: 'money', perm: 'margins', of: function (f) { return f.cost; } },
    usageQty:   { label: 'Ingredient quantity', domain: 'cost', fmt: 'num', perm: 'margins', of: function (f) { return f.qty; } },
    laborCost:  { label: 'Labor cost', domain: 'labor', fmt: 'money', perm: 'wages', of: function (f) { return f.cost; } },
    laborHours: { label: 'Labor hours', domain: 'labor', fmt: 'num', perm: 'margins', of: function (f) { return f.hours; } },
    otHours:    { label: 'Overtime hours', domain: 'labor', fmt: 'num', perm: 'margins', of: function (f) { return f.otHours; } },
    premiums:   { label: 'Break premiums', domain: 'labor', fmt: 'money', perm: 'wages', of: function (f) { return f.premium; } },
    netSales:   { label: 'Net sales (P&L)', domain: 'finance', fmt: 'money', perm: null, of: function (f) { return f.netSales; } },
    cogs:       { label: 'Cost of goods', domain: 'finance', fmt: 'money', perm: 'margins', of: function (f) { return f.cogs; } },
    variance:   { label: 'Food variance', domain: 'finance', fmt: 'money', perm: 'margins', of: function (f) { return f.cogsVariance; } },
    fourWall:   { label: 'Four-wall EBITDA', domain: 'finance', fmt: 'money', perm: 'money', of: function (f) { return f.fourWall; } },
    occupancy:  { label: 'Occupancy cost', domain: 'finance', fmt: 'money', perm: 'money', of: function (f) { return f.occupancy; } },
    covers:     { label: 'Covers', domain: 'finance', fmt: 'num', perm: null, of: function (f) { return f.covers; } }
  };

  /* ---------- fact builders ---------- */
  function key(kind, units, period) { return kind + '|' + units.join(',') + '|' + period; }

  function salesFacts(units, period) {
    var k = key('sales', units, period);
    if (cache[k]) return cache[k];
    var chLabel = {}; RG.CHANNELS.forEach(function (c) { chLabel[c.id] = c.label; });
    var dpLabel = {}; RG.CAL.DAYPARTS.forEach(function (d) { dpLabel[d.id] = d.label; });
    var out = [];
    units.forEach(function (u) {
      RG.CAL.daysIn(period).forEach(function (d) {
        var pm = RG.dayPmix(u, d.iso);
        if (!pm || pm.closed) return;
        pm.rows.forEach(function (r) {
          var packaged = r.channel === 'delivery' || r.channel === 'takeout';
          out.push({
            unit: u, iso: d.iso, dowName: d.dowName,
            item: r.item, itemName: r.name, cat: r.cat,
            channel: r.channel, channelLabel: chLabel[r.channel],
            daypart: r.daypart, daypartLabel: dpLabel[r.daypart],
            qty: r.qty, sales: r.ext,
            cost: RG.rand.cents(RG.plateCost(r.item, d.iso, packaged) * r.qty)
          });
        });
      });
    });
    return (cache[k] = out);
  }

  function costFacts(units, period) {
    var k = key('cost', units, period);
    if (cache[k]) return cache[k];
    var out = [];
    units.forEach(function (u) {
      var c = RG.periodCogs(u, period);
      Object.keys(c.byIng).forEach(function (id) {
        var ing = RG.ingById[id];
        if (!ing) return;
        var v = RG.vendorById[ing.vendor];
        out.push({
          unit: u, ing: id, ingName: ing.name, family: ing.family, unitLabel: ing.unit,
          vendor: ing.vendor, vendorName: v ? v.name : ing.vendor,
          qty: c.byIng[id].qty, cost: c.byIng[id].cost
        });
      });
    });
    return (cache[k] = out);
  }

  function laborFacts(units, period) {
    var k = key('labor', units, period);
    if (cache[k]) return cache[k];
    var out = [];
    units.forEach(function (u) {
      RG.CAL.daysIn(period).forEach(function (d) {
        (RG.dayLabor(u, d.iso).shifts || []).forEach(function (sh) {
          out.push({
            unit: u, iso: d.iso, dowName: d.dowName,
            emp: sh.emp, empName: sh.name, job: sh.job, jobLabel: sh.jobLabel, boh: sh.boh,
            hours: sh.hours, cost: sh.cost, otHours: sh.otHours, premium: sh.premium
          });
        });
      });
    });
    return (cache[k] = out);
  }

  function financeFacts(units, period) {
    var k = key('fin', units, period);
    if (cache[k]) return cache[k];
    var out = [];
    var periods = RG.model().trailing13;
    units.forEach(function (u) {
      periods.forEach(function (pk) {
        var pl = RG.periodPL(u, pk);
        out.push({ unit: u, period: pk, netSales: pl.netSales, cogs: pl.cogs,
          cogsVariance: pl.cogsVariance, fourWall: pl.fourWall, occupancy: pl.occupancy,
          covers: pl.covers });
      });
    });
    return (cache[k] = out);
  }

  function facts(domain, units, period) {
    if (domain === 'sales') return salesFacts(units, period);
    if (domain === 'cost') return costFacts(units, period);
    if (domain === 'labor') return laborFacts(units, period);
    return financeFacts(units, period);
  }

  /* ---------- the cross-tab ---------- */
  function build(cfg) {
    var m = MEAS[cfg.measure];
    var rowD = DIMS[cfg.row], colD = cfg.col ? DIMS[cfg.col] : null;
    var rows = facts(m.domain, cfg.units, cfg.period);
    var grid = {}, rowTot = {}, colTot = {}, total = 0;
    var rowKeys = [], colKeys = [];

    rows.forEach(function (f) {
      var v = m.of(f);
      if (v == null || isNaN(v)) return;
      var rk = rowD.of(f);
      var ck = colD ? colD.of(f) : 'Total';
      if (!(rk in rowTot)) { rowTot[rk] = 0; rowKeys.push(rk); }
      if (!(ck in colTot)) { colTot[ck] = 0; colKeys.push(ck); }
      grid[rk] = grid[rk] || {};
      grid[rk][ck] = (grid[rk][ck] || 0) + v;
      rowTot[rk] += v; colTot[ck] += v; total += v;
    });

    function order(keys, d) {
      if (d && d.order) {
        return keys.slice().sort(function (a, b) {
          return d.order.indexOf(a) - d.order.indexOf(b);
        });
      }
      return keys;
    }
    colKeys = order(colKeys, colD);
    if (colD && !colD.order) colKeys.sort(function (a, b) { return colTot[b] - colTot[a]; });
    rowKeys.sort(function (a, b) { return rowTot[b] - rowTot[a]; });
    if (rowD.order) rowKeys = order(rowKeys, rowD);

    return {
      measure: m, rowDim: rowD, colDim: colD,
      rowKeys: rowKeys, colKeys: colKeys,
      grid: grid, rowTot: rowTot, colTot: colTot, total: total,
      factCount: rows.length
    };
  }

  function fmtVal(m, v) {
    if (v == null || v === 0) return '—';
    if (m.fmt === 'money') return fmt$(v);
    return fmtNum(v, Math.abs(v) < 100 ? 1 : 0);
  }

  RG.pivot = {
    DIMS: DIMS, MEAS: MEAS, build: build, fmtVal: fmtVal, facts: facts,
    dimsFor: function (domain) {
      return Object.keys(DIMS).filter(function (k) { return DIMS[k].domains.indexOf(domain) >= 0; });
    },
    measuresFor: function () {
      return Object.keys(MEAS).filter(function (k) { return !MEAS[k].perm || can(MEAS[k].perm); });
    }
  };
  global.RGPivot = RG.pivot;
})(typeof window !== 'undefined' ? window : globalThis);
