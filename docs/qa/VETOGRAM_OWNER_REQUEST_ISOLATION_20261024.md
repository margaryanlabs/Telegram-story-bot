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


## Follow-up: explicit confirmation must be owner-bound before network

After initial source review, an additional race was found: a user can open an explicit `window.confirm` under A, switch to B, and press OK. Capturing the owner *after* confirmation would authorize the subsequent network call under B even though A supplied the task/chat target. This is distinct from suppressing stale responses.

For all nine relevant confirmations (Task Cloud load/save/erase, Reminders schedule/cancel/cancel-all, AI Memory load/erase, manual Telegram message send), capture the signed owner + account ID + generation **before** the confirmation and revalidate **after** it, before building or sending a network request. For the Negotiator grant confirmation, revalidate before `/api/vetogram-ai-grants` is called. Ordinary writeMemoryCloud and loadReminders calls without confirmations also use request/response identity fences.

The owner-scope test suite now includes this pre-network confirmation invariant. Eight source-grounded regression tests executed via a V8 evaluation harness against current GitHub source: **8/8 passed**; browser module syntax parsing passed. This is not a genuine mobile/WebView or full Node test run. No external effects, deployment, DB writes or feature flags were changed.


## 24 October follow-up — chat paging, Agent Control and stale send contexts

An additional owner-switch audit found that `loadChats` could apply A's fetched Telegram dialog metadata, error notices, and loading-state finalizers to B's AI UI. The same pattern existed in `agentStatus`, `changeAgentPause`, `agentHistory` and the asynchronous Negotiator grant-revoke click handler. All now capture `ownerRequestScope()` before request/consent and verify `isOwnerRequestCurrent(scope)` before applying data/errors/finalizers. This prevents A's recipient list or agent grant status being presented under B.

Draft safety also needed a mode-level invariant. Changing AI mode now clears the previous send intent/nonce, reviewed approval, model reply and visible draft, and disables Send. Both Send and Approval Center's Queue require an eligible, visible draft in the current mode. Reviewing an earlier owner-bound approval may load more chats; the controller now rechecks both the original signed owner and that the approval still exists before restoring its recipient, text and nonce. The Follow-up preview's two explicit confirmations also revalidate the original owner before copying preview content into AI inputs.

**Validation**: Twelve owner-scope and send-context test callbacks were executed directly against current GitHub JavaScript source through an isolated V8 harness (12 passed; 0 failures). Browser module parsed successfully in V8 after stripping module-only import lines. This is source/pure JavaScript regression verification, **not** a full `npm test` run, actual Telegram WebView E2E, remote PostgreSQL execution, or proof of deploy readiness.

**Unresolved release blockers**: `package-lock.json` still lacks three npm resolutions and GitHub CI jobs have been failing before execution. As independently rechecked from the current work container, DNS resolution for `registry.npmjs.org` and `github.com` returns temporary resolution errors; no dependency tree was fabricated and no secrets, Neon, Vercel settings or production data were touched.

### Acceptance cases for final QA

- Start A's paginated chat load, switch to B while a page is outstanding, then verify B's recipient picker, counters, focus list, notice and loading state remain untouched by A's response or error
- Start an Agent Control status/history/pause action on A and switch to B; verify no stale status or negotiated grant actions appear on B
- Switch from Negotiator to ordinary chat or AI Action, ensure Send is disabled and old text/nonce cannot be reused
- Reopen an Approval Center item whose chat requires asynchronous lookup; switch account while loading and ensure no A draft, nonce or recipient is copied to B
- Confirm a Follow-up preview into Second Brain while switching account mid-confirmation; the copy must be rejected
- Verify regular reviewed approvals and edited, explicit-send drafts still require human confirmation and remain available on their owning account
