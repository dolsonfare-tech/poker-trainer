# TRIAGE — the intake drill + PostHog event catalog

> **Read this when…** starting ANY working session (the drill runs first), a user
> reports a bug, or you need the exact name/props of a PostHog event.

## Cadence

**START of every session** — upgraded from weekly on July 20, 2026, when the
playtest link started being shared publicly. The four channels collect on their
own; this drill is what routes them into the ratchet.

## The four channels

1. **Sentry** (dashboard) — new issue types since last look. One-time founder
   action, **still open:** enable Sentry's new-issue EMAIL alerts so this channel
   pushes instead of waiting to be read. (An empty dashboard = no crashes, not a
   dead integration — the pipeline was verified end-to-end July 7.)
2. **PostHog failure events** — `coach_read_failed` (should be zero),
   `profile_load_failed`, `profile_create_failed`, `scenario_disagree_failed`,
   `username_change_failed`, `stale_session_cleared` (a spike = sessions being
   revoked somewhere). Plus the **comprehension heatmap**: `decision_made.decision_ms`
   p50 + `timed_out` rate per `scenario_id` — sustained outliers are comprehension
   bugs (see GAMEPLAY_COMPREHENSION_FINDINGS.md C4).
3. **`scenario_feedback`** (SQL editor) — most-flagged hands; grading disputes are
   content bugs:

   ```sql
   select scenario_id, reason, count(*) from public.scenario_feedback
   group by 1, 2 order by count(*) desc;
   ```

4. **`feedback`** (SQL editor):

   ```sql
   select category, message, created_at from public.feedback
   order by created_at desc limit 30;
   ```

## The routing law

Every real item becomes a work item, and the session that fixes it **MUST encode
the check** (invariants rule, audit rule, jest pin, e2e guard, or harness
invariant — the ratchet law, [GATES.md](GATES.md) gate 7) **and stamp the relevant
findings doc**. A user-reported bug that gets fixed without leaving a permanent
check behind is a triage failure, not a fix.

## PostHog event catalog

Every `track(` call in src, verified by grep (July 26, 2026). `track`/`identify`/
`resetAnalytics` live ONLY in `src/utils/analytics.js` (invariants rule 3);
autocapture is off — this catalog is the complete event surface. **32 events.**

Funnel order: `sign_in_link_sent` → `signed_in` → `profile_created` →
`session_started` → `decision_made` ×5 → `session_completed`.

| Event | Props | Fired from |
|-------|-------|------------|
| `sign_in_link_sent` | — | SignIn.jsx |
| `sign_in_link_error` | `message` | SignIn.jsx |
| `google_sign_in_clicked` | — | SignIn.jsx |
| `signed_in` | — | App.jsx (SIGNED_IN auth event) |
| `stale_session_cleared` | — | App.jsx (invalid-session recovery) |
| `profile_load_failed` | `message` | App.jsx (fetch error → retry screen) |
| `profile_created` | — | App.jsx |
| `profile_create_failed` | `message` | UsernameEntry.jsx |
| `guest_play_clicked` | — | App.jsx |
| `guest_gate_signin` | `from` (summary\|dashboard\|topbar) | App.jsx |
| `session_started` | `difficulty`, `chained`, `guest` | App.jsx |
| `decision_made` | `scenario_id`, `skill`, `result`, `timed_out`, `replay`; + `decision_ms` (non-timeout path; timeout path sends `result:'incorrect'`, `timed_out:true`) | App.jsx (two call sites) |
| `session_completed` | `difficulty`, `correct`, `incorrect`, `total`, `guest` | App.jsx |
| `coach_read_ok` | — | utils/claude.js |
| `coach_read_failed` | `reason` (network\|daily_limit\|http\|empty_response), `status` (http only) | utils/claude.js |
| `schema_guide_opened` | `schema` | App.jsx |
| `villain_guide_opened` | `from` ('tablereads' \| 'table' + `scenario_id`) | App.jsx (two call sites) |
| `table_peeked` | `scenario_id` | ScenarioCard.jsx |
| `scenario_disagree_opened` | `scenario_id`, `result` | FeedbackPanel.jsx |
| `scenario_disagree_submitted` | `scenario_id`, `reason`, `result` | FeedbackPanel.jsx |
| `scenario_disagree_failed` | `scenario_id` | FeedbackPanel.jsx |
| `feedback_opened` | — | Dashboard.jsx |
| `feedback_submitted` | `category`, `length` | Dashboard.jsx |
| `feedback_submit_failed` | — | Dashboard.jsx |
| `coach_notebook_opened` | `reads` | Dashboard.jsx |
| `go_pro_clicked` | — | Dashboard.jsx |
| `username_edit_opened` | — | Dashboard.jsx |
| `username_changed` | — | Dashboard.jsx |
| `username_change_failed` | `reason` (rate_limited\|error) | Dashboard.jsx |
| `table_reads_started` | `lifetime_attempts`; + `again:true` on re-deal | TableReads.jsx (two call sites) |
| `table_reads_answered` | `observation_id`, `picked`, `correct` | TableReads.jsx |
| `table_reads_completed` | `correct`, `total` | TableReads.jsx |

Adding an event: call `track()` from `src/utils/analytics.js` (never posthog-js
directly — invariants rule 3), then add the row here.
