/* ============================================================
   Restaurant OS — the client layer
   Everything company-specific lives in this one file. Swap it and the
   entire engine retargets to a different restaurant group.

   TARGET: 1100 Group — 8 restaurants, 4 brands, CA + OR.

   DATA PROVENANCE (enforced by scripts/verify.mjs):
     real:true   → publicly verifiable (brand names, cities, corridors,
                   founder/COO names, founding years). Do not invent these.
     real:false  → fictional demo values (all money, seats, sales traits,
                   staff below the two named principals, vendor terms).
   Street numbers are deliberately absent — confirm in discovery rather
   than fabricate an address that resolves to a real neighbour's door.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  RG.COMPANY = {
    name: '1100 Group',
    legalNote: 'Entity structure to be confirmed in discovery',
    founded: 2016,
    real: true,
    hq: 'Oakland, California',
    site: '1100group.com',
    fyLabel: '13-period fiscal calendar, periods start Monday'
  };

  /* ---- brands. The Star and Little Star are two formats of one brand. ---- */
  RG.BRANDS = [
    { id: 'camino', name: 'Bar Camino',      cuisine: 'Spanish · tapas · cocktails', accent: '#b1503f', real: true },
    { id: 'star',   name: 'Little Star',     cuisine: 'Chicago deep-dish · pizza',   accent: '#C99245', real: true },
    { id: 'catos',  name: "Cato's Ale House", cuisine: 'Ale house · pub kitchen',    accent: '#6FA57E', real: true },
    { id: 'bnn',    name: "Ben 'N Nick's",   cuisine: 'Bar & grill · burgers',       accent: '#2766d6', real: true }
  ];

  /* ---- units ----
     base   = fictional average weekday net sales, the engine's anchor
     ppa    = per-person average, dine-in
     growth = annual same-store trend applied continuously
     chan   = channel mix (dine-in / takeout / delivery / catering)
     Seats, sq ft, rent and every trait below are FICTIONAL. */
  RG.UNITS = [
    {
      id: 'bc-wc', brand: 'camino', format: 'Bar Camino',
      name: 'Bar Camino', short: 'Camino WC',
      city: 'Walnut Creek', state: 'CA', corridor: 'Downtown Walnut Creek',
      addressConfirmed: false, real: true,
      opened: '2022-04-11', openedSource: 'assumed',
      seats: 96, bar: 18, sqft: 3900, patio: true,
      base: 11800, ppa: 52.00, growth: 0.061,
      chan: { dinein: 0.74, takeout: 0.11, delivery: 0.08, catering: 0.07 },
      liquor: 'full', region: 'East Bay', comp: true,
      rent: 27500, camMonthly: 4100, pctRentBreak: 4300000, pctRentRate: 0.06,
      leaseEnd: '2032-03-31', options: '2 x 5 yr',
      pos: 'Toast', notes: 'Newest and highest-check unit. Bar program drives the mix.'
    },
    {
      id: 'star-grand', brand: 'star', format: 'The Star',
      name: 'The Star — Grand Ave', short: 'Star Grand',
      city: 'Oakland', state: 'CA', corridor: 'Grand Avenue',
      addressConfirmed: false, real: true,
      opened: '2019-09-05', openedSource: 'assumed',
      seats: 84, bar: 12, sqft: 3100, patio: true,
      base: 9400, ppa: 29.00, growth: 0.028,
      chan: { dinein: 0.58, takeout: 0.19, delivery: 0.21, catering: 0.02 },
      liquor: 'beer_wine', region: 'East Bay', comp: true,
      rent: 19800, camMonthly: 2600, pctRentBreak: 0, pctRentRate: 0,
      leaseEnd: '2029-08-31', options: '1 x 5 yr',
      pos: 'Toast', notes: 'Heaviest delivery mix in the group.'
    },
    {
      id: 'star-alameda', brand: 'star', format: 'The Star',
      name: 'The Star — Park St', short: 'Star Alameda',
      city: 'Alameda', state: 'CA', corridor: 'Park Street',
      addressConfirmed: false, real: true,
      opened: '2021-06-17', openedSource: 'assumed',
      seats: 72, bar: 10, sqft: 2700, patio: false,
      base: 7900, ppa: 27.50, growth: 0.034,
      chan: { dinein: 0.60, takeout: 0.22, delivery: 0.16, catering: 0.02 },
      liquor: 'beer_wine', region: 'East Bay', comp: true,
      rent: 15400, camMonthly: 1900, pctRentBreak: 0, pctRentRate: 0,
      leaseEnd: '2031-05-31', options: '2 x 5 yr',
      pos: 'Toast', notes: 'Steady neighbourhood volume, low variance.'
    },
    {
      id: 'star-pdx', brand: 'star', format: 'The Star',
      name: 'The Star — Portland', short: 'Star PDX',
      city: 'Portland', state: 'OR', corridor: 'Portland',
      addressConfirmed: false, real: true,
      opened: '2023-10-02', openedSource: 'assumed',
      seats: 78, bar: 14, sqft: 2950, patio: true,
      base: 6900, ppa: 26.50, growth: -0.018,
      chan: { dinein: 0.55, takeout: 0.20, delivery: 0.23, catering: 0.02 },
      liquor: 'beer_wine', region: 'Oregon', comp: true,
      rent: 13200, camMonthly: 1700, pctRentBreak: 0, pctRentRate: 0,
      leaseEnd: '2033-09-30', options: '2 x 5 yr',
      pos: 'Square', notes: 'PROBLEM CHILD — out-of-state, different POS, negative trend.'
    },
    {
      id: 'lstar-valencia', brand: 'star', format: 'Little Star',
      name: 'Little Star — Valencia', short: 'LS Valencia',
      city: 'San Francisco', state: 'CA', corridor: 'Valencia Street',
      addressConfirmed: false, real: true,
      opened: '2004-11-12', openedSource: 'assumed',
      seats: 68, bar: 12, sqft: 2400, patio: false,
      base: 10600, ppa: 31.00, growth: 0.019,
      chan: { dinein: 0.56, takeout: 0.18, delivery: 0.24, catering: 0.02 },
      liquor: 'beer_wine', region: 'San Francisco', comp: true,
      rent: 24600, camMonthly: 3200, pctRentBreak: 3900000, pctRentRate: 0.055,
      leaseEnd: '2028-10-31', options: '1 x 5 yr',
      pos: 'Toast', notes: 'Highest rent per square foot. Percentage rent in play.'
    },
    {
      id: 'lstar-solano', brand: 'star', format: 'Little Star',
      name: 'Little Star — Solano', short: 'LS Solano',
      city: 'Albany', state: 'CA', corridor: 'Solano Avenue',
      addressConfirmed: false, real: true,
      opened: '2011-03-08', openedSource: 'assumed',
      seats: 62, bar: 8, sqft: 2200, patio: false,
      base: 8100, ppa: 28.00, growth: 0.024,
      chan: { dinein: 0.59, takeout: 0.23, delivery: 0.16, catering: 0.02 },
      liquor: 'beer_wine', region: 'East Bay', comp: true,
      rent: 14100, camMonthly: 1800, pctRentBreak: 0, pctRentRate: 0,
      leaseEnd: '2030-02-28', options: '2 x 5 yr',
      pos: 'Toast', notes: 'Consistent performer, best food cost in the group.'
    },
    {
      id: 'catos', brand: 'catos', format: "Cato's Ale House",
      name: "Cato's Ale House", short: "Cato's",
      city: 'Oakland', state: 'CA', corridor: 'Piedmont Avenue',
      addressConfirmed: false, real: true,
      opened: '1994-05-20', openedSource: 'public',
      seats: 110, bar: 26, sqft: 4200, patio: true,
      base: 8600, ppa: 27.00, growth: 0.008,
      chan: { dinein: 0.82, takeout: 0.12, delivery: 0.05, catering: 0.01 },
      liquor: 'full', region: 'East Bay', comp: true,
      rent: 16900, camMonthly: 2200, pctRentBreak: 0, pctRentRate: 0,
      leaseEnd: '2027-06-30', options: 'none — renewal decision due',
      pos: 'Square', notes: 'Est. 1994. Beverage-led. Lease option decision inside 12 months.'
    },
    {
      id: 'bnn', brand: 'bnn', format: "Ben 'N Nick's",
      name: "Ben 'N Nick's", short: "Ben 'N Nick's",
      city: 'Oakland', state: 'CA', corridor: 'Rockridge',
      addressConfirmed: false, real: true,
      opened: '1997-08-15', openedSource: 'public',
      seats: 92, bar: 20, sqft: 3400, patio: true,
      base: 7700, ppa: 28.00, growth: 0.013,
      chan: { dinein: 0.76, takeout: 0.15, delivery: 0.08, catering: 0.01 },
      liquor: 'full', region: 'East Bay', comp: true,
      rent: 15200, camMonthly: 2000, pctRentBreak: 0, pctRentRate: 0,
      leaseEnd: '2029-12-31', options: '1 x 5 yr',
      pos: 'Square', notes: 'Est. 1997. Sports-driven weekend spikes.'
    }
  ];

  RG.unitById = {};
  RG.UNITS.forEach(function (u) { RG.unitById[u.id] = u; });

  /* ---- roles & permission matrix (drives the sign-in overlay) ---- */
  RG.PERMISSIONS = ['sales', 'money', 'wages', 'margins', 'people', 'admin', 'allunits'];

  RG.ROLES = {
    principal:  { label: 'Principal',           perms: ['sales','money','wages','margins','people','admin','allunits'] },
    exec:       { label: 'Executive',           perms: ['sales','money','wages','margins','people','admin','allunits'] },
    finance:    { label: 'Finance',             perms: ['sales','money','wages','margins','allunits'] },
    areamgr:    { label: 'Area Manager',        perms: ['sales','margins','people'] },
    gm:         { label: 'General Manager',     perms: ['sales','margins','people'] },
    chef:       { label: 'Culinary',            perms: ['sales','margins','allunits'] },
    marketing:  { label: 'Marketing',           perms: ['sales','allunits'] },
    people:     { label: 'People Ops',          perms: ['people','wages','allunits'] },
    staff:      { label: 'Team Member',         perms: [] },
    external:   { label: 'External / Advisor',  perms: ['sales'] }
  };

  /* Only the first two are real, publicly-known people. Everyone below the
     line is fictional demo staffing — never present them as real employees. */
  RG.PEOPLE = [
    { id: 'jguhl',   name: 'Jon Guhl',        title: 'Founder',                    role: 'principal', units: 'all', real: true },
    { id: 'sorr',    name: 'Shannon Orr',     title: 'Chief Operating Officer',    role: 'exec',      units: 'all', real: true },

    { id: 'dnakamura', name: 'Dana Nakamura', title: 'Controller',                 role: 'finance',   units: 'all', real: false },
    { id: 'rvillalobos', name: 'Rafael Villalobos', title: 'Director of Culinary', role: 'chef',      units: 'all', real: false },
    { id: 'ktobin',  name: 'Kerry Tobin',     title: 'Area Manager — East Bay',    role: 'areamgr',   units: ['star-grand','star-alameda','lstar-solano','catos','bnn'], real: false },
    { id: 'mabara',  name: 'Michal Abara',    title: 'Area Manager — SF & PDX',    role: 'areamgr',   units: ['lstar-valencia','star-pdx','bc-wc'], real: false },
    { id: 'pcaldera', name: 'Priya Caldera',  title: 'Director of Marketing',      role: 'marketing', units: 'all', real: false },
    { id: 'tokafor', name: 'Tunde Okafor',    title: 'People Operations Manager',  role: 'people',    units: 'all', real: false },

    { id: 'gm-bcwc',  name: 'Elena Marchetti', title: 'GM — Bar Camino',           role: 'gm', units: ['bc-wc'], real: false },
    { id: 'gm-grand', name: 'Desmond Pike',    title: 'GM — The Star Grand',       role: 'gm', units: ['star-grand'], real: false },
    { id: 'gm-alam',  name: 'Rosa Beltran',    title: 'GM — The Star Park St',     role: 'gm', units: ['star-alameda'], real: false },
    { id: 'gm-pdx',   name: 'Colin Deveraux',  title: 'GM — The Star Portland',    role: 'gm', units: ['star-pdx'], real: false },
    { id: 'gm-val',   name: 'Ana Sotelo',      title: 'GM — Little Star Valencia', role: 'gm', units: ['lstar-valencia'], real: false },
    { id: 'gm-sol',   name: 'Marcus Yee',      title: 'GM — Little Star Solano',   role: 'gm', units: ['lstar-solano'], real: false },
    { id: 'gm-catos', name: 'Bridget Halloran', title: "GM — Cato's Ale House",    role: 'gm', units: ['catos'], real: false },
    { id: 'gm-bnn',   name: 'Theo Ramsbeck',   title: "GM — Ben 'N Nick's",        role: 'gm', units: ['bnn'], real: false },

    { id: 'ext-cpa',  name: 'Outside CPA',     title: 'Tax & Advisory',            role: 'external', units: 'all', real: false }
  ];

  RG.personById = {};
  RG.PEOPLE.forEach(function (p) { RG.personById[p.id] = p; });

  RG.can = function (personId, perm) {
    var p = RG.personById[personId];
    if (!p) return false;
    return (RG.ROLES[p.role].perms || []).indexOf(perm) >= 0;
  };
  RG.unitsFor = function (personId) {
    var p = RG.personById[personId];
    if (!p) return [];
    return p.units === 'all' ? RG.UNITS.map(function (u) { return u.id; }) : p.units;
  };

  /* ---- job codes: the labor spine ---- */
  RG.JOBCODES = [
    { id: 'server',   label: 'Server',        boh: false, tipped: true,  rate: [18.50, 20.25] },
    { id: 'bartender',label: 'Bartender',     boh: false, tipped: true,  rate: [19.75, 22.00] },
    { id: 'host',     label: 'Host',          boh: false, tipped: true,  rate: [18.00, 19.50] },
    { id: 'busser',   label: 'Busser / Runner', boh: false, tipped: true, rate: [18.00, 19.75] },
    { id: 'line',     label: 'Line Cook',     boh: true,  tipped: false, rate: [22.00, 26.50] },
    { id: 'prep',     label: 'Prep Cook',     boh: true,  tipped: false, rate: [19.50, 22.75] },
    { id: 'dish',     label: 'Dishwasher',    boh: true,  tipped: false, rate: [18.00, 20.00] },
    { id: 'sous',     label: 'Sous Chef',     boh: true,  tipped: false, rate: [28.00, 33.00] },
    { id: 'mgr',      label: 'Manager',       boh: false, tipped: false, rate: [34.00, 41.00], salaried: true }
  ];

  /* ---- vendors ---- */
  RG.VENDORS = [
    { id: 'sysco',    name: 'Sysco',                 cat: 'broadline',  feed: 'EDI 810/850',      days: [0, 3], terms: 'Net 21', real: true },
    { id: 'usfoods',  name: 'US Foods',              cat: 'broadline',  feed: 'MOXe API',         days: [1, 4], terms: 'Net 21', real: true },
    { id: 'produce',  name: 'Bay Area Produce Co.',  cat: 'produce',    feed: 'PDF invoice',      days: [0,1,2,3,4,5], terms: 'Net 14', real: false },
    { id: 'meat',     name: 'Golden Gate Meat Co.',  cat: 'protein',    feed: 'PDF invoice',      days: [1, 4], terms: 'Net 14', real: false },
    { id: 'seafood',  name: 'Pacific Coast Seafood', cat: 'seafood',    feed: 'PDF invoice',      days: [2, 5], terms: 'Net 7',  real: false },
    { id: 'dairy',    name: 'Clover Sonoma',         cat: 'dairy',      feed: 'PDF invoice',      days: [0, 2, 4], terms: 'Net 14', real: true },
    { id: 'bakery',   name: 'Acme Bread Company',    cat: 'bakery',     feed: 'PDF invoice',      days: [0,1,2,3,4,5,6], terms: 'Net 14', real: true },
    { id: 'beerdist', name: 'Matagrano Inc.',        cat: 'beer',       feed: 'PDF invoice',      days: [2], terms: 'COD', real: false },
    { id: 'winedist', name: 'Vintage Wine Merchants', cat: 'wine',      feed: 'Provi',            days: [3], terms: 'Net 30', real: false },
    { id: 'spirits',  name: 'Southern Glazer\'s',    cat: 'spirits',    feed: 'Provi',            days: [3], terms: 'Net 30', real: true },
    { id: 'paper',    name: 'Restaurant Depot',      cat: 'paper',      feed: 'Receipt capture',  days: [1], terms: 'COD', real: true },
    { id: 'coffee',   name: 'Mr. Espresso',          cat: 'coffee',     feed: 'PDF invoice',      days: [1], terms: 'Net 14', real: true }
  ];
  RG.vendorById = {};
  RG.VENDORS.forEach(function (v) { RG.vendorById[v.id] = v; });

  /* ---- the stack, as it will render on the Integrations page ----
     tier 1 live API+webhook · 2 scheduled pull · 3 file/EDI/SFTP · 4 document ingest
     "assumed" flags what still needs confirming in discovery. */
  RG.SYSTEMS = [
    { id: 'toast',    name: 'Toast',            domain: 'POS',            tier: 1, units: ['bc-wc','star-grand','star-alameda','lstar-valencia','lstar-solano'], assumed: true },
    { id: 'square',   name: 'Square',           domain: 'POS',            tier: 1, units: ['star-pdx','catos','bnn'], assumed: true },
    { id: 'deliverect', name: 'Deliverect',     domain: 'Delivery middleware', tier: 1, units: 'all', assumed: true },
    { id: 'doordash', name: 'DoorDash',         domain: 'Marketplace',    tier: 2, units: 'all', assumed: true },
    { id: 'ubereats', name: 'Uber Eats',        domain: 'Marketplace',    tier: 2, units: 'all', assumed: true },
    { id: 'opentable',name: 'OpenTable',        domain: 'Reservations',   tier: 2, units: ['bc-wc','lstar-valencia','catos'], assumed: true },
    { id: '7shifts',  name: '7shifts',          domain: 'Scheduling',     tier: 1, units: 'all', assumed: true },
    { id: 'adp',      name: 'ADP',              domain: 'Payroll',        tier: 2, units: 'all', assumed: true },
    { id: 'r365',     name: 'Restaurant365',    domain: 'Back office / GL', tier: 2, units: 'all', assumed: true },
    { id: 'qbo',      name: 'QuickBooks Online', domain: 'Accounting',    tier: 1, units: 'all', assumed: true },
    { id: 'gbp',      name: 'Google Business Profile', domain: 'Reputation', tier: 1, units: 'all', assumed: false },
    { id: 'yelp',     name: 'Yelp',             domain: 'Reputation',     tier: 2, units: 'all', assumed: false },
    { id: 'sysco',    name: 'Sysco',            domain: 'Supplier',       tier: 3, units: 'all', assumed: true },
    { id: 'usfoods',  name: 'US Foods',         domain: 'Supplier',       tier: 3, units: 'all', assumed: true },
    { id: 'plaid',    name: 'Bank feeds (Plaid)', domain: 'Treasury',     tier: 1, units: 'all', assumed: true },
    { id: 'docs',     name: 'Vendor PDF invoices', domain: 'Document ingest', tier: 4, units: 'all', assumed: false },
    { id: 'health',   name: 'County health inspections', domain: 'Compliance', tier: 4, units: 'all', assumed: false }
  ];

  /* channels, with the economics the off-premise module needs */
  RG.CHANNELS = [
    { id: 'dinein',   label: 'Dine-in',   commission: 0,     source: 'POS' },
    { id: 'takeout',  label: 'Takeout',   commission: 0,     source: 'POS' },
    { id: 'delivery', label: 'Delivery',  commission: 0.238, source: 'Deliverect' },
    { id: 'catering', label: 'Catering',  commission: 0,     source: 'POS' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
