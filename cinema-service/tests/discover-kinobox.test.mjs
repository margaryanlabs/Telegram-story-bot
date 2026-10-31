import test from "node:test";
import assert from "node:assert/strict";
import {discover,normalizeDiscoveredProviders} from "../discover-kinobox.mjs";

test("normalizes translation variants but never publishes rights",()=>{
 const v=normalizeDiscoveredProviders([
  {source:"alloha",success:true,iframeUrl:"https://cdn.example/embed/root",
   translations:[
     {id:1,name:"Дубляж",quality:"1080p",iframeUrl:"https://cdn.example/embed/russian"},
     {id:2,name:"LostFilm",quality:"720p",iframeUrl:"https://cdn.example/embed/lost"}
   ]},
  {source:"bad",success:false,iframeUrl:"https://bad.example"},
  {source:"weird",success:true,iframeUrl:"javascript:alert(1)"},
 ]);
 assert.equal(v.length,2);
 assert.equal(v[0].translation_name,"Дубляж");
 assert.equal(v[1].quality_label,"720p");
 assert.ok(v.every(x=>x.rights_reviewed===false));
});
test("query validates, one request only, no automated crawler",async()=>{
 const calls=[];
 const resp=await discover({key:"title",value:"Интерстеллар",
  fetchFn:async url=>{calls.push(String(url));return {ok:true,json:async()=>[
   {source:"alloha",success:true,iframeUrl:"https://cdn.example/embed/1"}
  ]}}});
 assert.equal(calls.length,1);
 assert.match(calls[0],/title=/);
 assert.equal(resp.candidates.length,1);
 assert.equal(resp.candidates[0].rights_reviewed,false);
 await assert.rejects(discover({key:"all",value:"*"}),/Unsupported/);
 await assert.rejects(discover({key:"title",value:""}),/required/);
});
test("rejects credential URLs and HTTP results",()=>{
 const r=normalizeDiscoveredProviders([
  {source:"alloha",iframeUrl:"http://bad.example/embed"},
  {source:"alloha",iframeUrl:"https://user:pass@bad.example/embed"},
  {source:"alloha",iframeUrl:"https://cdn.example/embed"}
 ]);
 assert.equal(r.length,1);
});
