// Which build is sitting in build/? — the guard both e2e lanes run first.
//
// CRA inlines `process.env.REACT_APP_*` as string literals at webpack time, so
// `src/utils/supabase.js`'s `url && key ? createClient(...) : null` is decided
// by the BUILD, not by anything a spec can set. One bundle is therefore in
// exactly one auth mode, and the suite needs two of them:
//
//   npm run e2e:build       → localStorage mode (Supabase vars blanked).
//                             `hasSupabase` is false, App boots to
//                             UsernameEntry, and the 10 specs in e2e/ seed a
//                             profile into localStorage and drive the product.
//                             SignIn is UNREACHABLE in this build.
//   npm run e2e:build:auth  → auth-stub mode (DUMMY Supabase vars).
//                             `hasSupabase` is true, getSession() finds nothing
//                             in localStorage, and App renders SignIn — the
//                             only way to reach that screen at all. e2e/auth/
//                             drives it with every Supabase request intercepted
//                             (the stub host never resolves and never needs to).
//   npm run build           → PRODUCTION. Real keys from .env. Neither lane may
//                             ever run against it: the specs would talk to the
//                             live project.
//
// Running a lane against the wrong build is a wall of timeouts that reads like
// a broken app rather than a mis-staged build — that cost a debugging session on
// July 28, 2026, when `npm run gates` (which ends in `CI=true npm run build`)
// silently replaced the e2e build. Gate 6 said so in prose; the ratchet law
// wants an exit code, so this is it — now with the third state the auth lane
// introduced (July 30, 2026).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The dummy origin baked in by `e2e:build:auth`. `.e2e` is not a real TLD, so
// this can never resolve even if an interception is missed — a missed request
// fails loudly instead of reaching something real. Invariant 37 pins this
// constant to the value package.json actually builds with.
export const STUB_SUPABASE_URL = 'https://stub.supabase.e2e';

const PRODUCTION = /https:\/\/[a-z0-9]{8,}\.supabase\.co/;
const AUTH_STUB = /https:\/\/stub\.supabase\.e2e/;

/** 'production' | 'authstub' | 'localstorage' for a set of bundle sources. */
export function classifyBuild(sources) {
  // Production is tested FIRST and wins ties on purpose. A bundle carrying real
  // keys must classify as production even if the stub string is also present
  // somewhere, so a stray literal can never disarm the "never drive e2e against
  // the live project" half of this guard.
  if (sources.some((s) => PRODUCTION.test(s))) return 'production';
  if (sources.some((s) => AUTH_STUB.test(s))) return 'authstub';
  return 'localstorage';
}

// Negative control, run on every invocation: a guard that cannot fail is not a
// guard. The binary version of this check only proved it fired on a production
// bundle; a three-way classifier has to prove it SEPARATES all three, plus the
// precedence rule above. Costs microseconds; catches a regex being gutted or
// the two patterns being reordered.
export function selfTest() {
  const cases = [
    [['x=https://abcdefgh.supabase.co;'], 'production'],
    [[`x="${STUB_SUPABASE_URL}";`], 'authstub'],
    [['const u="";'], 'localstorage'],
    [[`a=https://abcdefgh.supabase.co;b="${STUB_SUPABASE_URL}";`], 'production'],
  ];
  return cases.every(([sources, want]) => classifyBuild(sources) === want);
}

/** Every emitted JS bundle, as source text. */
export async function readBuildSources(buildDir) {
  const jsDir = join(buildDir, 'static', 'js');
  const files = (await readdir(jsDir)).filter((f) => f.endsWith('.js'));
  return Promise.all(files.map((f) => readFile(join(jsDir, f), 'utf8')));
}

const FIX = {
  localstorage: 'npm run e2e:build',
  authstub: 'npm run e2e:build:auth',
};

const WHY = {
  // Read as: "you wanted <want>, you have <got>".
  'localstorage/production':
    'This is a PRODUCTION build — it has Supabase keys baked in, so every spec\n' +
    'would boot to SignIn and fail on a `.db-cta-btn` timeout.',
  'localstorage/authstub':
    'This is the AUTH-STUB build (`npm run e2e:build:auth`) — it boots to SignIn,\n' +
    'so every spec in this lane would fail on a `.db-cta-btn` timeout.',
  'authstub/production':
    'This is a PRODUCTION build — it carries the REAL Supabase keys, and this lane\n' +
    'drives the sign-in form. It must never point at the live project.',
  'authstub/localstorage':
    'This is the localStorage build (`npm run e2e:build`) — `hasSupabase` is false,\n' +
    'so App boots to UsernameEntry and the SignIn screen never renders at all.\n' +
    'Every check in this lane would fail, which is loud and therefore survivable —\n' +
    'the dangerous direction is a spec that QUIETLY passes against the wrong build.',
};

/**
 * Exit 1 unless build/ is the flavor this lane needs. `want` is the mode the
 * caller was built for; the message names both what is there and how to fix it.
 */
export async function requireBuildMode(buildDir, want) {
  if (!selfTest()) {
    console.error('build-mode guard is broken — it no longer separates the three build flavors.');
    process.exit(1);
  }
  const got = classifyBuild(await readBuildSources(buildDir));
  if (got === want) return got;
  console.error(
    `${WHY[`${want}/${got}`] ?? `Expected a ${want} build, found ${got}.`}\n\n` +
    `  Fix: ${FIX[want]}\n\n` +
    '(`npm run gates` and `npm run build` both leave a production build behind.\n' +
    ' If a local preview server is running against build/, re-run the build too.)',
  );
  process.exit(1);
}
