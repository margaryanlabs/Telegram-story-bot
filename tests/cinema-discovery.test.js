import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const app=readFileSync(resolve(root,"public/cinema.js"),"utf8");
const html=readFileSync(resolve(root,"public/cinema.html"),"utf8");
const theme=readFileSync(resolve(root,"public/cinema-premiere.css"),"utf8");

function harness(){
 const from=app.indexOf("  async function loadMoreStudioArchives(){");
 const to=app.indexOf("  function artElement(",from);
 assert.ok(from>=0&&to>from,"real app browsing functions must exist");
 const names=["mosfilm","lenfilm","gorky","starmedia","marsmedia","soyuzmultfilm"];
 const films=[{id:"seed",title:"Альфа",original:"Альфа",year:2001,
   genres:["Фильмы"],publishedAt:"2026-09-01T12:00:00"}];
 const state={tab:"catalog",genre:"Все",query:"",sort:"recent",visible:100,
   library:{favorites:[],progress:{}}};
 const studio={pages:new Map(names.map(c=>[c,2])),firstPages:new Set(names),selected:"mosfilm"};
 const discovery={prefetching:false,expanding:false};
 const els={cinemaMoreStudios:{disabled:false}};
 let renderCount=0;const status=[];
 const keys=["state","studio","discovery","films","STUDIO_LINKS","$","text",
   "studioPage","mergeStudioPage","render","showStudio",
   "setTimeout","clearTimeout","uploadTime","filmById"];
 const values=[
   state,studio,discovery,films,Object.fromEntries(names.map(n=>[n,""])),
   id=>els[id],(id,v)=>status.push(String(v)),
   async (c,page)=>({channel:c,page,nextPage:page<6?page+1:null,movies:[{
     id:c+"-"+page,title:c+" "+page,original:c,genres:["Фильмы","Комедия"],
     contentType:"Фильмы",year:2020+page,publishedAt:"2026-10-26T10:00:00"
   }]}),
   (c,page,data)=>{const first=films.length;films.push(...data.movies);
     studio.pages.set(c,data.nextPage);return films.length-first},
   ()=>renderCount++,()=>{},
   fn=>{queueMicrotask(fn);return 1},()=>{},
   f=>Date.parse(f.publishedAt||"")||0,
   id=>films.find(f=>f.id===id)
 ];
 const fn=new Function(...keys,app.slice(from,to)+"\nreturn {loadMoreStudioArchives,selectedFilms};");
 return {...fn(...values),state,studio,discovery,films,names,status,els,get renderCount(){return renderCount}};
}

test("premium cinema exposes genre, sorting, and more-studio controls",()=>{
 for(const id of ["cinemaGenreTiles","cinemaSort","cinemaMoreResults","cinemaMoreStudios","cinemaArchiveStatus"]){
   assert.ok(html.includes('id="'+id+'"'),"missing "+id);
 }
 assert.match(theme,/\.cinema-sort-label/);
 assert.match(theme,/\.cinema-browse-actions/);
 assert.match(theme,/\.cinema-hero-dot/);
});

test("archives fetch six rights-holder channel pages, then sort and filter them",async()=>{
 const app=harness();
 const countBefore=app.films.length;
 await app.loadMoreStudioArchives();
 assert.equal(app.films.length,countBefore+6);
 assert.equal(app.renderCount,1);
 assert.equal(app.discovery.expanding,false);
 assert.equal(app.els.cinemaMoreStudios.disabled,false);
 assert.equal(app.studio.pages.get("mosfilm"),3);
 assert.match(app.status.at(-1),/Добавлено 6 записей/);
 app.state.sort="title";
 const result=app.selectedFilms();
 assert.equal(result.length,7);
 assert.equal(result[0].title,"Альфа");
 app.state.query="mars";
 assert.deepEqual(app.selectedFilms().map(x=>x.id),["marsmedia-2"]);
});

test("catalogue genre and release-year sorting are independent",()=>{
 const app=harness();
 app.films.push(
   {id:"s1",title:"Сериал",year:2024,genres:["Сериалы"],contentType:"Сериалы",player:{licensed:true},publishedAt:"2026-10-14T10:00:00"},
   {id:"s2",title:"Фильм",year:1980,genres:["Фильмы"],contentType:"Фильмы",publishedAt:"2026-10-26T10:00:00"}
 );
 app.state.tab="series";app.state.genre="Сериалы";
 assert.deepEqual(app.selectedFilms().map(f=>f.id),["s1"]);
 app.state.tab="catalog";app.state.genre="Все";app.state.sort="year";
 assert.deepEqual(app.selectedFilms().map(f=>f.id),["seed","s2"]);
});

test("public movie feed is not a downloader and does not hide source credit",()=>{
 const pub=readFileSync(resolve(root,"cinema-service/official-rutube.mjs"),"utf8");
 assert.match(pub,/sourcePage:page/);
 assert.match(pub,/channel\.label/);
 assert.match(pub,/https:\/\/rutube\.ru\/play\/embed\//);
 assert.doesNotMatch(pub,/get_video_file|downloadVideo|proxyStream/);
});
