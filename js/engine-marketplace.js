/* ============================================================
   Restaurant OS — off-premise marketplace engine

   The delivery channel is not one thing. Each marketplace charges a
   different commission, funds promotions differently, issues error
   charges at a different rate, and attracts a different basket. Rolling
   them into a single "delivery" line hides exactly the decision an
   operator has to make: which of these is actually worth serving.

   The split is EXACT — marketplace gross sums to the delivery channel
   gross already produced by the sales engine, so nothing here can drift
   away from the P&L. Commission then feeds engine-finance, so the
   delivery-fee line IS the sum of the real per-marketplace rates rather
   than a flat blended assumption.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand, CAL = RG.CAL;

  /* commission / promo / error rates are the levers operators negotiate;
     they are the reason two restaurants with identical delivery revenue
     can have very different delivery profit */
  var MARKETPLACES = [
    { id: 'doordash', name: 'DoorDash', kind: 'marketplace', color: '#eb6834',
      share: 0.34, drift: 0.030, commission: 0.270, promo: [0.010, 0.042],
      errors: [0.006, 0.021], refunds: [0.003, 0.012], aov: 46,
      note: 'Largest share and the highest headline rate. Marketplace tier, not Drive.' },
    { id: 'ubereats', name: 'Uber Eats', kind: 'marketplace', color: '#1baf7a',
      share: 0.24, drift: 0.018, commission: 0.255, promo: [0.008, 0.038],
      errors: [0.005, 0.019], refunds: [0.003, 0.011], aov: 44,
      note: 'Absorbed Postmates; a single storefront now covers both.' },
    { id: 'grubhub', name: 'Grubhub / Seamless', kind: 'marketplace', color: '#eda100',
      share: 0.10, drift: -0.022, commission: 0.235, promo: [0.006, 0.030],
      errors: [0.004, 0.016], refunds: [0.002, 0.009], aov: 42,
      note: 'Losing share nationally; still meaningful on corporate accounts.' },
    { id: 'caviar', name: 'Caviar', kind: 'marketplace', color: '#e87ba4',
      share: 0.05, drift: -0.006, commission: 0.300, promo: [0.004, 0.020],
      errors: [0.003, 0.012], refunds: [0.002, 0.008], aov: 62,
      note: 'DoorDash-owned, premium positioning. Highest rate, highest basket.' },
    { id: 'ezcater', name: 'ezCater', kind: 'catering', color: '#9085e9',
      share: 0.05, drift: 0.020, commission: 0.150, promo: [0.000, 0.008],
      errors: [0.001, 0.006], refunds: [0.001, 0.005], aov: 285,
      note: 'Catering marketplace. Large baskets, far lower take rate.' },
    { id: 'chownow', name: 'ChowNow', kind: 'first-party', color: '#2766d6',
      share: 0.06, drift: 0.014, commission: 0.035, promo: [0.000, 0.010],
      errors: [0.001, 0.006], refunds: [0.001, 0.006], aov: 48,
      note: 'White-label ordering on a flat subscription — commission is nominal.' },
    { id: 'direct', name: 'First-party (own site & app)', kind: 'first-party', color: '#151d30',
      share: 0.12, drift: 0.036, commission: 0.031, promo: [0.000, 0.014],
      errors: [0.001, 0.005], refunds: [0.001, 0.006], aov: 51,
      note: 'Payment processing only. Every point of mix moved here is margin.' },
    { id: 'slice', name: 'Slice', kind: 'marketplace', color: '#d95926',
      share: 0.04, drift: 0.004, commission: 0.150, promo: [0.002, 0.014],
      errors: [0.002, 0.010], refunds: [0.001, 0.007], aov: 38, brands: ['star'],
      note: 'Pizza-only marketplace with a flat per-order model.' }
  ];

  /* the marketplaces a given restaurant actually lists on */
  var listFor = R.memo(function (unitId) {
    var u = RG.unitById[unitId];
    return MARKETPLACES.filter(function (m) {
      if (m.brands && m.brands.indexOf(u.brand) < 0) return false;
      /* ezCater only where the unit does meaningful catering */
      if (m.id === 'ezcater' && (u.chan.catering || 0) < 0.02) return false;
      return true;
    });
  });
  RG.marketplacesFor = listFor;

  /* Shares drift over the window: first-party and DoorDash gain,
     Grubhub loses. Normalised so the split is always exhaustive. */
  function shares(unitId, iso) {
    var list = listFor(unitId);
    var years = (CAL.toTs(iso) - CAL.toTs(CAL.ANCHOR)) / (365.25 * 86400000);
    var raw = list.map(function (m) {
      var s = m.share * (1 + m.drift * years * 3);
      /* a stable per-unit preference — one restaurant leans DoorDash,
         another has a stronger direct following */
      s *= 1 + 0.34 * (R.u('mkt:' + unitId + ':' + m.id) - 0.5);
      return Math.max(0.005, s);
    });
    var tot = raw.reduce(function (a, b) { return a + b; }, 0);
    return raw.map(function (v) { return v / tot; });
  }

  /* ---- one unit-day, split exactly ---- */
  var dayMarketplace = R.memo(function (unitId, iso) {
    var s = RG.daySales(unitId, iso);
    if (s.closed) return { rows: [], gross: 0 };
    var gross = s.byChannel.delivery || 0;
    var list = listFor(unitId);
    if (!gross || !list.length) return { rows: [], gross: 0 };

    var w = shares(unitId, iso).map(function (v, i) {
      return v * R.noise('mkd:' + unitId + iso + list[i].id, 0.16);
    });
    var amts = R.allocate(gross, w);

    var rows = list.map(function (m, i) {
      var g = amts[i];
      if (g <= 0) return null;
      var seed = unitId + iso + m.id;
      var commission = R.cents(g * m.commission);
      var promo = R.cents(g * R.between('pr:' + seed, m.promo[0], m.promo[1]));
      var errors = R.cents(g * R.between('er:' + seed, m.errors[0], m.errors[1]));
      var refunds = R.cents(g * R.between('rf:' + seed, m.refunds[0], m.refunds[1]));
      return {
        id: m.id, name: m.name, kind: m.kind, color: m.color, unit: unitId, iso: iso,
        gross: g,
        orders: Math.max(1, Math.round(g / (m.aov * R.noise('ao:' + seed, 0.10)))),
        commission: commission, promo: promo, errors: errors, refunds: refunds,
        net: R.cents(g - commission - promo - errors - refunds),
        prepMin: Math.round(R.between('pm:' + seed, 11, 26)),
        courierWaitMin: Math.round(R.between('cw:' + seed, 2, 14)),
        rating: Math.round(R.between('rt:' + seed, 4.1, 4.9) * 100) / 100
      };
    }).filter(Boolean);

    return { rows: rows, gross: gross };
  });
  RG.dayMarketplace = dayMarketplace;

  /* ---- rolled to a period ---- */
  RG.periodMarketplace = R.memo(function (unitId, periodKey) {
    var acc = {}, total = { gross: 0, commission: 0, promo: 0, errors: 0, refunds: 0, net: 0, orders: 0 };
    CAL.daysIn(periodKey).forEach(function (d) {
      dayMarketplace(unitId, d.iso).rows.forEach(function (r) {
        var a = acc[r.id] || (acc[r.id] = {
          id: r.id, name: r.name, kind: r.kind, color: r.color,
          gross: 0, commission: 0, promo: 0, errors: 0, refunds: 0, net: 0, orders: 0,
          prepSum: 0, waitSum: 0, ratingSum: 0, days: 0
        });
        ['gross', 'commission', 'promo', 'errors', 'refunds', 'net'].forEach(function (k) {
          a[k] = R.cents(a[k] + r[k]);
        });
        a.orders += r.orders;
        a.prepSum += r.prepMin; a.waitSum += r.courierWaitMin; a.ratingSum += r.rating; a.days++;
        ['gross', 'commission', 'promo', 'errors', 'refunds', 'net'].forEach(function (k) {
          total[k] = R.cents(total[k] + r[k]);
        });
        total.orders += r.orders;
      });
    });
    var rows = Object.keys(acc).map(function (k) {
      var a = acc[k];
      a.effectiveRate = a.gross ? (a.gross - a.net) / a.gross : 0;
      a.aov = a.orders ? R.cents(a.gross / a.orders) : 0;
      a.prepAvg = a.days ? Math.round(a.prepSum / a.days) : 0;
      a.waitAvg = a.days ? Math.round(a.waitSum / a.days) : 0;
      a.rating = a.days ? Math.round((a.ratingSum / a.days) * 100) / 100 : 0;
      a.share = total.gross ? a.gross / total.gross : 0;
      return a;
    }).sort(function (x, y) { return y.gross - x.gross; });
    total.effectiveRate = total.gross ? (total.gross - total.net) / total.gross : 0;
    total.aov = total.orders ? R.cents(total.gross / total.orders) : 0;
    return { unit: unitId, period: periodKey, rows: rows, total: total };
  });

  /* the number engine-finance charges to the P&L: the SUM of the real
     per-marketplace commissions, not a flat blended guess */
  RG.periodDeliveryFees = R.memo(function (unitId, periodKey) {
    return RG.periodMarketplace(unitId, periodKey).total.commission;
  });

  RG.MARKETPLACES = MARKETPLACES;
})(typeof window !== 'undefined' ? window : globalThis);
