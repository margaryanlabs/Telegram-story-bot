# VETOGRAM 3.0 — Premium experience / code handoff

This change is an incremental redesign of the **existing Mini App**, not a new product scaffold or disconnected demo. It complements, rather than replaces, the already merged-in-draft `vetogram-2026.css` command center and existing signed Telegram chat, Privacy, Stories, Voice, Studio and AI modules.

## What's real in this draft branch

- `public/vetogram-experience-2026.css` is the last-loaded visual treatment for navigational controls, compact real Telegram chat rows/search/composer, AI editor, Story Engine, and selected actions. It has explicit light-theme contrast and accessible focus/reduced-motion/mobile behavior.
- Added a visible **Creative Deck** just below the existing VETO AI mode switch. It offers 4 human-readable style choices per **AI Reply**, **Story Director**, and **Story-to-Sale** mode (12 presets total).
- `public/vetogram-creative-presets-core.js` contains a dependency-free, allowlisted pure prompt builder with a 3,000-character limit. It never reads Telegram chats or stores user content.
- `public/vetogram-creative-presets.js` progressively enhances the real AI textarea. A button click only writes an editable local **draft** and focuses the input; no AI API request, consent toggle, recipient selection, message send, Story publish, charge or persistence occurs.
- A second preset replaces the previously generated untouched instruction while retaining the original user text. Switching mode restores the user's original text only if the generated wrapper is unchanged; edited drafts are never discarded.
- Selected style has a visible and accessible `aria-pressed` state; the deck disappears in modes with no preset (e.g. Negotiator, AI Action, Second Brain, Translation), preserving the original safety-bound workflow.

## Quality gates / scope

The new `tests/vetogram-creative-deck.test.js` covers real allowed modes, prompt preservation and lengths, actual Mini App script/HTML wiring, lack of implicit network calls, interactive selection, mode changes and long-input rejection. **9/9 tests passed** when executing exact GitHub source in an isolated JavaScript runtime; they are also registered in the free offline Node suites and `package.json` syntax checks.

This is not a statement that every VETOGRAM module has been visually reviewed on physical devices or that all Telegram APIs work live. Final release QA must check iPhone/Android Telegram WebViews, chat composer behavior, light/dark contrast, touch targets, accessibility, privacy consent, and actual connected account functions.

No new backend services, migrations, payment settings, paid API calls, merge or deployment. Existing #181 stays Draft.

## Next polish items

1. Verify the exact rendered CSS on 320px, 393px, 768px, and desktop widths on *real app screens*, including theme variants and Android/iOS Telegram safe areas.
2. Confirm real chat filters and message composer retain expected keyboard/autofocus behavior with last-loaded CSS.
3. Add a real paid subscription/entitlement screen only after its Telegram Stars backend is verified. No mock "Pro active" badges or fictitious stats.
4. Complete UX smoke for Anti-Delete archival errors, Story publication permission status, and AI reply review before launch.
