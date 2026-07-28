// events.js — the PostHog registry (MOD-011 / CA-033, Wave 4).
//
// Invariants rule 28 stops an event NAME being written outside this module, and
// rule 24 keeps TRIAGE.md pointing at the right surfaces. Neither can see the
// PROP SHAPE, which is the half that breaks quietly: a renamed key does not
// error, it produces a series where the old property is simply absent from
// every new row. Nothing fails, the dashboard just goes flat.
//
// So this file pins the wire format of every emitter that carries props, plus
// the two systemic rules the dashboards depend on.
import * as events from './events';

jest.mock('./analytics', () => ({ track: jest.fn() }));
import { track } from './analytics';

beforeEach(() => jest.clearAllMocks());

const propsOf = () => track.mock.calls[0][1];
const nameOf = () => track.mock.calls[0][0];

// ── decision_made: the asymmetry CA-033 found, now deliberate ─────────────
describe('emitDecisionMade', () => {
  const base = { scenarioId: 'sc_042', skill: 'potodds', result: 'correct', replay: false };

  test('an answered hand carries decision_ms', () => {
    events.emitDecisionMade({ ...base, timedOut: false, decisionMs: 4200 });
    expect(nameOf()).toBe('decision_made');
    expect(propsOf()).toEqual({
      scenario_id: 'sc_042', skill: 'potodds', result: 'correct',
      timed_out: false, replay: false, decision_ms: 4200,
    });
  });

  test('a timed-out hand OMITS decision_ms rather than sending the full timer', () => {
    // The comprehension heatmap takes decision_ms p50 per scenario. Sending the
    // timer duration would make "ran out of time" indistinguishable from "thought
    // hard and answered at the buzzer" — a different player, a different
    // diagnosis. Absence is the honest encoding.
    events.emitDecisionMade({ ...base, result: 'incorrect', timedOut: true });
    expect(propsOf()).not.toHaveProperty('decision_ms');
    expect(propsOf().timed_out).toBe(true);
  });

  test('decisionMs is never forwarded when the hand timed out, even if passed', () => {
    events.emitDecisionMade({ ...base, timedOut: true, decisionMs: 60000 });
    expect(propsOf()).not.toHaveProperty('decision_ms');
  });
});

// ── Conditional props ────────────────────────────────────────────────────
describe('conditional props', () => {
  test('coach_read_failed carries status only for http failures', () => {
    events.emitCoachReadFailed('http', 503);
    expect(propsOf()).toEqual({ reason: 'http', status: 503 });

    jest.clearAllMocks();
    events.emitCoachReadFailed('network');
    expect(propsOf()).toEqual({ reason: 'network' });
    expect(propsOf()).not.toHaveProperty('status');
  });

  test('villain_guide_opened carries a scenario only when opened from the table', () => {
    events.emitVillainGuideOpened({ from: 'table', scenarioId: 'sc_007' });
    expect(propsOf()).toEqual({ from: 'table', scenario_id: 'sc_007' });

    jest.clearAllMocks();
    events.emitVillainGuideOpened({ from: 'tablereads' });
    expect(propsOf()).toEqual({ from: 'tablereads' });
  });

  test('table_reads_started flags only a re-deal', () => {
    events.emitTableReadsStarted({ lifetimeAttempts: 12, again: true });
    expect(propsOf()).toEqual({ lifetime_attempts: 12, again: true });

    jest.clearAllMocks();
    events.emitTableReadsStarted({ lifetimeAttempts: 0 });
    expect(propsOf()).toEqual({ lifetime_attempts: 0 });
    expect(propsOf()).not.toHaveProperty('again');
  });
});

// ── Systemic guards ──────────────────────────────────────────────────────
// These hold for every emitter, so a new one added later inherits them without
// anyone remembering to write a test.
describe('registry-wide shape', () => {
  const emitters = Object.entries(events).filter(([n]) => n.startsWith('emit'));

  test('the registry exports one emitter per event and nothing else', () => {
    expect(emitters.length).toBeGreaterThanOrEqual(30);
    for (const [, fn] of emitters) expect(typeof fn).toBe('function');
  });

  test('every event name is snake_case', () => {
    for (const [name, fn] of emitters) {
      jest.clearAllMocks();
      // Called with a permissive argument so destructuring emitters don't throw;
      // only the NAME is under test here.
      fn({});
      expect(track).toHaveBeenCalled();
      expect(nameOf()).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(nameOf()).not.toMatch(/[A-Z]/);
    }
  });

  test('every prop key is snake_case — the dashboards query these strings', () => {
    // The emitters take camelCase arguments and translate. A camelCase PROPERTY
    // reaching PostHog means a translation was missed, and every saved insight
    // filtering on the snake_case key silently stops matching.
    for (const [name, fn] of emitters) {
      jest.clearAllMocks();
      fn({});
      const props = track.mock.calls[0][1];
      if (!props) continue;
      for (const key of Object.keys(props)) {
        expect(`${name}:${key}`).toBe(`${name}:${key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)}`);
      }
    }
  });
});
