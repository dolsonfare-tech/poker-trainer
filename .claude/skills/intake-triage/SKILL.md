---
name: intake-triage
description: Run at the START of every working session. Checks all four user-signal channels (Sentry, PostHog, scenario_feedback SQL, feedback SQL), converts every real item to a work item, and applies the ratchet law before any coding begins.
---

# Intake Triage — Session-Start Drill

**Cadence:** every working session, before any code change. Upgraded from weekly
on July 20, 2026, when the playtest link started being shared publicly.

The four channels collect on their own. This drill is what routes them into the
ratchet. It costs 5 minutes and catches the class of bug where a user suffers
silently while the fix-queue grows stale.

---

## Channel 1 — Sentry

**What to check:** new issue types since the last session. Navigate to the
Sentry dashboard for the CheckRaise project.

**Healthy state:** no new issues since last look. An empty dashboard = no
crashes, not a dead integration (the pipeline was verified end-to-end July 7,
2026 — a `sentry-wire-test` event sits in the dashboard from that run; safe to
resolve).

**Open founder action (still pending):** enable Sentry's new-issue EMAIL alerts
so this channel pushes instead of waiting to be read.

**On a new issue:** record it as a work item. The session that fixes it must
encode a permanent check (jest pin, e2e guard, invariants rule — gate 7).

---

## Channel 2 — PostHog failure events

**Failure events to check** (all should be zero or very low):

| Event | Healthy | Spike means |
|-------|---------|-------------|
| `coach_read_failed` | 0 | Anthropic endpoint or auth issue |
| `profile_load_failed` | 0 | Supabase fetch error (shows retry screen) |
| `profile_create_failed` | 0 | UsernameEntry save failure |
| `scenario_disagree_failed` | 0 | `scenario_feedback` table missing or RLS error |
| `username_change_failed` | low | rate_limited is OK; `error` reason is not |
| `stale_session_cleared` | 0 | spike = sessions being revoked somewhere |

**Comprehension heatmap** (check when PlayTest is active):

Navigate to PostHog → `decision_made` events → filter by `timed_out: true` and
group by `scenario_id`. Sustained timeout rate or p50 `decision_ms` outlier on
a specific scenario = comprehension bug (see
`docs/findings/GAMEPLAY_COMPREHENSION_FINDINGS.md` C4). Add to work queue.

---

## Channel 3 — scenario_feedback (SQL editor)

Run in the Supabase SQL editor (founder / service-role access):

```sql
select scenario_id, reason, count(*)
from public.scenario_feedback
group by 1, 2
order by count(*) desc;
```

Most-flagged hands are content bugs. `grading_wrong` + `deserves_credit` reasons
indicate grading disputes — route these to the SME review queue and flag in
`docs/findings/SCENARIO_GRADING_FINDINGS.md`.

---

## Channel 4 — feedback (SQL editor)

```sql
select category, message, created_at
from public.feedback
order by created_at desc
limit 30;
```

Categories: `gameplay` / `scenarios` / `technical` / `idea`. Route each to the
appropriate finding doc or backlog entry. `technical` = work item immediately.

---

## Routing law (gate 7 — ratchet)

**Every real item from the four channels above becomes a work item.**

The session that fixes it **MUST:**

1. Leave a permanent mechanical check behind — one of:
   - an invariants rule in `scripts/check-invariants.mjs`
   - an audit rule in `scripts/audit-scenarios.mjs` or `audit-observations.mjs`
   - a jest pin in the test suite
   - an e2e guard in `e2e/`
   - a harness invariant in `scripts/playtest-personas.mjs`

2. Stamp the relevant findings doc with the fix and the check.

A user-reported bug that gets fixed without leaving a permanent check behind is
**a triage failure, not a fix**. Prose rules drift; exit codes don't.

---

## If all channels are clear

Confirm healthy state:

> "Triage clean — Sentry 0 new issues, all PostHog failure events zero,
> no new scenario_feedback spikes, no new feedback items. Proceeding with
> [session goal]."

Then proceed to the session goal.

---

## Quick reference — PostHog event catalog

32 events total (as of July 26, 2026). Full catalog in `docs/operations/TRIAGE.md`.

Funnel: `sign_in_link_sent` → `signed_in` → `profile_created` →
`session_started` → `decision_made` ×5 → `session_completed`.

Key health events outside the funnel:
- `coach_read_ok` / `coach_read_failed` (reason: network | daily_limit | http | empty_response)
- `stale_session_cleared`
- `profile_load_failed` / `profile_create_failed`
- `scenario_disagree_failed`

**Adding a new event:** call `track()` only from `src/utils/analytics.js` (never
posthog-js directly — invariants rule 3), then add the row to
`docs/operations/TRIAGE.md`'s event catalog.
