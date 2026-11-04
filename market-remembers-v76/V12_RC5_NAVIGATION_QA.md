# The Market Remembers — V12 RC5 Navigation QA

**Scope:** Fix actual archive/story return defects on top of V12 RC4 Depth Field, not a visual restart or production deployment.

## Verified implementation changes
- Navigation exposes a safe prior **view** derived from the actual current browser-history entry, not the currently focused star.
- Story routing is established **before** the cinematic reader mounts, so its return button says “К результатам архива”, “К предыдущей звезде”, or “Во вселенную” according to the real source.
- Closing a story entered from Archive calls browser Back to restore `#archive?theme=…&q=…`, including the search filter and query.
- Closing a related story returns to its previous story, instead of jumping to the globe.
- Returning to Archive/story avoids old camera return-to-globe animation and stale focus. Closing a star opened from the Universe retains the original star-return effect.
- Direct `#story/…` links with no prior in-app history still return to the universe.
- No user-data schema, private local-story storage, production domain, or already-deployed preview is changed.

## Automated QA
```sh
cd market-remembers-v76
node --test tests/*.test.mjs
node scripts/build.mjs
```

`tests/v12-rc5-return-navigation.test.mjs` uses a history/popstate simulation to exercise archive search return, linked-story return, direct shared URLs, route mounting order, and non-network behavior.

## Physical mobile verification remains required
1. Open Archive, search a word and select Risk; tap a result. Close story via the in-reader back button. Search/filter should remain.
2. From story A open a related star B. Close B; should reopen A with no sphere-return flash.
3. Open a star from the sphere. Close; should return to the star in the universe.
4. Open a shared story URL in a fresh browser tab with no previous navigation. Close; go to Universe.
5. Press Android Back (not only the in-reader button) from Archive and Story, and verify consistent behavior.
6. Test reduced motion, slow data, 320px/360px/390px screens and Safari WebKit.
7. Reopen private local story; it must never become publicly accessible.

**Gate:** Passing Node tests + Vercel READY is not an end-to-end Android guarantee, and not permission to merge production.
