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

## Foreign works in Russian translation — added 2026-10-27

The **"Зарубежные · на русском"** tab is now the default for new users of the Books module. Existing users keep their selected library in local storage. The tab provides five translation-source languages: English, French, German, Italian and Spanish.

**Catalog discovery uses real Russian Wikisource translation categories** (rather than unverified language guesses):

- `Категория:Переводы с английского языка`
- `Категория:Переводы с французского языка`
- `Категория:Переводы с немецкого языка`
- `Категория:Переводы с итальянского языка`
- `Категория:Переводы с испанского языка`

`GET /api/books-wikisource?collection=translations&original=fr` fetches category members (24 at a time) and exposes the opaque `nextCursor` for continuation. A user search like `...&original=en&q=Дойль` sends a constrained CirrusSearch `incategory:"Переводы с английского языка" Дойль` query. Search results are additionally normalized as `language=ru`, `originalLanguage=en`, and `isTranslation=true`. This category membership is an editorial catalog signal, not a legal clearance guarantee.

Common works such as "Гамлет" (Шекспир) and "Три мушкетёра" (Дюма) have *translation index pages* rather than full text. The API asks MediaWiki `parse` for categories and detects `Списки переводов`; when it has linked editions, the reader prompts for a particular old Russian translation, not falsely presenting the list itself as the novel. Edition candidates are restricted to links from that parent page, matching the work and author; arbitrary client page titles are never fetched. Some complex work trees and multi-volume editions need a future dedicated multi-level chapter resolver.

**Rights / honesty:** original author's public domain status ≠ translator's public domain status. Each translation, editorial revision, and jurisdiction may differ. For modern in-copyright Russian translations, obtain a publisher/rights-holder license rather than scraping commercial ebook platforms. No new copyrighted ebooks are included or redistributed. Wikimedia pages must retain creator/translator attribution and any source-specific CC BY-SA/share-alike obligations. The source hyperlink is available in reader settings, including the exact selected edition URL.

### Added checks
`tests/vetogram-books-wikisource.test.js` includes category pagination/cursor, source-constrained search, invalid source rejection, translation index + edition selection and attribution checks. The PR is still a draft until the GitHub Actions build is green and real works open inside Telegram on mobile.

## Reading Studio 2.0 — visual / UX upgrade

This iteration preserves the same standalone `/books.html` route; Vetogram Chats/Stories/Auth were not changed.

### Entrance and shelf
- Premium charcoal/champagne editorial visual system; CSS-built book sculpture with respectful reduced-motion fallback (no heavy 3D/WebGL assets).
- Fully data-driven **Continue Reading** section shown only when a previously opened book has local reading progress; this is not fake sample usage.
- Cover placeholders are typographic when the source does not provide a trusted cover. Russian translations remain distinct from English originals.
- Keyboard-accessible tabs, headings and book cards; original-source attribution remains available.

### Immersive reader
- Dynamic text pagination uses reading viewport width and height, selected font size, leading and line width. It avoids long "pages" that are thousands of characters on a phone.
- Every computed page stores an absolute character offset; changing typography or browser viewport reflows to a nearby page containing the same position, rather than saving fragile page numbers.
- Three paper themes; two font families; three line spacing modes; regular/narrow reading columns.
- Distraction-free focus mode with persistent exit button, swipe navigation, tap near the left/right page edge, keyboard arrows and native Telegram BackButton integration.
- Progress indicator represents the approximate position **in the currently loaded chapter/part**, not a false whole-book percentage. Reading history, bookmarks and saved quotes remain per device.
- Lightweight page-turn micro-motion; `prefers-reduced-motion` disables the animation.

### Validation and remaining tasks
- `tests/vetogram-books-reading-studio.test.js` checks realistic mobile/desktop page capacities, position retention after reflow, empty/Armenian text behavior and DOM control wiring.
- Independent V8 smoke test exercised the in-app layout logic on 375px and 1024px views with larger fonts, confirming monotonic offsets and reflow behavior.
- These static and simulated checks do **not** replace real Android/iPhone Telegram WebView rendering, accessibility auditing, legal content verification or a green CI.
- GitHub Actions jobs have recently failed within seconds without step detail; root cause remains unconfirmed. The development branch should **not** be merged or deployed until build and manual testing pass.

## VETOGRAM Books 3.0 — RU discovery, jacket system, VETO FLOW

### Discoverability: source tiers that must never be conflated
1. **Readable public-domain/openly permitted texts**: Russian Wikisource (including historical Russian translations), Armenian Wikisource, Project Gutenberg/Gutendex. Some entries are poems, indices or subpages; individual rights and localization still matter.
2. **Contemporary Russian-language bibliographic metadata**: `GET /api/books-discover?collection=now|new|fantasy|detective|romance|nonfiction|business|youth|classics&page=1&q=...`. This is a read-only metadata lookup using Google's Books API. It returns only volumes explicitly tagged `language=ru`. Covers and official preview/buy links are allowlisted. **It DOES NOT grant access to copyrighted full ebook files** and must not display a "Free full book" promise for these entries.
3. **Google Books authorized embedded viewer**: only when `accessInfo.embeddable === true` and an official preview URL exists, on explicit user click. The viewer's own territorial/rights constraints apply. Script loads on demand. A failed embedded preview falls back to the official source page.

Google Books API public queries require a registered application identifier (API key or OAuth), and Google's Terms restrict charging for use without a separate agreement or permission. **The provider is not claimed production-ready without credentials, publisher clearance and an end-to-end API test.** If the discovery feed errors, the UI offers an official Google Books web search; the free Wikisource reader remains unaffected. Do not put secrets in the client or start bulk queries to bypass rate limits. For a paid product or large-scale catalog, seek partner agreements and a correctly licensed metadata index.

### Books 3.0 interface
- Five collection tabs: translated Russian, native Russian, Armenian, worldwide Gutenberg, modern/new Russian metadata.
- New topic chips (fantasy, detective, romance, psychology, business, YA etc.), search terms for known novels and author names.
- CSS procedural covers: six stable palettes generated from title code points when licensed image art is missing; no fabricated reviews, rankings or fake actual source covers.
- Lightweight skeleton book cards while network discovery loads and graceful source-specific errors.

### Reading technology
- **VETO FLOW**: click-to-focus paragraph segmentation and guided previous/next paragraph controls, dimming the rest of the current page. Reader preserves normal navigation and accessibility roles; content remains local to this reading interface.
- Browser SpeechSynthesis narration, voice locale inferred from language, selectable speed, progression to the next page where supported. In Telegram WebView, device voices may not exist. Some platform TTS implementations use vendor network services; no categorical offline/privacy claim.
- Distraction-free focus mode, three reader themes, font/leading/line-width customization, reflow anchored by text offset, bookshelves, progress, source links and bookmarks.
- Text from external sources is presented using `textContent` and newly constructed text nodes, not injected HTML.

### Independent checks / QA
- Existing `tests/vetogram-books-wikisource.test.js`, `tests/vetogram-books-reading-studio.test.js`, `tests/vetogram-books-discover.test.js` and `tests/vetogram-books.test.js` require local Node.js verification.
- Isolated source syntax check and mocked catalog/navigation smoke checks have passed; actual Google provider may require credentials.
- GitHub Actions failure may be due to the user's repo billing/credit/CI setting, not necessarily code. The branch is purposefully draft/unmerged. Review account state outside of source code testing rather than changing production configuration.
- Before public launch: run local `npm test` and `npm run check`, verify independent source and real Telegram WebViews on Android/iOS, test external previews, rights/attribution, mobile line-breaking, TTS engine availability and API rate limits.


## Books 3.1 — offline files and RU genre discovery (27 Oct 2026)

### Personal library — truly private
- Separate **Мои файлы · Офлайн** tab plus a clearly labelled "Добавить книгу" file picker accepts user-owned EPUB, FB2 and TXT.
- `public/books-import.js` parses files entirely within the browser. Nothing is sent to Vercel or any external conversion service. Private books and chapter text are persisted in their own `vetogram-books-personal` IndexedDB database; reading position/metadata continue using device-local app storage. Data is **not synced between devices** and can be lost when app/browser storage is cleared. Users are responsible for files they import.
- **EPUB**: parses ZIP central directory, EPUB container.xml, OPF metadata, manifest/spine and XHTML chapter body; uses native `DecompressionStream('deflate-raw')` for compressed entries and supports STORED ZIP entries. EPUBs with DRM/encryption, ZIP64 or unsupported compression are rejected. EPUB chapter HTML is reduced to plain text, avoiding any active scripts or images.
- **FB2**: FictionBook title/author/language extracted from title-info, chapter/paragraph text from body. Files using a DOCTYPE/external entity definition are rejected. TXT includes Windows-1251 decoding fallback where UTF-8 is damaged.
- Local import guardrails: max compressed source size 12 MB, max total reading text 5 million chars, up to 160 EPUB spine items. No arbitrary remote URLs or imported active markup.
- Offline readers share the same native VETO FLOW focus, adaptive pagination, speaking voices when OS supports them, bookmarks, progress, and CSS-generated book-cover jackets. Users can remove their own books using the delete control.

### Read Now — a broader real-text discovery workflow
- Russian Wikisource category browsing from six verified categories: **Романы**, **Рассказы**, **Повести**, **Фантастика**, **Стихотворения**, **Русские народные сказки**.
- `GET /api/books-wikisource?collection=genres&genre=novels&page=1` with continuation-based categorymembers paging, `...&q=...` with category-constrained CirrusSearch; category titles are backend constants, not client-provided upstream URLs.
- Source category members can be full books, single poems, chapters, translated editions or indexes. Displayed counts are page/member totals, not a guarantee of full novels or rights clearance.
- Single-source UI remains responsive with abortable searches, source tabs, explicit local/source labels and source attribution. Contemporary protected works still use metadata/legal previews only.

### Verification completed for this iteration
- JavaScript parsing of importer, API modules and core reader tested in an isolated JS runtime.
- Synthetic native-format TXT and ZIP STORED EPUB fixtures exercised the actual importer: local save/list/get/delete, correct EPUB OPF title and chapter order.
- Simulated Telegram screen switched to private source, rendered a local EPUB card, opened the first chapter and navigated to the second chapter with no network request for private content.
- Node tests added `tests/vetogram-books-private-import.test.js` for importing/deleting TXT, importing FB2, EPUB chapter parsing, and rejecting malformed/untrusted content. Genre browsing/category-search tests added to the existing Wikisource test file.
- **Still required before production:** full local Node test suite on a checked-out repo, real Russian EPUB/FB2 files on Android/iOS Telegram WebView, device storage quota/eviction tests, permission/attribution audit and a successful production deploy. GitHub Actions failures are not used as a proxy for code correctness.

## Reading Atlas: VETO COMPASS (27 Oct 2026)

- The in-reader compass button opens a premium book navigation overlay without leaving the book.
- **Reading timeline** scrubber maps the current chapter's character offset to the correct adaptive page, so line-width or font changes do not break location.
- **Local full-text search within the currently loaded chapter** (not the whole multi-chapter work) returns up to 40 results with small context snippets. Jumping to a result safely highlights its first occurrence with text nodes + a locally constructed `mark` element; no innerHTML injection, external search API or user text upload.
- **Bookmark map** supports current offset tokens like `0:@1234` and legacy page tokens like `0:5`; chapter-aware navigation invokes the source-specific chapter loader.
- **Quotes** include their text location when captured from the current page. A book-specific quote list can jump back to the approximate position, copy the quote via browser clipboard permissions or stay on the device.
- **Personal marginal notes** provide a lightweight notepad anchored to chapter/character offset. Note text is capped at 500 characters per item and the device holds up to 120 recent notes across works. Only available in browser localStorage; not server-side/encrypted/cloud-synced. Browser data clearing will erase these notes.
- Deleting a locally imported book now also removes its associated bookmarks/progress, quotes and notes. This is an intentional per-device deletion and prompts the user before removing book files.

### Bugs and verification
- Fixed a disabled Next button on the last page of an EPUB chapter when later chapters are present.
- Corrected bookmark-token regular-expression escaping discovered during independent checks.
- Independent mock-WebView scenario verified: search produced 40 capped results, tapped result jumped to the correct page and highlighted safely; a real bookmark appeared in COMPASS; adding a personal note persisted it to localStorage; the reader stayed open.
- `tests/vetogram-books-compass.test.js` adds legacy/new bookmark token compatibility, malformed bookmark rejection and reader control contracts.
- Readiness unchanged: draft PR only, no deploy/merge, real Android/iOS WebView QA and full local Node test suite still outstanding.
