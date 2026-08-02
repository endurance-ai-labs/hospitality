/* ============================================================
   Restaurant OS — ingredients, recipes, menu  (MAZRA)

   PMIX is the atom of this model. Net sales are the SUM of item-level
   quantity x menu price, never an independently generated number.

   MAZRA SERVES NO ALCOHOL. There is no beer, wine or spirits line
   anywhere in this file, and no liquor distributor in the vendor list.
   That is not a cosmetic detail — it removes the highest-margin category
   most full-service restaurants lean on, so beverage cost, check average
   and the whole margin structure behave differently. The cafe program
   (Turkish coffee, Lebanese mocktails, La Marzocco espresso) is the
   beverage business, and it exists only at Redwood City.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand;

  var FAMILIES = {
    lamb:    { drift: 0.128, seas: 0.052, shock: { from: '2025-09-01', to: '2026-07-31', mag: 0.085 } },
    beef:    { drift: 0.115, seas: 0.045, shock: { from: '2025-08-01', to: '2026-07-31', mag: 0.075 } },
    poultry: { drift: 0.048, seas: 0.030, shock: { from: '2025-01-01', to: '2025-06-30', mag: 0.090 } },
    seafood: { drift: 0.068, seas: 0.085, shock: null },
    dairy:   { drift: 0.061, seas: 0.028, shock: { from: '2026-02-01', to: '2026-07-31', mag: 0.055 } },
    produce: { drift: 0.043, seas: 0.135, shock: null },
    grain:   { drift: 0.029, seas: 0.020, shock: null },
    legume:  { drift: 0.036, seas: 0.028, shock: null },
    oil:     { drift: 0.037, seas: 0.025, shock: null },
    nuts:    { drift: 0.074, seas: 0.030, shock: null },
    pantry:  { drift: 0.031, seas: 0.012, shock: null },
    coffee:  { drift: 0.092, seas: 0.018, shock: { from: '2025-11-01', to: '2026-07-31', mag: 0.140 } },
    na:      { drift: 0.028, seas: 0.010, shock: null },
    paper:   { drift: 0.041, seas: 0.006, shock: null }
  };

  var BASE_TS = Date.UTC(2024, 0, 1);

  function familyIndex(family, isoDate) {
    var f = FAMILIES[family] || FAMILIES.pantry;
    var ts = RG.CAL.toTs(isoDate);
    var years = (ts - BASE_TS) / (365.25 * 86400000);
    var doy = new Date(ts).getUTCMonth() * 30.4 + new Date(ts).getUTCDate();
    var idx = Math.pow(1 + f.drift, years);
    idx *= 1 + f.seas * Math.sin((doy / 365) * 2 * Math.PI - 1.1);
    if (f.shock) {
      var a = RG.CAL.toTs(f.shock.from), b = RG.CAL.toTs(f.shock.to);
      if (ts >= a) {
        var ramp = Math.min(1, (ts - a) / Math.max(1, b - a));
        idx *= 1 + f.shock.mag * ramp;
      }
    }
    return idx;
  }

  /* [id, name, family, unit, baseCost, vendorId, packSize] */
  var ING = [
    ['lamb-leg',   'Lamb leg, boneless',      'lamb',    'lb', 12.60, 'halal',  10],
    ['lamb-chop',  'Lamb chops, frenched',    'lamb',    'lb', 18.40, 'halal',   8],
    ['lamb-grnd',  'Ground lamb',             'lamb',    'lb',  9.85, 'halal',  10],
    ['beef-shaw',  'Beef shawarma, seasoned', 'beef',    'lb',  8.70, 'halal',  10],
    ['beef-grnd',  'Ground beef 80/20',       'beef',    'lb',  5.42, 'halal',  10],
    ['chix-thigh', 'Chicken thigh, boneless', 'poultry', 'lb',  3.12, 'halal',  20],
    ['chix-brst',  'Chicken breast',          'poultry', 'lb',  3.68, 'halal',  20],
    ['salmon',     'Salmon fillet',           'seafood', 'lb', 12.95, 'usfoods', 8],
    ['chickpea',   'Chickpeas, dry',          'legume',  'lb',  1.42, 'levant', 25],
    ['fava',       'Fava beans',              'legume',  'lb',  1.68, 'levant', 25],
    ['tahini',     'Tahini',                  'pantry',  'lb',  4.90, 'levant', 35],
    ['sumac',      'Sumac',                   'pantry',  'lb', 11.20, 'levant',  5],
    ['zaatar',     'Za’atar blend',           'pantry',  'lb', 13.40, 'levant',  5],
    ['baharat',    'Baharat & grill spice',   'pantry',  'lb',  9.60, 'levant',  5],
    ['pom-mol',    'Pomegranate molasses',    'pantry',  'qt',  7.80, 'levant', 12],
    ['rosewater',  'Rose & orange blossom',   'pantry',  'qt',  9.20, 'levant', 12],
    ['eggplant',   'Eggplant',                'produce', 'lb',  1.95, 'produce', 25],
    ['tom-fresh',  'Vine tomato',             'produce', 'lb',  2.85, 'produce', 25],
    ['cucumber',   'Persian cucumber',        'produce', 'lb',  2.40, 'produce', 20],
    ['onion',      'Yellow onion',            'produce', 'lb',  1.05, 'produce', 50],
    ['garlic',     'Garlic, peeled',          'produce', 'lb',  3.90, 'produce', 10],
    ['parsley',    'Flat-leaf parsley',       'produce', 'lb',  3.20, 'produce', 12],
    ['mint',       'Fresh mint',              'produce', 'lb',  4.80, 'produce',  6],
    ['lettuce',    'Romaine',                 'produce', 'lb',  2.15, 'produce', 24],
    ['lemon',      'Lemons',                  'produce', 'ea',  0.48, 'produce', 95],
    ['potato',     'Russet potato',           'produce', 'lb',  0.92, 'produce', 50],
    ['cauliflower','Cauliflower',             'produce', 'lb',  1.85, 'produce', 24],
    ['pepper-red', 'Red bell pepper',         'produce', 'lb',  3.10, 'produce', 20],
    ['grapeleaf',  'Grape leaves',            'produce', 'lb',  5.40, 'levant',  10],
    ['olives',     'Mixed olives',            'produce', 'lb',  5.90, 'levant',  10],
    ['pickle',     'Pickled turnip & cucumber','produce','lb',  3.40, 'levant',  10],
    ['yogurt',     'Whole-milk yogurt',       'dairy',   'lb',  2.35, 'dairy',   30],
    ['labneh',     'Labneh',                  'dairy',   'lb',  5.60, 'levant',  10],
    ['feta',       'Feta',                    'dairy',   'lb',  6.40, 'dairy',    8],
    ['halloumi',   'Halloumi',                'dairy',   'lb',  9.80, 'levant',   6],
    ['butter',     'Butter',                  'dairy',   'lb',  4.35, 'dairy',   36],
    ['cream',      'Heavy cream',             'dairy',   'qt',  4.80, 'dairy',   12],
    ['milk',       'Whole milk',              'dairy',   'gal', 5.20, 'dairy',    4],
    ['pita',       'Fresh pita',              'grain',   'ea',  0.44, 'bakery', 120],
    ['bulgur',     'Bulgur wheat',            'grain',   'lb',  1.55, 'levant',  25],
    ['rice',       'Basmati rice',            'grain',   'lb',  1.78, 'levant',  50],
    ['phyllo',     'Phyllo pastry',           'grain',   'lb',  3.60, 'levant',  10],
    ['vermicelli', 'Vermicelli',              'grain',   'lb',  1.65, 'levant',  20],
    ['oil-olive',  'Olive oil',               'oil',     'gal', 42.80, 'levant',   4],
    ['oil-fry',    'Fryer oil',               'oil',     'gal', 21.40, 'sysco',    6],
    ['walnut',     'Walnuts',                 'nuts',    'lb',  7.90, 'levant',  10],
    ['pistachio',  'Pistachios',              'nuts',    'lb', 13.60, 'levant',   5],
    ['sesame',     'Sesame seed',             'nuts',    'lb',  4.20, 'levant',  10],
    ['coffee-tk',  'Turkish coffee',          'coffee',  'lb', 12.80, 'coffee',   5],
    ['coffee-esp', 'Espresso beans',          'coffee',  'lb', 14.90, 'coffee',   5],
    ['tea',        'Black & herbal tea',      'na',      'lb', 11.40, 'coffee',   5],
    ['syrup',      'Mocktail syrups & purees','na',      'qt',  5.40, 'levant',  12],
    ['soda',       'Fountain soda syrup',     'na',      'gal', 18.90, 'sysco',    3],
    ['togo',       'To-go packaging',         'paper',   'ea',  0.46, 'paper',  500]
  ];

  RG.INGREDIENTS = ING.map(function (r) {
    return { id: r[0], name: r[1], family: r[2], unit: r[3], base: r[4], vendor: r[5], pack: r[6] };
  });
  RG.ingById = {};
  RG.INGREDIENTS.forEach(function (i) { RG.ingById[i.id] = i; });

  RG.ingCost = function (ingId, isoDate) {
    var ing = RG.ingById[ingId];
    if (!ing) return 0;
    var idx = familyIndex(ing.family, isoDate);
    var wobble = 1 + 0.035 * Math.sin(
      (RG.CAL.toTs(isoDate) / 86400000 + R.hash(ingId) % 90) / 90 * 2 * Math.PI
    );
    return R.cents(ing.base * idx * wobble);
  };
  RG.familyIndex = familyIndex;
  RG.FAMILIES = FAMILIES;

  var PRICE_MOVES = {
    mazra: [['2024-08-05', 0.036], ['2025-04-07', 0.044], ['2026-03-02', 0.033]]
  };

  /* [id, name, category, basePrice, weight, dayparts, recipe, cafeOnly]
     dayparts: L lunch · H afternoon · D dinner · N late */
  var MENU_ROWS = [
    ['mz-hummus',   'Hummus',                  'Mezze',   12,  96, 'LHDN', [['chickpea',0.22],['tahini',0.06],['oil-olive',0.012],['lemon',0.3],['pita',1]]],
    ['mz-hummus-s', 'Hummus with Shawarma',    'Mezze',   18,  74, 'LHDN', [['chickpea',0.20],['tahini',0.05],['beef-shaw',0.22],['oil-olive',0.010],['pita',1]]],
    ['mz-baba',     'Baba Ghanoush',           'Mezze',   13,  58, 'LHDN', [['eggplant',0.42],['tahini',0.05],['lemon',0.3],['oil-olive',0.010],['pita',1]]],
    ['mz-muham',    'Muhammara',               'Mezze',   13,  41, 'HDN',  [['walnut',0.14],['pepper-red',0.24],['pom-mol',0.02],['oil-olive',0.008]]],
    ['mz-labneh',   'Labneh',                  'Mezze',   12,  44, 'LHDN', [['labneh',0.26],['oil-olive',0.012],['zaatar',0.006],['pita',1]]],
    ['mz-falafel',  'Falafel (6 pc)',          'Mezze',   11,  88, 'LHDN', [['chickpea',0.26],['parsley',0.05],['oil-fry',0.022],['tahini',0.03]]],
    ['mz-grape',    'Stuffed Grape Leaves',    'Mezze',   12,  36, 'HDN',  [['grapeleaf',0.20],['rice',0.10],['lemon',0.4],['oil-olive',0.008]]],
    ['mz-caulif',   'Fried Cauliflower',       'Mezze',   12,  52, 'LHDN', [['cauliflower',0.38],['oil-fry',0.024],['tahini',0.04]]],
    ['mz-halloumi', 'Grilled Halloumi',        'Mezze',   14,  38, 'HDN',  [['halloumi',0.24],['tom-fresh',0.10],['oil-olive',0.008]]],
    ['mz-fatt',     'Fattoush',                'Salads',  14,  72, 'LHDN', [['lettuce',0.22],['tom-fresh',0.14],['cucumber',0.12],['sumac',0.006],['pita',0.6]]],
    ['mz-tabb',     'Tabbouleh',               'Salads',  13,  62, 'LHDN', [['parsley',0.20],['bulgur',0.06],['tom-fresh',0.12],['lemon',0.5]]],
    ['mz-arabic',   'Arabic Salad',            'Salads',  12,  48, 'LHDN', [['cucumber',0.18],['tom-fresh',0.16],['mint',0.02],['lemon',0.4]]],
    ['mz-mazra-sal','Mazra Salad',             'Salads',  15,  40, 'LHDN', [['lettuce',0.20],['feta',0.07],['olives',0.05],['cucumber',0.10],['sumac',0.005]]],
    ['mz-chix-plate','Chicken Shawarma Plate', 'Grill',   24, 168, 'LHDN', [['chix-thigh',0.46],['rice',0.22],['garlic',0.035],['pickle',0.05],['pita',1]]],
    ['mz-beef-plate','Beef Shawarma Plate',    'Grill',   26, 132, 'LHDN', [['beef-shaw',0.44],['rice',0.22],['garlic',0.030],['pickle',0.05],['pita',1]]],
    ['mz-tawook',   'Shish Tawook',            'Grill',   25, 124, 'LDN',  [['chix-brst',0.48],['rice',0.22],['garlic',0.035],['baharat',0.008]]],
    ['mz-kafta',    'Beef Kafta Plate',        'Grill',   25, 106, 'LDN',  [['beef-grnd',0.30],['lamb-grnd',0.16],['rice',0.22],['parsley',0.04],['baharat',0.008]]],
    ['mz-lamb-keb', 'Lamb Kebab Plate',        'Grill',   30,  84, 'DN',   [['lamb-leg',0.44],['rice',0.22],['baharat',0.008],['onion',0.08]]],
    ['mz-lamb-chop','Lamb Chops',              'Grill',   38,  56, 'DN',   [['lamb-chop',0.62],['rice',0.20],['baharat',0.008]]],
    ['mz-mixed',    'Mazra Mixed Grill',       'Grill',   42,  78, 'DN',   [['chix-thigh',0.24],['beef-shaw',0.20],['lamb-leg',0.22],['rice',0.26],['baharat',0.012]]],
    ['mz-salmon',   'Salmon Kebab',            'Grill',   29,  34, 'DN',   [['salmon',0.44],['rice',0.20],['lemon',0.5]]],
    ['mz-veg',      'Vegetarian Plate',        'Grill',   21,  46, 'LHDN', [['chickpea',0.14],['cauliflower',0.16],['eggplant',0.16],['rice',0.18],['tahini',0.04]]],
    ['mz-wrap-chix','Chicken Shawarma Wrap',   'Wraps',   15, 186, 'LHDN', [['chix-thigh',0.30],['pita',1],['garlic',0.030],['pickle',0.04]]],
    ['mz-wrap-beef','Beef Shawarma Wrap',      'Wraps',   17, 142, 'LHDN', [['beef-shaw',0.28],['pita',1],['garlic',0.026],['pickle',0.04]]],
    ['mz-wrap-fal', 'Falafel Wrap',            'Wraps',   13,  96, 'LHDN', [['chickpea',0.20],['pita',1],['tahini',0.04],['parsley',0.03]]],
    ['mz-wrap-kaf', 'Kafta Wrap',              'Wraps',   16,  68, 'LHDN', [['beef-grnd',0.20],['lamb-grnd',0.10],['pita',1],['onion',0.05]]],
    ['mz-toum',     'Garlic Sauce (Toum)',     'Sides',    3, 148, 'LHDN', [['garlic',0.05],['oil-olive',0.010]]],
    ['mz-pita-s',   'Fresh Pita',              'Sides',    3, 112, 'LHDN', [['pita',2]]],
    ['mz-rice-s',   'Basmati Rice',            'Sides',    5,  76, 'LHDN', [['rice',0.24],['vermicelli',0.03]]],
    ['mz-fries',    'Seasoned Fries',          'Sides',    7,  94, 'LHDN', [['potato',0.40],['oil-fry',0.030],['sumac',0.004]]],
    ['mz-pickles',  'Pickles & Olives',        'Sides',    5,  54, 'LHDN', [['pickle',0.10],['olives',0.08]]],
    ['mz-baklava',  'Baklava',                 'Desserts', 9,  74, 'LHDN', [['phyllo',0.10],['pistachio',0.06],['butter',0.05],['rosewater',0.006]]],
    ['mz-knafeh',   'Knafeh',                  'Desserts',12,  62, 'DN',   [['phyllo',0.12],['halloumi',0.10],['rosewater',0.008],['pistachio',0.02]]],
    ['mz-rice-pud', 'Rice Pudding',            'Desserts', 8,  34, 'DN',   [['rice',0.10],['milk',0.09],['rosewater',0.005]]],
    /* ---- cafe: Redwood City only ---- */
    ['mz-turkish',  'Turkish Coffee',          'Cafe',     6, 118, 'LHDN', [['coffee-tk',0.045],['cardamom-x',0]], true],
    ['mz-espresso', 'Espresso & Latte',        'Cafe',     6, 156, 'LHDN', [['coffee-esp',0.042],['milk',0.030]], true],
    ['mz-mocktail', 'Lebanese Mocktail',       'Cafe',     9, 104, 'HDN',  [['syrup',0.075],['lemon',0.5],['mint',0.012]], true],
    ['mz-lemonade', 'Mint Lemonade',           'Cafe',     7, 132, 'LHDN', [['lemon',1.6],['mint',0.014],['syrup',0.030]], true],
    ['mz-jallab',   'Jallab',                  'Cafe',     8,  46, 'HDN',  [['syrup',0.070],['pistachio',0.012]], true],
    ['mz-ayran',    'Ayran',                   'N/A Bev',  5,  58, 'LHDN', [['yogurt',0.24]]],
    ['mz-tea',      'Mint Tea',                'N/A Bev',  4,  86, 'LHDN', [['tea',0.020],['mint',0.010]]],
    ['mz-soft',     'Soft Drinks',             'N/A Bev',  4, 124, 'LHDN', [['soda',0.018]]]
  ];

  var DP_MAP = { L: 'lunch', H: 'happy', D: 'dinner', N: 'late' };
  /* Beverage categories. There is no alcohol category at all. */
  var BEV_CATS = ['Cafe', 'N/A Bev'];

  RG.MENU = [];
  MENU_ROWS.forEach(function (r) {
    RG.MENU.push({
      id: r[0], brand: 'mazra', name: r[1], category: r[2],
      basePrice: r[3], weight: r[4],
      dayparts: r[5].split('').map(function (c) { return DP_MAP[c]; }),
      recipe: r[6].filter(function (x) { return RG.ingById[x[0]]; })
                  .map(function (x) { return { ing: x[0], qty: x[1] }; }),
      bev: BEV_CATS.indexOf(r[2]) >= 0,
      cafe: !!r[7]
    });
  });
  RG.menuById = {};
  RG.MENU.forEach(function (m) { RG.menuById[m.id] = m; });
  RG.BEV_CATS = BEV_CATS;

  RG.menuFor = function (brandId) {
    return RG.MENU.filter(function (m) { return m.brand === brandId; });
  };
  /* The cafe program exists only where there is a cafe bar. */
  RG.menuForUnit = function (unit) {
    return RG.MENU.filter(function (m) {
      if (m.brand !== unit.brand) return false;
      if (m.cafe && !unit.cafe) return false;
      return true;
    });
  };

  RG.menuPrice = function (itemId, isoDate) {
    var m = RG.menuById[itemId];
    if (!m) return 0;
    var moves = PRICE_MOVES[m.brand] || [];
    var p = m.basePrice, ts = RG.CAL.toTs(isoDate);
    for (var i = 0; i < moves.length; i++) {
      if (ts >= RG.CAL.toTs(moves[i][0])) p *= 1 + moves[i][1];
    }
    return Math.round(p);
  };
  RG.PRICE_MOVES = PRICE_MOVES;

  /* Calibrated so food cost lands 29-32%. Beverage here is coffee and
     mocktails, which pour far cheaper than an alcohol program — the
     scale is lower than a bar-led concept would use, on purpose. */
  RG.PORTION_SCALE = { food: 1.66, bev: 1.12 };

  RG.plateCost = function (itemId, isoDate, packaged) {
    var m = RG.menuById[itemId];
    if (!m) return 0;
    var scale = m.bev ? RG.PORTION_SCALE.bev : RG.PORTION_SCALE.food;
    var c = 0;
    for (var i = 0; i < m.recipe.length; i++) {
      c += RG.ingCost(m.recipe[i].ing, isoDate) * m.recipe[i].qty * scale;
    }
    if (packaged && !m.bev) c += RG.ingCost('togo', isoDate) * 1.4;
    return c;
  };
})(typeof window !== 'undefined' ? window : globalThis);
