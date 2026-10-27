# VETOGRAM Books — reader module (MVP)

Route: `/books.html` from the **Vetogram Home** Books tile. It is intentionally separate from Telegram Chats, Stories and Privacy.

## What is implemented

- Catalog via `GET /api/books?lang=all|ru|en|fr|de|es|hy&q=...&topic=...&page=...` (server-side Gutendex proxy).
- Server verifies `copyright=false`, `media_type=Text`, text formats, source host, book ID and response size before fetching `GET /api/books?mode=text&id=11`.
- Full-screen, text-only, paginated reader (no remote HTML execution). Night / Paper / Sepia themes; font size; keyboard arrows / horizontal swipe; reading progress; bookmarks; selected quotations; personal shelf; local IndexedDB cache for already opened texts.
- No Telegram phone sign-in required to browse or read books; the module intentionally has no access to chats.
- Layout is smartphone-first, including Telegram in-app browser, and handles network/service errors.

## Limitations / operational requirements

- Project Gutenberg is primarily public domain **in the United States**, not automatically in Armenia, Russia, Georgia or elsewhere. Translation rights may differ; evaluate local licensing before offering items in each country. Books with `copyright: true` or unknown are excluded. Do not claim this is a catalog of modern bestsellers.
- The main Gutenberg site discourages automated access and large-scale harvesting; their public domain texts are not a high-traffic unrestricted CDN. Gutendex itself recommends self-hosting for sustained use. Before commercial-scale traffic, use a legal mirror/license-appropriate source and your own catalog/cache/egress policy; do not scrape.
- The Gutendex catalog lists tens of thousands of works but **Russian/Armenian availability is limited**. Next integration should be a source with a verified Russian/Armenian rights license and well-structured EPUB/text API.
- Book progress, library and quotes are currently **per-device**, not server-synchronized. IndexedDB availability in Telegram can vary by platform and whether storage was cleared.
- Very large books (over 4.5 MB response) and books without plain-text/HTML are not supported. HTML fallback is converted to plain text on the server, removing special formatting and images.
- This branch is a development change. Do not claim production launch until CI passes, deployment happens, then reader/catalog is smoke-tested on real Telegram devices.

## Verification

Run: `npm run check` and `npm test`; the PR GitHub workflow runs `npm run vercel-build`.

Manual smoke checklist: open `/books.html` in Telegram, search "Sherlock Holmes", open a readable result, advance pages, close/reopen/resume, save shelf, select/copy quote, change themes, search in Russian and check empty-state, simulate Gutendex/Gutenberg downtime, verify that existing Chats still open.

## Multilingual library integration (2026-10-27)

The standalone reader now has three switchable sources:
- Russian Wikisource `https://ru.wikisource.org` with server-side search on main-namespace pages and parsed text reading.
- Armenian Wikisource `https://hy.wikisource.org` using the same MediaWiki Action API.
- Existing Project Gutenberg / Gutendex catalog as a third source.

`GET /api/books-wikisource?wiki=ru&q=Пушкин&page=1` returns source-stamped search entries.
`GET /api/books-wikisource?wiki=hy&q=Թումանյան&page=1` searches Armenian pages.
`GET /api/books-wikisource?wiki=ru&mode=text&id=123` opens a known page id as *text only*.
`GET /api/books-wikisource?wiki=ru&mode=text&id=123&chapter=0` opens an enumerated child chapter.

**Important catalog semantics:** Wikisource homepages list more than 624,000 Russian and 37,000 Armenian *text/material pages*, not 624,000/37,000 individually readable full books. Some entries are poems, chapter subpages, old printed editions or indexes. The UI shows the search-result count, never asserts this is the number of complete books. Empty search uses an author-themed discovery query (Russian: Пушкин, Armenian: Թումանյան); this is not a complete catalog.

Chapter links are detected only when the parsed root page lists main-namespace links with a title prefix of `<root>/`. Works with unconventional subpage structure may need an expanded table-of-contents parser. A source page with few characters but chapter links can still be opened to choose a chapter.

Security and rights:
- Only `ru` and `hy` projects are addressable; no arbitrary external URLs.
- Only valid positive page ids, max lengths/bytes, GET method, Unicode-safe decoding and text-only rendering are used.
- Wikimedia API requests carry an identifying `User-Agent` and short shared HTTP cache headers.
- Original source page/revision and license page are linked in reader. Reading mode changes formatting; do not claim that all works/translations can lawfully be redistributed in Russia, Armenia or other countries without jurisdiction-specific rights checks. Wikisource works and contributions can carry differing licenses.
- The app does **not** fetch Wikisource pages until a user searches or opens a title and is **not** a bulk scraper.

### Tests
Unit tests: `tests/vetogram-books-wikisource.test.js` cover RU/HY search, server-side wiki restriction, text conversion, chapter loading and validation. `npm run vercel-build` includes a JS syntax check.

### Delivery status
As with the main Books MVP, this work remains on an isolated GitHub PR. Production availability is **not** confirmed. A real RU/HY API smoke test from the deployed Vercel route is required before opening this to all users. GitHub Actions currently reports failure and should be diagnosed before merge.
