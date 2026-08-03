/* ============================================================
   Restaurant OS — tie-out verifier
   Loads the browser scripts in order and asserts that every cross-module
   identity holds to the cent. Run before any deploy:  npm run verify
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'rand.js', 'data-calendar.js', 'data-company.js', 'data-menu.js',
  'engine-sales.js', 'engine-labor.js', 'engine-cogs.js', 'engine-finance.js',
  'engine-marketplace.js', 'engine-guest.js', 'engine-ops.js', 'model.js'
];

const t0 = Date.now();
for (const f of FILES) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), { filename: f });
}
const RG = globalThis.RG;
const loadMs = Date.now() - t0;

let pass = 0, fail = 0;
const failures = [];
const C = (n) => Math.round(n * 100) / 100;

function eq(label, a, b, tol = 0.02) {
  const d = Math.abs(C(a) - C(b));
  if (d <= tol) { pass++; return true; }
  fail++;
  failures.push(`${label}\n     expected ${C(b).toLocaleString()}  got ${C(a).toLocaleString()}  delta ${C(d).toLocaleString()}`);
  return false;
}
function ok(label, cond, note = '') {
  if (cond) { pass++; return true; }
  fail++; failures.push(`${label}${note ? '\n     ' + note : ''}`);
  return false;
}

console.log(`\n  Restaurant OS — dataset verification`);
console.log(`  ${RG.COMPANY.name} · ${RG.UNITS.length} units · ${RG.BRANDS.length} brands`);
console.log(`  Calendar ${RG.CAL.ANCHOR} → ${RG.CAL.END}  (${RG.CAL.DAYS.length} days, ${RG.CAL.PERIODS.length} periods)`);
console.log(`  Scripts loaded in ${loadMs} ms\n`);

const t1 = Date.now();
const M = RG.MODEL;
const buildMs = Date.now() - t1;
console.log(`  MODEL built in ${buildMs} ms  (${M.periods.length} periods x ${M.units.length} units)\n`);

const CUR = M.current, PRIOR = M.prior;
const ALL = M.units;

/* ---- 1. PMIX is the atom: item quantities x price = gross sales ---- */
{
  let checked = 0;
  for (const uid of ALL) {
    for (const p of M.periods.slice(-3)) {
      const pmix = RG.periodPmix(uid, p);
      const pmixSales = pmix.reduce((s, r) => C(s + r.sales), 0);
      const agg = RG.periodSales(uid, p);
      eq(`PMIX foots to gross sales — ${uid} ${p}`, pmixSales, agg.gross);
      checked++;
    }
  }
  /* and at the day grain, where it actually originates */
  for (const uid of ALL) {
    const iso = RG.CAL.DAYS[RG.CAL.DAYS.length - 40].iso;
    const pm = RG.dayPmix(uid, iso);
    if (!pm || pm.closed) continue;
    const rowSum = pm.rows.reduce((s, r) => C(s + r.ext), 0);
    eq(`PMIX day rows foot to day gross — ${uid} ${iso}`, rowSum, RG.daySales(uid, iso).gross);
  }
  console.log(`  [1] PMIX -> sales identity        ${checked} unit-periods + ${ALL.length} unit-days`);
}

/* ---- 2. net = gross - discounts - comps ---- */
{
  for (const uid of ALL) {
    const s = RG.periodSales(uid, CUR);
    eq(`net = gross - discounts - comps — ${uid}`, s.net, C(s.gross - s.discounts - s.comps));
  }
  console.log(`  [2] Net sales identity            ${ALL.length} units`);
}

/* ---- 3. channel and daypart splits foot to gross ---- */
{
  for (const uid of ALL) {
    const s = RG.periodSales(uid, CUR);
    const ch = Object.values(s.byChannel).reduce((a, b) => C(a + b), 0);
    const dp = Object.values(s.byDaypart).reduce((a, b) => C(a + b), 0);
    eq(`channel split foots — ${uid}`, ch, s.gross, 0.5);
    eq(`daypart split foots — ${uid}`, dp, s.gross, 0.5);
  }
  console.log(`  [3] Channel & daypart splits      ${ALL.length} units x 2`);
}

/* ---- 4. COGS bridge closes: actual = theoretical + named drivers ---- */
{
  for (const uid of ALL) {
    const c = RG.periodCogs(uid, CUR);
    const drivers = Object.values(c.drivers).reduce((a, b) => C(a + b), 0);
    eq(`variance = sum of drivers — ${uid}`, c.variance, drivers);
    eq(`actual = theo + variance — ${uid}`, c.actual, C(c.theo + c.variance));
    eq(`food + bev = actual — ${uid}`, C(c.actualFood + c.actualBev), c.actual);
  }
  console.log(`  [4] Food-cost bridge closes       ${ALL.length} units x 3`);
}

/* ---- 5. purchases reconcile to usage, invoices foot to lines ---- */
{
  for (const uid of ALL) {
    const pu = RG.periodPurchases(uid, CUR);
    const cg = RG.periodCogs(uid, CUR);
    eq(`purchases = actual usage + inv move — ${uid}`, pu.total, C(cg.actual + pu.invDelta));
    const invSum = pu.invoices.reduce((s, i) => C(s + i.total), 0);
    eq(`invoice register foots to purchases — ${uid}`, invSum, pu.total, 0.5);
    let lineFails = 0;
    for (const inv of pu.invoices) {
      const ls = inv.lines.reduce((s, l) => C(s + l.ext), 0);
      if (Math.abs(ls - inv.total) > 0.02) lineFails++;
    }
    ok(`invoice lines foot to invoice total — ${uid}`, lineFails === 0,
       `${lineFails} of ${pu.invoices.length} invoices do not foot`);
  }
  console.log(`  [5] Purchasing reconciliation     ${ALL.length} units x 3`);
}

/* ---- 6. P&L internal identities ---- */
{
  for (const uid of ALL) {
    const pl = RG.periodPL(uid, CUR);
    eq(`prime = cogs + labor — ${uid}`, pl.primeCost, C(pl.cogs + pl.labor));
    eq(`labor = wages + mgr + burden — ${uid}`, pl.labor, C(pl.wages + pl.mgrSalary + pl.payrollBurden));
    eq(`controllables foot — ${uid}`, pl.controllables,
      C(pl.deliveryFees + pl.cardFees + pl.directOperating + pl.marketing + pl.repairs + pl.admin + pl.utilities));
    eq(`occupancy foots — ${uid}`, pl.occupancy, C(pl.rent + pl.cam + pl.pctRent + pl.insurance));
    eq(`four-wall identity — ${uid}`, pl.fourWall,
      C(pl.netSales - pl.primeCost - pl.controllables - pl.occupancy));
    eq(`net = four-wall - G&A — ${uid}`, pl.net, C(pl.fourWall - pl.ga));
    eq(`P&L net sales = sales engine — ${uid}`, pl.netSales, RG.periodSales(uid, CUR).net);
    eq(`P&L cogs = cogs engine — ${uid}`, pl.cogs, RG.periodCogs(uid, CUR).actual);
    eq(`P&L food+bev = net sales — ${uid}`, C(pl.netFood + pl.netBev), pl.netSales);
  }
  console.log(`  [6] P&L identities                ${ALL.length} units x 9`);
}

/* ---- 7. consolidation: group = sum of units ---- */
{
  const g = RG.groupPL(CUR);
  for (const k of ['netSales', 'cogs', 'labor', 'controllables', 'occupancy', 'fourWall', 'net']) {
    const sum = ALL.reduce((s, uid) => C(s + RG.periodPL(uid, CUR)[k]), 0);
    eq(`group ${k} = sum of units`, g[k], sum, 0.1);
  }
  eq('group four-wall identity', g.fourWall,
     C(g.netSales - g.primeCost - g.controllables - g.occupancy), 0.1);
  console.log(`  [7] Consolidation                 8 lines`);
}

/* ---- 8. variance bridges sum exactly to the movement ---- */
{
  const sb = M.bridges.sales;
  eq('sales bridge parts = total delta',
     C(sb.traffic + sb.price + sb.mix), sb.total);
  eq('sales bridge total = period delta', sb.total, C(sb.toNet - sb.fromNet));

  const lb = M.bridges.labor;
  eq('labor bridge parts = total delta',
     C(lb.volume + lb.rate + lb.manager), lb.total);

  const pb = M.bridges.profit;
  const partsSum = Object.values(pb.parts).reduce((a, b) => C(a + b), 0);
  eq('profit bridge parts = total delta', partsSum, pb.total, 0.1);
  eq('profit bridge residual is zero', pb.check, 0, 0.1);
  console.log(`  [8] Variance bridges              5 checks`);
}

/* ---- 9. determinism: two independent builds must be identical ---- */
{
  const a = JSON.stringify(RG.periodPL(ALL[0], CUR));
  const b = JSON.stringify(RG.periodPL(ALL[0], CUR));
  ok('repeat call is byte-identical', a === b);
  /* rebuild the engine from scratch in a fresh context */
  const ctx = vm.createContext({});
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
  }
  const fresh = vm.runInContext(`JSON.stringify(RG.periodPL(${JSON.stringify(ALL[0])}, ${JSON.stringify(CUR)}))`, ctx);
  ok('fresh context reproduces the same P&L', fresh === a,
     fresh === a ? '' : 'engine is not deterministic across contexts');
  console.log(`  [9] Determinism                   2 checks`);
}

/* ---- 10. no fabricated real-world data ---- */
{
  const realPeople = RG.PEOPLE.filter(p => p.real);
  ok('only publicly-known people flagged real', realPeople.length === 2,
     `${realPeople.length} flagged real: ${realPeople.map(p => p.name).join(', ')}`);
  ok('every unit has a provenance flag', RG.UNITS.every(u => 'addressConfirmed' in u));
  ok('no unit claims a confirmed street address',
     RG.UNITS.every(u => u.addressConfirmed === false));
  ok('every person carries a real/fictional flag', RG.PEOPLE.every(p => 'real' in p));
  console.log(`  [10] Data provenance              4 checks`);
}

/* ---- 11. sanity: does the company look like a real restaurant group? ---- */
{
  const g = M.group[CUR];
  const band = (label, v, lo, hi) =>
    ok(`${label} in industry band (${lo}-${hi})`, v >= lo && v <= hi, `actual ${(v * 100).toFixed(1)}%`);
  band('group prime cost', g.primePct, 0.55, 0.72);
  band('group food+bev cost', g.cogsPct, 0.24, 0.36);
  band('group labor', g.laborPct, 0.26, 0.40);
  band('group occupancy', g.occupancyPct, 0.04, 0.13);
  band('group four-wall margin', g.fourWallPct, 0.05, 0.25);
  ok('every unit trades every open day', ALL.every(uid =>
    RG.periodSales(uid, CUR).net > 0));
  ok('SPLH is plausible', g.splh > 45 && g.splh < 130, `actual $${g.splh}`);
  console.log(`  [11] Industry sanity bands        7 checks`);
}


/* ---- 12. the ops engines foot to the P&L lines they claim ----
   Facilities, marketing and energy generate detail; that detail must sum
   exactly to the expense line already on the statement, or the module and
   the P&L are telling the prospect two different numbers. */
{
  for (const uid of ALL) {
    const pl = RG.periodPL(uid, CUR);
    const wo = RG.periodWorkOrders(uid, CUR).reduce((s, w) => C(s + w.cost), 0);
    eq(`work orders foot to P&L repairs — ${uid}`, wo, pl.repairs);
    const mk = RG.periodMarketing(uid, CUR).rows.reduce((s, r) => C(s + r.spend), 0);
    eq(`campaign spend foots to P&L marketing — ${uid}`, mk, pl.marketing);
    const en = RG.periodEnergy(uid, CUR);
    eq(`energy foots to P&L utilities — ${uid}`, C(en.electric + en.gas + en.water + en.waste), pl.utilities);
  }
  console.log(`  [12] Ops engines foot to P&L     ${ALL.length} units x 3`);
}

/* ---- 13. guest reviews are driven by real operating conditions ---- */
{
  const rows = ALL.map(uid => {
    const g = RG.periodGuest(uid, CUR);
    return { uid, rating: g.rating, labor: g.conditions.laborPerCover, variance: g.conditions.variancePct };
  });
  ok('every unit produced reviews', rows.every(r => r.rating > 0));
  ok('ratings sit in a believable band', rows.every(r => r.rating >= 2.6 && r.rating <= 5.0),
     rows.map(r => `${r.uid} ${r.rating}`).join(', '));
  /* the seeded story: the worst-variance unit should not be the top-rated one */
  const worstVar = rows.slice().sort((a, b) => b.variance - a.variance)[0];
  const bestRated = rows.slice().sort((a, b) => b.rating - a.rating)[0];
  ok('worst food variance is not the best-rated unit', worstVar.uid !== bestRated.uid,
     `both are ${worstVar.uid}`);
  console.log(`  [13] Guest engine joins ops       3 checks`);
}


/* ---- 14. the ingredient roll-up ties to the P&L theoretical ----
   The cross-analysis page aggregates cost by ingredient; the P&L states a
   theoretical total. They are two derivations of the same recipe lines and
   must agree, or the pivot quietly disagrees with the statement. */
{
  let ing = 0, theo = 0;
  for (const uid of ALL) {
    const c = RG.periodCogs(uid, CUR);
    theo += c.theo;
    for (const k of Object.keys(c.byIng)) ing += c.byIng[k].cost;
  }
  eq('ingredient roll-up = P&L theoretical cost', ing, theo, 1.0);
  ok('ingredient roll-up is non-trivial', ing > 100000, `got ${Math.round(ing)}`);
  console.log(`  [14] Ingredient roll-up ties      2 checks`);
}


/* ---- 15. marketplace split foots to the delivery channel ----
   The off-premise page slices delivery revenue across DoorDash, Uber
   Eats, Grubhub and the rest. If that split does not sum back to the
   channel the sales engine produced, the page and the P&L are telling
   the prospect two different numbers. */
{
  for (const uid of ALL) {
    const s = RG.periodSales(uid, CUR);
    const mp = RG.periodMarketplace(uid, CUR);
    eq(`marketplace gross = delivery channel — ${uid}`, mp.total.gross, s.byChannel.delivery || 0, 0.5);
    const parts = mp.rows.reduce((a, r) => C(a + r.commission + r.promo + r.errors + r.refunds + r.net), 0);
    eq(`marketplace deductions + net = gross — ${uid}`, parts, mp.total.gross, 0.5);
    const pl = RG.periodPL(uid, CUR);
    eq(`P&L delivery fee = Σ commissions — ${uid}`, pl.deliveryFees, mp.total.commission, 0.05);
  }
  ok('every restaurant lists at least three marketplaces',
     ALL.every(uid => RG.marketplacesFor(uid).length >= 3));
  console.log(`  [15] Marketplace reconciliation   ${ALL.length} units x 3 + 1`);
}

/* ---- summary ---- */
console.log('');
if (fail) {
  console.log(`  FAILURES (${fail}):\n`);
  failures.slice(0, 30).forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
  if (failures.length > 30) console.log(`   ... and ${failures.length - 30} more`);
  console.log('');
}
const g = M.group[CUR];
console.log(`  ── Period ${M.kpi.label}  (${M.kpi.range}) ──`);
console.log(`     Net sales        $${Math.round(g.netSales).toLocaleString()}`);
console.log(`     Covers           ${g.covers.toLocaleString()}      Avg check  $${g.avgCheck.toFixed(2)}`);
console.log(`     Prime cost       ${(g.primePct * 100).toFixed(1)}%   (COGS ${(g.cogsPct * 100).toFixed(1)}% + labor ${(g.laborPct * 100).toFixed(1)}%)`);
console.log(`     Four-wall EBITDA $${Math.round(g.fourWall).toLocaleString()}  (${(g.fourWallPct * 100).toFixed(1)}%)`);
console.log(`     TTM net sales    $${Math.round(M.kpi.ttmSales).toLocaleString()}`);
console.log(`     Food variance    $${Math.round(g.cogsVariance).toLocaleString()}`);
console.log(`     Triage flags     ${M.flags.length}`);
console.log('');
console.log(`  ${fail === 0 ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}  —  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
