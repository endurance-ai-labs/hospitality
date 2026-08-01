/* Forecast & Growth Model — driver-based, five years */
renderPage('Forecast & Growth', 'Driver-based five-year model with saved scenarios',
  ['Model', 'QBO'], function () {
  if (!can('money')) return card({ title: 'Restricted',
    body: '<div style="padding:20px;color:var(--color-text-muted)">The growth model is limited to ' +
      'finance and executive roles.</div>' });

  var M = RG.model();
  var base = { sales: M.kpi.ttmSales, fourWall: M.kpi.ttmFourWall, units: RG.UNITS.length };

  var DEFAULTS = {
    traffic: 1.0, check: 3.2, newUnits: 2, capexPerUnit: 1450, rampMonths: 18,
    wageInflation: 4.5, foodInflation: 3.8, occEscalation: 3.0, deliveryShift: -2.0,
    gaScaling: 55, goal: 45
  };
  var SAVED = 'rgos-forecast';
  var S = (function () {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SAVED) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  })();

  var PRESETS = {
    'Base case': DEFAULTS,
    'Aggressive expansion': Object.assign({}, DEFAULTS, { newUnits: 4, traffic: 1.5, gaScaling: 62 }),
    'Margin recovery': Object.assign({}, DEFAULTS, { newUnits: 0, traffic: 0.5, check: 4.5, foodInflation: 2.5 }),
    'Recession': Object.assign({}, DEFAULTS, { newUnits: 0, traffic: -3.5, check: 1.5, wageInflation: 2.0 })
  };

  window.fcSet = function (k, v) {
    S[k] = parseFloat(v);
    try { localStorage.setItem(SAVED, JSON.stringify(S)); } catch (e) {}
    location.reload();
  };
  window.fcPreset = function (name) {
    try { localStorage.setItem(SAVED, JSON.stringify(PRESETS[name])); } catch (e) {}
    location.reload();
  };
  window.fcReset = function () {
    try { localStorage.removeItem(SAVED); } catch (e) {}
    location.reload();
  };

  /* project five years */
  function project() {
    var out = [], sales = base.sales, units = base.units;
    var margin = base.sales ? base.fourWall / base.sales : 0.13;
    var auv = base.sales / base.units;
    for (var y = 1; y <= 5; y++) {
      var comp = (1 + S.traffic / 100) * (1 + S.check / 100) - 1;
      var newUnits = S.newUnits;
      /* new units ramp — first-year units contribute a partial AUV */
      var rampFactor = Math.min(1, 12 / S.rampMonths);
      var compSales = sales * (1 + comp);
      var newSales = newUnits * auv * rampFactor * Math.pow(1 + comp, y - 1);
      sales = RG.rand.cents(compSales + newSales);
      units += newUnits;
      auv = sales / units;

      /* margin drifts with cost inflation net of price */
      var costDrag = (S.foodInflation * 0.32 + S.wageInflation * 0.32 + S.occEscalation * 0.085) / 100;
      var priceRelief = (S.check / 100);
      var deliveryRelief = (-S.deliveryShift / 100) * 0.238 * 0.20;
      margin = Math.max(0.02, margin + (priceRelief - costDrag) * 0.55 + deliveryRelief);
      var ga = sales * (S.gaScaling / 1000);
      out.push({ year: y, units: units, sales: sales, auv: auv, margin: margin,
        fourWall: RG.rand.cents(sales * margin), ga: RG.rand.cents(ga),
        ebitda: RG.rand.cents(sales * margin - ga),
        capex: RG.rand.cents(newUnits * S.capexPerUnit * 1000) });
    }
    return out;
  }
  var proj = project();
  var y5 = proj[4];
  var goal = S.goal * 1e6;
  var cagr = Math.pow(y5.sales / base.sales, 1 / 5) - 1;
  var requiredCagr = Math.pow(goal / base.sales, 1 / 5) - 1;
  var onTrack = y5.sales >= goal;

  var SLIDERS = [
    ['traffic', 'Same-store traffic', '%/yr', -6, 6, 0.5],
    ['check', 'Check growth (price + mix)', '%/yr', 0, 8, 0.1],
    ['newUnits', 'New units per year', 'units', 0, 5, 1],
    ['capexPerUnit', 'Capex per new unit', '$k', 800, 2500, 50],
    ['rampMonths', 'Ramp to full AUV', 'months', 6, 30, 3],
    ['wageInflation', 'Wage inflation', '%/yr', 0, 10, 0.5],
    ['foodInflation', 'Food inflation', '%/yr', 0, 10, 0.5],
    ['occEscalation', 'Occupancy escalation', '%/yr', 0, 6, 0.5],
    ['deliveryShift', 'Marketplace mix shift', 'pts/yr', -6, 4, 0.5],
    ['gaScaling', 'Corporate G&A', '$ per $1k sales', 30, 90, 1],
    ['goal', 'Revenue goal at year 5', '$M', 25, 120, 1]
  ];

  var sliderHtml = SLIDERS.map(function (s) {
    return '<div style="padding:9px 0;border-bottom:1px solid var(--glass-border)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<span style="font-size:12px;color:var(--color-text-muted)">' + esc(s[1]) + '</span>' +
      '<b style="font-size:13px;font-variant-numeric:tabular-nums">' + S[s[0]] + ' ' + esc(s[2]) + '</b></div>' +
      '<input type="range" min="' + s[3] + '" max="' + s[4] + '" step="' + s[5] + '" value="' + S[s[0]] + '" ' +
      'style="width:100%" onchange="fcSet(\'' + s[0] + '\',this.value)"></div>';
  }).join('');

  var projRows = proj.map(function (p) {
    return '<tr><td><b>Year ' + p.year + '</b></td>' +
      '<td class="num">' + fmtNum(p.units) + '</td>' +
      '<td class="num">' + traced(fmt$(p.sales), {
        value: fmt$c(p.sales), formula: 'prior-year sales × (1 + traffic) × (1 + check) + new units × ramped AUV',
        inputs: [['Same-store growth', fmtPct((S.traffic / 100 + 1) * (S.check / 100 + 1) - 1)],
                 ['New units', fmtNum(S.newUnits)], ['Average unit volume', fmt$(p.auv)],
                 ['Ramp', S.rampMonths + ' months to full volume']],
        source: ['Model'], period: 'Year ' + p.year,
        note: 'A new unit does not contribute a full AUV in its first year — the ramp assumption is ' +
              'where most restaurant growth models quietly overstate.' }) + '</td>' +
      '<td class="num">' + fmt$(p.auv) + '</td>' +
      '<td class="num">' + fmtPct(p.margin) + '</td>' +
      '<td class="num">' + fmt$(p.fourWall) + '</td>' +
      '<td class="num">' + fmt$(p.ga) + '</td>' +
      '<td class="num"><b>' + fmt$(p.ebitda) + '</b></td>' +
      '<td class="num">' + fmt$(p.capex) + '</td></tr>';
  }).join('');

  var maxSales = Math.max(y5.sales, goal);
  var chart = '<div style="display:flex;align-items:flex-end;gap:10px;height:180px;padding:10px 0">' +
    [{ year: 'Now', sales: base.sales }].concat(proj.map(function (p) {
      return { year: 'Y' + p.year, sales: p.sales };
    })).map(function (p) {
      var h = (p.sales / maxSales) * 100;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">' +
        '<div style="font-size:10px;color:var(--color-text-muted);margin-bottom:5px">' + fmtK(p.sales) + '</div>' +
        '<div style="width:100%;background:var(--color-blue);border-radius:3px 3px 0 0;height:' +
          h.toFixed(1) + '%"></div>' +
        '<div style="font-size:10.5px;color:var(--color-slate-hint);margin-top:6px">' + esc(p.year) + '</div>' +
        '</div>';
    }).join('') + '</div>' +
    '<div style="position:relative;height:1px;background:var(--color-amber);margin-top:-' +
      (180 * (goal / maxSales) - 24).toFixed(0) + 'px;margin-bottom:' +
      (180 * (goal / maxSales) - 24).toFixed(0) + 'px">' +
      '<span style="position:absolute;right:0;top:-16px;font-size:10px;color:var(--color-amber);' +
      'font-weight:700">GOAL ' + fmtK(goal) + '</span></div>';

  return '<div class="stat-row">' +
    [['TTM net sales', fmt$(base.sales), fmtNum(base.units) + ' restaurants'],
     ['Year 5 sales', fmt$(y5.sales), fmtNum(y5.units) + ' restaurants'],
     ['Implied CAGR', fmtPct(cagr), 'five years'],
     ['Required for goal', fmtPct(requiredCagr), 'to reach ' + fmtK(goal)],
     ['Year 5 EBITDA', fmt$(y5.ebitda), fmtPct(y5.ebitda / y5.sales) + ' margin'],
     ['Total capex', fmt$(proj.reduce(function (a, p) { return RG.rand.cents(a + p.capex); }, 0)),
      fmtNum(S.newUnits * 5) + ' new units']
    ].map(function (r) {
      return '<div class="stat"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>';
    }).join('') + '</div>' +

    '<div class="demo-panel" style="border-color:' + (onTrack ? 'var(--color-green)' : 'var(--color-amber)') +
      '44;background:' + (onTrack ? 'var(--color-green-bg)' : 'var(--color-amber-bg)') + '">' +
      '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
      pill(onTrack ? 'on track' : 'behind goal', onTrack ? 'good' : 'warn') +
      '<b style="font-size:15px">' + (onTrack
        ? 'This scenario reaches ' + fmtK(y5.sales) + ' by year five, clearing the ' + fmtK(goal) + ' goal.'
        : 'This scenario reaches ' + fmtK(y5.sales) + ' by year five — ' +
          fmtK(goal - y5.sales) + ' short of the ' + fmtK(goal) + ' goal.') + '</b>' +
      '<span style="font-size:12px;color:var(--color-text-muted)">Implied ' + fmtPct(cagr) +
        ' CAGR against ' + fmtPct(requiredCagr) + ' required.' +
        (onTrack ? '' : ' Closing the gap needs roughly ' +
          fmtNum(Math.ceil((goal - y5.sales) / (base.sales / base.units))) +
          ' more units, or ' + fmtPct(requiredCagr - cagr) + ' more annual same-store growth.') +
      '</span></div></div>' +

    '<div class="two-col">' +
      card({ title: 'Drivers', sub: 'Every assumption is a lever. Scenarios save to your browser.',
        tools: '<button class="pa-btn" onclick="fcReset()">Reset</button>',
        body: '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' +
          Object.keys(PRESETS).map(function (k) {
            return '<button class="pa-btn" onclick="fcPreset(\'' + esc(k) + '\')">' + esc(k) + '</button>';
          }).join('') + '</div>' + sliderHtml }) +
      card({ title: 'Revenue path', sub: 'Against the year-five goal', sources: ['Model'],
        body: chart }) +
    '</div>' +

    card({ title: 'Five-year model', sub: 'Driver-based. Hover a sales figure to see the build.',
      tools: gridTools('fc', 'Five-year model'), sources: ['Model', 'QBO'],
      body: table({ id: 'fc', cols: [{ label: '' }, { label: 'Units', num: true },
        { label: 'Net sales', num: true }, { label: 'AUV', num: true }, { label: 'Four-wall %', num: true },
        { label: 'Four-wall $', num: true }, { label: 'G&A', num: true },
        { label: 'EBITDA', num: true }, { label: 'Capex', num: true }], rows: [projRows] }) });
});
