import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {join} from "node:path";
const root=new URL("../",import.meta.url);
const source=readFileSync(new URL("../public/media-discovery.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../public/media.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../public/media-discovery.css",import.meta.url),"utf8");
const start=source.indexOf("  function audio(raw){");
const end=source.indexOf("  async function one(",start);
assert.ok(start>0&&end>start,"catalog converters must be present");
const pure = new Function(
  "const clean=(v,n=220)=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim().slice(0,n);"+
  "const url=(v)=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:''}catch{return''}};"+
  source.slice(start,end)+"\nreturn {audio,show,book,archive,endpoint,parseProvider};"
)();
test("V11 UI ships real category search with no fabricated hits",()=>{
  assert.match(html,/id="discoverView"/);
  assert.match(html,/data-tab="discover"/);
  for(const id of ["v11SearchForm","v11Search","v11Results","v11ProviderStatus","v11DetailModal","v11DetailClose"]){
    assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
  }
  assert.match(html,/TVmaze, CC BY-SA/);
  assert.match(html,/media-discovery\.css/);
  assert.match(html,/media-discovery\.js/);
  assert.match(css,/@media\(max-width:440px\)/);
  assert.match(css,/prefers-reduced-motion/);
  execFileSync(process.execPath,["--check",join(process.cwd(),"public/media-discovery.js")],{stdio:"pipe"});
});
test("Audius maps public tracks and rejects gated, deleted media",()=>{
  const items=pure.parseProvider("music",{data:[
    {id:"live1",title:"Jazz",user:{name:"Singer"},permalink:"https://audius.co/singer/jazz"},
    {id:"locked",title:"Private",is_stream_gated:true},
    {id:"deleted",title:"Deleted",is_delete:true}
  ]});
  assert.equal(items.length,1);
  assert.equal(items[0].href,"https://audius.co/singer/jazz");
  assert.equal(items[0].title,"Jazz");
});
test("TVmaze maps series metadata and safe source links, never fake playback",()=>{
  const items=pure.parseProvider("shows",[
    {show:{id:176,name:"Sherlock",premiered:"2010-07-25",genres:["Crime"],summary:"<p>Drama</p>",url:"https://www.tvmaze.com/shows/176/sherlock"}},
    {show:{name:"Missing id"}}
  ]);
  assert.equal(items.length,1);assert.equal(items[0].type,"shows");
  assert.equal(items[0].detail,"Drama");
  assert.equal(items[0].href,"https://www.tvmaze.com/shows/176/sherlock");
});
test("Gutenberg limits in-app results to explicit public-domain entries",()=>{
  const items=pure.parseProvider("books",{results:[
    {id:1661,title:"Sherlock Holmes",copyright:false,authors:[{name:"Doyle"}],formats:{}},
    {id:100,title:"Rights unknown"},
    {id:101,title:"Copyrighted",copyright:true}
  ]});
  assert.equal(items.length,1);
  assert.equal(items[0].href,"https://www.gutenberg.org/ebooks/1661");
});
test("Archive only accepts license metadata and safe identifiers",()=>{
  const items=pure.parseProvider("films",{response:{docs:[
    {identifier:"sherlock-archive",title:"Archive",licenseurl:"https://creativecommons.org/publicdomain/mark/1.0/"},
    {identifier:"bad/../../",title:"Traversal",licenseurl:"https://creativecommons.org/publicdomain/mark/1.0/"},
    {identifier:"no-rights",title:"Unverified"}
  ]}});
  assert.equal(items.length,1);
  assert.equal(items[0].type,"films");
  assert.match(items[0].href,/^https:\/\/archive\.org\/details\//);
});
test("Search URLs are provider-local and restricted to public endpoints",()=>{
  for(const [type,host] of [["music","api.audius.co"],["shows","api.tvmaze.com"],["books","gutendex.com"],["films","archive.org"]]){
    const u=new URL(pure.endpoint(type,"Sherlock Holmes"));
    assert.equal(u.host,host);
    assert.equal(u.protocol,"https:");
  }
  const archive=new URL(pure.endpoint("films","Sherlock Holmes"));
  assert.match(archive.searchParams.get("q"),/collection:prelinger/);
  assert.match(archive.searchParams.get("q"),/title:Sherlock/);
});
test("Discovery remains read-only, limits timeouts and rejects untrusted HTML injection",()=>{
  assert.match(source,/Promise\.allSettled/);
  assert.match(source,/AbortController/);
  assert.match(source,/300000/);
  assert.match(source,/textContent/);
  assert.match(source,/localStorage\.setItem/);
  assert.doesNotMatch(source,/api\.vk\.com|VK_ADMIN_TOKEN|TMDB_API_KEY|dangerouslySetInnerHTML/);
  assert.doesNotMatch(source,/\.innerHTML\s*=/);
});
