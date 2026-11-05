# VETOGRAM REBORN — RB6: Authentication completion and same-owner session race fixes

**Date:** 2026-11-05  
**Branch:** `feature/vetogram-reborn-rb1-foundation-20261105`  
**PR:** Draft #235, base `feat/vetogram-black-universe-preview-api-20261101` (actual Vetogram 8.5 review snapshot)  
**Release:** Do not merge or deploy to production until full Node/device tests pass.

## P0 finding A — a pre-logout response could restore the cached connection

In `public/app.js`, `refreshViewerSync()` and `api()` were correctly fenced against **signed owner changes**, but `viewerOwnerEpoch` did not advance when the *same* signed Telegram Mini App owner revoked their MTProto session. An earlier GET could complete after a confirmed logout and re-apply old connected session fields, causing stale account badges or a new inbox refresh.

**Implemented:**
- `notifyTelegramSessionDisconnected()` now increments `viewerOwnerEpoch`, `viewerSyncIntent` and `viewerAnalyticsIntent`, invalidating in-flight authenticated reads, login tasks and analytics **even when initData is unchanged**.
- Aborts pending QR controller; clears stale auth-busy state. The event carries no owner ID, auth hash or private content.
- Updates personal account and landing-screen badges immediately; preserves separate Telegram Business Stories permissions.
- Existing Messenger logout listener still clears local chats, drafts, media URLs, send locks, cached message data and pending owner responses.

`tests/vetogram-reborn-rb6-session-races.test.js` adds real-controller Node VM scenarios for old Viewer Sync GETs, old Mini App GETs, authoritative server disconnect, temporary store degradation, explicit reconnect, and an archive-only response after logout.

## P0 finding B — archive-only refresh could erase the disconnected indicator

`public/telegram-chats.js` previously set `state.sessionDisconnected=false` after *any* successful inbox response, including owner-scoped **archive-only** data. Now that flag clears only when the response includes `data.connection?.verified===true`. A new verified personal session also resets the flag via the existing `vetogram:telegram-session-connected` lifecycle event.

Saved Privacy data may remain available separately when legitimately authorized; such archival access is not proof that the personal Telegram session is connected.

## P0 finding C — phone/2FA login completion could navigate after account change

The `renderViewerLoginResult`, `viewer-verify-code` and `viewer-verify-password` success paths used to close the sheet, announce success and await multiple server refreshes before navigating, **without checking the current owner after each wait**. A logout or owner switch mid-refresh could still send the user to stale Chats. A transient store outage could also show a misleading connected message.

**Implemented:** a shared `finishVerifiedViewerLogin({analytics})` routine:

1. Capture signed owner and current privacy epoch; clear the local login sheet.
2. Refresh Viewer Sync and Mini App state; after each await, verify that the signed owner/epoch is unchanged.
3. Optionally refresh analytics and recheck again.
4. Only report successful login and navigate to Chats if `viewerState.session?.connected===true`, no owner mismatch and no degraded storage state.
5. If login was accepted but state remains unverifiable, show an explicit **verification pending** message. **Do not automatically request/send another Telegram code.**

All three phone/password success routes now use the same helper.

`tests/vetogram-reborn-rb6-login-completion.test.js` covers verified success, absent/degraded session, owner change during each async stage and shared-helper wiring.

## Verification actually performed

- The current *extracted shipping functions* were executed in an isolated V8 environment with deferred fake responses: **6/6 same-owner session/logout and archive scenarios passed**, **6/6 login-completion scenarios passed**. This checks actual JS control flow in isolation.
- Both new Node VM regression files and the updated RB4 test are committed, but the **full Node suite has NOT been executed**. The private repository is not reachable by git from the local working container because DNS for github.com is unavailable, and the GitHub connector does not supply a mountable checkout.
- Real OTP/SMS/QR login, 2FA, chat send/receive, Android Telegram WebView behavior, and hosting preview **remain unverified**. No live credentials, user messages, session secrets, database rows or production services were accessed.

## Remaining release gates

- [ ] Full Node tests for RB1–RB6 and existing owner/auth/send/privacy regressions in an authenticated checkout.
- [ ] Authorized test Telegram account: phone-code, QR, 2FA, missing code and account-switch scenarios.
- [ ] Test logout during an actual in-flight live chat fetch and send; make sure the old session cannot repaint.
- [ ] Test transient storage downtime versus confirmed logout; avoid unwanted re-login prompts.
- [ ] Test Telegram Business Stories with personal MTProto explicitly disconnected.
- [ ] Android/iOS WebView: 320–430px, keyboard overlap, Back and reconnect.
- [ ] Separate staging URL with isolated credentials/branch; preview limits must be resolved first.
- [ ] Visual review of Chats and Stories then media quality gates; keep Draft until verified.
