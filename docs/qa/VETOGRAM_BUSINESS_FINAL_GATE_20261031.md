# VETOGRAM Mini App — Business consent / Anti-Delete final gate

Date: 2026-10-31. Branch: `feat/vetogram-reborn-auth-and-navigation-20261025`. PR #185.

## Release state

**CODE STAGED, NOT DEPLOYED OR LIVE-VERIFIED.** Do not claim release-ready until every mandatory live acceptance check below passes. Do not merge or deploy without the owner's separate instruction.

## What the branch now does

- Personal Telegram authentication remains independent of Telegram Business (QR, phone/code, optional 2FA). A successful personal login offers the Business-consent wizard in the same Mini App if the release flag and Neon write-lease preflight permit it.
- The first-time wizard suggests **all existing and future ordinary private chats**, with narrower modes available. The suggestion never grants rights: scope confirmation, Anti-Delete and Stories are separate, unchecked consents. A connected owner defaults to preserving existing recipients and rights.
- Permission writes use `account.updateConnectedBot`, an owner-bound expiring consent snapshot, a Neon owner lease, read-after-write verification, and **no automatic mutation retry after timeout**.
- New, edited, and deleted Business events are accepted only through the authenticated Telegram webhook. Anti-Delete copies and alerts are not claimed as proof without received events.
- Deletion storage now requires the **Business connection ID**, including SQL WHERE predicates. A deletion event cannot tombstone an older conversation archived under another Business connection or an independent user-session backup.
- Privacy diagnostics fail closed when live Telegram connection verification is missing, disabled, or attached to another owner. A stored deletion only proves the current connection when its Business ID matches. A button on the post-consent screen opens live deletion diagnostics.
- Telegram bot instructions point to the in-app wizard first; manual Telegram settings are a last-resort fallback.

## Mandatory preflight (read-only, before deployment)

1. Confirm the correct encrypted user session and no owner-ID mismatch; never log OTP, 2FA password, full session or message content.
2. Run `npm ci`, `npm run qa:core:offline`, `npm run qa:reborn:offline`, `npm run vercel-build` on the branch. All must pass; source/static and fixture results alone are insufficient.
3. Verify Neon is selected, schema >= 5, `veto_business_write_leases` exists, and cross-instance lease read/write is healthy. No migration is needed if schema v5 already exists.
4. Check the actual deployed `/api/webhook-v8` and its `allowed_updates`: `business_connection`, `business_message`, `edited_business_message`, `deleted_business_messages`. Verify Telegram's webhook URL and secret without exposing tokens.
5. Keep `VETOGRAM_UNIFIED_ONBOARDING` **OFF** until the staging and device checks pass. Enable it only through an explicitly authorized release, with rollback by setting it back to `0`.

## Mandatory real-account proof (not yet performed)

Using TWO consented test Telegram accounts on Android and iOS/desktop where relevant:

- Fresh personal login: phone/code, QR, and 2FA; check account ownership, error recovery and logout.
- First Business connection: no navigation into Telegram Settings; scope consent starts unchecked; Anti-Delete/Stories not pre-granted; verify chosen all-private or selected-only scope in Telegram after one write.
- Existing connection: current rights and recipient exclusions remain unchanged unless the account owner explicitly edits them. Another existing Business bot is not overwritten.
- Fresh message sent from the second account: archived in the correct owner and allowed chat. Repeat outside the allowed scope: must not be archived.
- Edit then delete the message: older copy/version and delete notification appear once; re-deliver the update and verify no duplicate alert.
- Revoke the Business bot: no subsequent message/edit/delete capture; already archived copies respect retention. Reconnect with a different Business ID: old copies **must not** count as new proof.
- Check Media Vault, ghost-view Story flow and Story publishing independently, on real accounts, without assuming a function is available merely because a test mocked it.
- Verify Telegram Mini App layouts and keyboard on Android/iPhone/Fold. Test outage/retry, account A→B→A switching, and background/foreground resumption.

## Release decision

**Blocked:** full Node/build tests, on-device UI QA, and the two-account live Business event capture have not been performed in this coding session. The production feature flag and deployed configuration were not changed. The next step after code review is an explicitly authorized staging release and live tests, not claiming completion based on static tests.
