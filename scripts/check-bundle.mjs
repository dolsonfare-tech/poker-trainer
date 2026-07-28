// Bundle-size gate (CA-014 / CA-022, Wave 4). Runs AFTER a production build.
//
//   npm run check:bundle          (gates runs it; CI runs it after the build)
//
// Why a gate at all: the lazy-load win is invisible in every other check. Jest
// passes, e2e passes, the app behaves identically whether the 438 KB scenario
// library is in the main chunk or in its own — the ONLY symptom is that every
// first-time visitor waits longer. A win nothing measures is a win that erodes.
//
// Two independent signals, because either alone is escapable:
//   1. main.js gzip stays under a ceiling.
//   2. the scenarios chunk still EXISTS as a separate file.
// Reverting the dynamic import to a static one trips both — the chunk vanishes
// and main grows by ~92 KB. Checking only the ceiling would let the split die
// quietly if the library were also shrunk for some other reason.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const JS_DIR = join(here, '..', 'build', 'static', 'js');

if (!existsSync(JS_DIR)) {
  console.error('No build found — run `npm run build` first.');
  process.exit(1);
}

// Ceiling re-set 2026-07-28 after CA-022 took main to 244.9 KB (from 353.9 at
// the start of Wave 4). Headroom is ~6%: enough for ordinary feature growth,
// far tighter than the ~92 KB re-inlining the scenario library would add or the
// ~17 KB from un-splitting the routes. Raising this number is a deliberate
// decision to ship a slower first load — say so in the commit.
const MAIN_GZIP_CEILING_KB = 260;

const files = readdirSync(JS_DIR).filter((f) => f.endsWith('.js'));
const gzipKb = (f) => gzipSync(readFileSync(join(JS_DIR, f))).length / 1024;

const main = files.find((f) => /^main\.[a-f0-9]+\.js$/.test(f));
if (!main) {
  console.error('✗ no main.*.js in build/static/js — cannot measure the entry bundle');
  process.exit(1);
}

const mainKb = gzipKb(main);
// Each split is asserted BY NAME. A missing chunk means that import went
// static again — which the ceiling alone might not catch if something else
// shrank at the same time.
const chunk = (name) => files.find((f) => new RegExp(`^${name}\\.[a-f0-9]+\\.chunk\\.js$`).test(f));
const SPLITS = [
  ['scenarios', 'the 172-scenario library, fetched on the first deal (CA-014)'],
  ['tablereads', 'Table Reads + its 39 KB observation pool, an opt-in mode (CA-022)'],
  ['villainguide', 'the reference modal, opened by a deliberate tap (CA-022)'],
];

let failed = false;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { console.log(`  ✗ ${msg}`); failed = true; };

if (mainKb <= MAIN_GZIP_CEILING_KB)
  ok(`main.js ${mainKb.toFixed(1)} KB gzip (ceiling ${MAIN_GZIP_CEILING_KB} KB)`);
else
  bad(`main.js ${mainKb.toFixed(1)} KB gzip EXCEEDS the ${MAIN_GZIP_CEILING_KB} KB ceiling — `
    + 'if the scenario library drifted back into the entry chunk, look for a static '
    + "import of data/scenarios; if this is real growth, raise the ceiling deliberately");

for (const [name, why] of SPLITS) {
  const f = chunk(name);
  if (f) ok(`${name} chunk present — ${gzipKb(f).toFixed(1)} KB gzip (${why})`);
  else bad(`no ${name}.*.chunk.js — that code is back in the entry bundle. ${why}. `
    + 'For scenarios: utils/deal.js must use a dynamic import and nothing on the login path '
    + '(schema.js, spacedrep.js, VillainGuide) may import data/scenarios statically. '
    + 'For the routes: App.jsx must declare them with React.lazy.');
}

console.log(`\n${files.length} JS assets — ${failed ? 'BUNDLE GATE FAILED' : 'bundle gate passed'}`);
process.exit(failed ? 1 : 0);
