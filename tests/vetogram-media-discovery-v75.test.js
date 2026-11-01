import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/vetogram-media-discovery-v75.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-discovery-v75.css',import.meta.url),'utf8');

function element(dataset={}){
 return {dataset,value:'',textContent:'',handlers:{},focused:false,
   addEventListener(type,handler){this.handlers[type]=handler},
   focus(){this.focused=true}
 };
}
function harness(){
 const form=element(),input=element(),help=element(),calls=[];
 const map={'#v75ExploreForm':form,'#v75ExploreQuery':input,'#v75ExploreHelp':help};
 const root={querySelector:key=>map[key]||null};
 const window={VetogramUniverse:{open:(...args)=>calls.push(args)}};
 const document={querySelector:query=>query==='.screen[data-screen="media"]'?root:null};
 runInNewContext(js,{document,window,String,Set});
 return {form,input,help,calls,window};
}
function search(h,target,query){
 h.input.value=query;
 h.form.handlers.submit({preventDefault(){},submitter:target?{dataset:{v75Target:target}}:undefined});
}
test('media discovery offers three real catalog selectors, separate from personal search',()=>{
 assert.match(html,/id="v75ExploreForm"/);
 assert.match(html,/id="v75ExploreQuery"/);
 assert.match(html,/id="v61SearchForm"/);
 for(const target of ['music','cinema','books']){
   assert.match(html,new RegExp('data-v75-target="'+target+'"'));
 }
 assert.match(html,/vetogram-media-discovery-v75\.js\?v=20261101-rebuild04/);
 assert.match(html,/vetogram-discovery-v75\.css\?v=20261101-rebuild04/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/max-width:390px/);
});
test('query is delivered only through existing media module bridge, with no fake search results',()=>{
 const h=harness();
 for(const target of ['music','cinema','books'])search(h,target,'Пушкин');
 assert.equal(h.calls.length,3);
 for(let i=0;i<3;i++)assert.equal(h.calls[i][0],['music','cinema','books'][i]);
 for(const call of h.calls){assert.equal(call[1],'search');assert.equal(call[2],null);assert.equal(call[3],'Пушкин');}
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|initData|telegram-chats|document\.cookie|sessionStorage|localStorage/);
});
test('one character never triggers misleading search, empty text opens catalog search',()=>{
 const h=harness();
 search(h,'cinema','x');
 assert.equal(h.calls.length,0);assert.equal(h.input.focused,true);
 assert.match(h.help.textContent,/две буквы/);
 search(h,'books',' ');
 assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'books');assert.equal(h.calls[0][3],'');
});
test('controls resist altered submitter values and strip control characters',()=>{
 const h=harness();
 search(h,'unsafe',' <script>Тест\n трек</script> ');
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0][0],'music');
 assert.equal(h.calls[0][3].includes('<'),false);
 assert.equal(h.calls[0][3].includes('>'),false);
});
test('bridge unavailable is reported rather than suggesting a successful search',()=>{
 const h=harness();delete h.window.VetogramUniverse;
 search(h,'music','Аудио');
 assert.equal(h.calls.length,0);
 assert.match(h.help.textContent,/загружается/);
});
