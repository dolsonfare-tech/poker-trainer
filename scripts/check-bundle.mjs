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

// Ceiling set 2026-07-28, when the split landed at 261.7 KB. Headroom is ~7%:
// enough for ordinary feature growth, far tighter than the ~92 KB that
// re-inlining the scenario library would add. Raising this number is a
// deliberate decision to ship a slower first load — say so in the commit.
const MAIN_GZIP_CEILING_KB = 280;

const files = readdirSync(JS_DIR).filter((f) => f.endsWith('.js'));
const gzipKb = (f) => gzipSync(readFileSync(join(JS_DIR, f))).length / 1024;

const main = files.find((f) => /^main\.[a-f0-9]+\.js$/.test(f));
if (!main) {
  console.error('✗ no main.*.js in build/static/js — cannot measure the entry bundle');
  process.exit(1);
}

const mainKb = gzipKb(main);
const scenariosChunk = files.find((f) => /^scenarios\.[a-f0-9]+\.chunk\.js$/.test(f));

let failed = false;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { console.log(`  ✗ ${msg}`); failed = true; };

if (mainKb <= MAIN_GZIP_CEILING_KB)
  ok(`main.js ${mainKb.toFixed(1)} KB gzip (ceiling ${MAIN_GZIP_CEILING_KB} KB)`);
else
  bad(`main.js ${mainKb.toFixed(1)} KB gzip EXCEEDS the ${MAIN_GZIP_CEILING_KB} KB ceiling — `
    + 'if the scenario library drifted back into the entry chunk, look for a static '
    + "import of data/scenarios; if this is real growth, raise the ceiling deliberately");

if (scenariosChunk)
  ok(`scenarios split out as its own chunk (${gzipKb(scenariosChunk).toFixed(1)} KB gzip, fetched on first deal)`);
else
  bad('no scenarios.*.chunk.js — the scenario library is no longer code-split (CA-014). '
    + 'utils/deal.js must load it with a dynamic import, and nothing on the login path '
    + '(schema.js, spacedrep.js, VillainGuide) may import data/scenarios statically');

console.log(`\n${files.length} JS assets — ${failed ? 'BUNDLE GATE FAILED' : 'bundle gate passed'}`);
process.exit(failed ? 1 : 0);
