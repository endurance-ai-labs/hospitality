/* ============================================================
   Restaurant OS — shared utilities
   Formatters, personas & role gating, source chips, approval chains,
   the Slack-nudge simulation, grid tools, and the derivation-tooltip
   engine that makes every number on the portal traceable.
   ============================================================ */

/* ---- selectors ---- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---- money & numbers. Portal convention: dates are MM-DD-YYYY. ---- */
function fmt$(n, dp) {
  if (n == null || isNaN(n)) return '—';
  var d = dp == null ? 0 : dp;
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US',
    { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmt$c(n) { return fmt$(n, 2); }
function fmtK(n) {
  if (n == null || isNaN(n)) return '—';
  var a = Math.abs(n);
  if (a >= 1e6) return (n < 0 ? '-$' : '$') + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
  if (a >= 1e3) return (n < 0 ? '-$' : '$') + Math.round(a / 1e3) + 'K';
  return fmt$(n);
}
function fmtNum(n, dp) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
}
function fmtPct(n, dp) {
  if (n == null || isNaN(n)) return '—';
  return (n * 100).toFixed(dp == null ? 1 : dp) + '%';
}
function fmtPP(n, dp) {   /* percentage-point delta */
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(dp == null ? 1 : dp) + ' pts';
}
function usDate(iso) {
  if (!iso) return '—';
  var p = String(iso).split('-');
  return p[1] + '-' + p[2] + '-' + p[0];
}

/* delta chip — good direction is configurable because for cost metrics
   down is good and the colour has to follow the meaning, not the sign */
function deltaChip(v, opts) {
  opts = opts || {};
  if (v == null || isNaN(v)) return '<span class="chip chip-flat">—</span>';
  var good = opts.lowerIsBetter ? v < 0 : v > 0;
  var cls = Math.abs(v) < (opts.flatBand || 0.0005) ? 'chip-flat' : (good ? 'chip-good' : 'chip-bad');
  var arrow = Math.abs(v) < (opts.flatBand || 0.0005) ? '' : (v > 0 ? '▲ ' : '▼ ');
  var txt = opts.pp ? fmtPP(v, opts.dp) : opts.money ? fmt$(v) : fmtPct(v, opts.dp);
  return '<span class="chip ' + cls + '">' + arrow + esc(txt) + '</span>';
}

function pill(text, tone) {
  return '<span class="pill pill-' + (tone || 'neutral') + '">' + esc(text) + '</span>';
}

/* ============================================================
   DERIVATION TOOLTIPS
   The credibility feature. Any number can carry data-exp; hovering
   shows the formula, the inputs that produced it, and which system the
   inputs came from. Build pages with exp() around every figure.
   ============================================================ */
function exp(cfg) {
  var payload = {
    v: cfg.value || '',
    f: cfg.formula || '',
    i: cfg.inputs || [],
    s: cfg.source || [],
    p: cfg.period || '',
    n: cfg.note || '',
    d: cfg.drill || ''
  };
  return ' data-exp="' + esc(JSON.stringify(payload)) + '"';
}

/* wrap a rendered value in a traceable span */
function traced(html, cfg) {
  return '<span class="traced"' + exp(cfg) + '>' + html + '</span>';
}

(function initTipEngine() {
  var tip = null, timer = null, current = null;

  function ensure() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.id = 'rg-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    return tip;
  }

  function render(data) {
    var rows = (data.i || []).map(function (x) {
      return '<div class="rg-tip-row"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>';
    }).join('');
    var chips = (data.s || []).map(function (s) {
      return '<span class="rg-tip-src">' + esc(s) + '</span>';
    }).join('');
    return (data.v ? '<div class="rg-tip-val">' + esc(data.v) + '</div>' : '') +
      (data.f ? '<div class="rg-tip-formula">' + esc(data.f) + '</div>' : '') +
      (rows ? '<div class="rg-tip-rows">' + rows + '</div>' : '') +
      (data.n ? '<div class="rg-tip-note">' + esc(data.n) + '</div>' : '') +
      '<div class="rg-tip-foot">' +
        (data.p ? '<span class="rg-tip-period">' + esc(data.p) + '</span>' : '') +
        (chips ? '<span class="rg-tip-srcs">' + chips + '</span>' : '') +
      '</div>' +
      (data.d ? '<div class="rg-tip-drill">Click to open ' + esc(data.d) + ' →</div>' : '');
  }

  function place(el) {
    var r = el.getBoundingClientRect();
    var t = ensure();
    t.style.visibility = 'hidden';
    t.style.display = 'block';
    var tw = t.offsetWidth, th = t.offsetHeight;
    var left = r.left + r.width / 2 - tw / 2;
    var top = r.top - th - 10;
    if (top < 8) top = r.bottom + 10;                        /* flip below */
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    t.style.left = Math.round(left + window.scrollX) + 'px';
    t.style.top = Math.round(top + window.scrollY) + 'px';
    t.style.visibility = 'visible';
  }

  function show(el) {
    var raw = el.getAttribute('data-exp');
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    var t = ensure();
    t.innerHTML = render(data);
    t.classList.add('on');
    place(el);
    current = el;
  }

  function hide() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (tip) { tip.classList.remove('on'); tip.style.display = 'none'; }
    current = null;
  }

  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest ? e.target.closest('[data-exp]') : null;
    if (!el || el === current) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { show(el); }, 250);
  });
  document.addEventListener('mouseout', function (e) {
    var el = e.target.closest ? e.target.closest('[data-exp]') : null;
    if (el) hide();
  });
  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
})();

/* ============================================================
   PERSONAS & ROLE GATING — driven by RG.PEOPLE / RG.ROLES
   ============================================================ */
var SESSION_KEY = 'rgos-user';

function personas() { return RG.PEOPLE; }

function currentPersona() {
  var id = null;
  try { id = localStorage.getItem(SESSION_KEY); } catch (e) {}
  return RG.personById[id] || RG.PEOPLE[0];
}
function isSignedIn() {
  try { return !!localStorage.getItem(SESSION_KEY) && !!RG.personById[localStorage.getItem(SESSION_KEY)]; }
  catch (e) { return false; }
}
function setRole(id) {
  try { localStorage.setItem(SESSION_KEY, id); } catch (e) {}
  location.reload();
}
function signOutUser() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  location.reload();
}
/* permission check for the signed-in user */
function can(perm) {
  return RG.can(currentPersona().id, perm);
}
/* units the signed-in user may see */
function myUnits() {
  return RG.unitsFor(currentPersona().id);
}
function scopedUnits() {
  var mine = myUnits();
  return RG.UNITS.filter(function (u) { return mine.indexOf(u.id) >= 0; });
}

function roleSummary(p) {
  var perms = RG.ROLES[p.role].perms;
  if (perms.indexOf('admin') >= 0) return 'Full access · all units · sign-off rights';
  if (perms.indexOf('money') >= 0) return 'Financial access · all units';
  if (perms.indexOf('allunits') >= 0) return RG.ROLES[p.role].label + ' · all units';
  if (perms.length === 0) return 'Schedule & tasks only';
  var n = RG.unitsFor(p.id).length;
  return RG.ROLES[p.role].label + ' · ' + n + (n === 1 ? ' unit' : ' units');
}

function renderSignIn() {
  /* Seventeen users is a lot to scan as one wall — group them the way an
     org chart reads, so the buyer finds themselves immediately. */
  var GROUPS = [
    ['Leadership', ['principal', 'exec', 'finance']],
    ['Above-store', ['chef', 'areamgr', 'marketing', 'people']],
    ['General Managers', ['gm']],
    ['External', ['external', 'staff']]
  ];
  var cards = GROUPS.map(function (g) {
    var people = RG.PEOPLE.filter(function (p) { return g[1].indexOf(p.role) >= 0; });
    if (!people.length) return '';
    return '<div class="login-section">' + esc(g[0]) + '</div>' +
      people.map(function (p) {
        var initials = p.name.split(' ').map(function (w) { return w[0]; })
          .join('').slice(0, 2).toUpperCase();
        return '<button class="login-card" onclick="setRole(\'' + p.id + '\')">' +
          '<span class="avatar">' + esc(initials) + '</span>' +
          '<span class="who"><b>' + esc(p.name) + '</b><i>' + esc(p.title) + '</i>' +
          '<span class="perm">' + esc(roleSummary(p)) + '</span></span>' +
          '</button>';
      }).join('');
  }).join('');
  var ov = document.createElement('div');
  ov.className = 'login-overlay';
  ov.innerHTML =
    '<div class="login-box">' +
      '<img src="/hospitality/assets/brand/1100-wordmark.svg" alt="' + esc(RG.COMPANY.name) + '" class="login-logo">' +
      '<div class="login-title">Operating System</div>' +
      '<div class="login-sub">' + esc(RG.UNITS.length) + ' restaurants · ' + esc(RG.BRANDS.length) +
        ' brands · one connected brain</div>' +
      '<div class="login-note">Select your user — every module, approval right and financial view is scoped to your role.</div>' +
      '<div class="login-grid">' + cards + '</div>' +
      '<div class="login-foot">Demo environment · fictional operating data · concept build by Endurance AI Labs</div>' +
    '</div>';
  document.body.appendChild(ov);
}

/* ============================================================
   SOURCE CHIPS — every panel names the system its data came from
   ============================================================ */
var SRC_META = {
  Toast:        ['#ff4c00', 'Orders, checks, PMIX, labor punches — Toast Partner API'],
  Square:       ['#3e4348', 'Orders, payments, catalog, team — Square API'],
  '7shifts':    ['#1a936f', 'Schedules, punches, availability — 7shifts REST API'],
  R365:         ['#0b4f9c', 'Inventory, recipes, AP and GL — Restaurant365'],
  Deliverect:   ['#6f42c1', 'All marketplace orders through one middleware feed'],
  DoorDash:     ['#eb1700', 'Marketplace orders, commission and error charges'],
  UberEats:     ['#06c167', 'Marketplace orders and delivery timing'],
  OpenTable:    ['#da3743', 'Reservations, covers, no-shows'],
  Google:       ['#4285f4', 'Reviews, ratings and local search performance'],
  Yelp:         ['#d32323', 'Reviews and category ranking'],
  ADP:          ['#d0271d', 'Gross-to-net payroll, taxes, benefits'],
  QBO:          ['#2ca01c', 'General ledger and AP — QuickBooks Online'],
  Sysco:        ['#0067b1', 'Order guide, invoices and pricing — EDI 810/850'],
  USFoods:      ['#00447c', 'Order guide and contract pricing — MOXē'],
  Plaid:        ['#111111', 'Bank balances, deposits and settlement'],
  Lease:        ['#8a6d3b', 'Lease abstract — base rent, CAM, percentage rent'],
  Docs:         ['#5a6472', 'Vendor PDF invoices, OCR-extracted then reviewed'],
  Model:        ['#2766d6', 'Derived inside the operating model — not a vendor feed']
};

function srcChip(kind) {
  var m = SRC_META[kind];
  if (!m) m = ['#5a6472', kind];
  return '<span class="src-chip" title="' + esc(m[1]) + '" style="--src:' + m[0] + '">' +
    '<i></i>' + esc(kind) + '</span>';
}
function srcChips() {
  return '<span class="src-chips">' +
    Array.prototype.slice.call(arguments).map(srcChip).join('') + '</span>';
}

/* ============================================================
   APPROVAL CHAINS + SLACK NUDGE
   State in localStorage "rgos-appr:<key>"; nudges in "rgos-nudge:<key>:<i>"
   ============================================================ */
window.__apprDefs = window.__apprDefs || {};

function apprState(key, n) {
  try {
    var raw = localStorage.getItem('rgos-appr:' + key);
    var arr = raw ? JSON.parse(raw) : [];
    while (arr.length < n) arr.push(null);
    return arr;
  } catch (e) { return new Array(n).fill(null); }
}
function apprSave(key, arr) {
  try { localStorage.setItem('rgos-appr:' + key, JSON.stringify(arr)); } catch (e) {}
}

function approvalChain(key, steps) {
  window.__apprDefs[key] = steps;
  var st = apprState(key, steps.length);
  var me = currentPersona();
  var html = steps.map(function (s, i) {
    var done = st[i];
    var prevDone = i === 0 || !!st[i - 1];
    var who = RG.personById[s.person];
    if (done) {
      return '<div class="appr-step done"><span class="tick">✓</span><div>' +
        '<b>' + esc(s.doneLabel || s.label) + '</b>' +
        '<span>' + esc(done.by) + ' · ' + esc(done.title) + ' · ' + esc(done.at) + '</span></div></div>';
    }
    var mine = who && who.id === me.id;
    if (prevDone && mine) {
      return '<div class="appr-step ready"><span class="tick">○</span><div>' +
        '<b>' + esc(s.label) + '</b><span>Awaiting you</span></div>' +
        '<button class="btn-approve" onclick="apprApprove(\'' + key + '\',' + i + ')">Approve</button></div>';
    }
    var nudged = null;
    try { nudged = localStorage.getItem('rgos-nudge:' + key + ':' + i); } catch (e) {}
    var nudgeBtn = prevDone && who ?
      '<button class="btn-nudge" onclick="slackNudge(\'' + key + '\',' + i + ')">' +
        slackMark() + (nudged ? 'Message again' : 'Message ' + esc(who.name.split(' ')[0])) + '</button>' : '';
    return '<div class="appr-step ' + (prevDone ? 'waiting' : 'locked') + '">' +
      '<span class="tick">' + (prevDone ? '○' : '🔒') + '</span><div>' +
      '<b>' + esc(s.label) + '</b><span>' + (who ? esc(who.name) + ' · ' + esc(who.title) : 'Unassigned') +
      (nudged ? ' · ⌲ Slack reminder sent ' + esc(nudged) : '') + '</span></div>' + nudgeBtn + '</div>';
  }).join('');
  return '<div class="appr-chain">' + html + '</div>';
}

function apprApprove(key, i) {
  var me = currentPersona();
  var st = apprState(key, (window.__apprDefs[key] || []).length);
  var now = new Date(RG.CAL.TODAY + 'T09:14:00Z');
  st[i] = { by: me.name, title: me.title, at: usDate(RG.CAL.TODAY) + ' 9:14 AM' };
  apprSave(key, st);
  location.reload();
}

function slackMark() {
  return '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">' +
    '<path fill="#E01E5A" d="M5.1 15.2a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5zm1.2 0a2.5 2.5 0 0 1 5 0v6.3a2.5 2.5 0 0 1-5 0v-6.3z"/>' +
    '<path fill="#36C5F0" d="M8.8 5.1a2.5 2.5 0 1 1 2.5-2.5v2.5H8.8zm0 1.2a2.5 2.5 0 0 1 0 5H2.5a2.5 2.5 0 0 1 0-5h6.3z"/>' +
    '<path fill="#2EB67D" d="M18.9 8.8a2.5 2.5 0 1 1 2.5 2.5h-2.5V8.8zm-1.2 0a2.5 2.5 0 0 1-5 0V2.5a2.5 2.5 0 0 1 5 0v6.3z"/>' +
    '<path fill="#ECB22E" d="M15.2 18.9a2.5 2.5 0 1 1-2.5 2.5v-2.5h2.5zm0-1.2a2.5 2.5 0 0 1 0-5h6.3a2.5 2.5 0 0 1 0 5h-6.3z"/></svg>';
}

function slackNudge(key, i) {
  var steps = window.__apprDefs[key] || [];
  var step = steps[i]; if (!step) return;
  var who = RG.personById[step.person];
  var me = currentPersona();
  var pop = document.createElement('div');
  pop.className = 'slk-overlay';
  pop.innerHTML =
    '<div class="slk-win">' +
      '<div class="slk-head">' + slackMark() + '<b>1100 Group</b><span>Direct message</span>' +
        '<button class="slk-x" onclick="this.closest(\'.slk-overlay\').remove()">✕</button></div>' +
      '<div class="slk-peer"><span class="slk-av">' +
        esc(who.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2)) +
        '</span><div><b>' + esc(who.name) + '</b><i>' + esc(who.title) + '</i></div>' +
        '<span class="slk-presence"></span></div>' +
      '<div class="slk-body">' +
        '<div class="slk-msg"><span class="slk-av sm">' +
          esc(me.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2)) +
          '</span><div><b>' + esc(me.name) + ' <span class="slk-app">APP</span></b>' +
          '<p>' + esc(step.label) + ' is waiting on you. ' +
          esc(step.nudge || 'It is the next step in the approval chain.') + '</p>' +
          '<p class="slk-link">Open in the operating portal →</p></div></div>' +
        '<div class="slk-status" id="slk-status"><span class="slk-spin"></span> Sending…</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(pop);
  setTimeout(function () {
    var s = pop.querySelector('#slk-status');
    if (s) s.innerHTML = '<span class="slk-ok">✓</span> Delivered';
  }, 750);
  setTimeout(function () {
    var s = pop.querySelector('#slk-status');
    if (s) s.innerHTML = '<span class="slk-ok">✓</span> Delivered · 👀 seen';
    try {
      localStorage.setItem('rgos-nudge:' + key + ':' + i,
        usDate(RG.CAL.TODAY) + ' 9:14 AM');
    } catch (e) {}
  }, 1900);
}

/* ============================================================
   GRID TOOLS — collapse / print / export, on every table
   ============================================================ */
function gridTools(id, title) {
  return '<div class="grid-tools">' +
    '<button class="pa-btn" onclick="gridPrint(\'' + id + '\')">Print</button>' +
    '<button class="pa-btn" onclick="gridExport(\'' + id + '\',\'' + esc(title || id) + '\')">Export</button>' +
    '</div>';
}
function gridPrint() { window.print(); }
function gridExport(id, title) {
  var tbl = document.getElementById(id);
  if (!tbl) return;
  var rows = $$('tr', tbl).map(function (tr) {
    return $$('th,td', tr).map(function (c) {
      var t = c.innerText.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
      return '"' + t + '"';
    }).join(',');
  }).join('\n');
  var blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (title || 'export').replace(/[^\w -]/g, '') + ' — ' + RG.CAL.TODAY + '.csv';
  a.click();
}

/* ---- inline sparkline (no chart library needed) ---- */
function sparkline(values, opts) {
  opts = opts || {};
  if (!values || values.length < 2) return '';
  var w = opts.w || 84, h = opts.h || 24, pad = 2;
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  var span = (max - min) || 1;
  var pts = values.map(function (v, i) {
    var x = pad + (i / (values.length - 1)) * (w - pad * 2);
    var y = h - pad - ((v - min) / span) * (h - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var up = values[values.length - 1] >= values[0];
  var col = opts.color || (up ? 'var(--color-green)' : 'var(--color-red)');
  return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

/* ---- period helpers used by every page ---- */
function M() { return RG.model(); }
function curPeriod() { return M().current; }
function periodLabel(key) {
  var p = RG.CAL.periodByKey[key];
  return p ? p.label : key;
}
function periodRange(key) {
  var p = RG.CAL.periodByKey[key];
  return p ? p.range : '';
}
