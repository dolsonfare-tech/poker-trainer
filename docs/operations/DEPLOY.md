# DEPLOY — push-to-deploy, the SQL law, env vars

> **Read this when…** you're about to deploy, a change adds a Supabase table or
> column, you're setting/auditing Vercel env vars, or a deploy landed and you need
> to verify it actually took.

## The flow

Push to `main` → Vercel builds and deploys. `vercel.json` is modern zero-config:

```json
{ "framework": "create-react-app", "outputDirectory": "build" }
```

`api/` is auto-mounted as serverless functions. The legacy `builds`/`routes` format
was removed July 2026 — it **silently broke `/api` routing** (`/api/coach-read`
404'd in prod while the graceful client fallback hid it). Don't reintroduce it.

## ⚠️ THE SQL-BEFORE-DEPLOY LAW (gate 5)

**New table or column → the block goes in `supabase/schema.sql` with RLS enabled +
explicit policies (invariants rule 8 fails otherwise) → run that block in the
Supabase SQL editor BEFORE the deploy that uses it → flag it to the founder.**

Why this is a law, not a guideline — both incidents:

- **`rebuys` column (July 18, 2026)** — `createRemoteProfile`/`saveRemoteUser` send
  `rebuys`, so until the `alter table` ran, EVERY profile write 400'd
  ("column profiles.rebuys does not exist") — breaking the whole session-save path,
  not just the Rebuy count. The SQL was run the same day, before the push.
- **`scenario_feedback` table (July 6, 2026)** — the softer failure mode: until the
  block ran, disagree submissions failed *gracefully* (inline "couldn't send" +
  `scenario_disagree_failed` event). Degraded UX shipping silently is still a miss.

Column additions on existing tables usually inherit the table's RLS + own-row
policies (the `rebuys` case) — say so explicitly when flagging to the founder.

## Env-var map (Vercel)

`REACT_APP_*` vars are **public by definition** (CRA inlines them into the bundle)
— set them plain, never Sensitive, and never prefix a secret with `REACT_APP_`
(invariants rule 4 catches it).

| Var | Kind | Notes |
|-----|------|-------|
| `REACT_APP_SUPABASE_URL` / `REACT_APP_SUPABASE_ANON_KEY` | public | absent → app runs localStorage-only mode (dev/jest/e2e) |
| `REACT_APP_POSTHOG_KEY` (+ optional `_HOST`) | public | absent → analytics.js is a silent no-op |
| `REACT_APP_SENTRY_DSN` | public, **Production env only** | deliberate: `environment` comes from NODE_ENV, which CRA hardcodes to `'production'` even for preview builds — preview events would be indistinguishable from real ones |
| `REACT_APP_GOOGLE_AUTH=1` | public flag | gates the Google button because `signInWithOAuth` navigates before erroring — an unconfigured provider shows a raw 400 page. Keep set wherever the provider is configured |
| `REACT_APP_SITE_URL` | public | auth redirect target (`https://checkraise.ai`); falls back to `window.location.origin`. Source-pinned in SignIn.test.js |
| `REACT_APP_ADSENSE_CLIENT` / `_SLOT_DASHBOARD` / `_SLOT_SUMMARY` | public, **DORMANT — do not set** | AdSense is on hold (July 18 founder decision); ads.js is a total no-op without them |
| `CLAUDE_API_KEY` | **Sensitive** | server-only, `api/coach-read.js`. Write-only in Vercel — `eval:coach` needs a separate short-lived founder console key |
| `SUPABASE_SECRET_KEY` | **Sensitive** | server-only, `api/coach-read.js` (which reads `SUPABASE_URL` or falls back to `REACT_APP_SUPABASE_URL`) |

## Post-deploy checks

1. **CI green on the push** — the workflow runs every gate; a red run means the
   deploy shipped unverified (invariants rule 12 will nag locally).
2. **Prod-bundle string grep** — fetch the deployed JS bundle and grep for a string
   unique to the change (past examples: "Recommended Play", the retry-screen copy).
   Proves the deploy carries the code; a graceful fallback can otherwise hide a
   dead feature for weeks (the coach-read 404 lesson).
3. **Hard-refresh icon/asset check** when anything under `public/` changed.

## Case-sensitivity law

Vercel is case-sensitive; macOS swallows case-only renames — prod 404'd the PWA
icons for weeks because git tracked `Icons/Icon-*.png` while the code asked for
lowercase. **After any rename under `public/`, verify with `git ls-files`.**
Invariants rule 7 (`case-sensitivity`) enforces the lowercase rule mechanically.

## DNS / email facts

| Concern | Fact |
|---------|------|
| Magic-link SMTP | Resend, on the `send.` subdomain; DKIM + DMARC `p=none`; Supabase SMTP = `smtp.resend.com:465`, user literal `resend`, password = Resend API key, sender `signin@checkraise.ai` |
| Resend gotcha | the domain stays "Not started" until you click **Verify DNS Records** — Supabase 500s ("Error sending magic link email") until then |
| support@checkraise.ai | Cloudflare Email Routing (was silently DISABLED until July 5, 2026 — bounced everything; re-enabled + verified) |
| Custom auth domain | deferred post-launch (~$35/mo Supabase Pro + addon) |
