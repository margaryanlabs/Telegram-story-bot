# VETOGRAM AI — signed-owner response isolation / functional AI routing
24 October 2026 · Existing repo, existing draft PR #181 · **not released**

## What was fixed
The Telegram Mini App could switch its signed `initData` while an HTTP request remained in flight. The previous `request()` handler used to call `reset()` on any stale request; this could inadvertently erase the UI state of a **new owner B** if an earlier owner A's response completed later. Several Task Cloud, Reminders and AI Memory callbacks also had a `safeIdentity()` check after awaiting their request, but `safeIdentity()` could reset to the new identity and return `true`, enabling a stale callback to overwrite the new user's screen or clear B's loading flags.

`public/vetogram-owner-scope-core.js` contains pure guards:
- Compare signed Telegram `initData`, Telegram owner ID and a local `requestEpoch` captured at dispatch with the live values.
- Increment `requestEpoch` on every `reset()`, preventing A→B→A from reviving A's earlier requests.
- Allow an old request to reset UI state only if it **still owns** that UI state. Never reset active B merely because A finished.
- Respect already-authorized explicit sends: nothing silently unsends/undoes a network action. Guard only the local response application, associated notice and loading UI.

The browser uses these guards in the seven Task Cloud/Reminders operations, AI Memory load/write/erase, AI generation, and the user-confirmed Telegram send flow. Every scoped action avoids mutating a different owner's UI in both successful completions and stale catch/finally clauses. No customer content is logged or exported.

## User-facing AI Action + Second Brain bug
Previously, `generate()` evaluated `answer.brief` and `answer.action` before `const answer=await request('/api/vetogram-ai',...)` was executed. For `brief` and `action` modes this causes a JavaScript ReferenceError, preventing valid model responses from reaching UI.

The controller now issues the AI request first and then renders the relevant mode using `answer`. The explicit Negotiator grant still happens before the AI provider call. No changes to send authorization or Telegram bot write capabilities.

## Evidence and remaining gates
- New `tests/vetogram-owner-scope.test.js` includes pure owner identity, epoch and stale reset cases plus source-structure assertions for every protected operation.
- Added the new helper to `npm run check`, added the owner tests to `npm run ci:offline`.
- Seven regression test callbacks were executed on the live GitHub sources in a V8-only evaluation harness: **7 passed, zero failures**. Browser controller source parsed after removing its ES-module imports for isolated validation.
- **Not yet verified:** complete `npm test` in Node, actual Telegram WebView account-switch E2E, Bot API, provider response schema, PostgreSQL E2E, signed auth E2E, Vercel build or production.
- The existing `package-lock.json` mismatch and runner failure remain unresolved; do not claim deploy readiness. No Neon migration, rollout, production or main branch change.

## Manual QA for eventual combined release
1. Open Mini App under A, request AI response, Task Cloud list and AI Memory list. Before responses, switch to B and load B's own data. A's later responses must never overwrite B, clear B's spinner or show A's errors.
2. Switch A→B→A within a slow request, confirming the epoch rejects A's obsolete completion even though account IDs match again.
3. Issue user-confirmed Telegram send from A and switch to B: verify any network-side send separately under A; ensure no stale UI messages/clears on B. Avoid retrying uncertain sends automatically.
4. Test `brief` and `action` modes with a valid mocked AI provider response and separately granted Negotiator flow.
5. Validate pending reminders, cloud optimistic CAS, consent headers, role and quota checks against disposable Postgres before any release.
