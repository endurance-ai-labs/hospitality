/* ============================================================
   Restaurant OS — ingredients, recipes, menu
   PMIX is the atom of this model. Net sales are the SUM of item-level
   quantity x menu price, never an independently generated number, so
   the sales page and the menu page can never disagree.

   Ingredient prices move on commodity family indexes, which is what
   makes "your beef is up 8% but the market is up 11%" answerable.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});
  var R = RG.rand;

  /* ---- commodity families ----
     idx(date) returns a multiplier vs. the 2024-01-01 baseline of 1.00.
     Shape: secular drift + seasonal swing + a family-specific shock. */
  var FAMILIES = {
    beef:    { drift: 0.115, seas: 0.045, shock: { from: '2025-08-01', to: '2026-07-31', mag: 0.075 } },
    poultry: { drift: 0.048, seas: 0.030, shock: { from: '2025-01-01', to: '2025-06-30', mag: 0.090 } },
    pork:    { drift: 0.052, seas: 0.038, shock: null },
    seafood: { drift: 0.068, seas: 0.085, shock: null },
    dairy:   { drift: 0.061, seas: 0.028, shock: { from: '2026-02-01', to: '2026-07-31', mag: 0.055 } },
    produce: { drift: 0.043, seas: 0.135, shock: null },
    grain:   { drift: 0.029, seas: 0.020, shock: null },
    oil:     { drift: 0.037, seas: 0.025, shock: null },
    pantry:  { drift: 0.031, seas: 0.012, shock: null },
    beer:    { drift: 0.026, seas: 0.008, shock: null },
    wine:    { drift: 0.033, seas: 0.006, shock: null },
    spirits: { drift: 0.030, seas: 0.006, shock: null },
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

  /* ---- ingredient master ----
     [id, name, family, unit, baseCost, vendorId, packSize] */
  var ING = [
    ['beef-grnd',  'Ground beef 80/20',        'beef',    'lb',  5.42, 'meat',    10],
    ['beef-chuck', 'Beef chuck',               'beef',    'lb',  6.85, 'meat',    10],
    ['beef-steak', 'Flat iron steak',          'beef',    'lb', 11.90, 'meat',     8],
    ['chix-brst',  'Chicken breast',           'poultry', 'lb',  3.68, 'meat',    20],
    ['chix-thigh', 'Chicken thigh',            'poultry', 'lb',  2.94, 'meat',    20],
    ['chix-wing',  'Chicken wings',            'poultry', 'lb',  3.35, 'meat',    20],
    ['pork-belly', 'Pork belly',               'pork',    'lb',  6.20, 'meat',    10],
    ['chorizo',    'Spanish chorizo',          'pork',    'lb',  9.75, 'meat',     5],
    ['bacon',      'Applewood bacon',          'pork',    'lb',  6.55, 'meat',    15],
    ['sausage-it', 'Italian sausage',          'pork',    'lb',  4.85, 'meat',    10],
    ['pepperoni',  'Pepperoni',                'pork',    'lb',  5.90, 'sysco',   10],
    ['shrimp',     'Gulf shrimp 16/20',        'seafood', 'lb', 12.40, 'seafood',  5],
    ['octopus',    'Spanish octopus',          'seafood', 'lb', 14.85, 'seafood',  5],
    ['salmon',     'Salmon fillet',            'seafood', 'lb', 12.95, 'seafood',  8],
    ['cod',        'Pacific cod',              'seafood', 'lb',  9.40, 'seafood',  8],
    ['mozz',       'Whole-milk mozzarella',    'dairy',   'lb',  4.15, 'sysco',   12],
    ['mozz-fresh', 'Fresh mozzarella',         'dairy',   'lb',  6.30, 'dairy',    6],
    ['parm',       'Parmigiano',               'dairy',   'lb', 11.80, 'dairy',     5],
    ['manchego',   'Manchego',                 'dairy',   'lb', 14.20, 'dairy',     5],
    ['cheddar',    'Sharp cheddar',            'dairy',   'lb',  4.95, 'sysco',   10],
    ['butter',     'Butter',                   'dairy',   'lb',  4.35, 'dairy',   36],
    ['cream',      'Heavy cream',              'dairy',   'qt',  4.80, 'dairy',   12],
    ['eggs',       'Eggs',                     'dairy',   'dz',  4.60, 'dairy',   15],
    ['tom-san',    'San Marzano tomato',       'produce', 'lb',  2.35, 'sysco',    6],
    ['tom-fresh',  'Vine tomato',              'produce', 'lb',  2.85, 'produce', 25],
    ['onion',      'Yellow onion',             'produce', 'lb',  1.05, 'produce', 50],
    ['garlic',     'Garlic',                   'produce', 'lb',  3.90, 'produce', 10],
    ['potato',     'Russet potato',            'produce', 'lb',  0.92, 'produce', 50],
    ['lettuce',    'Romaine',                  'produce', 'lb',  2.15, 'produce', 24],
    ['pepper-pad', 'Padron peppers',           'produce', 'lb',  6.40, 'produce',  5],
    ['mushroom',   'Cremini mushroom',         'produce', 'lb',  3.45, 'produce', 10],
    ['arugula',    'Arugula',                  'produce', 'lb',  4.60, 'produce',  4],
    ['lemon',      'Lemons',                   'produce', 'ea',  0.48, 'produce', 95],
    ['lime',       'Limes',                    'produce', 'ea',  0.34, 'produce',110],
    ['avocado',    'Avocado',                  'produce', 'ea',  1.35, 'produce', 48],
    ['jalapeno',   'Jalapeno',                 'produce', 'lb',  2.05, 'produce', 10],
    ['flour',      'High-gluten flour',        'grain',   'lb',  0.68, 'sysco',   50],
    ['bun',        'Brioche bun',              'grain',   'ea',  0.72, 'bakery',  48],
    ['bread',      'Rustic bread loaf',        'grain',   'ea',  3.95, 'bakery',  12],
    ['pasta',      'Dry pasta',                'grain',   'lb',  1.45, 'sysco',   20],
    ['tortilla',   'Corn tortilla',            'grain',   'ea',  0.16, 'sysco',  240],
    ['oil-olive',  'Olive oil',                'oil',     'gal', 38.50, 'sysco',   4],
    ['oil-fry',    'Fryer oil',                'oil',     'gal', 21.40, 'sysco',   6],
    ['saffron',    'Saffron',                  'pantry',  'oz', 92.00, 'sysco',    1],
    ['paprika',    'Smoked paprika',           'pantry',  'lb', 12.60, 'sysco',    2],
    ['spice',      'Spice & dry goods blend',  'pantry',  'lb',  6.80, 'sysco',    5],
    ['sauce-base', 'Pizza sauce base',         'pantry',  'lb',  1.85, 'sysco',   25],
    ['dressing',   'House dressing base',      'pantry',  'qt',  5.20, 'sysco',   12],
    ['beer-draft', 'Draft beer',               'beer',    'gal', 11.80, 'beerdist', 15.5],
    ['beer-btl',   'Bottled / canned beer',    'beer',    'ea',  1.42, 'beerdist', 24],
    ['wine-glass', 'Wine — by the glass',      'wine',    'btl', 11.50, 'winedist', 12],
    ['wine-btl',   'Wine — bottle list',       'wine',    'btl', 17.90, 'winedist', 12],
    ['spirit',     'Well & call spirits',      'spirits', 'btl', 16.40, 'spirits',  12],
    ['spirit-prem','Premium spirits',          'spirits', 'btl', 28.90, 'spirits',  12],
    ['vermouth',   'Vermouth & modifiers',     'spirits', 'btl', 13.20, 'spirits',  12],
    ['mixer',      'Mixers & syrups',          'na',      'qt',  3.60, 'sysco',   12],
    ['soda',       'Fountain soda syrup',      'na',      'gal', 18.90, 'sysco',    3],
    ['coffee',     'Coffee',                   'na',      'lb', 10.40, 'coffee',   5],
    ['togo',       'To-go packaging',          'paper',   'ea',  0.41, 'paper',  500]
  ];

  RG.INGREDIENTS = ING.map(function (r) {
    return { id: r[0], name: r[1], family: r[2], unit: r[3], base: r[4], vendor: r[5], pack: r[6] };
  });
  RG.ingById = {};
  RG.INGREDIENTS.forEach(function (i) { RG.ingById[i.id] = i; });

  /* Landed cost of one recipe unit of an ingredient on a given date.
     Family index x a small per-ingredient idiosyncratic drift. */
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

  /* ---- menu price increases, group-wide, by brand ----
     These produce the price effect in the sales bridge. */
  var PRICE_MOVES = {
    camino: [['2024-07-08', 0.035], ['2025-04-07', 0.042], ['2026-03-02', 0.031]],
    star:   [['2024-06-03', 0.038], ['2025-03-03', 0.045], ['2026-02-02', 0.034]],
    catos:  [['2024-09-02', 0.030], ['2025-05-05', 0.038], ['2026-04-06', 0.029]],
    bnn:    [['2024-08-05', 0.033], ['2025-05-05', 0.040], ['2026-03-30', 0.030]]
  };

  /* ---- menus ----
     [id, name, category, basePrice, weight, dayparts, [[ing,qty],...]]
     weight = relative popularity within the brand. dayparts: L/H/D/N. */
  var MENUS = {
    camino: [
      ['cam-pad',  'Padron Peppers',        'Tapas',     14, 62, 'LHD',  [['pepper-pad',0.28],['oil-olive',0.02],['spice',0.01]]],
      ['cam-pan',  'Pan con Tomate',        'Tapas',     11, 58, 'LHDN', [['bread',0.35],['tom-fresh',0.22],['oil-olive',0.015],['garlic',0.02]]],
      ['cam-croq', 'Jamon Croquetas',       'Tapas',     16, 71, 'LHDN', [['flour',0.12],['cream',0.10],['chorizo',0.10],['eggs',0.08]]],
      ['cam-pulpo','Pulpo a la Gallega',    'Tapas',     26, 44, 'DN',   [['octopus',0.38],['potato',0.30],['paprika',0.012],['oil-olive',0.02]]],
      ['cam-gam',  'Gambas al Ajillo',      'Tapas',     23, 66, 'DN',   [['shrimp',0.32],['garlic',0.05],['oil-olive',0.025],['bread',0.15]]],
      ['cam-chor', 'Chorizo a la Sidra',    'Tapas',     17, 49, 'HDN',  [['chorizo',0.30],['onion',0.10],['spice',0.01]]],
      ['cam-tort', 'Tortilla Espanola',     'Tapas',     14, 53, 'LHD',  [['eggs',0.30],['potato',0.35],['onion',0.12],['oil-olive',0.015]]],
      ['cam-manch','Manchego & Membrillo',  'Tapas',     18, 41, 'HDN',  [['manchego',0.24],['bread',0.20]]],
      ['cam-boq',  'Boquerones',            'Tapas',     15, 26, 'HDN',  [['cod',0.18],['oil-olive',0.02],['lemon',0.5]]],
      ['cam-pae',  'Paella Valenciana',     'Mains',     42, 57, 'DN',   [['chix-thigh',0.40],['chorizo',0.14],['shrimp',0.18],['saffron',0.018],['onion',0.15]]],
      ['cam-pae-m','Paella de Mariscos',    'Mains',     48, 38, 'DN',   [['shrimp',0.30],['cod',0.22],['octopus',0.16],['saffron',0.020],['onion',0.15]]],
      ['cam-steak','Solomillo',             'Mains',     46, 33, 'DN',   [['beef-steak',0.62],['potato',0.30],['butter',0.05]]],
      ['cam-sal',  'Salmon a la Plancha',   'Mains',     34, 29, 'DN',   [['salmon',0.44],['arugula',0.10],['lemon',0.6]]],
      ['cam-pol',  'Pollo al Ajillo',       'Mains',     29, 35, 'LDN',  [['chix-thigh',0.52],['garlic',0.06],['potato',0.24]]],
      ['cam-ens',  'Ensalada Mixta',        'Salads',    15, 44, 'LHD',  [['lettuce',0.26],['tom-fresh',0.14],['onion',0.06],['dressing',0.06]]],
      ['cam-bur',  'Camino Burger',         'Mains',     23, 47, 'LHD',  [['beef-grnd',0.40],['bun',1],['manchego',0.06],['potato',0.28]]],
      ['cam-boc',  'Bocadillo',             'Mains',     19, 32, 'LH',   [['bread',0.45],['chorizo',0.16],['manchego',0.05],['tom-fresh',0.08]]],
      ['cam-patat','Patatas Bravas',        'Sides',     12, 78, 'LHDN', [['potato',0.42],['oil-fry',0.035],['spice',0.012]]],
      ['cam-oliv', 'Marinated Olives',      'Sides',      8, 51, 'HDN',  [['spice',0.02],['oil-olive',0.008]]],
      ['cam-churr','Churros con Chocolate', 'Desserts',  13, 40, 'DN',   [['flour',0.14],['cream',0.10],['butter',0.05]]],
      ['cam-flan', 'Flan de Naranja',       'Desserts',  12, 27, 'DN',   [['eggs',0.16],['cream',0.14]]],
      ['cam-gin',  'Gin & Tonic Program',   'Cocktails', 17,132, 'HDN',  [['spirit-prem',0.11],['mixer',0.09]]],
      ['cam-cock', 'House Cocktails',       'Cocktails', 16,148, 'HDN',  [['spirit',0.115],['vermouth',0.04],['mixer',0.06]]],
      ['cam-sang', 'Sangria',               'Cocktails', 14, 74, 'HDN',  [['wine-glass',0.22],['spirit',0.04],['mixer',0.08]]],
      ['cam-wineg','Wine by the Glass',     'Wine',      15,126, 'HDN',  [['wine-glass',0.20]]],
      ['cam-wineb','Wine Bottle',           'Wine',      62, 31, 'DN',   [['wine-btl',1]]],
      ['cam-sherry','Sherry Flight',        'Wine',      21, 22, 'HDN',  [['wine-glass',0.26]]],
      ['cam-beer', 'Beer',                  'Beer',       9, 88, 'LHDN', [['beer-btl',1]]],
      ['cam-na',   'Zero-Proof & Soda',     'N/A Bev',    7, 64, 'LHDN', [['mixer',0.05],['soda',0.02]]],
      ['cam-coff', 'Coffee & Espresso',     'N/A Bev',    5, 47, 'LDN',  [['coffee',0.045]]]
    ],
    star: [
      ['st-deep-c', 'Classic Deep Dish',    'Deep Dish', 34,158, 'LDN',  [['flour',0.62],['mozz',0.78],['sauce-base',0.52],['sausage-it',0.26],['oil-olive',0.02]]],
      ['st-deep-v', 'Vegetarian Deep Dish', 'Deep Dish', 33,112, 'LDN',  [['flour',0.62],['mozz',0.74],['sauce-base',0.55],['mushroom',0.22],['onion',0.14]]],
      ['st-deep-p', 'Pepperoni Deep Dish',  'Deep Dish', 35,134, 'LDN',  [['flour',0.62],['mozz',0.80],['sauce-base',0.50],['pepperoni',0.24]]],
      ['st-deep-s', 'Spinach & Ricotta Deep','Deep Dish',35, 74, 'LDN',  [['flour',0.62],['mozz',0.70],['cream',0.12],['sauce-base',0.48],['arugula',0.16]]],
      ['st-thin-c', 'Thin Crust Cheese',    'Thin Crust',24,102, 'LDN',  [['flour',0.34],['mozz',0.46],['sauce-base',0.28]]],
      ['st-thin-p', 'Thin Crust Pepperoni', 'Thin Crust',27,118, 'LDN',  [['flour',0.34],['mozz',0.46],['sauce-base',0.28],['pepperoni',0.18]]],
      ['st-thin-s', 'Thin Crust Supreme',   'Thin Crust',30, 86, 'LDN',  [['flour',0.34],['mozz',0.46],['sauce-base',0.28],['sausage-it',0.14],['mushroom',0.10],['onion',0.08]]],
      ['st-thin-m', 'Thin Crust Margherita','Thin Crust',26, 68, 'LDN',  [['flour',0.34],['mozz-fresh',0.34],['tom-san',0.26]]],
      ['st-wing',   'Wings',                'Starters',  17,124, 'LDN',  [['chix-wing',0.72],['oil-fry',0.04],['spice',0.02]]],
      ['st-garl',   'Garlic Knots',         'Starters',  11, 96, 'LDN',  [['flour',0.20],['butter',0.06],['garlic',0.03],['parm',0.03]]],
      ['st-meat',   'Meatballs',            'Starters',  15, 58, 'LDN',  [['beef-grnd',0.26],['sausage-it',0.10],['tom-san',0.16],['parm',0.03]]],
      ['st-bread',  'Cheese Bread',         'Starters',  13, 71, 'LDN',  [['flour',0.22],['mozz',0.24],['butter',0.05]]],
      ['st-cae',    'Caesar Salad',         'Salads',    14, 88, 'LDN',  [['lettuce',0.30],['parm',0.05],['dressing',0.07],['bread',0.10]]],
      ['st-house',  'House Salad',          'Salads',    12, 64, 'LDN',  [['lettuce',0.26],['tom-fresh',0.12],['onion',0.05],['dressing',0.06]]],
      ['st-chop',   'Chopped Salad',        'Salads',    16, 47, 'LDN',  [['lettuce',0.24],['chix-brst',0.18],['cheddar',0.05],['dressing',0.07]]],
      ['st-pasta',  'Baked Ziti',           'Pasta',     22, 52, 'LDN',  [['pasta',0.34],['mozz',0.22],['sauce-base',0.30],['sausage-it',0.12]]],
      ['st-lasg',   'Lasagna',              'Pasta',     24, 41, 'DN',   [['pasta',0.30],['beef-grnd',0.22],['mozz',0.26],['sauce-base',0.28]]],
      ['st-sand',   'Italian Sandwich',     'Sandwiches',17, 44, 'L',    [['bread',0.40],['pepperoni',0.10],['mozz',0.10],['lettuce',0.06]]],
      ['st-cann',   'Cannoli',              'Desserts',  10, 46, 'DN',   [['cream',0.12],['flour',0.08]]],
      ['st-tira',   'Tiramisu',             'Desserts',  12, 34, 'DN',   [['cream',0.16],['coffee',0.02],['eggs',0.08]]],
      ['st-beerd',  'Draft Beer',           'Beer',       9,142, 'LDN',  [['beer-draft',0.125]]],
      ['st-beerb',  'Bottle & Can',         'Beer',       8, 76, 'LDN',  [['beer-btl',1]]],
      ['st-wineg',  'Wine by the Glass',    'Wine',      13, 82, 'DN',   [['wine-glass',0.20]]],
      ['st-wineb',  'Wine Bottle',          'Wine',      46, 18, 'DN',   [['wine-btl',1]]],
      ['st-soda',   'Fountain Soda',        'N/A Bev',    4,168, 'LDN',  [['soda',0.018]]],
      ['st-na',     'Bottled N/A',          'N/A Bev',    4, 58, 'LDN',  [['mixer',0.04]]]
    ],
    catos: [
      ['ct-burg',  'Ale House Burger',      'Kitchen',   19,146, 'LHDN', [['beef-grnd',0.42],['bun',1],['cheddar',0.07],['potato',0.30],['lettuce',0.04]]],
      ['ct-fish',  'Fish & Chips',          'Kitchen',   22, 94, 'LHDN', [['cod',0.42],['potato',0.40],['oil-fry',0.05],['flour',0.10]]],
      ['ct-wing',  'Ale House Wings',       'Kitchen',   16,128, 'LHDN', [['chix-wing',0.70],['oil-fry',0.04],['spice',0.02]]],
      ['ct-pret',  'Beer Pretzel',          'Kitchen',   12, 88, 'HDN',  [['flour',0.24],['butter',0.05],['cheddar',0.09]]],
      ['ct-nach',  'Loaded Nachos',         'Kitchen',   17, 76, 'HDN',  [['tortilla',14],['cheddar',0.22],['beef-grnd',0.18],['jalapeno',0.04]]],
      ['ct-sand',  'Turkey Club',           'Kitchen',   17, 51, 'LH',   [['bread',0.36],['chix-brst',0.22],['bacon',0.08],['lettuce',0.05]]],
      ['ct-cae',   'Caesar Salad',          'Kitchen',   14, 47, 'LHD',  [['lettuce',0.30],['parm',0.05],['dressing',0.07]]],
      ['ct-chili', 'House Chili',           'Kitchen',   13, 39, 'LHDN', [['beef-chuck',0.26],['onion',0.10],['spice',0.02],['cheddar',0.05]]],
      ['ct-mac',   'Bacon Mac & Cheese',    'Kitchen',   16, 62, 'HDN',  [['pasta',0.28],['cheddar',0.20],['cream',0.12],['bacon',0.08]]],
      ['ct-fries', 'Ale House Fries',       'Kitchen',   10,118, 'LHDN', [['potato',0.44],['oil-fry',0.035]]],
      ['ct-tacos', 'Fish Tacos',            'Kitchen',   18, 43, 'LHD',  [['cod',0.30],['tortilla',3],['lettuce',0.06],['lime',0.6]]],
      ['ct-steak', 'Steak Frites',          'Kitchen',   32, 27, 'DN',   [['beef-steak',0.56],['potato',0.32],['butter',0.04]]],
      ['ct-draft', 'Draft Beer',            'Beer',       9,318, 'LHDN', [['beer-draft',0.125]]],
      ['ct-draft-c','Craft Draft',          'Beer',      11,246, 'LHDN', [['beer-draft',0.125]]],
      ['ct-btl',   'Bottle & Can',          'Beer',       8,136, 'LHDN', [['beer-btl',1]]],
      ['ct-flight','Beer Flight',           'Beer',      14, 58, 'HDN',  [['beer-draft',0.115]]],
      ['ct-cock',  'Bar Cocktails',         'Cocktails', 14, 96, 'HDN',  [['spirit',0.11],['mixer',0.07]]],
      ['ct-shot',  'Shots & Neat Pours',    'Spirits',   11, 64, 'HDN',  [['spirit',0.09]]],
      ['ct-whisk', 'Whiskey Program',       'Spirits',   16, 42, 'HDN',  [['spirit-prem',0.10]]],
      ['ct-wineg', 'Wine by the Glass',     'Wine',      12, 54, 'HDN',  [['wine-glass',0.20]]],
      ['ct-soda',  'Fountain Soda',         'N/A Bev',    4, 92, 'LHDN', [['soda',0.018]]],
      ['ct-na',    'N/A Beer & Zero-Proof', 'N/A Bev',    7, 38, 'HDN',  [['beer-btl',1]]],
      ['ct-wing-d','Wing Wednesday Special','Kitchen',   12, 34, 'DN',   [['chix-wing',0.70],['oil-fry',0.04],['spice',0.02]]],
      ['ct-dess',  'Bread Pudding',         'Desserts',  10, 24, 'DN',   [['bread',0.22],['cream',0.14],['eggs',0.10]]]
    ],
    bnn: [
      ['bn-burg',  "Ben's Classic Burger",  'Grill',     18,168, 'LHDN', [['beef-grnd',0.40],['bun',1],['cheddar',0.07],['potato',0.28],['lettuce',0.04]]],
      ['bn-burg-b',"Nick's Bacon Burger",   'Grill',     21,132, 'LHDN', [['beef-grnd',0.42],['bun',1],['bacon',0.10],['cheddar',0.07],['potato',0.28]]],
      ['bn-burg-v','Veggie Burger',         'Grill',     17, 44, 'LHDN', [['bun',1],['mushroom',0.24],['cheddar',0.05],['potato',0.28]]],
      ['bn-patty', 'Patty Melt',            'Grill',     19, 61, 'LHDN', [['beef-grnd',0.40],['bread',0.30],['cheddar',0.08],['onion',0.10]]],
      ['bn-wing',  'Wings',                 'Starters',  16,114, 'HDN',  [['chix-wing',0.70],['oil-fry',0.04],['spice',0.02]]],
      ['bn-fries', 'Garlic Fries',          'Starters',  10,138, 'LHDN', [['potato',0.44],['oil-fry',0.035],['garlic',0.02]]],
      ['bn-rings', 'Onion Rings',           'Starters',  11, 72, 'HDN',  [['onion',0.34],['flour',0.10],['oil-fry',0.035]]],
      ['bn-nach',  'Nachos',                'Starters',  16, 68, 'HDN',  [['tortilla',14],['cheddar',0.22],['beef-grnd',0.16],['jalapeno',0.04]]],
      ['bn-sand',  'Chicken Sandwich',      'Grill',     17, 87, 'LHDN', [['chix-brst',0.36],['bun',1],['lettuce',0.05],['potato',0.28]]],
      ['bn-dog',   'Rockridge Dog',         'Grill',     13, 46, 'LHDN', [['sausage-it',0.22],['bun',1],['onion',0.06]]],
      ['bn-fish',  'Fish & Chips',          'Grill',     21, 54, 'LHDN', [['cod',0.40],['potato',0.38],['oil-fry',0.05]]],
      ['bn-cae',   'Caesar Salad',          'Salads',    13, 42, 'LHD',  [['lettuce',0.30],['parm',0.05],['dressing',0.07]]],
      ['bn-cobb',  'Cobb Salad',            'Salads',    17, 36, 'LHD',  [['lettuce',0.26],['chix-brst',0.18],['bacon',0.06],['eggs',0.16],['avocado',0.5]]],
      ['bn-tacos', 'Street Tacos',          'Grill',     16, 39, 'LHDN', [['chix-thigh',0.28],['tortilla',3],['onion',0.05],['lime',0.6]]],
      ['bn-chili', 'Game Day Chili',        'Starters',  12, 33, 'HDN',  [['beef-chuck',0.24],['onion',0.10],['cheddar',0.05],['spice',0.02]]],
      ['bn-draft', 'Draft Beer',            'Beer',       9,282, 'LHDN', [['beer-draft',0.125]]],
      ['bn-btl',   'Bottle & Can',          'Beer',       8,124, 'LHDN', [['beer-btl',1]]],
      ['bn-pitch', 'Beer Pitcher',          'Beer',      28, 46, 'HDN',  [['beer-draft',0.50]]],
      ['bn-cock',  'Bar Cocktails',         'Cocktails', 14, 88, 'HDN',  [['spirit',0.11],['mixer',0.07]]],
      ['bn-shot',  'Shots',                 'Spirits',   10, 52, 'HDN',  [['spirit',0.09]]],
      ['bn-wineg', 'Wine by the Glass',     'Wine',      12, 41, 'HDN',  [['wine-glass',0.20]]],
      ['bn-soda',  'Fountain Soda',         'N/A Bev',    4,104, 'LHDN', [['soda',0.018]]],
      ['bn-dess',  'Sundae',                'Desserts',   9, 28, 'DN',   [['cream',0.18]]]
    ]
  };

  var DP_MAP = { L: 'lunch', H: 'happy', D: 'dinner', N: 'late' };

  RG.MENU = [];
  Object.keys(MENUS).forEach(function (brand) {
    MENUS[brand].forEach(function (r) {
      RG.MENU.push({
        id: r[0], brand: brand, name: r[1], category: r[2],
        basePrice: r[3], weight: r[4],
        dayparts: r[5].split('').map(function (c) { return DP_MAP[c]; }),
        recipe: r[6].map(function (x) { return { ing: x[0], qty: x[1] }; }),
        /* beverage categories carry no packaging and never travel */
        bev: ['Beer','Wine','Cocktails','Spirits','N/A Bev'].indexOf(r[2]) >= 0
      });
    });
  });
  RG.menuById = {};
  RG.MENU.forEach(function (m) { RG.menuById[m.id] = m; });
  RG.menuFor = function (brandId) {
    return RG.MENU.filter(function (m) { return m.brand === brandId; });
  };

  /* Menu price on a date — base price stepped by the brand's price moves,
     rounded to a real menu number (whole dollar under $30, else nearest $1). */
  RG.menuPrice = function (itemId, isoDate) {
    var m = RG.menuById[itemId];
    if (!m) return 0;
    var moves = PRICE_MOVES[m.brand] || [];
    var p = m.basePrice, ts = RG.CAL.toTs(isoDate);
    for (var i = 0; i < moves.length; i++) {
      if (ts >= RG.CAL.toTs(moves[i][0])) p *= 1 + moves[i][1];
    }
    return Math.round(p);   /* menus are priced in whole dollars here */
  };
  RG.PRICE_MOVES = PRICE_MOVES;

  /* ---- portion calibration ----
     The recipe quantities above are written as readable per-plate portions.
     These two factors calibrate the ingredient master so each brand lands
     inside its real-world cost band: full-service food cost 28-32%, pour
     cost 20-23%. Kept explicit rather than baked into 100 recipe lines, so
     a single number moves the whole model when a real spec sheet arrives. */
  RG.PORTION_SCALE = { food: 1.82, bev: 1.24 };

  /* Theoretical plate cost on a date = sum of recipe lines at that day's
     ingredient cost. Off-premise adds packaging. */
  RG.plateCost = function (itemId, isoDate, packaged) {
    var m = RG.menuById[itemId];
    if (!m) return 0;
    var scale = m.bev ? RG.PORTION_SCALE.bev : RG.PORTION_SCALE.food;
    var c = 0;
    for (var i = 0; i < m.recipe.length; i++) {
      c += RG.ingCost(m.recipe[i].ing, isoDate) * m.recipe[i].qty * scale;
    }
    if (packaged && !m.bev) c += RG.ingCost('togo', isoDate) * 1.4;
    return R.cents(c);
  };
})(typeof window !== 'undefined' ? window : globalThis);
