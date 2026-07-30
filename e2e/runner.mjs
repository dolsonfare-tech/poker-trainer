// Shared orchestrator for the e2e lanes: serve build/ statically, run every
// *.spec.mjs in one directory against it with one shared browser, exit 1 on any
// failure.
//
// Specs are plain async functions — no test framework. They export a default
// `run(ctx)` and report through `ctx.check(name, ok, detail)`. Deterministic
// geometry and behavior checks only: this suite is the zero-token, always-on
// layer of the bug net (see CLAUDE.md · Proactive bug net).
//
// Two lanes call in here (see buildmode.mjs for why there have to be two):
//   e2e/run.mjs       → e2e/*.spec.mjs      against a localStorage build
//   e2e/run-auth.mjs  → e2e/auth/*.spec.mjs against an auth-stub build
// The lane, not the spec, decides which build is legal — a spec dropped into
// the wrong directory is rejected by the build-mode guard rather than run.
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';
import { requireBuildMode } from './buildmode.mjs';

/**
 * @param {object} o
 * @param {string} o.buildDir   the static build to serve
 * @param {string} o.specDir    directory whose *.spec.mjs files make up the lane
 * @param {'localstorage'|'authstub'} o.buildMode  the flavor this lane requires
 * @param {number} o.port
 */
export async function runLane({ buildDir, specDir, buildMode, port }) {
  if (!existsSync(join(buildDir, 'index.html'))) {
    console.error(
      `No production build found — run \`npm run ${buildMode === 'authstub' ? 'e2e:build:auth' : 'e2e:build'}\` first.`,
    );
    process.exit(1);
  }
  await requireBuildMode(buildDir, buildMode);

  const server = await startServer(buildDir, port);
  const browser = await chromium.launch();
  const baseURL = `http://localhost:${port}`;

  let failures = 0;
  const specs = (await readdir(specDir)).filter((f) => f.endsWith('.spec.mjs')).sort();
  // An empty lane is a dead lane: a renamed or moved spec would otherwise
  // report "all checks passed" while measuring nothing at all.
  if (specs.length === 0) {
    console.error(`No *.spec.mjs files in ${specDir} — this lane would pass by measuring nothing.`);
    await browser.close();
    server.close();
    process.exit(1);
  }

  for (const f of specs) {
    console.log(`\n── ${f} ──`);
    const t0 = Date.now();
    const check = (name, ok, detail = '') => {
      console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
      if (!ok) failures++;
    };
    try {
      const mod = await import(join(specDir, f));
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
}
