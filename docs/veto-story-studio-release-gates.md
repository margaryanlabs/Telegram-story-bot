# VETO Story Studio 1.0 — real-device launch gate

This PR adds a **fully local** photo editor to the existing Telegram Stories composer.
Automatic tests are synthetic; do **not** claim mobile launch readiness from Vercel build status alone.

## Scope shipped by this PR

- Open photo editor through **Stories → Выбрать фото → Редактировать** or **Studio → Создать Story**.
- 5 deterministic local looks: Editorial, Cinematic, Minimal, Warm, Original.
- 9:16 crop, pan by touch, zoom, exposure/contrast/saturation/warmth/vignette.
- Text on image, 3 positions, text size.
- Local bounded 25-level undo / redo.
- Export JPEG at 1080 × 1920 and feed back into existing confirmed Story composer.
- Save draft as a JPEG file through system share/download; **not** cloud or in-app persistent drafts.
- No AI model is called; **Magic Styles are not AI-generated** and no hidden AI charges apply.

## Release acceptance, two consenting test accounts

1. Android Telegram in-app Mini App, then iOS Telegram; also compare in a standalone modern mobile browser.
2. Open photo picker **without** linked Telegram. Editor must still open; publish must still require valid Telegram connection.
3. Load small JPEG, PNG, WebP; reject unsupported formats and >20MB. Check portrait EXIF orientation.
4. Open landscape 16:9 image: result is correctly 9:16 with no letterboxing. Drag + zoom without sideways black gaps.
5. Test each preset and all six sliders; test text overlays for long Russian/Armenian/English headlines.
6. Test undo and redo, reset, cancel; cancellation cannot upload an image or publish any Telegram Story.
7. Save draft and verify only a user-selected file is shared/downloaded. Confirm no image auto-upload while editing.
8. Use generated JPEG and continue composer; test Standard, Public, Contacts, Close Friends and Selected audience. Failed Telegram connection, invalid selected audience, 403 and expired credentials must **fail closed**.
9. Rapidly change photos while compression is running, remove image, then choose another; an earlier asynchronous job must never override the latest image.
10. Background Telegram mid-load and during export; navigate away and back; verify blob URLs are reclaimed, no dangling microphone, and UI stays responsive.
11. Publish one controlled test Story with a connected consenting Telegram account. Verify displayed audience and Telegram's own Story result. Delete according to user direction.
12. Watch memory/network on an older Android WebView; ensure no raw photo or AI prompts are sent to a third-party network endpoint before explicit publish.

## Limitations and next build

- Native Telegram Story editing, Telegram's full rich-entity stickers, and AI retouch/background removal **not implemented**.
- Timeline/video editor, audio/music tracks, automatic schedules, subscriptions/Telegram Stars, and in-app drafts **not implemented**.
- A browser's file-download and system-share capabilities vary, especially inside Telegram WebViews.
- Next product gates: private durable drafts with owner-safe auth, one-tap story sequences,
  optional user-triggered AI transformations with transparent credit accounting,
  evidence-backed analytics and Telegram Stars checkout.

## Go/no-go

Go only when real Android/iOS source selection, rendering, share/export and a complete
Telegram post/delete flow pass, and all affected PRs reconcile cleanly with current main.
