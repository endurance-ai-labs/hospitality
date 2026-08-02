/* ============================================================
   Restaurant OS — the client layer
   Everything company-specific lives in this one file.

   TARGET: Mazra — Mediterranean / Levantine grill, two locations.

   DATA PROVENANCE (enforced by scripts/verify.mjs):
     real:true   → publicly reported and verifiable — the trading name,
                   both street addresses, the founding family, the
                   conversion from Green Valley Market, the opening
                   dates, and the fact that Mazra serves no alcohol.
     real:false  → fictional demo values: every dollar, seat count, sales
                   trait, lease term and staff member below the family.
   Sources: Palo Alto Online / Redwood City Pulse 03-06-2024; San Mateo
   Daily Journal 03-2024; the restaurants' own public listings.
   ============================================================ */
(function (global) {
  var RG = global.RG || (global.RG = {});

  RG.COMPANY = {
    name: 'Mazra',
    legalNote: 'Entity structure to be confirmed in discovery',
    founded: 2021,
    real: true,
    hq: 'San Bruno, California',
    fyLabel: '13-period fiscal calendar, periods start Monday',
    note: 'Family-owned. The San Bruno restaurant was converted from Green Valley ' +
          'Market, the family grocery. Ranked #23 on Yelp’s Top 100 Places to Eat ' +
          'in the US in 2024 — the highest-placed Bay Area restaurant.'
  };

  /* One brand, two formats: the original grill, and Redwood City which
     adds a cafe bar. */
  RG.BRANDS = [
    { id: 'mazra', name: 'Mazra', cuisine: 'Mediterranean · Levantine grill',
      accent: '#1baf7a', real: true }
  ];

  /* ---- units ----
     Addresses and opening dates are public. Seats, square footage, rent,
     sales traits and everything else below are FICTIONAL. */
  RG.UNITS = [
    {
      id: 'mz-sb', brand: 'mazra', format: 'Grill',
      name: 'Mazra — San Bruno', short: 'San Bruno',
      city: 'San Bruno', state: 'CA', corridor: '504 San Bruno Ave W',
      addressConfirmed: true, real: true,
      opened: '2021-03-15', openedSource: 'public',
      seats: 54, bar: 0, sqft: 2100, patio: false,
      base: 7800, ppa: 28.50, growth: 0.072,
      chan: { dinein: 0.42, takeout: 0.30, delivery: 0.23, catering: 0.05 },
      liquor: 'none', region: 'Peninsula', comp: true,
      rent: 15500, camMonthly: 1900, pctRentBreak: 0, pctRentRate: 0,
      leaseEnd: '2031-02-28', options: '1 x 5 yr',
      pos: 'Toast', cafe: false,
      notes: 'The original, converted from the family grocery. Small room, very high ' +
             'volume per seat, heavy takeout.'
    },
    {
      id: 'mz-rwc', brand: 'mazra', format: 'Grill + Cafe',
      name: 'Mazra — Redwood City', short: 'Redwood City',
      city: 'Redwood City', state: 'CA', corridor: '221 Broadway',
      addressConfirmed: true, real: true,
      opened: '2024-04-02', openedSource: 'public',
      seats: 88, bar: 12, sqft: 3400, patio: true,
      base: 9200, ppa: 31.00, growth: 0.115,
      chan: { dinein: 0.52, takeout: 0.26, delivery: 0.18, catering: 0.04 },
      liquor: 'none', region: 'Peninsula', comp: true,
      rent: 27000, camMonthly: 3100, pctRentBreak: 0, pctRentRate: 0,
      leaseEnd: '2034-03-31', options: '2 x 5 yr',
      pos: 'Toast', cafe: true,
      notes: 'Opened April 2024. Adds a cafe bar — Turkish coffee, Lebanese mocktails ' +
             'and a La Marzocco espresso program. Still ramping.'
    }
  ];

  RG.unitById = {};
  RG.UNITS.forEach(function (u) { RG.unitById[u.id] = u; });

  /* ---- roles & permission matrix ---- */
  RG.PERMISSIONS = ['sales', 'money', 'wages', 'margins', 'people', 'admin', 'allunits'];

  RG.ROLES = {
    principal:  { label: 'Owner',              perms: ['sales','money','wages','margins','people','admin','allunits'] },
    exec:       { label: 'Co-Founder',         perms: ['sales','money','wages','margins','people','admin','allunits'] },
    finance:    { label: 'Finance',            perms: ['sales','money','wages','margins','allunits'] },
    areamgr:    { label: 'Multi-unit Manager', perms: ['sales','margins','people','allunits'] },
    gm:         { label: 'General Manager',    perms: ['sales','margins','people'] },
    chef:       { label: 'Kitchen Leadership', perms: ['sales','margins','allunits'] },
    marketing:  { label: 'Marketing',          perms: ['sales','allunits'] },
    people:     { label: 'People Ops',         perms: ['people','wages','allunits'] },
    staff:      { label: 'Team Member',        perms: [] },
    external:   { label: 'External / Advisor', perms: ['sales'] }
  };

  /* The three named family members are publicly reported. Everyone below
     the line is fictional demo staffing — never present them as real. */
  RG.PEOPLE = [
    { id: 'tmakableh', name: 'Thouqan Makableh', title: 'Owner',      role: 'principal', units: 'all', real: true },
    { id: 'jmakableh', name: 'Jordan Makableh',  title: 'Co-Founder', role: 'exec',      units: 'all', real: true },
    { id: 'smakableh', name: 'Saif Makableh',    title: 'Co-Founder', role: 'exec',      units: 'all', real: true },

    { id: 'controller', name: 'Nadia Haddad',   title: 'Controller',            role: 'finance',   units: 'all', real: false },
    { id: 'chef',       name: 'Karim Doughan',  title: 'Executive Chef',        role: 'chef',      units: 'all', real: false },
    { id: 'ops',        name: 'Layla Faris',    title: 'Multi-unit Manager',    role: 'areamgr',   units: 'all', real: false },
    { id: 'mktg',       name: 'Rana Aziz',      title: 'Marketing & Community', role: 'marketing', units: 'all', real: false },
    { id: 'people',     name: 'Omar Sabbagh',   title: 'People Operations',     role: 'people',    units: 'all', real: false },

    { id: 'gm-sb',  name: 'Dana Khoury',   title: 'GM — San Bruno',    role: 'gm', units: ['mz-sb'],  real: false },
    { id: 'gm-rwc', name: 'Elias Mansour', title: 'GM — Redwood City', role: 'gm', units: ['mz-rwc'], real: false },

    { id: 'ext-cpa', name: 'Outside CPA', title: 'Tax & Advisory', role: 'external', units: 'all', real: false }
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

  /* ---- job codes ----
     No bartender role: Mazra serves no alcohol. The Redwood City bar is a
     coffee and mocktail cafe, so the role is Barista. */
  RG.JOBCODES = [
    { id: 'server',   label: 'Server',          boh: false, tipped: true,  rate: [18.50, 20.75] },
    { id: 'barista',  label: 'Barista',         boh: false, tipped: true,  rate: [19.00, 21.50] },
    { id: 'host',     label: 'Host / Counter',  boh: false, tipped: true,  rate: [18.00, 19.75] },
    { id: 'busser',   label: 'Busser / Runner', boh: false, tipped: true,  rate: [18.00, 19.75] },
    { id: 'grill',    label: 'Grill Cook',      boh: true,  tipped: false, rate: [23.00, 28.00] },
    { id: 'prep',     label: 'Prep Cook',       boh: true,  tipped: false, rate: [19.50, 23.00] },
    { id: 'dish',     label: 'Dishwasher',      boh: true,  tipped: false, rate: [18.00, 20.00] },
    { id: 'sous',     label: 'Sous Chef',       boh: true,  tipped: false, rate: [28.00, 34.00] },
    { id: 'mgr',      label: 'Manager',         boh: false, tipped: false, rate: [34.00, 41.00], salaried: true }
  ];

  /* ---- vendors. No beer, wine or spirits distributor. ---- */
  RG.VENDORS = [
    { id: 'sysco',   name: 'Sysco',                 cat: 'broadline', feed: 'EDI 810/850',     days: [0, 3], terms: 'Net 21', real: true },
    { id: 'usfoods', name: 'US Foods',              cat: 'broadline', feed: 'MOXē API',   days: [1, 4], terms: 'Net 21', real: true },
    { id: 'halal',   name: 'Peninsula Halal Meats', cat: 'protein',   feed: 'PDF invoice',     days: [1, 4], terms: 'Net 14', real: false },
    { id: 'produce', name: 'Bay Area Produce Co.',  cat: 'produce',   feed: 'PDF invoice',     days: [0,1,2,3,4,5], terms: 'Net 14', real: false },
    { id: 'levant',  name: 'Levant Foods Import',   cat: 'specialty', feed: 'PDF invoice',     days: [2], terms: 'Net 30', real: false },
    { id: 'bakery',  name: 'Pacific Pita Bakery',   cat: 'bakery',    feed: 'PDF invoice',     days: [0,1,2,3,4,5,6], terms: 'Net 14', real: false },
    { id: 'dairy',   name: 'Clover Sonoma',         cat: 'dairy',     feed: 'PDF invoice',     days: [0, 2, 4], terms: 'Net 14', real: true },
    { id: 'coffee',  name: 'Mr. Espresso',          cat: 'coffee',    feed: 'PDF invoice',     days: [1], terms: 'Net 14', real: true },
    { id: 'paper',   name: 'Restaurant Depot',      cat: 'paper',     feed: 'Receipt capture', days: [1], terms: 'COD', real: true }
  ];
  RG.vendorById = {};
  RG.VENDORS.forEach(function (v) { RG.vendorById[v.id] = v; });

  /* ---- the stack. Everything flagged assumed until discovery. ---- */
  RG.SYSTEMS = [
    { id: 'toast',      name: 'Toast',                   domain: 'POS',                 tier: 1, units: 'all', assumed: true },
    { id: 'deliverect', name: 'Deliverect',              domain: 'Delivery middleware', tier: 1, units: 'all', assumed: true },
    { id: 'doordash',   name: 'DoorDash',                domain: 'Marketplace',         tier: 2, units: 'all', assumed: true },
    { id: 'ubereats',   name: 'Uber Eats',               domain: 'Marketplace',         tier: 2, units: 'all', assumed: true },
    { id: '7shifts',    name: '7shifts',                 domain: 'Scheduling',          tier: 1, units: 'all', assumed: true },
    { id: 'adp',        name: 'ADP',                     domain: 'Payroll',             tier: 2, units: 'all', assumed: true },
    { id: 'r365',       name: 'Restaurant365',           domain: 'Back office / GL',    tier: 2, units: 'all', assumed: true },
    { id: 'qbo',        name: 'QuickBooks Online',       domain: 'Accounting',          tier: 1, units: 'all', assumed: true },
    { id: 'gbp',        name: 'Google Business Profile', domain: 'Reputation',          tier: 1, units: 'all', assumed: false },
    { id: 'yelp',       name: 'Yelp',                    domain: 'Reputation',          tier: 2, units: 'all', assumed: false },
    { id: 'sysco',      name: 'Sysco',                   domain: 'Supplier',            tier: 3, units: 'all', assumed: true },
    { id: 'plaid',      name: 'Bank feeds (Plaid)',      domain: 'Treasury',            tier: 1, units: 'all', assumed: true },
    { id: 'docs',       name: 'Vendor PDF invoices',     domain: 'Document ingest',     tier: 4, units: 'all', assumed: false },
    { id: 'health',     name: 'County health inspections', domain: 'Compliance',        tier: 4, units: 'all', assumed: false }
  ];

  RG.CHANNELS = [
    { id: 'dinein',   label: 'Dine-in',   commission: 0,     source: 'POS' },
    { id: 'takeout',  label: 'Takeout',   commission: 0,     source: 'POS' },
    { id: 'delivery', label: 'Delivery',  commission: 0.238, source: 'Deliverect' },
    { id: 'catering', label: 'Catering',  commission: 0,     source: 'POS' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
