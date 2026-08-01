/* ============================================================
   Restaurant OS — guest engine
   Reviews, sentiment, reservations and loyalty.

   Reviews are NOT random. Rating is driven by the unit's actual
   operating conditions that period — labor per cover, food variance,
   comp rate — so "the Friday service complaints" genuinely trace back
   to the shifts that caused them. That join is the Brain's showpiece.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand, CAL = RG.CAL;

  var THEMES = ['Food quality', 'Service speed', 'Staff friendliness', 'Value', 'Ambience',
                'Cleanliness', 'Wait time', 'Order accuracy', 'Noise'];
  var PLATFORMS = [
    { id: 'google', label: 'Google', share: 0.52, src: 'Google' },
    { id: 'yelp', label: 'Yelp', share: 0.28, src: 'Yelp' },
    { id: 'opentable', label: 'OpenTable', share: 0.11, src: 'OpenTable' },
    { id: 'survey', label: 'Post-visit survey', share: 0.09, src: 'Google' }
  ];

  var POS_TEXT = {
    'Food quality': ['Everything came out exactly right.', 'Best in the neighbourhood, consistently.'],
    'Service speed': ['In and out on a lunch hour without feeling rushed.', 'Food hit the table fast.'],
    'Staff friendliness': ['The team here actually seems to like working here.', 'Warm, unpretentious service.'],
    'Value': ['Portions justify the price.', 'Fair for what you get in this area.'],
    'Ambience': ['Great room, easy to hold a conversation.', 'Patio is the best seat in the area.'],
    'Cleanliness': ['Spotless, right down to the restrooms.', 'Clean and well kept.'],
    'Wait time': ['Quoted 20 minutes and it was 20 minutes.', 'Walked right in on a weeknight.'],
    'Order accuracy': ['Order was exactly right including the modifications.', 'Nothing missing, nothing wrong.'],
    'Noise': ['Lively without shouting.', 'Comfortable even when full.']
  };
  var NEG_TEXT = {
    'Food quality': ['Came out lukewarm and under-seasoned.', 'Not the kitchen I remember.'],
    'Service speed': ['Forty minutes between ordering and food arriving.', 'One server covering the whole room.'],
    'Staff friendliness': ['Felt like an inconvenience the whole meal.', 'Nobody checked on us once.'],
    'Value': ['Prices moved, portions did not.', 'Hard to justify at this price now.'],
    'Ambience': ['Table wobbled the entire meal.', 'Lighting and heat were both off.'],
    'Cleanliness': ['Restroom needed attention.', 'Table was still sticky when we sat.'],
    'Wait time': ['Quoted 15 minutes, waited 50.', 'Waitlist was not being managed.'],
    'Order accuracy': ['Two items missing from the delivery order.', 'Sent out the wrong protein twice.'],
    'Noise': ['Could not hear across a four-top.', 'Music well past conversational.']
  };

  var FIRST = ['Alex','Jordan','Sam','Casey','Riley','Morgan','Avery','Quinn','Reese','Rowan',
               'Emerson','Hayden','Skyler','Devon','Marlowe','Blair','Ellis','Finley'];
  var LASTI = ['B.','C.','D.','F.','G.','H.','K.','L.','M.','N.','P.','R.','S.','T.','V.','W.'];

  /* the operating conditions that actually move a rating */
  function conditions(unitId, periodKey) {
    var pl = RG.periodPL(unitId, periodKey);
    var s = RG.periodSales(unitId, periodKey);
    var cogs = RG.periodCogs(unitId, periodKey);
    var laborPerCover = s.covers ? pl.laborHours / s.covers : 0;
    return {
      laborPerCover: laborPerCover,
      compRate: pl.grossSales ? pl.comps / pl.grossSales : 0,
      variancePct: cogs.variancePct,
      deliveryShare: s.gross ? (s.byChannel.delivery || 0) / s.gross : 0,
      splh: pl.splh
    };
  }

  /* Expected rating: starts from a brand baseline and is pushed by the
     unit's real conditions. Understaffed periods produce service and wait
     complaints; high variance produces food-quality complaints. */
  var periodGuest = R.memo(function (unitId, periodKey) {
    var u = RG.unitById[unitId];
    var c = conditions(unitId, periodKey);
    var base = { camino: 4.44, star: 4.31, catos: 4.18, bnn: 4.24 }[u.brand];

    var laborPenalty = Math.max(0, (0.115 - c.laborPerCover)) * 5.2;   /* thin coverage hurts */
    var qualityPenalty = Math.max(0, c.variancePct - 0.03) * 7.5;
    var deliveryPenalty = c.deliveryShare * 0.42;                       /* off-premise rates lower */
    var expected = base - laborPenalty - qualityPenalty - deliveryPenalty
      + R.between('gq:' + unitId + periodKey, -0.06, 0.06);
    expected = Math.max(2.6, Math.min(4.9, expected));

    var s = RG.periodSales(unitId, periodKey);
    var volume = Math.max(6, Math.round(s.covers / 78 * R.between('gv:' + unitId + periodKey, 0.8, 1.25)));

    /* theme weights follow the same conditions, so the sentiment
       breakdown and the operating data always tell one story */
    var weights = {
      'Food quality':      1 + qualityPenalty * 2.4,
      'Service speed':     1 + laborPenalty * 2.8,
      'Staff friendliness': 1 + laborPenalty * 1.2,
      'Value':             1 + (u.brand === 'camino' ? 0.5 : 0.15),
      'Ambience':          0.8,
      'Cleanliness':       0.6,
      'Wait time':         1 + laborPenalty * 1.9,
      'Order accuracy':    1 + c.deliveryShare * 2.6,
      'Noise':             0.5
    };

    var days = CAL.daysIn(periodKey);
    var reviews = [];
    for (var i = 0; i < volume; i++) {
      var seed = 'rev:' + unitId + periodKey + i;
      var day = days[R.hash(seed + 'd') % days.length];
      var plat = PLATFORMS[0];
      var x = R.u(seed + 'p'), acc = 0;
      for (var k = 0; k < PLATFORMS.length; k++) {
        acc += PLATFORMS[k].share;
        if (x <= acc) { plat = PLATFORMS[k]; break; }
      }
      /* rating drawn around the expected value, integer 1-5 */
      var raw = expected + R.gauss(seed + 'r') * 0.72;
      var stars = Math.max(1, Math.min(5, Math.round(raw)));
      var neg = stars <= 3;
      var themeNames = Object.keys(weights);
      var tw = themeNames.map(function (t) {
        return neg ? weights[t] : (2.2 - Math.min(1.9, weights[t]));
      });
      var ti = 0, y = R.u(seed + 't') * tw.reduce(function (a, b) { return a + b; }, 0);
      for (var j = 0; j < tw.length; j++) { y -= tw[j]; if (y <= 0) { ti = j; break; } }
      var theme = themeNames[ti];
      var bank = neg ? NEG_TEXT[theme] : POS_TEXT[theme];
      var responded = R.chance(seed + 'resp', stars <= 3 ? 0.72 : 0.28);
      reviews.push({
        id: unitId + '-' + periodKey + '-r' + i,
        unit: unitId, date: day.iso, dow: day.dowName,
        platform: plat.id, platformLabel: plat.label, source: plat.src,
        stars: stars, theme: theme, negative: neg,
        text: bank[R.hash(seed + 'x') % bank.length],
        author: FIRST[R.hash(seed + 'f') % FIRST.length] + ' ' + LASTI[R.hash(seed + 'l') % LASTI.length],
        responded: responded,
        responseHours: responded ? Math.round(R.between(seed + 'rh', 2, 70)) : null,
        /* the join: which shift produced this experience */
        daypart: R.u(seed + 'dp') < 0.62 ? 'dinner' : (R.u(seed + 'dp2') < 0.5 ? 'lunch' : 'late')
      });
    }
    reviews.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    var avg = reviews.reduce(function (s2, r) { return s2 + r.stars; }, 0) / (reviews.length || 1);
    var byTheme = {};
    reviews.forEach(function (r) {
      var t = byTheme[r.theme] || (byTheme[r.theme] = { theme: r.theme, n: 0, neg: 0, stars: 0 });
      t.n++; t.stars += r.stars; if (r.negative) t.neg++;
    });
    var themes = Object.keys(byTheme).map(function (k) {
      var t = byTheme[k];
      t.avg = t.stars / t.n;
      t.negRate = t.neg / t.n;
      return t;
    }).sort(function (a, b) { return b.neg - a.neg; });

    var responded = reviews.filter(function (r) { return r.responded; });
    return {
      unit: unitId, period: periodKey,
      reviews: reviews, count: reviews.length,
      rating: Math.round(avg * 100) / 100,
      negCount: reviews.filter(function (r) { return r.negative; }).length,
      themes: themes,
      responseRate: reviews.length ? responded.length / reviews.length : 0,
      avgResponseHours: responded.length
        ? Math.round(responded.reduce(function (s2, r) { return s2 + r.responseHours; }, 0) / responded.length)
        : null,
      conditions: c
    };
  });
  RG.periodGuest = periodGuest;

  /* ---- reservations & covers ---- */
  RG.periodReservations = R.memo(function (unitId, periodKey) {
    var u = RG.unitById[unitId];
    var takesRes = ['bc-wc', 'lstar-valencia', 'catos'].indexOf(unitId) >= 0;
    var s = RG.periodSales(unitId, periodKey);
    var days = CAL.daysIn(periodKey);
    var booked = 0, walkIn = 0, noShow = 0, cancelled = 0, rows = [];
    days.forEach(function (d) {
      var ds = RG.daySales(unitId, d.iso);
      if (ds.closed) return;
      var resShare = takesRes ? R.between('rs:' + unitId + d.iso, 0.44, 0.62) : 0;
      var b = Math.round(ds.covers * resShare);
      var ns = Math.round(b * R.between('ns:' + unitId + d.iso, 0.03, 0.085));
      var cx = Math.round(b * R.between('cx:' + unitId + d.iso, 0.05, 0.12));
      booked += b; noShow += ns; cancelled += cx;
      walkIn += ds.covers - b;
      rows.push({
        date: d.iso, dow: d.dowName, covers: ds.covers, booked: b, walkIn: ds.covers - b,
        noShow: ns, cancelled: cx,
        quotedWait: Math.round(R.between('qw:' + unitId + d.iso, 5, 45)),
        actualWait: Math.round(R.between('aw:' + unitId + d.iso, 5, 58)),
        turns: u.seats ? Math.round((ds.covers / u.seats) * 100) / 100 : 0,
        revpash: u.seats ? R.cents((ds.byChannel.dinein || 0) / (u.seats * 6)) : 0
      });
    });
    var lostCovers = noShow;
    return {
      unit: unitId, period: periodKey, takesRes: takesRes,
      booked: booked, walkIn: walkIn, noShow: noShow, cancelled: cancelled,
      noShowRate: booked ? noShow / booked : 0,
      lostRevenue: R.cents(lostCovers * RG.ppaOn(u, CAL.periodByKey[periodKey].end)),
      rows: rows,
      avgTurns: rows.length ? rows.reduce(function (a, r) { return a + r.turns; }, 0) / rows.length : 0,
      revpash: rows.length ? R.cents(rows.reduce(function (a, r) { return a + r.revpash; }, 0) / rows.length) : 0
    };
  });

  /* ---- marketing & loyalty ----
     Campaign spend is generated to foot EXACTLY to the P&L marketing line. */
  var CAMPAIGNS = [
    ['Local search & maps', 'Google', 'always-on'],
    ['Paid social — brand', 'Meta', 'always-on'],
    ['Email — house list', 'Klaviyo', 'always-on'],
    ['SMS — loyalty offers', 'Attentive', 'burst'],
    ['Neighbourhood print & events', 'Local', 'burst'],
    ['Delivery marketplace promo', 'Deliverect', 'always-on']
  ];
  RG.periodMarketing = R.memo(function (unitId, periodKey) {
    var pl = RG.periodPL(unitId, periodKey);
    var total = pl.marketing;
    var weights = CAMPAIGNS.map(function (c, i) {
      return (c[2] === 'always-on' ? 1.4 : 0.6) * R.between('mkw:' + unitId + periodKey + i, 0.6, 1.5);
    });
    var amts = R.allocate(total, weights);
    var s = RG.periodSales(unitId, periodKey);
    var rows = CAMPAIGNS.map(function (c, i) {
      var spend = amts[i];
      var roas = R.between('roas:' + unitId + periodKey + i, 1.6, 6.4);
      var attributed = R.cents(spend * roas);
      return {
        name: c[0], channel: c[1], cadence: c[2], spend: spend,
        attributedSales: attributed, roas: roas,
        covers: Math.round(attributed / Math.max(1, s.avgCheck)),
        impressions: Math.round(spend * R.between('imp:' + unitId + periodKey + i, 45, 210))
      };
    });
    var members = Math.round(RG.unitById[unitId].seats * R.between('loy:' + unitId, 22, 46));
    return {
      unit: unitId, period: periodKey, total: total, rows: rows,
      attributed: rows.reduce(function (a, r) { return R.cents(a + r.attributedSales); }, 0),
      loyalty: {
        members: members,
        active: Math.round(members * R.between('loya:' + unitId + periodKey, 0.28, 0.44)),
        visitLift: R.between('loyv:' + unitId, 0.18, 0.42),
        spendLift: R.between('loys:' + unitId, 0.08, 0.22),
        redemptions: Math.round(members * R.between('loyr:' + unitId + periodKey, 0.06, 0.14)),
        liability: R.cents(members * R.between('gc:' + unitId, 3.2, 11.5))
      }
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
