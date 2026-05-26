# CheckRaise — Decision Log

Running record of all meaningful decisions made during design and build. Update any time a significant decision is made.

**Entry format:**
`[Date] — [Category] — [Source: Strategy / Build / Feedback]`
`Decision:` What was decided
`Reason:` Why (one sentence)
`Impact:` What it affects

---

## Decisions

**May 2026 — Platform — Source: Strategy**
Decision: Build as a React web app first, not native iOS
Reason: Partner's skill level and AI code generation works better with React than Swift or React Native
Impact: All Phase 1 code is React; iOS App Store path uses Capacitor wrapper in Phase 3

**May 2026 — Platform — Source: Strategy**
Decision: Rejected Flutter for now, may revisit later
Reason: Partner unfamiliar with Dart; React has better AI code generation support
Impact: Stick with React ecosystem; Flutter remains an option if switching to cross-platform later

**May 2026 — Backend — Source: Strategy**
Decision: Supabase chosen over Firebase for Phase 2 backend
Reason: PostgreSQL is better for querying user decision history needed for personalization engine
Impact: Phase 2 database schema designed for PostgreSQL; Supabase Auth for login

**May 2026 — Architecture — Source: Strategy**
Decision: Folder structure established before writing any code
Reason: Brother flagged importance of scalable structure for future developer handoff
Impact: src/components, src/data, src/utils, src/hooks folders; see master architecture doc

**May 2026 — Metadata — Source: Strategy**
Decision: Bundle ID format locked as com.[yourname].checkraise
Reason: Bundle ID cannot be changed after App Store submission
Impact: Must be set in package.json and Xcode before App Store submission; currently deferred pending name decision

**May 2026 — Scenario Data — Source: Strategy**
Decision: All scenarios include difficulty and weight fields from day one
Reason: Required for spaced repetition engine in Phase 2; easier to add now than retrofit later
Impact: scenarios.js data structure includes `difficulty: beginner/intermediate/advanced` and `weight: 1.0`

**May 2026 — AI Integration — Source: Strategy**
Decision: Claude API called directly from browser in Phase 1 with `anthropic-dangerous-direct-browser-access` header
Reason: No backend exists yet in Phase 1; acceptable for private prototype only
Impact: API key must move to backend proxy before any public launch

**May 2026 — Styling — Source: Build**
Decision: Switched from Google Fonts to system fonts (Georgia, Courier New) during early development
Reason: Google Fonts failed to load when opening HTML file directly without a server
Impact: Later reversed — Playfair Display and JetBrains Mono added via Google Fonts in Phase 1.5

**May 2026 — Deployment — Source: Build**
Decision: Deployed React app to Vercel via GitHub integration
Reason: Free hosting with automatic redeployment on every GitHub push
Impact: Live URL at checkraise.ai; every push to GitHub main branch auto-deploys

**May 2026 — API Security — Source: Build**
Decision: Removed hardcoded Claude API key from App.js before pushing to GitHub; moved to Vercel environment variable REACT_APP_CLAUDE_API_KEY
Reason: GitHub push protection blocked commits containing exposed API keys
Impact: App.js references environment variable; API key must be set in Vercel dashboard

**May 2026 — Build Approach — Source: Build**
Decision: Used single index.html prototype first, then migrated to proper React app structure via create-react-app
Reason: Faster to validate concept with single file before setting up full project structure
Impact: Code now lives in src/App.js inside proper React project

**May 2026 — Content — Source: Feedback**
Decision: Opponent modeling added as a core skill category
Reason: Poker SME feedback: playing the opponent is weighted higher than cards or position in real play
Impact: Scenarios need villain profiles; new skill category added; grading logic accounts for villain type

**May 2026 — Content — Source: Feedback**
Decision: Grading logic needs contextual awareness — correct answer varies by villain type
Reason: Poker SME disagreed with some assessments; correct play against a nit differs from correct play against a maniac
Impact: Scenario data structure includes villain field; Claude prompt receives villain context

**May 2026 — Roadmap — Source: Feedback**
Decision: Simulated bot gameplay added to Phase 2 roadmap
Reason: Business partner feedback: wants guided play against a computer, not just static scenarios
Impact: Phase 2 scope expands; scenario trainer remains Phase 1 foundation

**May 2026 — Architecture — Source: Build**
Decision: Scenarios moved from App.js into dedicated src/data/scenarios.js file
Reason: Separates content from code so partner can add scenarios without touching App.js
Impact: App.js imports SCENARIOS from ./data/scenarios; all future scenario additions go in scenarios.js only

**May 2026 — API — Source: Build**
Decision: Model name corrected to claude-sonnet-4-5
Reason: Original model string returned 404 errors
Impact: Both API calls in App.js updated

**May 2026 — Branding — Source: Strategy**
Decision: App renamed from PokerIQ to CheckRaise
Reason: Final brand decision; domain is checkraise.ai
Impact: package.json, manifest.json, App.js header, index.html title all updated; Bundle ID set as com.yourname.checkraise

**May 2026 — Performance — Source: Build**
Decision: Per-scenario Claude API call replaced with pre-written static feedback in scenarios.js
Reason: API calls on every decision caused slow feedback and unnecessary cost
Impact: handleDecision no longer calls the API; each scenario has a feedback object with correct/partial/incorrect responses; only Coach's Read at session end calls the API

**May 2026 — UI — Source: Build**
Decision: Correct answer shown in feedback panel for incorrect and partial responses
Reason: Users need to know what the right play was immediately after making a mistake
Impact: FeedbackPanel accepts a correctAnswer prop and displays the correct play when grade is incorrect or partial

**May 2026 — Architecture — Source: Build**
Decision: App.js split into 7 component files in src/components
Reason: Separates concerns and prepares codebase for developer handoff in Phase 2
Impact: ScenarioCard, FeedbackPanel, SkillTracker, SessionSummary, VillainGuide, DifficultySelector, PlayingCard all live in src/components; App.jsx is routing only

**May 2026 — Architecture — Source: Build**
Decision: API logic moved from App.js into src/utils/claude.js
Reason: Single file owns all Claude API calls
Impact: fetchCoachRead exported from claude.js; no other file should call the API directly

**May 2026 — AI Integration — Source: Build**
Decision: Villain context and tableContext injected into Coach's Read prompt
Reason: Coach's Read was analyzing decisions without knowing the opponent type, producing generic feedback
Impact: Each decision in the prompt includes villain label, villain notes, and tableContext

**May 2026 — Content — Source: Strategy**
Decision: Dedicated Claude project created for scenario generation separate from build project
Reason: Scenario generation needs a focused system prompt without build context polluting it
Impact: Scenario Generator project contains scenarios.js, build guide, and deep research papers

**May 2026 — Content — Source: Strategy**
Decision: Both Gemini and ChatGPT deep research papers uploaded to scenario generation project
Reason: Gemini paper covers GTO math and villain metrics; ChatGPT paper covers live exploitative instincts and Fitzgerald frameworks — neither alone was sufficient
Impact: Scenario generator has both theoretical backbone and practical texture

**May 2026 — Content — Source: Strategy**
Decision: 50 new scenarios added (sc_034 through sc_083), bringing total to 83
Reason: Phase 2 requires 50+ SME-reviewed scenarios; batch generated via dedicated scenario generation project
Impact: All 8 skill areas now have minimum 9 scenarios each; all difficulty levels covered; pending SME review

**May 2026 — Gamification — Source: Build**
Decision: Streaks added to Phase 1 using localStorage; XP system later removed entirely
Reason: XP is not meaningful or helpful to the user; streak is the sole primary engagement metric
Impact: Streak increments on consecutive daily sessions; breaks if a day is missed; localStorage ready to migrate to Supabase in Phase 2

**May 2026 — Session Structure — Source: Build**
Decision: Session length set to 5 scenarios
Reason: 10 scenarios felt too long during playtesting; 5 matches the daily puzzle model
Impact: SESSION_LENGTH constant in App.jsx controls this

**May 2026 — Roadmap — Source: Strategy**
Decision: Phase 1.5 added between Phase 1 and Phase 2 — UX and design validation before backend
Reason: Developer friend recommended slowing down and validating the full logged-in experience with dummy data before spending money on a database
Impact: No Supabase or backend work begins until Phase 1.5 screens are designed, tested, and reviewed

**May 2026 — Architecture — Source: Strategy**
Decision: Dummy user data hardcoded in src/data/dummyUser.js for Phase 1.5
Reason: Need to simulate full logged-in experience without a real backend
Impact: All Phase 1.5 screens read from dummyUser.js; replaced with real Supabase data in Phase 2; data shape informs Phase 2 database schema

**May 2026 — Roadmap — Source: Strategy**
Decision: Monetization decision deferred until after Phase 1.5 UX validation
Reason: Wrong to architect for a specific monetization model before knowing what users respond to
Impact: Architecture keeps all doors open — subscription, freemium, one-time purchase all remain viable

**May 2026 — Content — Source: Build**
Decision: Scenario body and question text must use suit symbols (♠♥♦♣), never shorthand abbreviations
Reason: Shorthand is inconsistent with the UI and confusing for beginner players
Impact: All future scenarios must write hands as e.g. Q♦J♦ not QJd

**May 2026 — Content — Source: Build**
Decision: Question text must name all available options — never two-option framing when three buttons exist
Reason: Two-option question framing misleads players into ignoring the third option
Impact: Standard phrasing is "Fold, call, or raise?" or "What do you do?"

**May 2026 — Roadmap — Source: Strategy**
Decision: Leaderboard added to Phase 1.5 as a collapsed embedded section on the Dashboard rather than a separate screen
Reason: Behavioral specialist feedback — collapsed view validates the competitive mechanic more cleanly
Impact: Leaderboard lives inside Dashboard.jsx, not as a standalone screen

**May 2026 — Roadmap — Source: Strategy**
Decision: New-user state (gray dots, locked schema, 0 sessions) deferred to Phase 2
Reason: The value of the new-user state only emerges when a real user hits session 5 for the first time; a static dummy version tests nothing meaningful
Impact: Phase 1.5 dashboard shows returning-user state only; new-user onboarding built in Phase 2 with real Supabase data

**May 2026 — Architecture — Source: Build**
Decision: VILLAIN_LABELS and SKILL_TAGS lookup objects added to scenarios.js; tag and villain.label fields removed from all 83 scenarios
Reason: Both fields were redundant — tag always paired with skill, villain.label always paired with villain.type; hardcoding both created silent drift risk
Impact: mkScenario derives tag and villain.label automatically; console.warn guards fire on unknown types; output shape unchanged

**May 2026 — Content — Source: Build**
Decision: Scenario 3 villain label standardized from "Passive Regular" to "Passive Player"
Reason: Only scenario using "Passive Regular" — no strategic distinction; inconsistency discovered during lookup refactor
Impact: Covered automatically by the VILLAIN_LABELS lookup

**May 2026 — UI — Source: Build**
Decision: Dashboard added as entry point screen, replacing DifficultySelector as the first screen the user sees
Reason: Phase 1.5 goal — validate the full logged-in experience before building the backend
Impact: App.jsx screen state now includes 'dashboard'; difficulty selector sits behind CTA; handleRestart routes back to dashboard; logo tap returns to dashboard from any screen

**May 2026 — UI — Source: Build**
Decision: Dashboard rebuilt with behavioral specialist input — section order, stats size, coach copy, and desktop layout all revised
Reason: Original build had redundant streak mentions, oversized hero numbers, CTA in wrong position for one-handed mobile use, and no desktop optimization
Impact: Section order is Archetype → Skills → Leaderboard → CTA; hero numbers replaced with compact stat row (1.6rem Playfair); coach copy removed for cleanliness; dashboard capped at 480px with card frame on desktop screens above 700px

**May 2026 — UI — Source: Build**
Decision: Playfair Display and JetBrains Mono added via Google Fonts; Georgia and Courier New become fallbacks only
Reason: Georgia is a body text font from 1993 — at display size, Playfair Display's stroke contrast is significantly more distinctive and premium
Impact: public/index.html gets Google Fonts link tags; Playfair Display on logo, hero numbers, schema name, schema quote, CTA; JetBrains Mono on all label/monospace elements

**May 2026 — UI — Source: Build**
Decision: XP system removed entirely
Reason: Partner feedback — XP is not meaningful or helpful to the user; streak is sufficient as the primary engagement metric
Impact: XP_VALUES, XP_SESSION_BONUS, XP_STREAK_BONUS, sessionXP, xpData removed from App.jsx; XPSummary component removed from SessionSummary.jsx; calcStreakAndXP replaced with calcStreak

**May 2026 — UI — Source: Build**
Decision: SkillTracker removed from the session/gameplay screen
Reason: Partner feedback — reduces scroll and removes redundancy; skill results shown on session summary only
Impact: Session screen is now: progress dots → combo ring → scenario card → feedback → next button

**May 2026 — UI — Source: Build**
Decision: Color coding legend and skill descriptions added to dashboard and session summary
Reason: Users need to know what the dot colors mean and what each skill tests
Impact: Legend row added below skill dots on dashboard (Strong / Work On / Weak / Unrated); session summary adds same legend plus one-line description of each skill

**May 2026 — UI — Source: Build**
Decision: Gameplay page simplified — pot removed from decision panel, street/decision header removed
Reason: Pot shown twice; street/decision header redundant with board
Impact: DecisionPanel no longer renders dp-header with street and pot; single source of truth for pot is the board section

**May 2026 — UI — Source: Build**
Decision: Skill dots on dashboard made tappable — expand to show skill description and color meaning
Reason: Users need to understand what each skill tests and what the color rating means without leaving the dashboard
Impact: SkillDot component in Dashboard.jsx has expanded state; tapping spans the cell across 2 columns and shows description + rating label; section meta updated to "tap a skill to learn more"

**May 2026 — UI — Source: Build**
Decision: Global leaderboard replaced with friends leaderboard
Reason: Consistent user feedback requesting friends comparison; global leaderboard with fake usernames tests nothing meaningful
Impact: dummyUser.js leaderboard updated to friends shape with isUser flag; "See full →" replaced with "Invite →"; your row highlighted in gold; Phase 2 will need Supabase social graph for real friends data

**May 2026 — UI — Source: Build**
Decision: CTA button text changed from "Start Today's Session" to "Deal Me In"
Reason: "Start Today's Session" felt wrong for second or third sessions in a day; "Deal Me In" is poker-native and works every time
Impact: Dashboard.jsx CTA label updated

**May 2026 — Roadmap — Source: Strategy**
Decision: Beginner-to-Pro spectrum deferred to Phase 2
Reason: Needs real session history and accuracy data to be meaningful; a static position in Phase 1.5 dummy data tests nothing
Impact: Will replace the stats row (streak + sessions) in Phase 2 once real data exists

**May 2026 — Roadmap — Source: Strategy**
Decision: Phase 2 scope to be locked based on Phase 1.5 user feedback, not pre-defined
Reason: Developer friend's advice — don't build features users haven't reacted to yet
Impact: Phase 2 technical spec written after Phase 1.5 testing; developer friend reviews before Phase 2 begins