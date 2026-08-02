/* ============================================================
   Restaurant OS — cache stamp
   Rewrites every ?v= in every HTML file to a hash of the actual JS and
   CSS content. A hand-maintained date stamp only works if you remember
   to bump it; this one changes exactly when the assets change and never
   when they do not. Run before every deploy — `npm run deploy` does.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const assets = [...walk(path.join(ROOT, 'js')), ...walk(path.join(ROOT, 'css'))].sort();
const h = crypto.createHash('sha256');
for (const f of assets) {
  h.update(path.relative(ROOT, f).replace(/\\/g, '/'));
  h.update(fs.readFileSync(f));
}
const stamp = h.digest('hex').slice(0, 10);

/* Fork landing pages (mazra.html) are COPIES of the fork's own index and
   carry the fork's asset hash. Stamping them here would overwrite that
   with the parent's hash and leave the fork pointing at stale assets. */
const FORKS = ['mazra'];
const htmls = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith('.html') && !FORKS.includes(f.replace('.html', '')))
  .map((f) => path.join(ROOT, f))
  .concat(
    fs.readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory() &&
        !['node_modules', '.git', 'scripts', 'css', 'js', 'assets', 'vendor'].includes(e.name) &&
        !FORKS.includes(e.name))
      .map((e) => path.join(ROOT, e.name, 'index.html'))
      .filter((p) => fs.existsSync(p))
  );

let changed = 0;
for (const f of htmls) {
  const before = fs.readFileSync(f, 'utf8');
  const after = before.replace(/(\?v=)[0-9a-z]+/g, `$1${stamp}`);
  if (after !== before) { fs.writeFileSync(f, after); changed++; }
}

console.log(`\n  Cache stamp: v=${stamp}`);
console.log(`  ${assets.length} assets hashed · ${changed} of ${htmls.length} HTML files updated\n`);
