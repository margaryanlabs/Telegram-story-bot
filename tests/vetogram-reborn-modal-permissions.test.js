import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('public/studio.html');
const app=read('public/app.js');
const privacy=read('public/privacy.js');
const css=read('public/vetogram-noir.css');
const neon=read('lib/neon-store.js');
const wizard=read('api/business-wizard.js');

test('mobile login sheet matches its real html root and dismisses app navigation',()=>{
  assert.match(html,/<html id="vetogram"[^>]*class="[^"]*vetogram-noir/);
  assert.match(css,/html#vetogram\.vetogram-noir body\.veto-sheet-open #sheet/);
  assert.match(css,/html#vetogram\.vetogram-noir body\.veto-sheet-open \.bottom-nav/);
  assert.doesNotMatch(css.replaceAll('html#vetogram.vetogram-noir body.veto-sheet-open',''),/#vetogram\.vetogram-noir body\.veto-sheet-open/);
  assert.match(html,/id="sheet" role="dialog" aria-modal="true"/);
  assert.match(html,/tabindex="-1" hidden/);
  assert.match(app,/\$\('sheet'\)\.focus\(\{preventScroll:true\}\)/);
  assert.match(app,/sheetReturnFocus/);
  assert.match(app,/returnTo\.focus\(\{preventScroll:true\}\)/);
  assert.match(app,/\$\('viewerCountryPicker'\)\?\.hidden===false/);
});

test('both business and personal-login flows use one sheet and a safe Telegram Back event',()=>{
  assert.match(app,/window\.VetoTelegramModal = Object\.freeze\(\{open:openSheet,close:closeSheet\}\)/);
  assert.match(privacy,/window\.VetoTelegramModal\?\.open/);
  assert.match(privacy,/window\.VetoTelegramModal\?\.close/);
  assert.match(app,/new CustomEvent\('vetogram:modal-closed'\)/);
  assert.match(privacy,/addEventListener\('vetogram:modal-closed'/);
  assert.match(privacy,/privacyState\.backup\.stopRequested=true/);
});

test('business wizard strips disabled scopes and does not offer conflicting selected/excluded peers',()=>{
  assert.match(privacy,/el\.disabled = scope !== 'selected-private'/);
  assert.match(privacy,/el\.disabled = scope === 'selected-private' \|\| scope === 'preserve'/);
  assert.match(privacy,/if \(el\.disabled\) el\.checked = false/);
  assert.match(privacy,/effectiveSelected\.length > 0 && effectiveSelected\.length <= 12/);
  assert.match(privacy,/effectiveExcluded\.length <= 12/);
  assert.match(privacy,/antiDeleteConsent:\$\('businessWizardAntiDelete'\)\?\.checked===true/);
  assert.match(privacy,/storiesConsent:\$\('businessWizardStories'\)\?\.checked===true/);
  const errorArea=privacy.split('<h2>Нужно подключить свой Telegram</h2>')[1]?.split('</div>')[0]||'';
  assert.equal((errorArea.match(/data-business-close="1"/g)||[]).length,1);
});

test('production Neon check requires actual atomic Business lease table as well as schema version',()=>{
  assert.match(neon,/to_regclass\('public\.veto_business_write_leases'\)/);
  assert.match(neon,/businessLeaseReady:lease\?\.ready===true/);
  assert.match(wizard,/Number\(result\?\.schemaVersion\)>=5 && result\.businessLeaseReady===true/);
  assert.match(wizard,/if\(readiness\?\.ready!==true\)/);
  assert.doesNotMatch(wizard,/CREATE TABLE|ALTER TABLE/);
});

test('saved protection settings alone never prove real Anti-Delete delivery',()=>{
  assert.match(privacy,/получение удалений ещё не проверено/);
  assert.match(privacy,/Bot API/);
  assert.match(privacy,/тестового удаления сообщения/);
});

test('personal account management does not silently trigger Business consent wizard',()=>{
  const entry=app.split('window.VetoTelegramOpenAccountConnection = async () => {')[1]
    ?.split('\n  };')[0];
  assert.ok(entry,'account-management entry must exist');
  assert.match(entry,/profileSheet\(\)/);
  assert.match(entry,/connectionHelpSheet\(\)/);
  assert.doesNotMatch(entry,/VetoTelegramOpenUnifiedOnboarding/);
  assert.match(app,/Anti-Delete подключается в Vetogram/);
});

test('UI does not promise Stories publishing or viewer details without Telegram proof',()=>{
  assert.match(app,/право публикации проверяется при попытке/);
  assert.match(app,/публикация зависит от возможностей и разрешений Telegram/);
  assert.match(app,/данные о просмотрах, которые фактически вернёт Telegram/);
  assert.doesNotMatch(app,/<b>Stories<\/b><small>сможешь публиковать Story из Vetogram/);
});

test('after Business consent the wizard has one accessible exit, not duplicate close buttons',()=>{
  assert.match(privacy,/archiveIncomplete\?'Закрыть':'Готово'/);
  assert.doesNotMatch(privacy,/data-business-close="1">Готово<\/button>'\}<button data-business-close="1">Закрыть/);
});
test('account profile distinguishes missing Business consent from verified incoming events',()=>{
  assert.match(app,/const businessConnected = state\.businessPermissions\?\.connected === true/);
  assert.match(app,/businessNeedsPermission/);
  assert.match(app,/доставка событий отдельно не проверена/);
  assert.match(app,/получение сообщений и удалений ещё нужно проверить/);
  assert.doesNotMatch(app,/state\.businessPermissions\?\.connected === true \|\| state\.connection === 'needs_permission'/);
});
