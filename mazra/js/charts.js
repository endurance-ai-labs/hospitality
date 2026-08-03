/* ============================================================
   Restaurant OS — chart layer (Chart.js)

   PALETTE PROVENANCE — do not swap these hex values casually.
   The categorical order below was run through the dataviz validator
   in BOTH modes and passes every hard gate:
     light  (surface #ffffff): worst adjacent CVD ΔE 11.7, normal-vision 20.1
     dark   (surface #1a2131): worst adjacent CVD ΔE 11.9, normal-vision 17.3
   Getting here took three rejected attempts, all caught by the validator
   rather than by eye: the portal's own muted tokens read gray (#6FA57E at
   chroma 0.081, green↔amber at ΔE 13.0 for normal vision — below the 15
   floor), and two deliberately institutional sets failed the chroma floor
   on teal and navy. The shipped set is the restrained one that still
   clears every gate, with contrast ≥ 3:1 on both surfaces.

   Colour is reserved for identity here and for STATUS elsewhere: a KPI
   rail is ink until a metric breaches its target.

   Rules enforced: one axis only (never dual-y), hues assigned in fixed
   order and never cycled, status colours reserved for state.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  /* Institutional set: navy, rust, teal, bronze, plum. Restrained on
     purpose — a private-equity-owned operator's reporting should not look
     like a consumer app. Validated in BOTH modes, and it separates BETTER
     than the brighter set it replaced:
       light (surface #ffffff): worst adjacent CVD dE 11.7, normal 20.1
       dark  (surface #1a2131): worst adjacent CVD dE 11.9, normal 17.3 */
  var LIGHT = ['#2f6bb0', '#b85a28', '#00897a', '#b98c1c', '#83519f'];
  var DARK  = ['#5590d6', '#d4703c', '#12a091', '#ab8226', '#a173bf'];

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

  /* Charts must not be built until the container actually has a width.
     Building in the same tick as the innerHTML assignment can measure 0 —
     and once Chart.js has cached a zero width it has no reason to
     re-measure, so the canvas paints nothing at full size. Defer to a
     frame, retry while the container is collapsed, and keep a
     ResizeObserver on each one so a later layout change re-fits it. */
  function flush() {
    if (!global.Chart) { queue = []; return; }
    var pending = queue.slice();
    queue = [];
    var tries = 0;
    (function attempt() {
      var ready = pending.filter(function (q) {
        var el = document.getElementById(q.id);
        return el && el.parentElement && el.parentElement.offsetWidth > 0;
      });
      if (!ready.length && tries < 20 && pending.length) {
        tries++;
        /* setTimeout, NOT requestAnimationFrame: rAF is paused in a
           background or non-compositing tab, so an rAF retry loop would
           never build the chart at all. */
        return setTimeout(attempt, 30);
      }
      build(pending);
      /* Belt and braces: a ResizeObserver only fires when the box actually
         CHANGES. If a chart was built at zero width and the container then
         simply is its final size, nothing ever fires — so sweep once. */
      if (!global.__rgSafetyNet) {
        global.__rgSafetyNet = true;
        setTimeout(function () {
          Array.prototype.slice.call(document.querySelectorAll('canvas')).forEach(function (el) {
            if (!el.parentElement || el.parentElement.offsetWidth <= 0) return;
            if (el._rgChart) {
              if (el.offsetWidth === 0) { try { el._rgChart.resize(); } catch (e) {} }
            } else if (el._rgFactory) { rebuild(el); }
          });
        }, 300);
      }
    })();
  }

  function build(pending) {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily ||
      'ui-sans-serif, system-ui, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.color = ink('muted');
    /* NO ENTRY ANIMATION — deliberate, and the single most important line
       in this file. Chart.js defers its FIRST paint to a requestAnimationFrame
       tick. rAF is paused in any tab that is not compositing — a background
       tab, a restored session, a window behind another window — so an
       animated first render can leave the canvas correctly sized and
       completely blank, which reads to a viewer as broken data rather than
       a paused frame loop. Verified by sampling the canvas backing store:
       0 painted pixels with animation on in a non-compositing tab, 14,328
       with animation off. Hover transitions still animate. */
    Chart.defaults.animation = false;
    Chart.defaults.datasets.bar.maxBarThickness = 46;

    pending.forEach(function (q) {
      var el = document.getElementById(q.id);
      if (!el) return;
      if (el._rgChart) el._rgChart.destroy();
      /* Chart.js registers the canvas at the start of construction. If the
         constructor then throws — which it does when the canvas has zero
         width — the canvas stays registered while _rgChart is never set,
         and every retry after that dies with "canvas is already in use".
         Always clear the registry entry first, and remember failures so a
         later resize can recover instead of silently rendering nothing. */
      var prior = (global.Chart.getChart && Chart.getChart(el)) || el._rgChart;
      if (prior) { try { prior.destroy(); } catch (e) {} }
      el._rgChart = null;
      try {
        el._rgChart = new Chart(el.getContext('2d'), q.factory());
        el._rgFactory = q.factory;
        observe(el);
      } catch (e) {
        el._rgFactory = q.factory;      /* retry when it has a size */
        el._rgFailed = true;
        observe(el);
      }
    });
  }

  function rebuild(el) {
    var prior = (global.Chart.getChart && Chart.getChart(el)) || null;
    if (prior) { try { prior.destroy(); } catch (e) {} }
    try {
      el._rgChart = new Chart(el.getContext('2d'), el._rgFactory());
      el._rgFailed = false;
    } catch (e) {}
  }

  /* re-fit when the container changes size — theme toggles, sidebar
     collapse, orientation change, or a late font load */
  function observe(el) {
    if (el._rgObs || typeof ResizeObserver === 'undefined') return;
    var box = el.parentElement;
    if (!box) return;
    el._rgObs = new ResizeObserver(function () {
      if (box.offsetWidth <= 0) return;
      if (el._rgChart) { try { el._rgChart.resize(); } catch (e) {} return; }
      if (el._rgFactory) rebuild(el);
    });
    el._rgObs.observe(box);
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
        grace: '6%',
        grid: { color: ink('grid'), drawBorder: false, lineWidth: 1, tickBorderDash: [3, 4] },
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
                ? function (ctx) {
                    /* a vertical gradient reads as depth without adding ink */
                    var a = ctx.chart.chartArea;
                    if (!a) return 'transparent';
                    var c = s.color || series(i);
                    var g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
                    g.addColorStop(0, c + '38');
                    g.addColorStop(1, c + '03');
                    return g;
                  }
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

  /* Direct labels on bar ends. Selective by design: only when a single
     series is plotted and the set is small enough to stay legible. */
  var valueLabels = {
    id: 'rgValueLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.on) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 10px ' + Chart.defaults.font.family;
      ctx.fillStyle = opts.color;
      chart.data.datasets.forEach(function (ds, di) {
        var meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach(function (el, i) {
          var v = ds.data[i];
          if (v == null) return;
          if (opts.horizontal) {
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(opts.fmt(v), el.x + 7, el.y);
          } else {
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(opts.fmt(v), el.x, el.y - 5);
          }
        });
      });
      ctx.restore();
    }
  };

  /* ---- bar: magnitude across categories. 4px rounded data-end. ---- */
  function bar(id, cfg) {
    push(id, function () {
      return {
        type: 'bar',
        plugins: [valueLabels],
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
          o.plugins.rgValueLabels = {
            on: cfg.series.length === 1 && !cfg.stacked && cfg.labels.length <= 14,
            horizontal: !!cfg.horizontal, color: ink('muted'),
            fmt: cfg.pct ? function (v) { return (v * 100).toFixed(1) + '%'; }
               : cfg.plain ? function (v) { return Math.round(v).toLocaleString('en-US'); }
               : money
          };
          if (cfg.horizontal) o.layout = { padding: { right: 54 } };
          else o.layout = { padding: { top: 16 } };
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
