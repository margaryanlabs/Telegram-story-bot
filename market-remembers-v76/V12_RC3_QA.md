# The Market Remembers — V12 RC3 / Mobile Reading QA

RC3 is a **review-only** continuation of RC2. No production merge, public submission
backend, or migration of same-origin browser data.

## Focused repairs

1. Actual story artifact now comes before the optional exploration trail.
   On RC2, the route panel could appear above the central memory title.
2. The old V9.3 observatory duplicate is hidden **only after** the new V12
   story artifact mounts successfully. Existing fallback markup and navigation
   remain intact if the cinematic enhancement cannot run.
3. The source-grounded memory hero has a direct “Читать историю ↓” action that
   scrolls to chapter 1 inside the drawer, with keyboard focus and reduced-motion
   handling. Historical sourced records instead have “Читать источник ↓”.
4. Mobile hero vertical whitespace is reduced without altering text content,
   provenance, trusted original citations, archive or bookmark semantics.
5. A DOM-like test exercises actual insertion order, not only file patterns.

## Manual verification needed on Android / iOS

- Tap a fictional star: **first viewport** should show the cinematic memory
  artifact and one clear read action, not a second large observatory panel.
- Tap “Читать историю”: first chapter enters the viewport without the sticky
  top/section-navigation covering its headline.
- Scroll and jump among all four chapters, use the return button and Back.
- Tap a sourced legend: preserve portrait attribution, quote and original text.
- Open two stories: collapsed trail follows the hero and still reopens normally.
- Save, remove, revisit a lesson; copy a story permalink; switch to archive.
- Test 320px, 360px and 390px portrait widths, landscape, 200% text zoom,
  slow GPU/Canvas fallback and reduced-motion.
- Confirm previous V12 RC2 URL still serves its earlier version.

**Release gate:** a successful Node build is not a claim of physical mobile QA
or production readiness.
