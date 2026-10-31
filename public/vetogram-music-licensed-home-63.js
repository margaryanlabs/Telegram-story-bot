/* VETOGRAM 6.3 / one-click open-licensed songs.
 * Source records are real ccMixter CC-BY full MP3s; native music player
 * reports playback errors if the upstream CDN blocks a region or hotlink.
 * Never insert fake chart positions, previews, links-as-play or DRM media.
 */
(()=>{
"use strict";
const V=window.VetogramMusic,rows=window.VetogramMixterSeeds;
const host=document.getElementById("licensedHomeTracks"),more=document.getElementById("licensedHomeMore");
const count=document.getElementById("licensedHomeCount");
if(!V||!host||!more||!Array.isArray(rows))return;
const safe=(url,host)=>{
  try{const u=new URL(String(url));return u.protocol==="https:"&&u.hostname===host&&!u.username&&!u.password?u.href:""}catch{return""}
};
const licenses=/^https:\/\/creativecommons\.org\/licenses\/by\/(?:2\.0|2\.5|3\.0|4\.0)\/$/;
const clean=s=>String(s||"").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,130).trim();
const make=(tag,klass,s)=>{
  const el=document.createElement(tag);if(klass)el.className=klass;
  if(s!==undefined)el.textContent=String(s);
  return el;
};
const tracks=rows.map(row=>{
  const f=row?.files?.find(f=>f?.file_format_info?.["media-type"]==="audio");
  const stream=safe(f?.download_url,"ccmixter.org");
  const license=String(row.license_url||"").replace(/^http:/,"https:");
  const permalink=safe(row.file_page_url,"ccmixter.org");
  if(!stream||!stream.toLowerCase().includes(".mp3")||!licenses.test(license)||!permalink||
     !Number.isSafeInteger(Number(row.upload_id))||!clean(row.upload_name))return null;
  return {
    id:"ccmixter:"+Number(row.upload_id),source:"ccmixter",
    title:clean(row.upload_name),artist:clean(row.user_real_name||row.user_name||"Independent artist"),
    stream,permalink,license_url:license,license:"CC BY",provider:"ccMixter"
  };
}).filter(Boolean);
const unique=[...new Map(tracks.map(x=>[x.id,x])).values()];
let visible=20;
function card(t){
  const article=make("article","licensed-home-card");
  const art=make("span","licensed-home-art","♫");art.setAttribute("aria-hidden","true");
  const info=make("div","licensed-home-info");
  info.append(make("strong","",t.title),make("small","",t.artist));
  const origin=make("a","licensed-home-source","Автор ↗");origin.href=t.permalink;
  origin.target="_blank";origin.rel="noopener noreferrer";
  const license=make("a","licensed-home-license","CC BY");license.href=t.license_url;
  license.target="_blank";license.rel="noopener noreferrer";
  const rights=make("div","licensed-home-rights");rights.append(origin,license);info.append(rights);
  const play=make("button","licensed-home-play","▶");
  play.type="button";play.setAttribute("aria-label","Слушать "+t.title);
  play.addEventListener("click",()=>V.play(t,unique));
  article.append(art,info,play);return article;
}
function render(){
  host.replaceChildren(...unique.slice(0,visible).map(card));
  if(!unique.length)host.append(make("p","licensed-home-empty","Пока нет подтверждённых доступных музыкальных файлов."));
  count.textContent=unique.length+" независимых записей · CC BY";
  more.hidden=visible>=unique.length;
}
more.addEventListener("click",()=>{visible=Math.min(unique.length,visible+20);render()});
render();
window.VetogramLicensedHome=Object.freeze({count:()=>unique.length});
})();
