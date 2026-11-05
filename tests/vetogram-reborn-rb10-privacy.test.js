/* Vetogram Reborn RB10 — protection is real, not a cosmetic promise.
 * Source-contract regression checks: account verification, original data
 * ownership, opt-in, permanent deletion and mobile visibility must survive.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('studio.html');
const css=read('vetogram-reborn-privacy.css');
const shell=read('app.js');
const rb8=read('vetogram-reborn-atelier.css');
const rb9=read('vetogram-reborn-media.css');

function privacy(){
  const a=html.indexOf('<section class="screen" data-screen="privacy">');
  const b=html.indexOf('<section class="screen" data-screen="chats">',a);
  assert.ok(a>=0&&b>a,'actual Privacy page exists');
  return html.slice(a,b);
}
function archived(){
  const a=html.indexOf('<section class="screen" data-screen="chats">');
  const b=html.indexOf('<section class="screen" data-screen="ai"',a);
  assert.ok(a>=0&&b>a,'owner-scoped saved-chats page exists');
  return html.slice(a,b);
}
function balanced(source){
  const stripped=source.replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
  let level=0;
  for(const c of stripped){
    if(c==='{')level++;
    if(c==='}')level--;
    assert.ok(level>=0,'unmatched closing CSS brace');
  }
  assert.equal(level,0,'unclosed CSS block');
}

test('Privacy Atelier is the final actual studio stylesheet',()=>{
  const links=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(links.length>=20);
  assert.ok(links.at(-1).startsWith('/vetogram-reborn-privacy.css?v='));
  assert.ok(links.some(x=>x.startsWith('/vetogram-reborn-atelier.css?v=')));
  assert.ok(links.some(x=>x.startsWith('/vetogram-reborn-media.css?v=')));
  assert.ok(rb8.length>20000&&rb9.length>15000);
});

test('Consent and verified status remain real controller-owned DOM IDs',()=>{
  const p=privacy();
  for(const id of ['privacyStatusPill','privacyStatusText','privacyHeroText',
    'privacyEnableAllButton','privacyBusinessOnboarding','privacyBusinessWizardButton',
    'privacyBusinessOnboardingState','privacyBusinessVerifyButton',
    'privacyBusinessDetailsButton','privacyEvidenceStatus','privacyAccessTitle',
    'privacyAccessText','privacyAccessAction']){
    assert.ok(p.includes('id="'+id+'"'),id);
  }
  assert.match(p,/требует отдельного согласия/);
  assert.match(css,/status-pill/);
  assert.doesNotMatch(css,/content\s*:\s*["'](?:Включено|Подключено|Защищено|LIVE|ONLINE)/i);
});

test('Manual Telegram Business fallback and no historical resurrection disclaimer survive',()=>{
  const p=privacy();
  assert.match(p,/veto-business-manual-fallback/);
  assert.match(p,/id="privacyBusinessOnboardingSteps"/);
  assert.match(p,/id="privacyBusinessCopyButton"/);
  assert.match(p,/id="privacyBackupGuideButton"/);
  assert.match(p,/Секретные чаты и удалённые ранее сообщения не восстанавливаются/);
  assert.match(p,/Только сообщения, которые Vetogram успел получить/);
});

test('Real five archive counters and freshness proof are not fabricated',()=>{
  const p=privacy();
  for(const id of ['privacyStatThreads','privacyStatDeleted','privacyStatEdited',
    'privacyStatMessages','privacyStatVault','privacyEvidenceBar','privacyEvidenceRefresh']){
    assert.ok(p.includes('id="'+id+'"'),id);
  }
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css,/content\s*:\s*["'](?:\d+|Защищено|Проверено)/);
});

test('Secondary tools remain user discoverable via native details disclosure',()=>{
  const p=privacy();
  const start=p.indexOf('<details class="rb10-advanced-tools"');
  const end=p.indexOf('</details>',start);
  assert.ok(start>0&&end>start);
  const segment=p.slice(start,end);
  assert.match(segment,/<summary>/);
  assert.match(segment,/Другие инструменты/);
  assert.match(segment,/data-ghost-jump="deleted"/);
  assert.match(segment,/data-ghost-jump="edited"/);
  assert.match(segment,/data-ghost-jump="media"/);
  assert.match(segment,/data-open-screen="publish"/);
  assert.match(css,/\.rb10-advanced-tools\[open\]/);
  assert.doesNotMatch(css,/\.rb10-advanced-tools\s*\{\s*display\s*:\s*none/);
});

test('All user-owned Anti-Delete and Privacy switches stay interactive',()=>{
  const p=privacy();
  for(const id of [
    'privacyAntiDeleteSwitch','privacyEditHistorySwitch',
    'privacyGhostInboxSwitch','privacyGhostFocusSwitch',
    'privacyNotifyDeletesSwitch','privacyNotifyEditsSwitch'
  ])assert.match(p,new RegExp('id="'+id+'" type="checkbox"'));
  assert.match(css,/\.setting-row \.switch/);
  assert.doesNotMatch(css,/\.setting-row\s+input\s*\{[\s\S]*?pointer-events\s*:\s*none/);
});

test('Retention and destructive archive purge keep explicit controls',()=>{
  const p=privacy();
  for(const days of ['7','30','90','365','3650'])assert.ok(p.includes('data-retention="'+days+'"'));
  assert.match(p,/Уменьшение срока может удалить старые копии/);
  assert.match(p,/id="privacyClearButton"/);
  assert.match(p,/Удалить сохранённый архив навсегда/);
  assert.match(css,/#privacyClearButton/);
  assert.match(css,/border:1px solid rgba\(232,148,154,.45\)/);
  assert.doesNotMatch(css,/#privacyClearButton\s*\{[^}]*display\s*:\s*none/);
});

test('Archived Smart Inbox uses real filters, search, and no invented unread state',()=>{
  const p=archived();
  for(const id of ['smartInboxAction','smartInboxWatch','smartInboxAll',
    'smartBriefTitle','smartBriefStatus','privacySearch','privacyFilters',
    'privacyThreads','privacyEmpty','privacyThreadCount']){
    assert.ok(p.includes('id="'+id+'"'),id);
  }
  assert.match(p,/не называет сообщения «непрочитанными»/);
  assert.match(css,/\[data-screen="chats"\] .privacy-filters/);
  assert.match(css,/\[data-screen="chats"\] #privacyEmpty/);
  assert.match(css,/\[data-screen="chats"\] .smart-inbox-grid/);
});

test('Navigation stays four tabs with a route into Privacy and real Chats',()=>{
  assert.match(html,/data-nav="privacy"/);
  assert.match(html,/data-nav="telegram"/);
  assert.match(html,/data-reborn-nav="four"/);
  assert.match(shell,/privacy:\s*'privacy'/);
  assert.match(shell,/chats:\s*'chats'/);
});

test('CSS stays source-scoped to Privacy and archived Smart Inbox',()=>{
  assert.match(css,/html#vetogram\.vetogram-noir \.screen\[data-screen="privacy"\]/);
  assert.match(css,/html#vetogram\.vetogram-noir \.screen\[data-screen="chats"\]/);
  assert.doesNotMatch(css,/\bbody\s*\{\s*background/);
  assert.doesNotMatch(css,/background-image\s*:\s*url\(/);
  assert.doesNotMatch(css,/fetch\(|viewerApi\(|localStorage|sessionStorage|postMessage/);
});

test('Light user themes, keyboard focus, small screens and reduced motion',()=>{
  assert.match(css,/data-veto-theme="pearl"/);
  assert.match(css,/data-veto-theme="linen"/);
  for(const width of ['345','440','720'])assert.ok(css.includes('max-width:'+width+'px'));
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/forced-colors:active/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\.rb10-advanced-tools>summary/);
});

test('No CSS parser errors or missing privacy stylesheet body',()=>{
  assert.ok(css.length>25000);
  balanced(css);
  assert.ok(css.includes('PRIVATE CONTROL CENTER'));
  assert.ok(css.includes('RB10B'));
});

test('Design retains genuine archive warnings and does not relabel screen as live Telegram',()=>{
  const p=privacy(),a=archived();
  assert.match(a,/Сохранённые чаты/);
  assert.match(p,/Отметки о прочтении/);
  assert.match(p,/Статус в сети/);
  assert.match(p,/Сохраняются только новые доступные сообщения/);
  assert.doesNotMatch(css,/content\s*:\s*["'](?:online|live|synced|verified|connected)/i);
});
