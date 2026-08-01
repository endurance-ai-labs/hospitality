# Restaurant OS — Brain Powered Operating System

Institutional operations portal for a multi-unit restaurant group, built on the
same framework as the Y8S (Yates) and CFP/Blackwater portals.

**Target:** 1100 Group — 8 restaurants, 4 brands, CA + OR.
The client layer is isolated to `js/data-company.js`; swap that one file and the
entire engine retargets to a different group.

Design brief and discovery kit live in `../restaurant-os-prompt/`.

---

## Status

| Phase | What | State |
|---|---|---|
| 0 | Discovery | Kit written, not yet run with the client |
| **1** | **Deterministic dataset engine** | **Done — 201/201 tie-out checks pass** |
| **2** | **Framework: nav, sign-in, Brain FAB, tooltips** | **Done — browser-verified** |
| **3-8** | **All 19 pages** | **Done — 228/228 checks pass, every route verified** |

---

## Commands

```bash
npm run verify
```

Loads the browser scripts in Node and asserts every cross-module identity to the
cent. **Run before any deploy.** 201 checks across 11 groups: PMIX→sales, net
sales identity, channel/daypart splits, food-cost bridge, purchasing
reconciliation, P&L identities, consolidation, variance bridges, determinism,
data provenance, and industry sanity bands.

```bash
npm run build
```

Bakes period-grain aggregates to three static payloads (~40s). Rerun after any
engine change, then re-verify.

---

## Architecture

```
js/
  rand.js               deterministic PRNG + allocate() — the tie-out workhorse
  data-calendar.js      13x28 fiscal calendar, dayparts, holidays
  data-company.js       CLIENT LAYER — units, people, roles, vendors, systems
  data-menu.js          ingredients, commodity indexes, recipes, menu, prices
  engine-sales.js       demand -> integer PMIX -> gross -> net
  engine-labor.js       roster, shifts, punches, OT, CA break premiums
  engine-cogs.js        theoretical vs actual, 5 named drivers, purchasing
  engine-finance.js     P&L, percentage rent, variance bridges
  model.js              MODEL assembly, scorecard, KPIs, anomaly triage
  model-precomputed.js  GENERATED — core payload, every page (59 KB gz)
  model-daily.js        GENERATED — daily series, trend pages only (188 KB gz)
  model-pmix.js         GENERATED — period PMIX, menu page only (63 KB gz)
```

Load order matters — each file attaches to the single global `RG` namespace.
A single namespace is a deliberate departure from the Yates portal's bare
globals: it removes the global-collision and TDZ class of bug documented in the
Yates notes.

### The rules the engine enforces

**PMIX is the atom.** Net sales are never generated. A demand signal produces
integer item quantities; gross sales are the sum of quantity x that day's menu
price. Everything downstream re-aggregates the same integers, so the exec
dashboard, the menu page, the P&L revenue line and the bank deposit cannot
disagree. `verify.mjs` check [1] proves it at both period and day grain.

**Bridges close by construction.** Actual food cost is theoretical plus five
named drivers (portioning, waste, spoilage, purchase price, unexplained), so
"variance was $23,299" always decomposes into parts that sum exactly to the
whole. Sales and labor bridges are decomposed analytically, not allocated:
`traffic = (Nb - Na) x Ca`, `check = Nb x (Cb - Ca)`, which sum to the total
identically.

**Nothing calls `Math.random()` or `Date.now()`.** Every value traces to a
string seed. Check [9] rebuilds the engine in a fresh VM context and asserts
byte-identical output.

**Provenance is enforced.** Only two people are flagged `real: true` (the
publicly-known founder and COO). No unit claims a confirmed street address —
`addressConfirmed: false` everywhere, to be filled from discovery rather than
fabricated. Check [10] fails the build if that slips.

### Calibration constants

Three constants tune the model into real industry bands. They are deliberately
explicit rather than baked across a hundred recipe lines, so one number moves
the whole model when real spec sheets arrive:

- `RG.PORTION_SCALE` (`data-menu.js`) — food 1.82, bev 1.24 → 28-32% food cost, ~21% pour cost
- `SPLH_TARGET` (`engine-labor.js`) — the scheduling driver, calibrated to 25-27% hourly wages
- `RG.PL_RATES` (`engine-finance.js`) — every controllable rate, stated on the page

### Current output

```
Period FY2026 P7 (06-15-2026 – 07-12-2026)
  Net sales         $2,068,321        TTM $26,711,890
  Covers            37,130            Avg check $68.47
  Prime cost        63.5%   (COGS 31.9% + labor 31.5%)
  Four-wall EBITDA  $268,040  (13.0%)
  Food variance     $23,299
  Triage flags      7
```

### Seeded stories the demo is built to find

- **The Star — Portland** is the problem child: negative comp trend, different
  POS (Square vs. Toast), 2.35x the group's food variance, and comps running
  ~4.9% of gross against a ~2.1% group norm. It should surface first in triage.
- **Little Star — Solano** is the control: best food cost in the group.
- **Little Star — Valencia** approaches its percentage-rent breakpoint during
  the current fiscal year.
- **Cato's Ale House** has a lease option decision inside 12 months and no
  renewal option remaining.

---

## Phase 2 — the framework (done)

```
css/rg.css      brand + component layer over the cloned framework
js/util.js      formatters, personas & role gating, source chips,
                approval chains, Slack nudge, grid tools, sparklines,
                and the DERIVATION TOOLTIP engine
js/nav.js       topbar, news marquee, commodity ticker, sub-nav, theme toggle
js/brain.js     floating Brain — 8 cross-system answers computed live
index.html      Executive Command Center
```

**Run it:**

```bash
npm run build
```

then start the `restaurant-os` preview (`.claude/launch.json`, port 5245).

**The tooltip engine is the spine.** Wrap any figure with `traced(html, cfg)`:

```js
traced(fmt$(g.netSales), {
  value: fmt$c(g.netSales),
  formula: 'Σ (item quantity × menu price) − discounts − comps',
  inputs: [['Gross sales', fmt$c(g.grossSales)], ['Discounts', '−' + fmt$c(g.discounts)]],
  source: ['Toast', 'Square'], period: periodLabel(CUR),
  note: 'Built up from item-level PMIX, not entered as a total.',
  drill: 'Sales & Traffic'
})
```

Build every page this way. 33 traced figures on the exec dashboard alone.

Browser-verified: no console errors; tooltip resolves exactly
($2,119,417.00 − $31,435.52 − $19,660.81 = $2,068,320.67); role gating confirmed
(a GM sees one unit, no four-wall or margin columns, no Financial nav group);
dark theme resolves; triage spans three modules with Portland leading on two
high-severity flags.

## Phase 3-8 — the modules (done)

19 routes, all verified 200 and error-free in the browser. Page logic lives in
`js/pages/<slug>.js`; each `<slug>/index.html` is boilerplate plus one script
tag. `js/page.js` supplies the shared scaffolding (header, unit/period
selectors, `card()`, `table()`, `waterfall()`), so pages stay short.

```
/                Executive Command Center      /cogs/          Food & Beverage Cost
/sales/          Sales & Traffic               /purchasing/    Purchasing & Price Watch
/menu/           Menu Engineering              /inventory/     Inventory & Waste
/covers/         Reservations & Covers         /labor/         Labor & Scheduling
/offprem/        Off-Premise Economics         /hr/            People & HR
/guest/          Experience & Reputation       /marketing/     Marketing & Loyalty
/finance/        P&L by Unit                   /forecast/      Forecast & Growth
/cash/           Cash & Loss Prevention        /leases/        Real Estate & Leases
/facilities/     Facilities & Energy           /compliance/    Food Safety & Compliance
/integrations/   Integrations & Data Health
```

Two more engines back these: `engine-guest.js` (reviews, reservations,
marketing) and `engine-ops.js` (assets, work orders, energy, safety, cash,
people). Both follow the purchasing discipline — generated detail sums
**exactly** to the P&L line it belongs to. Checks [12] and [13] enforce it.

527 traced figures across the site.

### The join that sells it

Reviews are not random. `engine-guest.js` drives rating and complaint themes
from the unit's real operating conditions that period — labor hours per cover,
food variance, delivery mix. So on `/guest/`, a one-star "forty minutes between
ordering and food arriving" links to the shift that produced it, showing that
day's SPLH, hours and covers. No review platform can make that join, and no
labor report surfaces it either.

## Live

**https://endurancelabs.ai/hospitality** — password `enduranceportal`

- Repo: `endurance-ai-labs/hospitality` (public), branch `master`
- Host: GitHub Pages at `endurance-ai-labs.github.io/hospitality`
- Proxy: reverse-proxy rewrite in `alex-sok/endurance-ai` `next.config.ts`
  (PR #9, merged) — same clean-proxy pattern as `/law`
- Local preview: `restaurant-os` in `.claude/launch.json`, port 5245, serves the
  `.hospitality-serve` junction so `localhost:5245/hospitality/` mirrors prod

### Deploying

```bash
npm run deploy
```

Chains build → verify → stamp. Then commit and push `master`; Pages rebuilds in
about a minute. **Never push without `npm run stamp`** — see the cache note below.

### Two subpath traps this deployment hit

**Routes must be flat `.html` files, not directories.** Next.js strips the
trailing slash before proxying, so `/hospitality/cogs/` reached Pages as
`/hospitality/cogs`, Pages canonicalised it with a 301 whose `Location` is its
OWN absolute origin, and Vercel passed it through — every sub-route bounced the
visitor from `endurancelabs.ai` to `endurance-ai-labs.github.io`. Each route now
also exists as `<slug>.html` at the repo root and every internal link drops its
trailing slash, so Pages answers 200 with no canonicalisation. The landing page
was never affected, which is why `/law` and `/1100` never surfaced this.

**The cache stamp is content-derived for a reason.** A hand-typed date stamp
only busts the cache if you remember to bump it. `scripts/stamp.mjs` hashes
every JS and CSS file and writes that hash into every `?v=`, so it advances
exactly when the assets change.

## Next

- Real 1100 Group brand assets (the wordmark is a flagged placeholder)
- Public `/welcome` landing page on the Preferred/Y8S pattern

### Gotchas

- **Use the framework's real class names.** The card is `.demo-panel` (+
  `.demo-panel-head`), the table is `table.demo-tbl` inside
  `.demo-tbl-wrap grid-scroll`. There is no `.demo-card`, `.demo-table` or
  `.totals-band` — inventing names silently produces an unstyled page that
  still passes every data check. Totals rows need no class: any `tfoot td`
  gets the navy sticky band automatically.
- **Bump `?v=` on every asset when you change JS or CSS.** All 19 HTML files
  stamp `?v=<date>` on their `/css/*` and `/js/*` references. Without it the
  browser serves a stale `page.js` and renders last week's markup against this
  week's styles — which looks exactly like a CSS bug and is not one.
  Current stamp: `v=20260801a`.
- CSS also loads via `theme.css` `@import url('layout.css?v=...')` — editing an
  imported file needs that inner version bumped too.
- Sign-in overlay styles (`.login-*`) live in `rg.css`. They are NOT in the
  cloned framework — they came from the Yates brand layer and were ported.
- Tables, grids and charts never sit flush to a card border (gutter rule).
- Dates render MM-DD-YYYY.
- A hidden Browser pane pauses CSS animations and blocks screenshots entirely —
  motion checks read 0 px/s falsely.
