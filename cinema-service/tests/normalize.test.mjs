import test from "node:test";
import assert from "node:assert/strict";
import {normalizeFilm} from "../normalize.mjs";
const sample={
 id:"mosfilm-afonya",title_ru:"Афоня",original_title:"Afonya",year:1975,
 description:"Русская комедия",duration_seconds:5520,genres:["Советское кино","Комедия"],
 rights_holder:"Мосфильм",attribution:"Киноконцерн «Мосфильм»",provider:"RUTUBE",
 source_type:"iframe",playback_url:"https://rutube.ru/play/embed/97251d193ac780c0138596f3aea972c0",
 source_page_url:"https://rutube.ru/video/97251d193ac780c0138596f3aea972c0/",
 rights_basis:"official_embed",rights_evidence_url:"https://rutube.ru/info/embed/",rights_reviewed:true
};
test("official provider record normalizes",()=>{
 const f=normalizeFilm(sample);
 assert.equal(f.id,"mosfilm-afonya");
 assert.equal(f.title,"Афоня");
 assert.equal(f.provider,"RUTUBE");
 assert.equal(f.year,1975);
 assert.deepEqual(f.genres,["Советское кино","Комедия"]);
});
test("cannot import without explicit rights review",()=>{
 assert.throws(()=>normalizeFilm({...sample,rights_reviewed:false}),/ручную проверку прав/);
});
test("rejects unauthorized provider origin and non-https",()=>{
 assert.throws(()=>normalizeFilm({...sample,playback_url:"https://bad.example/embed/secret"}),/неизвестный видеопровайдер/);
 assert.throws(()=>normalizeFilm({...sample,playback_url:"http://rutube.ru/play/embed/xxx"}),/HTTPS/);
});
test("rejects off-format provider URL, credentials and malicious IDs",()=>{
 assert.throws(()=>normalizeFilm({...sample,playback_url:"https://rutube.ru/evil"}),/iframe/);
 assert.throws(()=>normalizeFilm({...sample,playback_url:"https://bob:secret@rutube.ru/play/embed/a"}),/HTTPS URL/);
 assert.throws(()=>normalizeFilm({...sample,id:"../../../api"}),/Недопустимый id/);
});
test("allows independently approved external provider when allowlisted",()=>{
 const f=normalizeFilm({...sample,source_type:"hls",playback_url:"https://licensed.example/film/playlist.m3u8"},
  {allowedOrigins:["https://licensed.example"]});
 assert.equal(f.source_type,"hls");
 assert.ok(f.playback_url.startsWith("https://licensed.example/"));
});
test("does not accept unknown rights basis",()=>{
 assert.throws(()=>normalizeFilm({...sample,rights_basis:"found_online"}),/основание показа/);
});
