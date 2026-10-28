import test from 'node:test';
import assert from 'node:assert/strict';
import {CHANNELS,parseVideo,parsePage,fetchChannelPage,cleanPoster} from '../official-rutube.mjs';

const video=(opts={})=>({
  id:"0123456789abcdef0123456789abcdef",
  title:"Приключения старого кино (1987)",
  duration:5500,
  description:"Официальная полная версия фильма.",
  thumbnail_url:"https://pic.rutube.ru/video/thumb.jpg",
  author:{id:CHANNELS.mosfilm.id,name:"Мосфильм"},
  is_paid:false,
  ...opts
});
test("verified Mosfilm film becomes public platform iframe with original source",()=>{
 const x=parseVideo(video(),"mosfilm");
 assert.equal(x.id,"rutube-mosfilm-0123456789abcdef0123456789abcdef");
 assert.equal(x.minutes,92);
 assert.equal(x.year,1987);
 assert.equal(x.player.type,"iframe");
 assert.equal(x.player.url,"https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef");
 assert.equal(x.sourcePage,"https://rutube.ru/video/0123456789abcdef0123456789abcdef/");
 assert.equal(x.poster,"https://pic.rutube.ru/video/thumb.jpg");
 assert.equal(x.player.credit,CHANNELS.mosfilm.label);
});
test("foreign uploader, trailers, paid, private, shorts and live items rejected",()=>{
 assert.equal(parseVideo(video({author:{id:987654}}),"mosfilm"),null);
 assert.equal(parseVideo(video({title:"Трейлер нового фильма"}),"mosfilm"),null);
 assert.equal(parseVideo(video({is_paid:true}),"mosfilm"),null);
 assert.equal(parseVideo(video({is_private:true}),"mosfilm"),null);
 assert.equal(parseVideo(video({duration:120}),"mosfilm"),null);
 assert.equal(parseVideo(video({is_livestream:true}),"mosfilm"),null);
 assert.equal(parseVideo(video({is_embeddable:false}),"mosfilm"),null);
 assert.equal(parseVideo(video({thumbnail_url:"https://evil.com/a.jpg"}),"mosfilm").poster,null);
});
test("other official studios require their exact channel author",()=>{
 assert.ok(parseVideo(video({author:{id:CHANNELS.lenfilm.id}}),"lenfilm"));
 assert.ok(parseVideo(video({author:{id:CHANNELS.gorky.id}}),"gorky"));
 assert.ok(parseVideo(video({author:{id:CHANNELS.starmedia.id}}),"starmedia"));
 assert.ok(parseVideo(video({author:{id:CHANNELS.marsmedia.id}}),"marsmedia"));
 assert.equal(parseVideo(video({author:{id:CHANNELS.mosfilm.id}}),"gorky"),null);
});
test("pagination never follows untrusted next URL",()=>{
 const parsed=parsePage({results:[video(),video({duration:12})],
    has_next:true,next:"https://evil.example/steal"},"mosfilm",1);
 assert.equal(parsed.movies.length,1);
 assert.equal(parsed.skipped,1);
 assert.equal(parsed.diagnostics.shortOrLong,1);
 assert.equal(parsed.nextPage,2);
 assert.equal(parsePage({results:[],has_next:false},"mosfilm",2).nextPage,null);
});
test("public metadata fetch is one fixed URL per requested official page",async()=>{
 const calls=[];
 const fetchFn=async (url)=>{
  calls.push(url);
  return {ok:true,json:async()=>({results:[video()],has_next:false})};
 };
 const data=await fetchChannelPage("mosfilm",5,{fetchFn,now:()=>1000});
 assert.equal(data.movies.length,1);
 assert.equal(calls[0],"https://rutube.ru/api/video/person/25963146/?page=5&format=json&origin__type=rtb,rst,ifrm,rspa");
 assert.equal((await fetchChannelPage("mosfilm",5,{fetchFn,now:()=>1001})).movies.length,1);
 assert.equal(calls.length,1);
 await assert.rejects(fetchChannelPage("evil",1,{fetchFn}),/Неизвестный/);
 await assert.rejects(fetchChannelPage("mosfilm",121,{fetchFn}),/Неверная/);
});
test("artwork is host checked",()=>{
 assert.equal(cleanPoster("https://evil.example/cover.png"),null);
 assert.equal(cleanPoster("http://pic.rutube.ru/cover.jpg"),null);
 assert.equal(cleanPoster("https://pic.rutubelist.ru/cover.jpg"),"https://pic.rutubelist.ru/cover.jpg");
 assert.equal(cleanPoster("https://pic.rtbcdn.ru/video/2026-10-23/poster.jpg"),"https://pic.rtbcdn.ru/video/2026-10-23/poster.jpg");
});

test("Soyuzmultfilm children films and cartoon episodes show with original posters and dates",()=>{
 const c=parseVideo(video({
   id:"11111111111111111111111111111111",
   author:{id:CHANNELS.soyuzmultfilm.id,name:"Союзмультфильм"},
   title:"Умка. Большое плавание",duration:430,
   publication_ts:"2026-10-27T17:08:33",
   thumbnail_url:"https://pic.rtbcdn.ru/video/2026-10-27/umka.jpg"
 }),"soyuzmultfilm");
 assert.ok(c);
 assert.equal(c.contentType,"Мультфильмы");
 assert.equal(c.publishedAt,"2026-10-27T17:08:33");
 assert.equal(c.poster,"https://pic.rtbcdn.ru/video/2026-10-27/umka.jpg");
 assert.equal(c.player.provider,"RUTUBE");
 assert.equal(parseVideo(video({author:{id:CHANNELS.soyuzmultfilm.id},duration:32}),"soyuzmultfilm"),null);
});
test("Studio film records label series and preserve fact-checked genre terms",()=>{
 const s=parseVideo(video({
  title:"Женщина в беде — 4 серия (драма, 2015, сериал)",
  author:{id:CHANNELS.starmedia.id},
  publication_ts:"2026-10-24T20:00:00"
 }),"starmedia");
 assert.equal(s.contentType,"Сериалы");
 assert.ok(s.genres.includes("Драма"));
 assert.ok(s.genres.includes("Сериалы"));
});
