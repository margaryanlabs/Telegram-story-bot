# VETOGRAM 3.6 — Real media and voice UX
25 October 2026 · Draft PR #181 · no deployment

## Design + behavior delivered
1. Actual owner-scoped photo dialog: calm cinema-like fullscreen viewer, safe-area treatment for 320–520px devices, 44px close target, focused save action, reduced-motion fallback and deliberately non-animated backdrop on phones. The original real `<dialog>`, blob URLs and consent checks remain intact.
2. Real image download extensions: previously `openPhotoViewer` always used `.jpg`. A new ephemeral `state.mediaMimeByUrl` remembers the actual Blob MIME for an authenticated, allowed photo. PNG downloads as PNG, WebP as WebP, GIF as GIF, JPEG as JPEG. Unknown image format falls back to .jpg without guessing a file type from an arbitrary URL. This map is cleared along with owner/thread media URLs and when cached files are evicted. It never persists, and neither chat content nor images are uploaded by this change.
3. Recording UX: clarified accessible `aria-pressed` / `aria-label` for real start and stop states of the existing local voice recorder; initial HTML is explicitly not recording. No automatic send is attached to UI display. The existing preview, redo and explicit send remain unchanged.
4. Delivery strip styling now reflects the existing accepted, uncertain or failed state; no new receipt signal, server acceptance does **not** imply read.
5. Photo viewer keeps source-locked blob checks (signed owner/thread and membership in the current in-memory media list). No new network request, timer or media preload.

## Verification
- `tests/vetogram-media-lightbox-36.test.js` registered in `ci:offline`, `qa:core:offline` and syntax `check`. 5/5 isolated JS checks passed against actual branch source, including running the genuine `openPhotoViewer` control for JPEG, PNG, WebP and GIF, rejecting unrelated remote/blob sources and simulating both recording accessibility states.
- CSS braces balanced, layout constrained by visual viewport and mobile safe areas.
- This is **not** real Android/iOS screenshot validation or proof of telegram photo download / mic permissions in a native WebView. Those require the Preview that is being handled in another chat.

## Physical acceptance
- Phone 320/360/393px and Fold: photo lightbox stays inside safe areas, close and save are reachable by touch; Escape native dialog dismisses and frees the blob view; opening different account's media is refused.
- Large PNG, WebP, JPEG, animated GIF images save with the correct local extension and preserve image data; live/private archive permissions remain scoped.
- Voice: first mic permission, denial/retry, start/stop, preview, pause/play, redo, cancel and explicit send. Recorded state is announced to accessibility users.
- Active session switch and thread exit free the corresponding blob URL; no object URL leak or media carryover.
- Pending/accepted/uncertain message delivery and public Story publishing must undergo separate real-account QA before production.

## Infrastructure boundary
This pass did not touch Vercel, Neon, API keys, Telegram Business permissions, main branch, invoices or production deploy.
