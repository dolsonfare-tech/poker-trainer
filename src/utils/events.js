import { track } from './analytics';

// ─── events.js — the PostHog event registry (MOD-011 / CA-033, Wave 4) ─────
//
// Every event name and every prop shape lives here, once. Callers import an
// emitter and pass values; they never hand-write a name or assemble a prop bag.
// Invariants rule 28 enforces that — an event-name string literal anywhere but
// this file is a build error.
//
// Why: the funnel is load-bearing. The session-start triage drill reads it, the
// day-14 playtest analysis depends on it, and PostHog has no schema — a
// one-character typo produces a silently empty funnel rather than an error, and
// the data cannot be re-collected after the fact. Before this file, 32 events
// were composed inline at 37 call sites.
//
// Prop naming: PostHog properties stay snake_case (that is how they are queried
// in the dashboards and in TRIAGE.md); emitter ARGUMENTS are camelCase, like
// the rest of the codebase. The mapping happens here, so neither side bends to
// the other.

// ── Auth + identity ───────────────────────────────────────────────────────
export const emitSignInLinkSent      = () => track('sign_in_link_sent');
export const emitSignInLinkError     = (message) => track('sign_in_link_error', { message });
export const emitGoogleSignInClicked = () => track('google_sign_in_clicked');
export const emitSignedIn            = () => track('signed_in');
export const emitStaleSessionCleared = () => track('stale_session_cleared');
export const emitProfileLoadFailed   = (message) => track('profile_load_failed', { message });
export const emitProfileCreated      = () => track('profile_created');
export const emitProfileCreateFailed = (message) => track('profile_create_failed', { message });

// ── Guest gate ────────────────────────────────────────────────────────────
export const emitGuestPlayClicked = () => track('guest_play_clicked');
/** `from` is the surface the gate fired on: summary | dashboard | topbar. */
export const emitGuestGateSignIn  = (from) => track('guest_gate_signin', { from });

// ── The session loop ──────────────────────────────────────────────────────
export const emitSessionStarted = ({ difficulty, chained, guest }) =>
  track('session_started', { difficulty, chained, guest });

/**
 * One hand answered — including a timeout, which scores as a miss.
 *
 * This emitter exists because the two call sites had DRIFTED: the timeout path
 * omitted `decision_ms` while the answered path included it (CA-033). The
 * comprehension heatmap reads `decision_made.decision_ms` p50 per scenario, so
 * the two shapes are not interchangeable.
 *
 * The asymmetry is PRESERVED, deliberately, and is now stated in one place
 * instead of being an accident of two call sites: a timed-out hand carries no
 * `decision_ms` because the player never decided — the clock ran out. Emitting
 * the full timer duration would be indistinguishable from someone who thought
 * hard and answered at the buzzer, which is a different player and a different
 * diagnosis. Omitting it keeps the heatmap's p50 over hands that were actually
 * answered. Changing this is a data-semantics decision, not a refactor.
 */
export const emitDecisionMade = ({ scenarioId, skill, result, timedOut, replay, decisionMs }) =>
  track('decision_made', {
    scenario_id: scenarioId,
    skill,
    result,
    timed_out: timedOut,
    replay,
    ...(timedOut ? {} : { decision_ms: decisionMs }),
  });

export const emitSessionCompleted = ({ difficulty, correct, incorrect, total, guest }) =>
  track('session_completed', { difficulty, correct, incorrect, total, guest });

// ── Coach's Read ──────────────────────────────────────────────────────────
export const emitCoachReadOk = () => track('coach_read_ok');
/**
 * `reason` is network | daily_limit | http | empty_response. `status` rides
 * along only on http — the triage drill breaks this event down by reason, so a
 * new reason string must be added to the TRIAGE.md catalog note as well.
 */
export const emitCoachReadFailed = (reason, status) =>
  track('coach_read_failed', status === undefined ? { reason } : { reason, status });

// ── Reference surfaces ────────────────────────────────────────────────────
export const emitSchemaGuideOpened = (schema) => track('schema_guide_opened', { schema });
/** `from` is 'table' (carries the scenario) or 'tablereads' (does not). */
export const emitVillainGuideOpened = ({ from, scenarioId }) =>
  track('villain_guide_opened', scenarioId === undefined ? { from } : { from, scenario_id: scenarioId });
export const emitTablePeeked = (scenarioId) => track('table_peeked', { scenario_id: scenarioId });

// ── Scenario disagreement (content-bug capture) ───────────────────────────
export const emitScenarioDisagreeOpened = ({ scenarioId, result }) =>
  track('scenario_disagree_opened', { scenario_id: scenarioId, result });
export const emitScenarioDisagreeSubmitted = ({ scenarioId, reason, result }) =>
  track('scenario_disagree_submitted', { scenario_id: scenarioId, reason, result });
export const emitScenarioDisagreeFailed = (scenarioId) =>
  track('scenario_disagree_failed', { scenario_id: scenarioId });

// ── Beta feedback ─────────────────────────────────────────────────────────
export const emitFeedbackOpened      = () => track('feedback_opened');
export const emitFeedbackSubmitted   = ({ category, length }) =>
  track('feedback_submitted', { category, length });
export const emitFeedbackSubmitFailed = () => track('feedback_submit_failed');

// ── Dashboard ─────────────────────────────────────────────────────────────
export const emitCoachNotebookOpened = (reads) => track('coach_notebook_opened', { reads });
export const emitGoProClicked        = () => track('go_pro_clicked');
export const emitUsernameEditOpened  = () => track('username_edit_opened');
export const emitUsernameChanged     = () => track('username_changed');
/** `reason` is rate_limited | error. */
export const emitUsernameChangeFailed = (reason) => track('username_change_failed', { reason });

// ── Table Reads (mode-local) ──────────────────────────────────────────────
/** `again` marks a re-deal from the summary; absent on a fresh entry. */
export const emitTableReadsStarted = ({ lifetimeAttempts, again }) =>
  track('table_reads_started', again
    ? { lifetime_attempts: lifetimeAttempts, again: true }
    : { lifetime_attempts: lifetimeAttempts });
export const emitTableReadsAnswered = ({ observationId, picked, correct }) =>
  track('table_reads_answered', { observation_id: observationId, picked, correct });
export const emitTableReadsCompleted = ({ correct, total }) =>
  track('table_reads_completed', { correct, total });
