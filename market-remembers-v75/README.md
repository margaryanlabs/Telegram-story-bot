# Market Remembers — VETO Universe 7.5.2 (isolated review)

**Reference:** V7.4 Human Legacy at `market-remembers-preview/human-legacy-v74.html`. The original document, source branch, and Render URL must remain unchanged.

**Preview:** `market-remembers-v75/index.html`, a copy of the original full-screen VETO particle sphere and legacy application with additive journey UX. No redesign or replacement of the WebGL core.

## New: cohesive guided narrative

Choose one of three existing **Memory Paths** in LENS. Each route uses exactly four existing fictional/editorial examples, never real members or verified social relationships.

- The first chapter opens directly in the existing immersive story reader.
- A four-step ribbon, interactive chapter markers and previous/next controls remain visible while reading.
- At the final chapter, 'Завершить маршрут' opens an editorial recap rather than silently jumping into an unrelated story.
- The recap shows the four stories, how many lessons are already bookmarked in this browser, and offers Restart or Other Routes.
- The floating journey chip can end the route without altering the personal Legacy record.

## V7.5.2 — stellar interaction and mobile usability

This refinement keeps the exact V7.4 sphere, palettes, visual hierarchy, stories, Memory Paths and My Legacy while addressing identifiable usability issues:

- A restrained context label follows the **selected, front-facing star** on the sphere. It identifies the alias/category without replacing the story card or opening a different page. It is not an added control, and disappears during reading and filter-selection overlays.
- The visible star buttons are selected by front-facing depth, explicit selection priority, and **screen-space distance**. On mobile display up to eight non-overlapping star buttons; on larger screens up to fifteen. Other stories remain accessible through the existing NEXT buttons and archive.
- Nonvisible stars are removed from sequential keyboard navigation (`tabIndex=-1`, appropriate ARIA) to avoid confusing invisible focus.
- Touch targets are increased without swelling visual points. Existing Canvas fallback, mouse/pinch controls, reduced-motion support and WebGL shader stay intact.
- Camera easing now depends on elapsed frame duration, making the same interaction feel similar across differing device refresh rates.
- Refined selected card, control focus states and mobile dock; no content or user-data migration.

## Boundaries

No accounts, global stories, payments, backend or public user-data sync are introduced. The original localStorage keys are intentionally preserved within the V7.5 origin. Because V7.4 and V7.5 are on separate domains, their local storage is separate; no migration occurs.

All three paths are fiction-based editorial navigation. The three local V7.5 reader enhancements do not modify V7.4.

## Validation

Run `node --test market-remembers-v75/tests/*.test.mjs` at repository root.

Tests assert preserved WebGL/legacy code, legacy/privacy copy, semantic UI anchors, full inline JS parsing, realistic isolated route transitions, selected-star collision priority, mobile marker limits, keyboard visibility, and stable frame-duration easing. They **do not** replace end-to-end browser/GPU/mobile visual verification.
