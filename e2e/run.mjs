// e2e orchestrator: serve the production build statically, run every
// *.spec.mjs against it with one shared browser, exit 1 on any failure.
//
//   npm run e2e          (requires a prior `npm run build`)
//
// Specs are plain async functions — no framework. Deterministic geometry and
// behavior checks only: this suite is the zero-token, always-on layer of the
// bug net (see CLAUDE.md · Proactive bug net).
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, '..', 'build');
if (!existsSync(join(buildDir, 'index.html'))) {
  console.error('No production build found — run `npm run build` first.');
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
