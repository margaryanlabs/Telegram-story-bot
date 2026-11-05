/* Deterministic Vetogram Reborn stylesheet build.
 * Uses only standard Node; no third-party dependencies or build service.
 * The GitHub committed output is generated from these four source modules
 * in their original cascade order and an RB12 semantic-safety epilogue.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const names=['vetogram-reborn-atelier.css','vetogram-reborn-media.css',
 'vetogram-reborn-privacy.css','vetogram-reborn-account.css'];
const head="/* VETOGRAM REBORN RB12 — GENERATED DESIGN BUNDLE\n * Ordered sources: RB8 Chats/Stories, RB9 Media, RB10 Privacy, RB11 Account.\n * Run: node scripts/build-reborn-css.mjs; node scripts/build-reborn-css.mjs --check\n * Edits belong in the four source CSS files or GUARD below, not this output.\n */\n";
const guard=String.raw`

/* RB12 / release invariants — comes AFTER all source modules. */

/* CSS display!important from historic skins must never expose intentionally
   hidden chats, OTP notices, QR tokens, dialog controls or loading states.
   Keep hidden=until-found discoverable for native browser search semantics. */
html#vetogram.vetogram-noir [hidden]:not([hidden="until-found"]) {
  display: none !important;
}

/* Sensitive controls also need an ID-specific guard: historical
   selectors may carry multiple IDs and would otherwise outrank the
   document-wide [hidden] rule despite being earlier in cascade order. */
html#vetogram.vetogram-noir #telegramMirror #telegramThreadOpenNative[hidden],
html#vetogram.vetogram-noir #sheet #viewerQrImage[hidden],
html#vetogram.vetogram-noir #sheet #viewerCountryPicker[hidden],
html#vetogram.vetogram-noir #telegramMirror #viewerPendingLoginNotice[hidden] {
  display: none !important;
}

/* Mobile chat header keeps finger-sized controls even with legacy 39px
   overrides. Redundant Archive and Home header actions are already hidden
   by the actual RB8 mobile layout, preserving room on 320px displays. */
@media (pointer: coarse) and (max-width: 600px) {
  html#vetogram.vetogram-noir body.veto-chat-active:not(.veto-chat-thread)
  #telegramMirror .veto-mirror-header-actions .veto-mirror-icon-btn {
    min-width: 44px !important;
    width: 44px !important;
    min-height: 44px !important;
    height: 44px !important;
  }
  html#vetogram.vetogram-noir body.veto-chat-thread
  #telegramMirror .veto-mirror-thread-bar #telegramThreadBack {
    min-width: 44px !important;
    min-height: 44px !important;
  }
}

/* Respect actual visualViewport sizing on mobile sheets, including browser
   toolbar and Fold changes without a keyboard. The more specific historic
   .veto-keyboard-open selector still owns the keyboard-bottom offset. */
html#vetogram.vetogram-noir body.veto-sheet-open #sheet {
  max-height: min(89dvh, calc(var(--veto-visible-height, 100dvh) - 12px)) !important;
}
`;

const out=head+names.map(n=>{
  const source=readFileSync(resolve(root,'public',n),'utf8').trimEnd();
  return '/* ===== BEGIN '+n+' ===== */\n'+source+'\n/* ===== END '+n+' ===== */\n';
}).join('\n')+guard.trimStart();
const path=resolve(root,'public','vetogram-reborn-ui.css');
if(process.argv.includes('--check')){
  const current=readFileSync(path,'utf8');
  if(current!==out)throw new Error('RB12 bundle is stale — run node scripts/build-reborn-css.mjs');
  process.stdout.write('RB12 bundle matches all four source files and release guards\n');
}else{
  writeFileSync(path,out);
  process.stdout.write('RB12 bundle generated: '+Buffer.byteLength(out)+' bytes\n');
}
