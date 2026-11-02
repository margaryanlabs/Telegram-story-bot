# Market Remembers — VETO Universe 7.5.1 (isolated review)

**Reference:** V7.4 Human Legacy at `market-remembers-preview/human-legacy-v74.html`. The original document, source branch, and Render URL must remain unchanged.

**Preview:** `market-remembers-v75/index.html`, a copy of the original full-screen VETO particle sphere and legacy application with additive journey UX. No redesign or replacement of the WebGL core.

## New: cohesive guided narrative

Choose one of three existing **Memory Paths** in LENS. Each route uses exactly four existing fictional/editorial examples, never real members or verified social relationships.

- The first chapter opens directly in the existing immersive story reader.
- A four-step ribbon, interactive chapter markers and previous/next controls remain visible while reading.
- At the final chapter, 'Завершить маршрут' opens an editorial recap rather than silently jumping into an unrelated story.
- The recap shows the four stories, how many lessons are already bookmarked in this browser, and offers Restart or Other Routes.
- The floating journey chip can end the route without altering the personal Legacy record.

## Boundaries

No accounts, global stories, payments, backend or public user-data sync are introduced. The original localStorage keys are intentionally preserved within the V7.5 origin. Because V7.4 and V7.5 are on separate domains, their local storage is separate; no migration occurs.

All three paths are fiction-based editorial navigation. The three local V7.5 reader enhancements do not modify V7.4.

## Validation

Run `node --test market-remembers-v75/tests/*.test.mjs` at repository root.

Tests assert preserved WebGL/legacy code, legacy/privacy copy, semantic UI anchors, parsing of the full inline JS and realistic isolated route transitions through all four steps. They **do not** replace end-to-end browser/GPU/mobile visual verification.
