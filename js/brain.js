/* ============================================================
   Restaurant OS — the Brain
   A floating bubble on every page. Every answer JOINS at least two
   modules and cites the systems it drew from, which is the whole
   difference between this and a chatbot bolted onto a dashboard.
   Answers are computed live from the MODEL, not written as strings.
   ============================================================ */
(function () {
  function brainMark() {
    return '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9.5 3.5a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0-1.8 4.2A2.6 2.6 0 0 0 6 15a2.5 2.5 0 0 0 3.5 2.3V3.5z"/>' +
      '<path d="M14.5 3.5A2.5 2.5 0 0 1 17 6a2.5 2.5 0 0 1 1.8 4.2A2.6 2.6 0 0 1 18 15a2.5 2.5 0 0 1-3.5 2.3V3.5z"/>' +
      '<path d="M12 3.2v17.6"/><path d="M9.5 20.8h5"/></svg>';
  }

  /* ---- the answer set. Each returns {text, cites, link} ---- */
  var QUESTIONS = [
    {
      q: 'Which unit is hurting us most right now, and why?',
      a: function () {
        var M = RG.model();
        var worst = M.scorecard[M.scorecard.length - 1];
        var top = M.flags[0];
        return {
          text: '<b>' + esc(worst.name) + '</b> ranks last of ' + M.scorecard.length +
            ' on the composite score. Four-wall margin ' + fmtPct(worst.fourWallPct) +
            ' against a group average of ' +
            fmtPct(M.group[M.current].fourWallPct) + ', prime cost ' + fmtPct(worst.primePct) +
            ', and food variance of ' + fmt$(worst.cogsVariance) + ' in ' + periodLabel(M.current) +
            '.<br><br>The largest single flag anywhere in the group is <b>' + esc(top.unitName) +
            '</b> — ' + esc(top.title) + ' — worth ' + fmt$(top.impact) + '. ' + esc(top.detail),
          cites: ['Toast', 'Square', 'R365', '7shifts'],
          link: '/hospitality/cogs'
        };
      }
    },
    {
      q: 'Why did group profit move versus last period?',
      a: function () {
        var M = RG.model(), b = M.bridges.profit, p = b.parts;
        var named = [['Sales flow-through', p.sales], ['Cost of goods', p.cogs],
          ['Labor', p.labor], ['Controllables', p.controllables], ['Occupancy', p.occupancy]];
        named.sort(function (x, y) { return Math.abs(y[1]) - Math.abs(x[1]); });
        return {
          text: 'Four-wall EBITDA moved ' + fmt$(b.total) + ' from ' + periodLabel(b.from) +
            ' to ' + periodLabel(b.to) + ' (' + fmt$(b.fromFourWall) + ' → ' + fmt$(b.toFourWall) +
            ').<br><br>' + named.map(function (n) {
              return '• <b>' + n[0] + '</b> ' + (n[1] >= 0 ? '+' : '') + fmt$(n[1]);
            }).join('<br>') +
            '<br><br>These five are exhaustive — they sum to the total movement exactly, ' +
            'because they are the only lines between net sales and four-wall EBITDA.',
          cites: ['Toast', 'R365', '7shifts', 'QBO'],
          link: '/hospitality/finance'
        };
      }
    },
    {
      q: 'Was our sales change traffic or check average?',
      a: function () {
        var M = RG.model(), b = M.bridges.sales;
        return {
          text: 'Net sales moved ' + fmt$(b.total) + ' period over period.<br><br>' +
            '• <b>Traffic</b> ' + (b.traffic >= 0 ? '+' : '') + fmt$(b.traffic) +
            ' — checks went ' + fmtNum(b.fromChecks) + ' → ' + fmtNum(b.toChecks) + '<br>' +
            '• <b>Menu price</b> ' + (b.price >= 0 ? '+' : '') + fmt$(b.price) +
            ' — from scheduled price moves inside the window<br>' +
            '• <b>Mix &amp; behaviour</b> ' + (b.mix >= 0 ? '+' : '') + fmt$(b.mix) +
            ' — what guests actually ordered<br><br>' +
            'Average check ' + fmt$c(b.fromAvgCheck) + ' → ' + fmt$c(b.toAvgCheck) + '. ' +
            (Math.abs(b.traffic) > Math.abs(b.check)
              ? 'This was a <b>traffic</b> story, not a pricing one.'
              : 'This was carried by <b>check average</b>, not by more guests.'),
          cites: ['Toast', 'Square'],
          link: '/hospitality/sales'
        };
      }
    },
    {
      q: 'Where is our food cost leaking, and is it price or portioning?',
      a: function () {
        var M = RG.model();
        var rows = RG.UNITS.map(function (u) {
          return { u: u, c: RG.periodCogs(u.id, M.current) };
        }).sort(function (a, b) { return b.c.variance - a.c.variance; });
        var w = rows[0];
        var labels = { portion: 'portioning', waste: 'waste', spoilage: 'spoilage',
          ppv: 'purchase price', unexplained: 'unexplained shrink' };
        var d = w.c.drivers;
        var ranked = Object.keys(d).sort(function (a, b) { return d[b] - d[a]; });
        return {
          text: 'Group theoretical-vs-actual variance is ' + fmt$(M.group[M.current].cogsVariance) +
            ' this period. The worst unit is <b>' + esc(w.u.name) + '</b> at ' +
            fmt$(w.c.variance) + ' (' + fmtPct(w.c.variancePct) + ' of theoretical).<br><br>' +
            ranked.map(function (k) {
              return '• <b>' + labels[k] + '</b> ' + fmt$(d[k]);
            }).join('<br>') +
            '<br><br>Purchase price is a <i>supplier</i> problem; portioning and shrink are a ' +
            '<i>floor</i> problem. Here the largest driver is <b>' + labels[ranked[0]] +
            '</b>, so ' + (ranked[0] === 'ppv'
              ? 'start with the order guide and contract pricing.'
              : 'start with spec sheets and the line, not the vendor.'),
          cites: ['R365', 'Sysco', 'Toast'],
          link: '/hospitality/cogs'
        };
      }
    },
    {
      q: 'Which units are closest to a percentage-rent trigger?',
      a: function () {
        var M = RG.model();
        var p = RG.CAL.periodByKey[M.current];
        var rows = RG.UNITS.filter(function (u) { return u.pctRentBreak; }).map(function (u) {
          var fytd = RG.CAL.PERIODS.filter(function (q) {
            return q.fy === p.fy && q.period <= p.period;
          }).reduce(function (s, q) { return s + RG.periodSales(u.id, q.key).net; }, 0);
          return { u: u, fytd: fytd, prox: fytd / u.pctRentBreak };
        }).sort(function (a, b) { return b.prox - a.prox; });
        if (!rows.length) return { text: 'No unit in the group carries a percentage-rent clause.', cites: ['Lease'] };
        return {
          text: rows.map(function (r) {
            return '<b>' + esc(r.u.name) + '</b> — FY-to-date net sales ' + fmt$(r.fytd) +
              ' against a ' + fmt$(r.u.pctRentBreak) + ' breakpoint (' + fmtPct(r.prox) + ').' +
              (r.prox > 1 ? ' <b>Triggered.</b> Incremental rent runs at ' + fmtPct(r.u.pctRentRate) +
                ' of every sales dollar above the breakpoint.'
                : ' Not yet triggered.');
          }).join('<br><br>') +
          '<br><br>This is the one place where growing sales costs money — worth knowing before ' +
          'you push a promotion at these units.',
          cites: ['Lease', 'Toast'],
          link: '/hospitality/leases'
        };
      }
    },
    {
      q: 'Is our labor problem hours, wage rates, or overtime?',
      a: function () {
        var M = RG.model(), b = M.bridges.labor, g = M.group[M.current];
        return {
          text: 'Total labor moved ' + fmt$(b.total) + ' period over period, now ' +
            fmtPct(g.laborPct) + ' of net sales.<br><br>' +
            '• <b>Volume</b> ' + (b.volume >= 0 ? '+' : '') + fmt$(b.volume) +
            ' — hours went ' + fmtNum(b.fromHours) + ' → ' + fmtNum(b.toHours) + '<br>' +
            '• <b>Rate</b> ' + (b.rate >= 0 ? '+' : '') + fmt$(b.rate) +
            ' — effective ' + fmt$c(b.fromRate) + '/hr → ' + fmt$c(b.toRate) + '/hr<br>' +
            '• <b>Management</b> ' + (b.manager >= 0 ? '+' : '') + fmt$(b.manager) + '<br><br>' +
            'Inside that, overtime moved ' + fmt$(b.otDelta) + ' and California meal-break ' +
            'premiums moved ' + fmt$(b.premiumDelta) + '. Group SPLH is ' + fmt$c(g.splh) + '.',
          cites: ['7shifts', 'ADP', 'Toast'],
          link: '/hospitality/labor'
        };
      }
    },
    {
      q: 'Rank every unit by four-wall margin.',
      a: function () {
        var M = RG.model();
        var rows = M.scorecard.slice().sort(function (a, b) { return b.fourWallPct - a.fourWallPct; });
        return {
          text: rows.map(function (r, i) {
            return (i + 1) + '. <b>' + esc(r.short) + '</b> ' + fmtPct(r.fourWallPct) +
              ' · ' + fmt$(r.fourWall) + ' on ' + fmt$(r.netSales) +
              ' · occupancy ' + fmtPct(r.occupancyPct);
          }).join('<br>') +
          '<br><br>Margin and rank are not the same thing — the composite score also weighs comp ' +
          'growth and cost control, so a high-margin unit with a widening food variance still ' +
          'falls in the leaderboard.',
          cites: ['Toast', 'Square', 'R365', 'QBO', 'Lease'],
          link: '/hospitality/finance'
        };
      }
    },
    {
      q: 'What does delivery actually earn us after commission?',
      a: function () {
        var M = RG.model(), g = M.group[M.current];
        var delivery = RG.UNITS.reduce(function (s, u) {
          return s + (RG.periodSales(u.id, M.current).byChannel.delivery || 0);
        }, 0);
        return {
          text: 'Delivery gross was ' + fmt$(delivery) + ' this period, ' +
            fmtPct(delivery / g.grossSales) + ' of group gross sales. Marketplace commission took ' +
            fmt$(g.deliveryFees) + ' of that — a blended effective take rate of ' +
            fmtPct(g.deliveryFees / delivery) + '.<br><br>' +
            'Alcohol does not travel, so the delivery basket carries none of the beverage margin ' +
            'that pays for the dining room. Packaging is charged into cost of goods on every ' +
            'off-premise item.<br><br>Every point of mix shifted from marketplace to first-party ' +
            'is worth roughly ' + fmt$(delivery * 0.238 * 0.01) + ' a period at current volume.',
          cites: ['Deliverect', 'DoorDash', 'UberEats', 'Toast'],
          link: '/hospitality/offprem'
        };
      }
    }
  ];

  function panelHtml() {
    var M = RG.model();
    return '<div class="brain-head">' + brainMark().replace('26', '18').replace('26', '18') +
      '<div><b>The Brain</b><br><span>' + RG.UNITS.length + ' restaurants · ' +
      periodLabel(M.current) + ' · answers cite their sources</span></div>' +
      '<button class="slk-x" style="margin-left:auto;color:inherit" onclick="RGBrain.close()">✕</button></div>' +
      '<div class="brain-body" id="brain-body">' +
        '<div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--color-slate-hint);margin-bottom:9px">' +
        'Ask across every system</div>' +
        QUESTIONS.map(function (q, i) {
          return '<button class="brain-q" onclick="RGBrain.ask(' + i + ')">' + esc(q.q) + '</button>';
        }).join('') +
      '</div>';
  }

  var api = {
    open: function () {
      var p = document.getElementById('brain-panel');
      if (!p) return;
      p.innerHTML = panelHtml();
      p.classList.add('on');
    },
    close: function () {
      var p = document.getElementById('brain-panel');
      if (p) p.classList.remove('on');
    },
    toggle: function () {
      var p = document.getElementById('brain-panel');
      if (!p) return;
      p.classList.contains('on') ? api.close() : api.open();
    },
    ask: function (i) {
      var q = QUESTIONS[i];
      var res = q.a();
      var body = document.getElementById('brain-body');
      if (!body) return;
      body.innerHTML =
        '<button class="brain-back" onclick="RGBrain.open()">← All questions</button>' +
        '<div style="font-weight:800;font-size:13px;margin-bottom:9px;line-height:1.4">' + esc(q.q) + '</div>' +
        '<div class="brain-a">' + res.text +
        '<div class="brain-cite"><span style="font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--color-slate-hint)">Sources</span>' +
        res.cites.map(srcChip).join('') +
        (res.link ? '<a href="' + res.link + '" style="margin-left:auto;font-size:11.5px;font-weight:700;color:var(--color-blue);text-decoration:none">Open module →</a>' : '') +
        '</div></div>';
    },
    questions: QUESTIONS
  };
  window.RGBrain = api;

  /* mount on every page */
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof isSignedIn === 'function' && !isSignedIn()) return;
    if (document.getElementById('brain-fab')) return;
    var fab = document.createElement('button');
    fab.className = 'brain-fab';
    fab.id = 'brain-fab';
    fab.title = 'Ask the Brain';
    fab.innerHTML = brainMark();
    fab.onclick = api.toggle;
    var panel = document.createElement('div');
    panel.className = 'brain-panel';
    panel.id = 'brain-panel';
    document.body.appendChild(panel);
    document.body.appendChild(fab);
  });
})();
