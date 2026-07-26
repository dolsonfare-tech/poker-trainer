---
name: deploy-checklist
description: Run before and after every push to main. Enforces the SQL-before-deploy law, eval:coach requirement on prompt/model changes, e2e:build gotcha, env-var audit, and post-deploy verification steps.
---

# Deploy Checklist

Run this before pushing AND after the deploy lands. Push to `main` → Vercel
builds and deploys automatically (`vercel.json` is modern zero-config; the
legacy `builds`/`routes` format was removed July 2026 after it silently broke
`/api` routing for weeks).

---

## Pre-deploy: Step 1 — SQL law (gate 5) ⚠️ FIRST

**Does this change add a Supabase table or column?**

If yes, ALL of the following must happen BEFORE the push:

1. The block is in `supabase/schema.sql` with `ENABLE ROW LEVEL SECURITY`
   (invariants rule 8 exits 1 if missing) and explicit policies (WARN only if
   RLS is enabled but zero policies exist — a green gate does not by itself
   prove policies are in place; confirm the policy block is really there).
2. The founder has run that block in the Supabase SQL editor.
3. The founder has confirmed the column/table is live.

**Why this is a law — both incidents:**

- **`rebuys` column (July 18, 2026):** `createRemoteProfile`/`saveRemoteUser`
  sent `rebuys`, so until the `alter table` ran, EVERY profile write 400'd
  ("column profiles.rebuys does not exist") — breaking the entire session-save
  path, not just the Rebuy count.
- **`scenario_feedback` table (July 6, 2026):** softer failure — until the block
  ran, disagree submissions failed *gracefully* (inline "couldn't send" +
  `scenario_disagree_failed` event). Degraded UX shipping silently is still a miss.

Column additions on existing tables usually inherit the table's RLS + own-row
policies (like `rebuys` did) — say so explicitly when flagging to the founder.

**If SQL law applies and the SQL has NOT been run: stop. Do not push.**

---

## Pre-deploy: Step 2 — Prompt/model change law ⚠️ SECOND

**Does this change touch `api/coach-read.js` prompt text or the model string?**

If yes, a live `eval:coach` run is required BEFORE pushing:

```bash
CLAUDE_API_KEY=sk-ant-... npm run eval:coach
```

All 9 synthetic sessions must pass the F5 bar:
1. Pattern-level why (not hand-by-hand restatement)
2. Direction of error named (too passive / too aggressive / etc.)
3. Villain context used
4. Confident-miss callout when clustered fast+wrong hands
5. Human tone — no solver language, no invented details
6. Session-scoped voice (field notes, not a trait verdict)

**Use a short-lived founder console key** — Vercel Sensitive keys are write-only;
you cannot read them back. Generate a key at console.anthropic.com and delete it
after the run. Output goes to gitignored `coach-eval-output.md`.

Last live run: July 26, 2026 (9/9 pass, voice reframe verified).

**If the eval fails any of the 9 reads: fix the prompt, re-run. Do not push.**

---

## Pre-deploy: Step 3 — Gates

Run in this order; all must exit 0:

```bash
npm run check:invariants       # gate 1 — 16 architecture rules
CI=true npm test               # gate 2 — jest unit + integration suite
npm run audit:scenarios        # gate 3 — if scenarios.js or constants.js touched
npm run audit:observations     # gate 3b — if observations.js touched
npm run simulate:schemas       # gate 4 — if deriveSchema or rating engine touched
```

Then the e2e suite (gate 6). **The e2e build is different from the production build:**

```bash
npm run e2e:build              # blanks SUPABASE vars → localStorage mode → app boots past SignIn
npm run e2e                    # ~30s; plain `npm run build` bakes in .env keys and boots to SignIn
```

Never run `npm run e2e` against a plain `npm run build` — the specs can't seed
a user past the SignIn screen.

**If any gate fails: fix the issue, do not skip or weaken the check.**

---

## Pre-deploy: Step 4 — Env-var audit

Verify no new env vars violate ownership rules:

- `REACT_APP_*` vars are **public by definition** (CRA inlines them into the
  bundle). Never prefix a secret with `REACT_APP_` — invariants rule 4 exits 1.
- `REACT_APP_SENTRY_DSN` — set on **Production env only** in Vercel. CRA
  hardcodes `NODE_ENV='production'` even for preview builds — preview errors
  would be indistinguishable from real ones.
- `REACT_APP_GOOGLE_AUTH=1` — keep set wherever the Google OAuth provider is
  configured. The button navigates before erroring; an unconfigured provider
  shows a raw 400 page.
- `REACT_APP_SITE_URL` — must be `https://checkraise.ai` in Production. Source-
  pinned in `SignIn.test.js`.
- **AdSense vars (`REACT_APP_ADSENSE_CLIENT` / `_SLOT_*`) — DORMANT. Do not
  set.** AdSense is on hold (July 18, 2026 founder decision); the code is a
  total no-op without them.
- `CLAUDE_API_KEY` / `SUPABASE_SECRET_KEY` — Sensitive in Vercel; server-only
  in `api/coach-read.js`. Never commit, never put in `.env`, never prefix with
  `REACT_APP_`.

---

## Pre-deploy: Step 5 — Case-sensitivity check

**Did this change rename or add anything under `public/`?**

If yes:

```bash
git ls-files public/
```

All paths must be lowercase. Vercel is case-sensitive; macOS swallows case-only
renames. The PWA icons 404'd in production for weeks because git tracked
`Icons/Icon-*.png` (capitals). Invariants rule 7 (`case-sensitivity`) enforces
this mechanically — but verify manually after renames.

---

## Push

```bash
git push origin main
```

---

## Post-deploy: Step 1 — CI green

Check GitHub Actions. The CI workflow runs every gate on every push to main:
`npm ci` → invariants → audit:scenarios → audit:observations → jest →
simulate:schemas → playtest:personas (1 trial) → production build → e2e.

**A red CI run means the deploy shipped unverified.** Invariants rule 12
(`ci-status`) will nag locally on the next gate run.

---

## Post-deploy: Step 2 — Bundle string grep

Fetch the served JS bundle and grep for a string unique to the change:

```bash
# Example — verifying "Recommended Play" shipped
curl -s https://checkraise.ai/ | grep -o 'chunk\.[a-z0-9]*\.js' | head -1 | \
  xargs -I{} curl -s "https://checkraise.ai/static/js/{}" | grep -c "Recommended Play"
```

Past examples: "Recommended Play" (honest-labeling pass), the retry-screen copy,
"Shuffling up". This proves the deploy actually carries the change — a graceful
fallback can hide a dead feature for weeks (the `/api/coach-read` 404 lesson).

---

## Post-deploy: Step 3 — Asset check

If anything under `public/` changed: hard-refresh the prod URL and verify icons,
favicon, and any changed assets load without 404. Check Network tab in DevTools.

---

## Post-deploy: Step 4 — Feature smoke-test

For any user-facing change, verify the golden path in prod:

1. Open `https://checkraise.ai` in an incognito window.
2. Play the guest flow if the change touches auth/onboarding.
3. Navigate to the changed screen and confirm the feature string is present.

---

## Quick pre-deploy checklist

- [ ] SQL law: new table/column → SQL run in Supabase editor before push
- [ ] Eval:coach: prompt/model changed → live run passed (9/9, F5 bar)
- [ ] `npm run check:invariants` — exit 0
- [ ] `CI=true npm test` — exit 0
- [ ] `npm run audit:scenarios` — if scenarios.js / constants.js touched
- [ ] `npm run audit:observations` — if observations.js touched
- [ ] `npm run simulate:schemas` — if deriveSchema / rating engine touched
- [ ] `npm run e2e:build && npm run e2e` — if gameplay/dashboard/App.css/session flow
- [ ] No secret in a `REACT_APP_*` var
- [ ] AdSense vars not set (dormant)
- [ ] `git ls-files public/` — all lowercase if public/ changed

## Quick post-deploy checklist

- [ ] CI green on the push (GitHub Actions)
- [ ] Bundle string grep confirms the change is present
- [ ] Hard-refresh icon/asset check if `public/` changed
- [ ] Feature smoke-test in incognito prod window
