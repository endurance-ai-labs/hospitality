/* ============================================================
   Restaurant OS — sales & PMIX engine

   THE TIE-OUT RULE THIS FILE ENFORCES:
   Net sales are never generated directly. A demand signal produces
   INTEGER item quantities; gross sales are then the sum of those
   quantities times that day's menu price. Every downstream number —
   the exec dashboard, the P&L revenue line, the menu page, the bank
   deposit — re-aggregates the same integers, so they cannot diverge.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand, CAL = RG.CAL;

  /* ---- day-of-week shape by brand (index 0 = Monday) ---- */
  var DOW_SHAPE = {
    camino: [0.00, 0.72, 0.84, 1.02, 1.44, 1.58, 0.96],   /* closed Mondays */
    star:   [0.78, 0.82, 0.88, 1.00, 1.34, 1.46, 1.16],
    catos:  [0.86, 0.90, 0.94, 1.04, 1.32, 1.38, 1.06],
    bnn:    [0.82, 0.86, 0.92, 1.02, 1.36, 1.44, 1.12]
  };

  /* seasonal amplitude and phase (day-of-year of the annual peak) */
  var SEASON = {
    camino: { amp: 0.115, peak: 196 },   /* patio-led, summer peak */
    star:   { amp: 0.095, peak: 336 },   /* deep dish peaks in winter */
    catos:  { amp: 0.085, peak: 208 },
    bnn:    { amp: 0.090, peak: 250 }
  };

  /* daypart mix by brand */
  var DAYPART_MIX = {
    camino: { lunch: 0.14, happy: 0.17, dinner: 0.51, late: 0.18 },
    star:   { lunch: 0.26, happy: 0.06, dinner: 0.54, late: 0.14 },
    catos:  { lunch: 0.21, happy: 0.19, dinner: 0.42, late: 0.18 },
    bnn:    { lunch: 0.22, happy: 0.18, dinner: 0.43, late: 0.17 }
  };

  /* average party size, for checks-from-covers */
  var PARTY = { camino: 2.3, star: 2.9, catos: 2.3, bnn: 2.4 };

  /* ---- weather: one deterministic series per region ----
     A wet Saturday in the East Bay hits every unit in that region at once,
     which is what makes the "was it us or was it the weather" question
     answerable instead of hand-waved. */
  var weatherOf = R.memo(function (region, iso) {
    var d = CAL.byIso[iso];
    var wetSeason = Math.cos((d.doy / 365) * 2 * Math.PI) * 0.5 + 0.5;  /* peaks in Jan */
    var rain = R.u('wx:' + region + ':' + iso) < (0.06 + wetSeason * 0.34);
    var heavy = rain && R.u('wxh:' + region + ':' + iso) < 0.28;
    var heat = R.u('wxt:' + region + ':' + iso) > 0.965 && d.doy > 150 && d.doy < 270;
    var f = 1;
    if (rain) f *= heavy ? 0.885 : 0.952;
    if (heat) f *= 1.06;
    return { rain: rain, heavy: heavy, heat: heat, f: f,
             label: heavy ? 'Heavy rain' : rain ? 'Rain' : heat ? 'Heat' : 'Clear' };
  });
  RG.weatherOf = weatherOf;

  /* ---- local events: a handful of seeded per-unit demand shocks ---- */
  function eventFactor(unit, day) {
    /* sports-driven weekend spikes at Ben 'N Nick's */
    if (unit.id === 'bnn' && day.dow >= 4 && R.chance('ev:' + unit.id + day.iso, 0.16)) return 1.14;
    /* street fairs / neighbourhood nights */
    if (R.chance('ev2:' + unit.id + day.iso, 0.012)) return 1.22;
    /* equipment outage or short-staffed close */
    if (R.chance('ev3:' + unit.id + day.iso, 0.008)) return 0.74;
    return 1;
  }

  /* ---- is the unit trading at all today? ---- */
  function isClosed(unit, day) {
    var hol = CAL.holidayOf(day.iso);
    if (hol && hol.f <= 0.12) return true;                 /* Christmas, Thanksgiving */
    if (unit.brand === 'camino' && day.dow === 0) return true;  /* dark Mondays */
    return false;
  }

  /* ---- the demand signal (a driver, NOT the reported number) ---- */
  function demand(unit, day) {
    if (isClosed(unit, day)) return 0;
    var s = SEASON[unit.brand], sh = DOW_SHAPE[unit.brand];
    var f = unit.base;
    f *= sh[day.dow];
    f *= 1 + s.amp * Math.cos(((day.doy - s.peak) / 365) * 2 * Math.PI);
    var years = (day.ts - CAL.toTs(CAL.ANCHOR)) / (365.25 * 86400000);
    f *= Math.pow(1 + unit.growth, years);
    f *= weatherOf(unit.region, day.iso).f;
    var hol = CAL.holidayOf(day.iso);
    if (hol) f *= hol.f;
    f *= eventFactor(unit, day);
    f *= R.noise('dem:' + unit.id + ':' + day.iso, 0.078);
    return Math.max(0, f);
  }
  RG.demand = demand;

  /* ---- channel mix on a date: delivery share drifts up over time ---- */
  function channelMix(unit, day) {
    var years = (day.ts - CAL.toTs(CAL.ANCHOR)) / (365.25 * 86400000);
    var d = unit.chan.delivery * (1 + 0.085 * years);
    var t = unit.chan.takeout * (1 + 0.02 * years);
    var c = unit.chan.catering;
    var din = Math.max(0.25, 1 - d - t - c);
    var sum = din + t + d + c;
    return { dinein: din / sum, takeout: t / sum, delivery: d / sum, catering: c / sum };
  }

  /* ---- PMIX for one unit-day ----
     Returns integer quantities per item per channel. This is the atom. */
  var dayPmix = R.memo(function (unitId, iso) {
    var unit = RG.unitById[unitId], day = CAL.byIso[iso];
    if (!unit || !day) return null;
    var target = demand(unit, day);
    if (target <= 0) {
      return { rows: [], gross: 0, byChannel: {}, byDaypart: {}, closed: true };
    }

    var menu = RG.menuFor(unit.brand);
    var mix = channelMix(unit, day);
    var dpMix = DAYPART_MIX[unit.brand];
    var priceOf = {};
    menu.forEach(function (m) { priceOf[m.id] = RG.menuPrice(m.id, iso); });

    var rows = [], byChannel = {}, byDaypart = {}, gross = 0;

    RG.CHANNELS.forEach(function (ch) {
      var chTarget = target * mix[ch.id];
      if (chTarget < 1) { byChannel[ch.id] = 0; return; }
      byChannel[ch.id] = 0;

      CAL.DAYPARTS.forEach(function (dp) {
        /* delivery and catering skew away from happy hour and late night */
        var dpShare = dpMix[dp.id];
        if (ch.id === 'delivery') dpShare *= (dp.id === 'happy' ? 0.25 : dp.id === 'late' ? 0.55 : 1.25);
        if (ch.id === 'catering') dpShare *= (dp.id === 'lunch' ? 2.2 : dp.id === 'dinner' ? 1.1 : 0.15);
        var slotTarget = chTarget * dpShare;
        if (slotTarget < 8) return;

        /* candidate items for this channel + daypart */
        var cands = [], weights = [];
        for (var i = 0; i < menu.length; i++) {
          var m = menu[i];
          if (m.dayparts.indexOf(dp.id) < 0) continue;
          var w = m.weight;
          /* alcohol does not travel; N/A beverages barely do */
          if (ch.id === 'delivery' || ch.id === 'catering') {
            if (m.bev) w *= (m.category === 'N/A Bev' ? 0.20 : 0);
            else w *= 1.15;
          }
          /* happy hour tilts hard toward bar and small plates */
          if (dp.id === 'happy') w *= m.bev ? 1.9 : (m.basePrice <= 17 ? 1.25 : 0.45);
          if (dp.id === 'late')  w *= m.bev ? 1.55 : 0.72;
          if (w <= 0) continue;
          /* per-unit, slowly-drifting taste so units are not clones */
          w *= 1 + 0.30 * (R.u('taste:' + unitId + ':' + m.id) - 0.5);
          w *= R.noise('mixn:' + unitId + ':' + iso + ':' + dp.id + ':' + m.id, 0.22);
          cands.push(m); weights.push(w);
        }
        if (!cands.length) return;

        /* convert a dollar target into integer covers-worth of items */
        var avgPrice = 0, tw = 0;
        for (var k = 0; k < cands.length; k++) { avgPrice += priceOf[cands[k].id] * weights[k]; tw += weights[k]; }
        avgPrice = avgPrice / (tw || 1);
        var units = Math.max(1, Math.round(slotTarget / Math.max(1, avgPrice)));
        var qtys = R.allocateInt(units, weights);

        for (var j = 0; j < cands.length; j++) {
          if (!qtys[j]) continue;
          var price = priceOf[cands[j].id];
          var ext = R.cents(qtys[j] * price);
          rows.push({
            item: cands[j].id, name: cands[j].name, cat: cands[j].category,
            channel: ch.id, daypart: dp.id, qty: qtys[j], price: price, ext: ext
          });
          gross = R.cents(gross + ext);
          byChannel[ch.id] = R.cents(byChannel[ch.id] + ext);
          byDaypart[dp.id] = R.cents((byDaypart[dp.id] || 0) + ext);
        }
      });
    });

    return { rows: rows, gross: gross, byChannel: byChannel, byDaypart: byDaypart, closed: false };
  });
  RG.dayPmix = dayPmix;

  /* ---- discounts, comps and voids ----
     Propensity varies by unit so the loss-prevention module has something
     real to find. One unit deliberately runs hot. */
  function adjustments(unit, day, gross) {
    if (!gross) return { discounts: 0, comps: 0, voids: 0, voidCount: 0 };
    var base = 0.021;
    if (unit.id === 'star-pdx') base = 0.049;               /* the outlier */
    if (unit.brand === 'catos') base = 0.028;
    var promoDay = (day.dow === 2 && unit.brand === 'catos') ? 0.022 : 0;  /* wing night */
    var dRate = (base * 0.62 + promoDay) * R.noise('disc:' + unit.id + day.iso, 0.30);
    var cRate = base * 0.38 * R.noise('comp:' + unit.id + day.iso, 0.42);
    var vRate = base * 0.26 * R.noise('void:' + unit.id + day.iso, 0.45);
    return {
      discounts: R.cents(gross * Math.max(0, dRate)),
      comps: R.cents(gross * Math.max(0, cRate)),
      voids: R.cents(gross * Math.max(0, vRate)),
      voidCount: Math.round(gross * Math.max(0, vRate) / 28)
    };
  }

  /* ---- the eager daily aggregate ---- */
  var daySales = R.memo(function (unitId, iso) {
    var unit = RG.unitById[unitId], day = CAL.byIso[iso];
    var pm = dayPmix(unitId, iso);
    if (!pm || pm.closed) {
      return { unit: unitId, iso: iso, closed: true, gross: 0, net: 0, discounts: 0,
               comps: 0, voids: 0, covers: 0, checks: 0, byChannel: {}, byDaypart: {} };
    }
    var adj = adjustments(unit, day, pm.gross);
    var net = R.cents(pm.gross - adj.discounts - adj.comps);
    var dineIn = pm.byChannel.dinein || 0;
    var ppa = RG.ppaOn(unit, iso);
    var covers = Math.max(0, Math.round(dineIn / ppa));
    var party = PARTY[unit.brand] * R.noise('pty:' + unitId + iso, 0.06);
    var dineChecks = Math.max(0, Math.round(covers / party));
    var offChecks = Math.round(
      ((pm.byChannel.takeout || 0) / 46) +
      ((pm.byChannel.delivery || 0) / 52) +
      ((pm.byChannel.catering || 0) / 310)
    );
    return {
      unit: unitId, iso: iso, closed: false,
      gross: pm.gross, discounts: adj.discounts, comps: adj.comps, voids: adj.voids,
      voidCount: adj.voidCount, net: net,
      covers: covers, checks: dineChecks + offChecks, dineChecks: dineChecks,
      avgCheck: dineChecks ? R.cents(dineIn / dineChecks) : 0,
      ppa: R.cents(covers ? dineIn / covers : 0),
      byChannel: pm.byChannel, byDaypart: pm.byDaypart,
      weather: weatherOf(unit.region, iso),
      holiday: CAL.holidayOf(iso)
    };
  });
  RG.daySales = daySales;

  /* per-person average drifts with menu price so covers stay believable */
  RG.ppaOn = function (unit, iso) {
    var moves = RG.PRICE_MOVES[unit.brand] || [], p = unit.ppa, ts = CAL.toTs(iso);
    for (var i = 0; i < moves.length; i++) if (ts >= CAL.toTs(moves[i][0])) p *= 1 + moves[i][1];
    return p;
  };

  /* ---- rollups ---- */
  function sumDays(unitIds, days) {
    var out = {
      gross: 0, discounts: 0, comps: 0, voids: 0, net: 0,
      covers: 0, checks: 0, byChannel: {}, byDaypart: {}, openDays: 0
    };
    unitIds.forEach(function (uid) {
      days.forEach(function (d) {
        var s = daySales(uid, d.iso);
        if (s.closed) return;
        out.openDays++;
        out.gross = R.cents(out.gross + s.gross);
        out.discounts = R.cents(out.discounts + s.discounts);
        out.comps = R.cents(out.comps + s.comps);
        out.voids = R.cents(out.voids + s.voids);
        out.net = R.cents(out.net + s.net);
        out.covers += s.covers;
        out.checks += s.checks;
        Object.keys(s.byChannel).forEach(function (c) {
          out.byChannel[c] = R.cents((out.byChannel[c] || 0) + s.byChannel[c]);
        });
        Object.keys(s.byDaypart).forEach(function (c) {
          out.byDaypart[c] = R.cents((out.byDaypart[c] || 0) + s.byDaypart[c]);
        });
      });
    });
    out.avgCheck = out.checks ? R.cents(out.net / out.checks) : 0;
    out.ppa = out.covers ? R.cents((out.byChannel.dinein || 0) / out.covers) : 0;
    return out;
  }
  RG.sumDays = sumDays;

  RG.periodSales = R.memo(function (unitId, periodKey) {
    return sumDays([unitId], CAL.daysIn(periodKey));
  });
  RG.groupPeriodSales = R.memo(function (periodKey) {
    return sumDays(RG.UNITS.map(function (u) { return u.id; }), CAL.daysIn(periodKey));
  });

  /* PMIX rolled to a period — cached, this is what the menu page reads */
  RG.periodPmix = R.memo(function (unitId, periodKey) {
    var acc = {};
    CAL.daysIn(periodKey).forEach(function (d) {
      var pm = dayPmix(unitId, d.iso);
      if (!pm || pm.closed) return;
      pm.rows.forEach(function (r) {
        var a = acc[r.item] || (acc[r.item] = {
          item: r.item, name: r.name, cat: r.cat, qty: 0, sales: 0, cost: 0
        });
        a.qty += r.qty;
        a.sales = R.cents(a.sales + r.ext);
        a.cost = R.cents(a.cost + RG.plateCost(r.item, d.iso, r.channel === 'delivery' || r.channel === 'takeout') * r.qty);
      });
    });
    return Object.keys(acc).map(function (k) {
      var a = acc[k];
      a.margin = R.cents(a.sales - a.cost);
      a.foodPct = a.sales ? a.cost / a.sales : 0;
      a.avgPrice = a.qty ? R.cents(a.sales / a.qty) : 0;
      return a;
    }).sort(function (x, y) { return y.sales - x.sales; });
  });
})(typeof window !== 'undefined' ? window : globalThis);
