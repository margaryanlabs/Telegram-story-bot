import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const html=read('studio.html');
const app=read('app.js');
const css=read('vetogram-noir.css');
const picker=read('vetogram-country-picker.js');
const repoApi=readFileSync(new URL('../api/viewer-sync.js',import.meta.url),'utf8');

function fixture(){
  const sandbox={window:{},Object,Set,String,Number};
  vm.createContext(sandbox);
  new vm.Script(picker).runInContext(sandbox);
  return sandbox.window.VetogramCountryPicker;
}

test('country picker lists real choices with flags and calling codes; +7 is ambiguous',()=>{
  const countries=fixture();
  assert.ok(countries.countries.length>=100);
  assert.equal(countries.lookup('+374 99 123 456')?.iso,'AM');
  assert.equal(countries.lookup('+995 555 12 34 56')?.iso,'GE');
  assert.equal(countries.lookup('+971501234567')?.iso,'AE');
  assert.equal(countries.lookup('+7 912 999 99 99'),null);
  assert.equal(countries.lookup('+1 415 555 1111'),null);
  assert.ok(countries.find('Армения').some(country=>country.iso==='AM'));
  assert.ok(countries.find('Россия').some(country=>country.iso==='RU'));
  assert.ok(countries.find('+971').some(country=>country.iso==='AE'));
  assert.equal(countries.find('несуществующая страна').length,0);
});

test('country choice cannot send a code, store private data, or silently retry',()=>{
  assert.doesNotThrow(()=>new vm.Script(picker));
  assert.doesNotMatch(picker,/\bfetch\s*\(/);
  assert.doesNotMatch(picker,/\b(localStorage|sessionStorage)\s*\./);
  assert.doesNotMatch(picker,/viewerApi\s*\(/);
  assert.match(picker,/phone\.dispatchEvent\(new Event\('input'/);
  assert.match(picker,/selected=next/);
  assert.match(picker,/phone\.setSelectionRange/);
  assert.match(picker,/aria-selected/);
  assert.match(picker,/addEventListener\('keydown'/);
});

test('actual Telegram account sheet exposes searchable country, international phone and code state',()=>{
  assert.match(html,/src="\/vetogram-country-picker\.js\?v=/);
  assert.ok(html.indexOf('/vetogram-country-picker.js')<html.indexOf('/app.js'));
  for(const id of ['viewerCountryTrigger','viewerCountryPicker','viewerCountrySearch',
      'viewerCountryOptions','viewerPhone','viewerCode']){
    assert.match(app,new RegExp('id="'+id+'"'),id);
  }
  assert.match(app,/VetogramCountryPicker\?\.mount\(\)/);
  assert.match(app,/viewerCodeSheet\(data\.delivery,\s*data\.reused === true\)/);
  assert.match(app,/Фактическое получение кода ещё не подтверждено/);
  assert.match(app,/data\.reused === true/);
});

test('server preserves outstanding code challenge and does not imply delivered SMS',()=>{
  assert.match(repoApi,/if \(pending\?\.phone === requestedPhone\)/);
  assert.match(repoApi,/reused: true/);
  assert.match(repoApi,/retryAfterSeconds/);
  assert.match(repoApi,/beginUserAuth\(requestedPhone\)/);
  assert.match(repoApi,/saveAuthChallenge\(\{/);
  assert.match(repoApi,/delivery: auth\.delivery/);
});

test('four real destinations include AI and retain secondary routes',()=>{
  const nav=html.split('<nav class="bottom-nav')[1]?.split('</nav>')[0];
  assert.ok(nav,'bottom navigation missing');
  const tabs=[...nav.matchAll(/class="nav-item(?: [^"]*)?" data-nav="([^"]+)"/g)]
    .map(matches=>matches[1]);
  assert.deepEqual(tabs,['telegram','publish','ai','privacy']);
  assert.match(html,/id="vetoNavHome"/);
  assert.match(app,/vetoNavHome'\)\?\.addEventListener/);
  assert.match(app,/ai:'ai'/);
  assert.match(app,/'story-engine':'publish'/);
  assert.match(html,/data-vg26-destination="story-engine"/);
  assert.match(html,/data-vg26-destination="voice"/);
});

test('open sheet hides bottom navigation and restores it after close',()=>{
  assert.match(app,/document\.body\.classList\.add\('veto-sheet-open'\)/);
  assert.match(app,/document\.body\.classList\.remove\('veto-sheet-open'\)/);
  assert.match(css,/body\.veto-sheet-open \.bottom-nav/);
  assert.match(css,/body\.veto-sheet-open #sheet/);
  assert.match(css,/\.veto-country-options/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/max-height:min\(90dvh/);
});

test('country dropdown preserves national digits when +7 is shared by Russia and Kazakhstan',()=>{
  const handlers=()=>({
    events:{},children:[],hidden:true,value:'',dataset:{},
    addEventListener(name,callback){this.events[name]=callback},
    setAttribute(){},replaceChildren(){this.children=[]},
    append(...elements){this.children.push(...elements)},
    contains(target){return this.children.includes(target)},
    closest(){return this},focus(){},setSelectionRange(){},dispatchEvent(event){
      this.events[event.type]?.(event);
    }
  });
  const phone=handlers(),trigger=handlers(),panel=handlers(),search=handlers(),options=handlers();
  phone.value='+7 912 123 45 67';
  const ids={viewerPhone:phone,viewerCountryTrigger:trigger,
    viewerCountryPicker:panel,viewerCountrySearch:search,viewerCountryOptions:options};
  const document={
    getElementById:id=>ids[id]||null,
    addEventListener(){},
    createElement:()=>handlers()
  };
  const window={};
  runInNewContext(picker,{window,document,AbortController,Event:class {constructor(type){this.type=type}},
    Object,Set,String,Number});
  window.VetogramCountryPicker.mount();
  trigger.events.click();
  const kazakhstan=options.children.find(button=>button.dataset.iso==='KZ');
  assert.ok(kazakhstan,'Kazakhstan must be selectable as a distinct +7 country');
  options.events.click({target:kazakhstan});
  assert.equal(phone.value,'+7  912 123 45 67'.replace('  ',' '));
  assert.equal(panel.hidden,true);
  assert.match(trigger.textContent,/Казахстан/);
});
