# VETOGRAM REBORN — RB10: Private Control Center

**Date:** 2026-11-05  
**Repository:** `margaryanlabs/Telegram-story-bot`  
**Review branch:** `feature/vetogram-reborn-rb1-foundation-20261105`  
**Draft PR:** #235 against Vetogram 8.5 preview branch  
**Production, account sessions and backend:** unchanged.

## Goal and verified source diagnosis

The existing **Protection** page was an unprioritized stack of account setup, archive tools, backups, counters, diagnostics, settings and alerts. It also linked to **Saved Chats / Smart Inbox**, a separate route with older visual treatments. The goal is an understandable, truthful user experience, not an imaginary always-on Anti-Delete service.

The existing `public/privacy.js` governs all source-backed conditions:

- `operational` requires *complete settings*, a live Telegram Business connection, no connection error and no degraded archive.
- The status pill toggles **ready** and **warn** based on those conditions, with distinct texts such as *Проверяю Telegram*, *Нужно подключить Telegram*, *Настроено · проверь сообщением*, or temporary degradation.
- The separate enabled-settings button may be disabled even if real chat delivery has not yet been tested. Completion of local settings is not proof of archiving every Telegram chat.
- Archived data and media are limited to events Vetogram had permission to receive or explicitly back up; deleted historical and Secret Chats are not resurrected.

The new CSS preserves these distinctions, including a neutral style for checking, cool green only for real `ready` status, and warm amber for `warn` or degraded state.

## Actual source work

1. **`public/studio.html`**: shorter, consent-aware Protection introduction; original `ghost-quick-grid` is wrapped in a native `details` disclosure labeled **«Другие инструменты»**. Every button, ID, original action handler and direct navigation route remains intact. Emergency actions and real account-status proof are not hidden behind this disclosure. Loads the new CSS as the **last** studio stylesheet.
2. **`public/vetogram-reborn-privacy.css`**: new source-scoped Obsidian Atelier style layer for verified status/opt-in, Telegram Business wizard, honest setup disclosure and manual fallback, independent chat backup, actual five archive counters, freshness evidence, secondary action disclosure, account diagnostics, settings, Anti-Delete/history/inbox/notifications toggles, retention selector, and informative difference between Telegram official read status and private archive.
3. The same stylesheet now includes the separate **Saved Chats / Smart Inbox** route: actual explainable priority tiles, personal archive search, current filters, record list, empty-state and archive connection status. The view retains its own data and heuristics. There are no fabricated unread counts, contact photos or deleted messages.
4. **Destructive action discovered and corrected during QA:** the permanent archive deletion button `#privacyClearButton` lives in `data-screen="chats"`, not `data-screen="privacy"`. Its new danger-border treatment was moved to the real route, without moving the control or altering the backend. `public/privacy.js` still opens an explicit separate sheet requiring a typed **УДАЛИТЬ** before the destructive action is enabled.
5. **`tests/vetogram-reborn-rb10-privacy.test.js`**: 15 source contracts for exact stylesheet loading, server-owned status and consent, manual Telegram Business path, actual 5 counters, Archive-only warning, optional tools access, switches, retention and typed deletion confirmation, real Smart Inbox data and filters, 4-tab routing, theme/viewport/focus/reduced-motion constraints, CSS balance, no URL-based fake media or made-up online states.

## Design decisions / non-goals

- One graphically distinct account-status section, followed by a visible consent/setup path and evidence-based archive metadata. Settings are normal accessible rows, not endless promotional cards.
- Dangerous permanent deletion receives a strong warning treatment. A shorter retention also retains its separate existing `tg.showConfirm`/native confirm flow.
- All actual toggles, input states, errors, `disabled` attributes, route ownership and local settings are maintained by their original controllers.
- Responsive at 345/440/720px in both the Protection and Saved-Chats routes; Pearl and Linen light variants, focus-visible and reduced-motion are explicit.
- No new JavaScript runtime, no new third-party animation framework, no synthetic server data and no changes to privacy or consent behavior.
- No style changes to unmodified Chats, Stories, Media and Play controllers; previous RB1–RB9 remain in the same Draft PR.

## Validation performed

- Read back actual GitHub branch content including `studio.html`, `privacy.js`, `app.js`, `vetogram-reborn-privacy.css`, RB8 and RB9 styles.
- Ran **15/15** regression source-contract cases in isolated V8 against fetched real files.
- Confirmed CSS block balance, all critical source IDs, theme scoping and the `ready/warn/operational` source mapping.
- Found and fixed the mis-scoped destructive-delete style during a failing source-contract check; all 15 checks passed after the correction.

**Not executed:** full repository `node --test`, computed-style browser render, Android Telegram WebView / Fold screen, real Telegram Business event flow, account permissions, media import/deletion, or backend data lifecycle tests.

**Preview:** Render remains at the prior 25-service cap; the last Vercel attempt rejected RB9 preview with `402 api-deployments-free-per-day`. No RB10 staging URL has been created. The existing 8.5 review server **does not show RB10**. No production deployment or merge occurred.

## Release gates / follow-up

- [ ] Run full Node suite on a complete checkout, especially existing `privacy.js` and destructive/archive tests.
- [ ] Render screenshots of 320, 360, 390, 430, and Samsung Fold expanded widths; check overflow/contrast in graphite, Pearl and Linen.
- [ ] In actual authorized Telegram Business account, verify connection and denied/revoked cases, wizard fallback and real new-message delivery.
- [ ] Prove degraded backend never appears as successfully operational; retry connection and verify statuses.
- [ ] Exercise all six toggles and retention confirmations; changing retention to a shorter value requires explicit confirmation.
- [ ] Test permanently clearing owner-scoped archive with typed `УДАЛИТЬ` on a disposable test account only, after verifying separate Telegram chat remains unchanged.
- [ ] Open and use actions within the collapsed extra-tools disclosure via touchscreen, keyboard and a screen reader.
- [ ] Review previous RB7 Back behavior when opening diagnostics / archived chats and then returning to Protection.
- [ ] Create isolated staging preview when hosting quota/billing restrictions permit. Keep Draft PR until visual and real-device acceptance.

**No live user data, identities, media, account settings or production resources were modified.**
