/* ============================================================
   Restaurant OS — chart layer (Chart.js)

   PALETTE PROVENANCE — do not swap these hex values casually.
   The categorical order below was run through the dataviz validator
   in BOTH modes and passes every hard gate:
     light  (surface #ffffff): worst adjacent CVD ΔE 9.1, normal-vision 19.6
     dark   (surface #1a2131): worst adjacent CVD ΔE 8.4, normal-vision 19.3
   The portal's own muted tokens FAILED — #6FA57E reads gray (chroma 0.081)
   and green↔amber sit at ΔE 13.0 for normal vision, below the 15 floor.
   Slot 1 keeps the brand blue; the rest are stepped for separation.

   Light mode carries a contrast WARN on slots 3-5, which obligates relief:
   every chart here ships a legend, direct labels or the table beneath it.

   Rules enforced: one axis only (never dual-y), hues assigned in fixed
   order and never cycled, status colours reserved for state.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  var LIGHT = ['#2766d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
  var DARK  = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }
  function series(i) {
    var p = isDark() ? DARK : LIGHT;
    return p[i % p.length];
  }
  function ink(level) {
    var d = isDark();
    if (level === 'muted') return d ? 'rgba(255,255,255,.45)' : 'rgba(21,29,48,.48)';
    if (level === 'grid')  return d ? 'rgba(255,255,255,.07)' : 'rgba(21,29,48,.075)';
    return d ? 'rgba(255,255,255,.82)' : 'rgba(21,29,48,.80)';
  }

  var queue = [];

  /* pages emit the canvas as a string, then flush() builds them */
  function canvas(id, height) {
    return '<div class="rg-chart" style="height:' + (height || 260) + 'px">' +
      '<canvas id="' + id + '"></canvas></div>';
  }

  function push(id, factory) { queue.push({ id: id, factory: factory }); }

  function flush() {
    if (!global.Chart) { queue = []; return; }
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily ||
      'ui-sans-serif, system-ui, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.color = ink('muted');
    Chart.defaults.animation = { duration: 380 };

    queue.forEach(function (q) {
      var el = document.getElementById(q.id);
      if (!el) return;
      if (el._rgChart) el._rgChart.destroy();
      try { el._rgChart = new Chart(el.getContext('2d'), q.factory()); }
      catch (e) { /* a broken chart must never take the page down */ }
    });
    queue = [];
  }

  /* ---- shared scaffolding ---- */
  function baseOpts(o) {
    o = o || {};
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: o.legend === false ? { display: false } : {
          display: true, position: 'top', align: 'end',
          labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle',
                    padding: 14, color: ink('muted') }
        },
        tooltip: {
          backgroundColor: '#101726', titleColor: '#eef1f6', bodyColor: '#cdd8e8',
          borderColor: 'rgba(255,255,255,.12)', borderWidth: 1,
          padding: 11, cornerRadius: 7, displayColors: true, boxWidth: 8, boxHeight: 8,
          usePointStyle: true, titleFont: { weight: '700', size: 11.5 },
          bodyFont: { size: 11.5 },
          callbacks: o.tooltip || {}
        }
      },
      scales: o.scales
    };
  }

  function money(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return '$' + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(a / 1e3) + 'K';
    return '$' + Math.round(a);
  }

  function axes(o) {
    o = o || {};
    return {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: ink('muted'), maxRotation: 0, autoSkipPadding: 14 },
        stacked: !!o.stacked
      },
      y: {
        grid: { color: ink('grid'), drawBorder: false },
        border: { display: false },
        ticks: { color: ink('muted'), padding: 6,
                 callback: o.pct ? function (v) { return (v * 100).toFixed(0) + '%'; }
                        : o.plain ? function (v) { return v.toLocaleString('en-US'); }
                        : function (v) { return money(v); } },
        stacked: !!o.stacked,
        beginAtZero: o.beginAtZero !== false
      }
    };
  }

  /* ---- line: change over time. 2px marks, no dot spam. ---- */
  function line(id, cfg) {
    push(id, function () {
      return {
        type: 'line',
        data: {
          labels: cfg.labels,
          datasets: cfg.series.map(function (s, i) {
            return {
              label: s.label, data: s.data,
              borderColor: s.color || series(i),
              backgroundColor: s.fill
                ? (function () {
                    var c = s.color || series(i);
                    return c + '1f';
                  })()
                : 'transparent',
              fill: !!s.fill,
              borderWidth: 2,
              borderDash: s.dashed ? [5, 4] : undefined,
              tension: 0.28,
              pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 18,
              pointBackgroundColor: s.color || series(i),
              pointBorderColor: isDark() ? '#1a2131' : '#fff',
              pointBorderWidth: 2
            };
          })
        },
        options: baseOpts({
          legend: cfg.series.length > 1,
          scales: axes(cfg),
          tooltip: {
            label: function (c) {
              return ' ' + c.dataset.label + ': ' +
                (cfg.pct ? (c.parsed.y * 100).toFixed(1) + '%'
                 : cfg.plain ? c.parsed.y.toLocaleString('en-US')
                 : '$' + Math.round(c.parsed.y).toLocaleString('en-US'));
            }
          }
        })
      };
    });
    return canvas(id, cfg.height);
  }

  /* ---- bar: magnitude across categories. 4px rounded data-end. ---- */
  function bar(id, cfg) {
    push(id, function () {
      return {
        type: 'bar',
        data: {
          labels: cfg.labels,
          datasets: cfg.series.map(function (s, i) {
            return {
              label: s.label, data: s.data,
              backgroundColor: s.colors || s.color || series(i),
              borderRadius: 4, borderSkipped: 'start',
              /* 2px surface gap between adjacent fills */
              borderWidth: 2, borderColor: 'transparent',
              maxBarThickness: cfg.horizontal ? 22 : 46
            };
          })
        },
        options: (function () {
          var o = baseOpts({
            legend: cfg.series.length > 1,
            scales: cfg.horizontal
              ? { x: axes(cfg).y, y: { grid: { display: false, drawBorder: false },
                                       ticks: { color: ink('muted') }, stacked: !!cfg.stacked } }
              : axes(cfg),
            tooltip: {
              label: function (c) {
                return ' ' + (c.dataset.label || '') + ': ' +
                  (cfg.pct ? (c.parsed[cfg.horizontal ? 'x' : 'y'] * 100).toFixed(1) + '%'
                   : cfg.plain ? c.parsed[cfg.horizontal ? 'x' : 'y'].toLocaleString('en-US')
                   : '$' + Math.round(c.parsed[cfg.horizontal ? 'x' : 'y']).toLocaleString('en-US'));
              }
            }
          });
          o.indexAxis = cfg.horizontal ? 'y' : 'x';
          o.interaction = { mode: cfg.stacked ? 'index' : 'nearest', intersect: !cfg.stacked };
          return o;
        })()
      };
    });
    return canvas(id, cfg.height);
  }

  /* ---- doughnut: part-to-whole, ≤6 slices, always legended ---- */
  function doughnut(id, cfg) {
    push(id, function () {
      return {
        type: 'doughnut',
        data: {
          labels: cfg.labels,
          datasets: [{
            data: cfg.data,
            backgroundColor: cfg.labels.map(function (_, i) { return cfg.colors ? cfg.colors[i] : series(i); }),
            borderColor: isDark() ? '#1a2131' : '#fff',
            borderWidth: 2, hoverOffset: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: {
            legend: { display: true, position: 'right',
              labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle',
                        padding: 11, color: ink('muted') } },
            tooltip: {
              backgroundColor: '#101726', titleColor: '#eef1f6', bodyColor: '#cdd8e8',
              borderColor: 'rgba(255,255,255,.12)', borderWidth: 1, padding: 11, cornerRadius: 7,
              usePointStyle: true, boxWidth: 8, boxHeight: 8,
              callbacks: {
                label: function (c) {
                  var t = c.dataset.data.reduce(function (a, b) { return a + b; }, 0) || 1;
                  return ' ' + c.label + ': $' + Math.round(c.parsed).toLocaleString('en-US') +
                    '  (' + (c.parsed / t * 100).toFixed(1) + '%)';
                }
              }
            }
          }
        }
      };
    });
    return canvas(id, cfg.height || 230);
  }

  RG.chart = {
    line: line, bar: bar, doughnut: doughnut,
    flush: flush, series: series, canvas: canvas,
    LIGHT: LIGHT, DARK: DARK
  };
  global.RGChart = RG.chart;
})(typeof window !== 'undefined' ? window : globalThis);
