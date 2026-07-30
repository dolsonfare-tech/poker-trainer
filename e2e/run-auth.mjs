// Auth e2e lane: the SignIn specs, against an auth-stub build.
//
//   npm run e2e:build:auth && npm run e2e:auth
//
// Separate from the default lane because it needs the OPPOSITE build — one with
// Supabase env vars present, so `hasSupabase` is true and App renders SignIn at
// all (see buildmode.mjs). Keeping it a sibling entry point rather than a flag
// on run.mjs means `npm run e2e` and its guard are untouched by this lane
// existing, and each lane's build requirement is a fact about the lane rather
// than about an argument someone has to remember to pass.
//
// Different default port so both lanes can be running at once.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runLane } from './runner.mjs';

const here = dirname(fileURLToPath(import.meta.url));

await runLane({
  buildDir: join(here, '..', 'build'),
  specDir: join(here, 'auth'),
  buildMode: 'authstub',
  port: Number(process.env.E2E_AUTH_PORT || 4174),
});
