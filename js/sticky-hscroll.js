// Blackwater Partners — Sticky horizontal scrollbar (viewport-bottom).
//
// When a wide table or chart card overflows horizontally, the user normally has
// to scroll the page all the way down to find the native scrollbar. This module
// renders a thin overlay scrollbar pinned to the bottom of the viewport that
// mirrors the active wide container's scroll position bidirectionally.
//
// Targets: any element matching `.table-wrap`, `.msa-table-wrap`, `.chart-card`
// (the standard Blackwater scroll containers across the portal).
//
// Auto-hides when no qualifying container is in view, or when the container's
// own native scrollbar is already on screen (no overlay needed there).

(function () {
  'use strict';

  const SELECTOR = '.table-wrap, .msa-table-wrap, .chart-card';
  const OVERLAY_HEIGHT = 14;
  const Z_INDEX = 9000;
  // If host's own bottom is within this many px of viewport bottom, suppress
  // the overlay (native scrollbar is already showing).
  const NATIVE_BAR_TOLERANCE = 30;

  let overlay = null;
  let inner = null;
  let activeHost = null;
  let suppressSync = false;

  function makeOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'cfp-sticky-hscroll';
    overlay.setAttribute('aria-hidden', 'true');
    Object.assign(overlay.style, {
      position: 'fixed', bottom: '0', left: '0', width: '0px',
      height: OVERLAY_HEIGHT + 'px',
      overflowX: 'auto', overflowY: 'hidden',
      zIndex: String(Z_INDEX), display: 'none',
      background: 'rgba(255,255,255,0.92)',
      borderTop: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
      pointerEvents: 'auto',
    });
    inner = document.createElement('div');
    inner.style.height = '1px';
    inner.style.width = '0px';
    overlay.appendChild(inner);
    document.body.appendChild(overlay);

    overlay.addEventListener('scroll', () => {
      if (!activeHost || suppressSync) return;
      suppressSync = true;
      activeHost.scrollLeft = overlay.scrollLeft;
      requestAnimationFrame(() => { suppressSync = false; });
    });
  }

  function syncFrom(host) {
    inner.style.width = host.scrollWidth + 'px';
    const r = host.getBoundingClientRect();
    overlay.style.left = Math.max(0, r.left) + 'px';
    overlay.style.width = Math.min(window.innerWidth, r.right) - Math.max(0, r.left) + 'px';
    if (overlay.scrollLeft !== host.scrollLeft) {
      suppressSync = true;
      overlay.scrollLeft = host.scrollLeft;
      requestAnimationFrame(() => { suppressSync = false; });
    }
  }

  function findActive() {
    const candidates = document.querySelectorAll(SELECTOR);
    const vh = window.innerHeight;
    let best = null;
    let bestArea = 0;
    for (const el of candidates) {
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh) continue;
      // If the host's own bottom (and thus its own scrollbar) is already
      // visible above where our overlay would sit, don't overlay it.
      if (r.bottom <= vh - NATIVE_BAR_TOLERANCE) continue;
      const visTop = Math.max(0, r.top);
      const visBot = Math.min(vh, r.bottom);
      const visH = visBot - visTop;
      if (visH <= 0) continue;
      const area = visH * Math.min(window.innerWidth, r.right) - Math.max(0, r.left);
      if (area > bestArea) { bestArea = area; best = el; }
    }
    return best;
  }

  function update() {
    if (!overlay) makeOverlay();
    const host = findActive();
    if (!host) {
      activeHost = null;
      overlay.style.display = 'none';
      return;
    }
    activeHost = host;
    overlay.style.display = 'block';
    syncFrom(host);
  }

  function bindHost(el) {
    if (el.__cfpStickyBound) return;
    el.__cfpStickyBound = true;
    el.addEventListener('scroll', () => {
      if (el !== activeHost || suppressSync) return;
      suppressSync = true;
      overlay.scrollLeft = el.scrollLeft;
      requestAnimationFrame(() => { suppressSync = false; });
    }, { passive: true });
  }

  function bindAll() {
    document.querySelectorAll(SELECTOR).forEach(bindHost);
  }

  function init() {
    if (!document.body) return setTimeout(init, 50);
    makeOverlay();
    bindAll();
    update();

    let raf = 0;
    const sched = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; update(); });
    };
    window.addEventListener('scroll', sched, { passive: true });
    window.addEventListener('resize', sched, { passive: true });

    // Re-bind when DOM mutates (tables rendered async, drawers open, etc.)
    const mo = new MutationObserver(() => { bindAll(); sched(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
