/* ============================================================
   Restaurant OS — deterministic randomness
   Every generated value traces back to a string seed, so the whole
   company is reproducible byte-for-byte on every load, in every
   browser, and in the Node verifier.
   NEVER call Math.random() or Date.now() anywhere in this dataset.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  /* FNV-1a 32-bit string hash */
  function hash(str) {
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /* mulberry32 — small, fast, well-distributed */
  function rng(seed) {
    var a = hash(seed);
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* single stateless draw in [0,1) */
  function u(seed) { return rng(seed)(); }

  function between(seed, lo, hi) { return lo + u(seed) * (hi - lo); }
  function intBetween(seed, lo, hi) { return lo + Math.floor(u(seed) * (hi - lo + 1)); }

  /* Bates approximation of a normal: mean 0, sd ~1 */
  function gauss(seed) {
    var r = rng(seed);
    return (r() + r() + r() - 1.5) * 2;
  }

  /* multiplicative noise centred on 1, clamped so no single day goes absurd */
  function noise(seed, sd, clamp) {
    clamp = clamp == null ? 2.6 : clamp;
    var z = Math.max(-clamp, Math.min(clamp, gauss(seed)));
    return 1 + z * sd;
  }

  function chance(seed, p) { return u(seed) < p; }
  function pick(seed, arr) { return arr[Math.floor(u(seed) * arr.length) % arr.length]; }

  function shuffle(seed, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(u(seed + ':sh' + i) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* money is always stored already rounded to cents */
  function cents(x) { return Math.round(x * 100) / 100; }

  /* ---- the two workhorses behind every tie-out in the model ----
     Split a total across weights so the parts sum EXACTLY to the total.
     Largest-remainder method; no float drift. */
  function allocate(total, weights) {
    var t = Math.round(total * 100);
    var sum = 0, i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    if (!sum) sum = 1;
    var raw = weights.map(function (w) { return (t * w) / sum; });
    var out = raw.map(function (x) { return Math.floor(x); });
    var used = 0; for (i = 0; i < out.length; i++) used += out[i];
    var rem = t - used;
    var order = raw.map(function (x, k) { return { i: k, f: x - Math.floor(x) }; })
      .sort(function (a, b) { return b.f - a.f || a.i - b.i; });
    for (var k = 0; k < rem; k++) out[order[k % order.length].i] += 1;
    return out.map(function (c) { return c / 100; });
  }

  function allocateInt(total, weights) {
    var sum = 0, i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    if (!sum) sum = 1;
    var raw = weights.map(function (w) { return (total * w) / sum; });
    var out = raw.map(function (x) { return Math.floor(x); });
    var used = 0; for (i = 0; i < out.length; i++) used += out[i];
    var rem = total - used;
    var order = raw.map(function (x, k) { return { i: k, f: x - Math.floor(x) }; })
      .sort(function (a, b) { return b.f - a.f || a.i - b.i; });
    for (var k = 0; k < rem; k++) out[order[k % order.length].i] += 1;
    return out;
  }

  /* memoiser for lazily materialised detail (checks, punches, PMIX rows) */
  function memo(fn) {
    var cache = {};
    return function () {
      var k = Array.prototype.join.call(arguments, '|');
      if (k in cache) return cache[k];
      return (cache[k] = fn.apply(null, arguments));
    };
  }

  RG.rand = {
    hash: hash, rng: rng, u: u, between: between, intBetween: intBetween,
    gauss: gauss, noise: noise, chance: chance, pick: pick, shuffle: shuffle,
    cents: cents, allocate: allocate, allocateInt: allocateInt, memo: memo
  };
})(typeof window !== 'undefined' ? window : globalThis);
