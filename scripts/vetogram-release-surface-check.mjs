/* VETOGRAM REBORN — cost-free, read-only release-surface audit.
 * Run from any clean checkout: npm run qa:surface:offline.
 * No network, Telegram, AI credits, Neon, Actions or Vercel dependency.
 * The result is a static gate only; it does not replace device/E2E QA.
 */
import {existsSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

export function inspectReleaseSurface({html,app,story,ai,exists}){
  const errors=[];
  const add=(ok,message)=>{if(!ok)errors.push(message)};
  const idMatches=[...html.matchAll(/<[\w-]+\b[^>]*\bid=["']([^"']+)["']/g)];
  const ids=idMatches.map(m=>m[1]);
  const duplicateIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
  add(duplicateIds.length===0,'DUPLICATE_DOM_IDS: '+duplicateIds.join(', '));

  const rawAssets=[...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)]
    .map(match=>match[1]).filter(value=>value.startsWith('/') &&
      /\.(?:js|css)(?:[?#]|$)/i.test(value));
  const localPaths=rawAssets.map(url=>url.split(/[?#]/)[0]);
  const seen=new Set();
  for(const file of localPaths){
    add(/^\/[a-zA-Z0-9/_-]+\.(?:js|css)$/.test(file)&&!file.includes('/../'),
      'INVALID_LOCAL_ASSET: '+file);
    add(!seen.has(file),'DUPLICATE_ASSET: '+file);
    seen.add(file);
    add(exists('public'+file),'MISSING_ASSET: '+file);
  }
  const requiredScreens=['telegram','privacy','ai','voice','publish','viewers',
    'analytics','story-engine','studio','relay'];
  const screenTags=[...html.matchAll(/<section\b[^>]*\bclass=["'][^"']*\bscreen\b[^"']*["'][^>]*>/g)]
    .map(match=>match[0]);
  const screens=screenTags.map(tag=>tag.match(/\bdata-screen=["']([^"']+)["']/)?.[1])
    .filter(Boolean);
  for(const screen of requiredScreens)
    add(screens.includes(screen),'MISSING_SCREEN: '+screen);
  add(screens.length===new Set(screens).size,'DUPLICATE_SCREEN_NAMES');

  const scripts=rawAssets.filter(p=>/\.js(?:\?|$)/.test(p));
  const position=path=>scripts.findIndex(p=>p.split(/[?#]/)[0]===path);
  for(const dependent of ['/story-engine.js','/vetogram-ai.js','/privacy.js',
    '/telegram-chats.js','/voice-studio.js']){
    add(position('/app.js')!==-1 && position(dependent)>position('/app.js'),
      'WRONG_BOOTSTRAP_ORDER: '+dependent);
  }
  for(const path of ['/app.js','/vetogram-noir.css','/vetogram-experience-v4.js']){
    const match=rawAssets.find(p=>p.split(/[?#]/)[0]===path);
    add(Boolean(match?.includes('?v=')),'UNCACHED_CRITICAL_ASSET: '+path);
  }

  add(/id=["']sheet["'][^>]*\brole=["']dialog["'][^>]*\baria-modal=["']true["']/.test(html),
    'MISSING_SHARED_MODAL_CONTRACT');
  add(/id=["']storyPortalConfirm["'][^>]*\btype=["']checkbox["']/.test(html) &&
      !/id=["']storyPortalConfirm["'][^>]*\bchecked(?:\s|=|\/|>)/.test(html),
    'PORTAL_MUST_REQUIRE_FRESH_OPT_IN');
  add(/window\.VetoTelegramStageStory\s*=\s*async/.test(app) &&
      /await window\.VetoTelegramStageStory\(/.test(story),
    'MISSING_AWAITED_STORY_PUBLISHER_BRIDGE');
  add(/viewerOwnerEpoch\+\+/.test(app) &&
      /viewerSyncIntent\+\+/.test(app) &&
      /viewerAnalyticsIntent\+\+/.test(app),
    'MISSING_OWNER_EPOCH_INVALIDATION');
  add(/const requestedSigned=String\(requested\?\.signed\|\|''\)/.test(story) &&
      /signed:scope\.identity/.test(ai),
    'MISSING_SIGNED_AI_STORY_HANDOFF');

  return {ok:errors.length===0,errors,
    counts:{uniqueDomIds:ids.length,localAssets:localPaths.length,
      screens:screens.length,loadedScripts:scripts.length}};
}

const current=process.argv[1]?resolve(process.argv[1]):'';
if(current===fileURLToPath(import.meta.url)){
  const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
  const read=name=>readFileSync(join(root,name),'utf8');
  const result=inspectReleaseSurface({
    html:read('public/studio.html'),app:read('public/app.js'),
    story:read('public/story-engine.js'),ai:read('public/vetogram-ai.js'),
    exists:relative=>existsSync(join(root,relative))
  });
  if(result.ok)console.log('VETOGRAM_RELEASE_SURFACE_OK',JSON.stringify(result.counts));
  else{
    console.error('VETOGRAM_RELEASE_SURFACE_BLOCKED');
    for(const problem of result.errors)console.error(' -',problem);
    process.exitCode=1;
  }
}
