// dealScenarios (CA-014, Wave 4) — the lazy-load seam.
//
// This file exists because of a specific silent-regression risk introduced when
// the scenario library moved behind a dynamic import. `spacedrep.js` used to
// default `contrastPairs` to the authored CONTRAST_PAIRS map, but it is on the
// login path (db.js, claude.js and session.js all import it), so a static
// import there would have pinned the 438 KB library into the main bundle no
// matter what dealScenarios did. The default is now `[]` and dealScenarios
// passes the real map through after loading the chunk.
//
// The failure mode that creates: drop that one argument and contrast pairing —
// the product's interleaving mechanism, and a deliberate learning-science
// choice — stops happening. Nothing throws. Sessions still deal five hands.
// The only symptom is that a feature quietly no longer works.
import { dealScenarios } from './deal';
import { buildSession } from './spacedrep';
import SCENARIOS, { CONTRAST_PAIRS } from '../data/scenarios';
import { createUser } from './session';

jest.mock('./spacedrep', () => ({
  ...jest.requireActual('./spacedrep'),
  buildSession: jest.fn(() => []),
}));

beforeEach(() => {
  jest.clearAllMocks();
  buildSession.mockImplementation(jest.requireActual('./spacedrep').buildSession);
});

test('the authored contrast pairs reach the session builder', () => {
  // The regression pin. `contrastPairs` defaults to [] now, so this argument is
  // the ONLY thing keeping interleaving alive.
  return dealScenarios('beginner', createUser('Dealer')).then(() => {
    expect(buildSession).toHaveBeenCalledTimes(1);
    const opts = buildSession.mock.calls[0][1];
    expect(opts.contrastPairs).toBe(CONTRAST_PAIRS);
    expect(opts.contrastPairs.length).toBeGreaterThan(0);
  });
});

test('deals a full session of the requested difficulty', async () => {
  const deck = await dealScenarios('beginner', createUser('Dealer'));
  expect(deck).toHaveLength(5);
  for (const s of deck) expect(s.difficulty).toBe('beginner');
});

test('the pool handed to the builder is filtered, not the whole library', async () => {
  await dealScenarios('intermediate', createUser('Dealer'));
  const pool = buildSession.mock.calls[0][0];
  expect(pool.length).toBeGreaterThan(0);
  expect(pool.length).toBeLessThan(SCENARIOS.length);
  for (const s of pool) expect(s.difficulty).toBe('intermediate');
});

test('is async — the caller must await the chunk before rendering a session', () => {
  // useSessionRun.startSession relies on this returning a promise so it can
  // await the deck BEFORE setting screen='session'. If this ever became
  // synchronous again the await would be a no-op and still pass, so assert the
  // shape directly rather than inferring it.
  const returned = dealScenarios('beginner', createUser('Dealer'));
  expect(typeof returned.then).toBe('function');
  return returned;
});
