// e2e orchestrator: serve the production build statically, run every
// *.spec.mjs against it with one shared browser, exit 1 on any failure.
//
//   npm run e2e          (requires a prior `npm run build`)
//
// Specs are plain async functions — no framework. Deterministic geometry and
// behavior checks only: this suite is the zero-token, always-on layer of the
// bug net (see CLAUDE.md · Proactive bug net).
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, '..', 'build');
if (!existsSync(join(buildDir, 'index.html'))) {
  console.error('No production build found — run `npm run e2e:build` first.');
  process.exit(1);
}

// ── Build-mode guard (ratchet, July 28 2026) ───────────────────────────────
// Gate 6 requires `npm run e2e:build`, NOT a plain build: a plain build bakes
// the real Supabase keys in, so the app boots to SignIn and no spec can seed a
// user. `npm run gates` ends with `CI=true npm run build`, so merely running the
// gates silently replaces build/ with a bundle this suite cannot drive — and any
// local preview server pointed at build/ turns into a sign-in wall at the same
// moment. Both happened on July 28: the symptom was a 20s `.db-cta-btn` timeout
// and a change that looked like it had not shipped. Gate 6 said so in prose; the
// ratchet law wants an exit code, so here it is.
const supabaseKeyBaked = (sources) => sources.some((s) => /https:\/\/[a-z0-9]{8,}\.supabase\.co/.test(s));

// Negative control, run every invocation: a guard that cannot fail is not a
// guard. It must fire on a production-shaped bundle and stay silent on an
// e2e-shaped one. Costs microseconds; catches the regex being gutted.
if (!supabaseKeyBaked(['x=https://abcdefgh.supabase.co;']) || supabaseKeyBaked(['const u="";'])) {
  console.error('build-mode guard is broken — it no longer distinguishes the two builds.');
  process.exit(1);
}

const jsDir = join(buildDir, 'static', 'js');
const jsSources = await Promise.all(
  (await readdir(jsDir)).filter((f) => f.endsWith('.js'))
    .map((f) => readFile(join(jsDir, f), 'utf8')),
);
if (supabaseKeyBaked(jsSources)) {
  console.error(
    'This is a PRODUCTION build — it has Supabase keys baked in, so every spec\n' +
    'would boot to SignIn and fail on a `.db-cta-btn` timeout.\n\n' +
    '  Fix: npm run e2e:build\n\n' +
    '(`npm run gates` and `npm run build` both leave a production build behind.\n' +
    ' If a local preview server is running against build/, re-run e2e:build too.)',
  );
  process.exit(1);
}

const PORT = Number(process.env.E2E_PORT || 4173);
const server = await startServer(buildDir, PORT);
const browser = await chromium.launch();
const baseURL = `http://localhost:${PORT}`;

let failures = 0;
const specs = (await readdir(here)).filter((f) => f.endsWith('.spec.mjs')).sort();
for (const f of specs) {
  console.log(`\n── ${f} ──`);
  const t0 = Date.now();
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
  };
  try {
    const mod = await import(join(here, f));
    await mod.default({ browser, baseURL, check });
  } catch (e) {
    failures++;
    console.error(`  ✗ SPEC ERROR: ${e.message}`);
  }
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

await browser.close();
server.close();
console.log(failures === 0 ? '\nE2E: all checks passed' : `\nE2E: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
