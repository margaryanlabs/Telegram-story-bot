# VETOGRAM 5.0 test audit — 2026-10-26

The complete existing Node suite was executed against the recovered PR #188 source, then repeatedly against the integrated V5 working tree. No suite was excluded and no production build gate was narrowed.

## Baseline evidence

`node --test tests/*.test.js`: **902 tests, 860 passed, 41 failed, 1 skipped**. Baseline log: `v5-baseline-tests.log` in the task workspace. The skip is the existing Neon staging integration check, which requires an explicitly configured secure staging environment.

## Repairs to existing tests

- Updated outdated fixed asset timestamps to require actual versioned shipped assets. The independent release-surface gate still checks linked files, module destinations, script types, route/DOM identity, and consent boundaries.
- Added browser prerequisites omitted by older VM fixtures: `AbortController`, generation counters, `paintIdleSpectrum`, Portal cleanup, current owner epoch, and actual composer identity state. Tests still execute the real controller handlers and assert no stale owner writes, no stale UI state, microphone teardown, or automatic sends.
- Updated AI Story fixtures to provide the signed identity now required by production. Cross-owner rejection, text-only edits, media preservation, public-link opt-in clearing, and undo boundaries remain asserted.
- Fixed realm-sensitive strict array assertions by creating a host-realm array before comparing values. No pagination/deduplication expectation changed.
- Updated Viewer function extraction for its current default Story argument and supplied owner epochs/intent counters. Late success/error rejection and signed request-header assertions remain.
- Updated copy/branding checks to the current Russian wording and VETOGRAM identity; preserved explicit privacy separation and new-events-only archive limitations.
- Replaced references to removed historical CSS comments and whitespace-sensitive declarations with checks on the actual selectors, text tokens, viewport/safe-area properties, and focus/reduced-motion rules. These remain source checks, not proof of pixel fidelity.
- Button coverage now reads the controllers actually linked from `studio.html`, instead of maintaining a stale hand-written list.
- Owner-session onboarding now covers the additional direct `auth.SentCodeSuccess` path and requires its owner check before session persistence, alongside code, password, and QR paths.

## Verification boundary

All 41 baseline failures are resolved. During integrated development, new tests and implementation changes continued to arrive. The last inspected full build log at this QA checkpoint reports **949 tests, 946 passed, 2 failed, 1 skipped**; both remaining failures are obsolete auth UI source assertions owned by the auth task and are being updated against the final helper contract. A new complete green build is required before preview promotion.

The test repairs do not prove real code receipt, live Telegram reads/sends, physical WebView layout, real provider inference, or controlled Business edit/delete retention. Those require their respective live environments and are tracked as release gates, not simulated successes.
