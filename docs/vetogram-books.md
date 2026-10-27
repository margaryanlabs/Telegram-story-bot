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
