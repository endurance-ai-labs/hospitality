/* ============================================================
   Restaurant OS — navigation shell
   Same framework as the CFP/Margins and Y8S portals: news marquee +
   market ticker + topbar with grouped nav + section sub-nav + theme
   toggle + persona switcher.
   ============================================================ */

/* every load starts light — the Margins profile */
(function () {
  document.documentElement.setAttribute('data-theme', 'light');
  try { localStorage.setItem('rgos-theme', 'light'); } catch (e) {}
})();

var BASE = '/hospitality';

var NAV_GROUPS = [
  { id: 'home', label: 'Home', href: '/hospitality/', items: [] },
  {
    id: 'sales', label: 'Sales',
    items: [
      { href: '/hospitality/sales',    label: 'Sales & Traffic' },
      { href: '/hospitality/menu',     label: 'Menu Engineering' },
      { href: '/hospitality/covers',   label: 'Reservations & Covers' },
      { href: '/hospitality/offprem',  label: 'Off-Premise Economics' }
    ]
  },
  {
    id: 'cost', label: 'Cost', perm: 'margins',
    items: [
      { href: '/hospitality/cogs',      label: 'Food & Beverage Cost' },
      { href: '/hospitality/purchasing', label: 'Purchasing & Price Watch' },
      { href: '/hospitality/inventory', label: 'Inventory & Waste' }
    ]
  },
  {
    id: 'people', label: 'People',
    items: [
      { href: '/hospitality/labor',  label: 'Labor & Scheduling' },
      { href: '/hospitality/hr',     label: 'People & HR' }
    ]
  },
  {
    id: 'guest', label: 'Guest',
    items: [
      { href: '/hospitality/guest',     label: 'Experience & Reputation' },
      { href: '/hospitality/marketing', label: 'Marketing & Loyalty' }
    ]
  },
  {
    id: 'finance', label: 'Financial', perm: 'money',
    items: [
      { href: '/hospitality/finance',  label: 'P&L by Unit' },
      { href: '/hospitality/forecast', label: 'Forecast & Growth' },
      { href: '/hospitality/cash',     label: 'Cash & Loss Prevention' },
      { href: '/hospitality/leases',   label: 'Real Estate & Leases' }
    ]
  },
  {
    id: 'ops', label: 'Operations',
    items: [
      { href: '/hospitality/facilities',   label: 'Facilities & Energy' },
      { href: '/hospitality/compliance',   label: 'Food Safety & Compliance' },
      { href: '/hospitality/integrations', label: 'Integrations & Data Health' }
    ]
  }
];

function _norm(p) {
  if (!p) return '/';
  p = p.replace(/\/index\.html$/, '/');
  /* the portal is served under a base path — strip it so active-group
     detection compares clean routes */
  if (p.indexOf(BASE) === 0) p = p.slice(BASE.length) || '/';
  return p || '/';
}
function _activeGroup(path) {
  path = _norm(path);
  if (path === '/') return 'home';
  for (var i = 0; i < NAV_GROUPS.length; i++) {
    var g = NAV_GROUPS[i];
    for (var j = 0; j < g.items.length; j++) {
      /* item hrefs carry the base path; the incoming path has had it
         stripped — normalise both sides before comparing */
      if (path.indexOf(_norm(g.items[j].href)) === 0) return g.id;
    }
  }
  return 'home';
}

/* ---- ticker: the inputs that actually move a restaurant P&L ---- */
var TICKER = [
  ['BEEF (USDA COMPOSITE)', '$3.42/lb', '+11.5% YoY', 'down'],
  ['CHICKEN BREAST', '$1.68/lb', '+4.8% YoY', 'down'],
  ['CHEESE BLOCK (CME)', '$1.94/lb', '+6.1% YoY', 'down'],
  ['PRODUCE INDEX', '104.3', '+2.2%', 'down'],
  ['FRYER OIL', '$21.40/gal', '-1.8%', 'up'],
  ['CPI FOOD AWAY FROM HOME', '+3.9% YoY', 'unch', 'down'],
  ['CPI FOOD AT HOME', '+1.8% YoY', '-0.2 pt', 'up'],
  ['CA MINIMUM WAGE', '$16.50/hr', 'eff. 01-01', 'down'],
  ['OR MINIMUM WAGE (PORTLAND)', '$16.30/hr', 'eff. 07-01', 'down'],
  ['BLACK BOX SAME-STORE SALES', '+2.1%', 'industry', 'up'],
  ['BLACK BOX SAME-STORE TRAFFIC', '-1.4%', 'industry', 'down'],
  ['PG&E COMMERCIAL RATE', '$0.284/kWh', '+7.9% YoY', 'down'],
  ['DELIVERY TAKE RATE (BLENDED)', '23.8%', 'unch', 'down'],
  ['TOAST SYNC', 'LIVE', '3 min ago', 'up'],
  ['R365 NIGHTLY SYNC', 'OK', '02:41 AM', 'up'],
  ['OPEN WORK ORDERS', '14', '-3', 'up'],
  ['FED FUNDS', '3.75–4.00%', 'hold', 'up'],
  ['PRIME RATE', '6.75%', 'unch', 'up'],
  ['UST 10-YR', '4.12%', '+1 bp', 'up'],
  ['UNEMPLOYMENT', '4.1%', '+0.1 pt', 'down']
];

var MARQUEE = [
  ['1100 GROUP', 'Eight restaurants, four brands, one connected operating system'],
  ['CA LABOR', 'Meal-break premium exposure is tracked per shift — see Labor & Scheduling'],
  ['COMMODITY', 'Beef composite up 11.5% year over year; menu price moves lag by roughly two periods'],
  ['DELIVERY', 'Blended marketplace take rate holding at 23.8% — first-party mix shift is the lever'],
  ['NRA', 'Full-service traffic remains slightly negative industry-wide while check average carries growth'],
  ['1100 GROUP', 'Period close runs on a 13-period calendar — every period is four comparable weeks']
];

function renderTopbar(opts) {
  opts = opts || {};
  var target = document.getElementById('topbar');
  if (!target) return;
  if (!isSignedIn()) { renderSignIn(); target.outerHTML = ''; return; }

  var subtitle = opts.subtitle || 'Operating System';
  var path = _norm(window.location.pathname);
  var activeGroupId = _activeGroup(path);
  var me = currentPersona();

  var groups = NAV_GROUPS.filter(function (g) { return !g.perm || can(g.perm); });
  var activeGroup = null;
  groups.forEach(function (g) { if (g.id === activeGroupId) activeGroup = g; });

  function groupHtml(g) {
    var active = g.id === activeGroupId;
    var href = g.items.length === 0 ? g.href : g.items[0].href;
    if (g.items.length === 0) {
      return '<div class="nav-item"><a href="' + href + '" data-group="' + g.id + '" class="' +
        (active ? 'active' : '') + '">' + g.label + '</a></div>';
    }
    var dd = g.items.map(function (it) {
      var ia = path.indexOf(_norm(it.href)) === 0;
      return '<a href="' + it.href + '" class="nav-dropdown-item ' + (ia ? 'active' : '') + '">' +
        it.label + '</a>';
    }).join('');
    return '<div class="nav-item nav-item-with-dropdown">' +
      '<a href="' + href + '" data-group="' + g.id + '" class="' + (active ? 'active' : '') + '">' +
      g.label + ' <span class="nav-caret">▾</span></a>' +
      '<div class="nav-dropdown">' + dd + '</div></div>';
  }
  var groupLinks = groups.map(groupHtml).join('');

  var subBar;
  if (activeGroup && activeGroup.items.length > 1) {
    var subItems = activeGroup.items.map(function (it) {
      var ia = path.indexOf(_norm(it.href)) === 0;
      return '<a href="' + it.href + '" class="section-subnav-item ' + (ia ? 'active' : '') + '">' +
        it.label + '</a>';
    }).join('');
    subBar = '<nav class="section-subnav" id="section-subnav" aria-label="' + activeGroup.label + ' sub-navigation">' +
      '<div class="section-subnav-inner"><span class="section-subnav-label">' + activeGroup.label + '</span>' +
      '<div class="section-subnav-items">' + subItems + '</div></div></nav>';
  } else {
    subBar = '<div class="section-subnav section-subnav--empty" id="section-subnav" aria-hidden="true">' +
      '<div class="section-subnav-inner"><span class="section-subnav-label">&nbsp;</span>' +
      '<div class="section-subnav-items"><span class="section-subnav-item">&nbsp;</span></div></div></div>';
  }

  var tickerHtml = TICKER.map(function (t) {
    return '<span class="ticker-item"><span class="ticker-label">' + t[0] + '</span>' +
      '<span class="ticker-value">' + t[1] + '</span>' +
      '<span class="ticker-change ' + t[3] + '">' + t[2] + '</span></span>';
  }).join('<span class="ticker-sep">·</span>') + '<span class="ticker-sep">·</span>';

  var marqueeItems = MARQUEE.map(function (m) {
    return '<span class="news-marquee-item"><span class="news-marquee-source">' + m[0] + '</span>' +
      '<span class="news-marquee-text">' + m[1] + '</span>' +
      '<span class="news-marquee-sep">—</span></span>';
  }).join('');

  var initials = me.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();

  target.outerHTML =
    '<div class="news-marquee" id="news-marquee"><div class="news-marquee-track">' +
      marqueeItems + marqueeItems + '</div></div>' +
    '<div class="market-ticker" id="market-ticker"><div class="ticker-track">' +
      tickerHtml + tickerHtml + '</div></div>' +
    '<div class="portal-topbar">' +
      '<a class="brand" href="/hospitality/" style="cursor:pointer;text-decoration:none">' +
        '<img src="/hospitality/assets/brand/1100-mark.svg" alt="' + esc(RG.COMPANY.name) + '" class="rg-logo">' +
        '<div class="rg-brand-text"><div class="rg-name">' + esc(RG.COMPANY.name) + '</div>' +
        '<div class="rg-sub">' + esc(subtitle) + '</div></div></a>' +
      '<nav class="nav nav-desktop">' + groupLinks + '</nav>' +
      '<div class="portal-topbar-right">' +
        '<button class="nav-icon-btn theme-toggle" id="theme-toggle" title="Toggle light / dark mode" aria-label="Toggle theme">' +
          '<svg class="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
          '<svg class="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' +
        '</button>' +
        '<div class="nav-item nav-item-with-dropdown nav-user-btn" id="nav-user-btn" title="Account &amp; role">' +
          '<a href="#" class="nav-icon-btn nav-user-trigger" aria-label="Account" onclick="event.preventDefault()">' +
            '<span class="nav-user-avatar">' + esc(initials) + '</span>' +
            '<span class="nav-user-label">' + esc(me.name.split(' ')[0]) + '</span>' +
            '<span class="nav-caret">▾</span></a>' +
          '<div class="nav-dropdown nav-dropdown-right">' +
            '<div class="nav-user-card">' +
              '<div class="nav-user-card-title">' + esc(me.name) + ' <span class="nav-user-badge">DEMO</span></div>' +
              '<div class="nav-user-card-sub">' + esc(me.title) + '</div>' +
              '<div class="nav-user-card-meta">' + esc(roleSummary(me).toUpperCase()) + '</div>' +
            '</div>' +
            '<div class="nav-user-card" style="padding-top:6px">' +
              '<div class="nav-user-card-meta" style="margin-bottom:4px">SWITCH USER (DEMO)</div>' +
              RG.PEOPLE.map(function (p) {
                return '<a href="#" class="nav-dropdown-item" style="padding:6px 0;' +
                  (p.id === me.id ? 'color:var(--color-blue);font-weight:700' : '') +
                  '" onclick="event.preventDefault();setRole(\'' + p.id + '\')">' +
                  (p.id === me.id ? '● ' : '○ ') + esc(p.name) + ' — ' + esc(p.title) + '</a>';
              }).join('') +
            '</div>' +
            '<div class="nav-dropdown-divider"></div>' +
            '<a href="#" class="nav-dropdown-item" onclick="event.preventDefault();signOutUser()">Sign out</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<button class="nav-toggle" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav-menu">' +
      '<span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span></button>' +
    '<nav class="nav nav-mobile" id="nav-menu" aria-hidden="true">' + groups.map(groupHtml).join('') + '</nav>' +
    '<div class="nav-scrim" id="nav-scrim" hidden></div>' + subBar;

  document.body.classList.remove('has-sidenav', 'has-sidenav-collapsed');

  if (!document.querySelector('.demo-watermark')) {
    var wm = document.createElement('div');
    wm.className = 'demo-watermark';
    wm.textContent = 'Demo environment · fictional data';
    document.body.appendChild(wm);
  }

  _wireMobileNav();
  _wireThemeToggle();

  /* match ticker scroll speed (px/s) to the marquee above it */
  (function sync(tries) {
    var mt = document.querySelector('.news-marquee-track');
    var tt = document.querySelector('.ticker-track');
    if (!mt || !tt) return;
    if ((!mt.scrollWidth || !tt.scrollWidth) && tries < 40) {
      return requestAnimationFrame(function () { sync(tries + 1); });
    }
    if (mt.scrollWidth && tt.scrollWidth) {
      tt.style.animationDuration = (37 * tt.scrollWidth / mt.scrollWidth).toFixed(1) + 's';
    }
  })(0);
}

function _wireMobileNav() {
  var toggle = document.getElementById('nav-toggle');
  var menu = document.getElementById('nav-menu');
  var scrim = document.getElementById('nav-scrim');
  if (!toggle || !menu) return;
  function close() {
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (scrim) scrim.hidden = true;
  }
  function open() {
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    if (scrim) scrim.hidden = false;
  }
  toggle.addEventListener('click', function () {
    document.body.classList.contains('nav-open') ? close() : open();
  });
  if (scrim) scrim.addEventListener('click', close);
  $$('.nav-item-with-dropdown > a', menu).forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (window.matchMedia('(max-width: 900px)').matches) {
        var item = a.parentElement;
        if (!item.classList.contains('open')) {
          e.preventDefault();
          $$('.nav-item-with-dropdown.open', menu).forEach(function (o) { o.classList.remove('open'); });
          item.classList.add('open');
        }
      }
    });
  });
  window.addEventListener('resize', function () {
    if (!window.matchMedia('(max-width: 900px)').matches) close();
  });
}

function _wireThemeToggle() {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('rgos-theme', theme); } catch (e) {}
    var moon = btn.querySelector('.theme-icon-moon'), sun = btn.querySelector('.theme-icon-sun');
    if (theme === 'light') { if (moon) moon.style.display = 'none'; if (sun) sun.style.display = ''; }
    else { if (moon) moon.style.display = ''; if (sun) sun.style.display = 'none'; }
  }
  apply(document.documentElement.getAttribute('data-theme') || 'light');
  btn.addEventListener('click', function () {
    apply(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  });
}

(function loadStickyHscroll() {
  if (window.__rgStickyLoaded) return;
  window.__rgStickyLoaded = true;
  var s = document.createElement('script');
  s.src = '/hospitality/js/sticky-hscroll.js';
  s.async = true;
  document.head.appendChild(s);
})();

window.RGNav = { renderTopbar: renderTopbar, NAV_GROUPS: NAV_GROUPS };
