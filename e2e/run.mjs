// Default e2e lane: the product specs, against a localStorage-mode build.
//
//   npm run e2e:build && npm run e2e
//
// Everything that makes a lane run lives in runner.mjs; the build-mode guard
// lives in buildmode.mjs. This file is the lane's identity: which specs, which
// build, which port. `readdir` in the runner is non-recursive, so e2e/auth/ is
// invisible here — the sign-in lane needs a different build and is run by
// run-auth.mjs.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runLane } from './runner.mjs';

const here = dirname(fileURLToPath(import.meta.url));

await runLane({
  buildDir: join(here, '..', 'build'),
  specDir: here,
  buildMode: 'localstorage',
  port: Number(process.env.E2E_PORT || 4173),
});
