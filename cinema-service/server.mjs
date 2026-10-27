// VETOGRAM CINEMA / metadata-only API for VPS reverse-proxy.
import http from "node:http";
import process from "node:process";
import pg from "pg";
import {fetchChannelPage,CHANNELS} from "./official-rutube.mjs";
const port=Number(process.env.PORT||3800);
if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is required");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:10000,connectionTimeoutMillis:5000});
function respond(res,status,obj) {
 const body=JSON.stringify(obj);
 res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=30","X-Content-Type-Options":"nosniff","Content-Length":Buffer.byteLength(body)});
 res.end(body);
}
export function asFilm(r) {
 return {id:r.id,title:r.title_ru,original:r.original_title,year:r.release_year,
   synopsis:r.synopsis,poster:r.poster_url,minutes:Math.ceil((r.duration_seconds||0)/60),
   spoken:r.spoken_language,genres:r.genres||[],hue:r.hue,creator:r.rights_holder,
   sourcePage:r.source_page_url,license:r.rights_basis,licenseUrl:r.rights_evidence_url,
   player:{type:r.source_type,url:r.playback_url,licensed:true,license:r.rights_basis,
     credit:r.attribution,provider:r.provider},editions:[]};
}
const sqlSelect=[
 "SELECT m.id,m.title_ru,m.original_title,m.release_year,m.synopsis,m.poster_url,",
 "m.duration_seconds,m.spoken_language,m.genres,m.hue,m.rights_holder,",
 "s.provider,s.type AS source_type,s.playback_url,s.source_page_url,s.rights_basis,",
 "s.rights_evidence_url,s.attribution FROM cinema_movies m",
 "JOIN LATERAL (SELECT * FROM cinema_playback_sources x",
 "WHERE x.movie_id=m.id AND x.active=true AND x.rights_reviewed_at IS NOT NULL",
 "AND cardinality(x.territory_codes)=0 ORDER BY x.rights_reviewed_at DESC LIMIT 1) s ON true",
 "WHERE m.publishing_status='published'"
].join(" ");
const server=http.createServer(async(req,res)=>{
 if(req.method!=="GET"){respond(res,405,{error:"GET only"});return}
 const url=new URL(req.url,"http://localhost");
 try {
  if(url.pathname==="/healthz"){
   await pool.query("SELECT 1");respond(res,200,{status:"ok",service:"cinema-catalog"});return;
  }
  // Independent metadata feed: live public embeds from approved rights-holder
  // channels. Does not require a private PostgreSQL row for every studio video.
  if(url.pathname==="/api/cinema/channels"){
    const channel=url.searchParams.get("channel")||"mosfilm";
    const page=Number(url.searchParams.get("page")||"1");
    if(!Object.hasOwn(CHANNELS,channel)||!Number.isInteger(page)||page<1||page>120){
      respond(res,400,{error:"invalid channel or page"});return;
    }
    const result=await fetchChannelPage(channel,page);
    respond(res,200,result);return;
  }
  if(url.pathname==="/api/cinema/channels/list"){
    respond(res,200,{channels:Object.entries(CHANNELS).map(([id,c])=>({
      id,name:c.label,channelUrl:c.channelUrl
    }))});return;
  }
  if(url.pathname==="/api/cinema/movies"){
   const q=(url.searchParams.get("q")||"").trim().slice(0,80);
   const genre=(url.searchParams.get("genre")||"").trim().slice(0,60);
   const limit=Math.min(80,Math.max(1,Number.parseInt(url.searchParams.get("limit")||"40",10)||40));
   const offset=Math.min(10000,Math.max(0,Number.parseInt(url.searchParams.get("offset")||"0",10)||0));
   const result=await pool.query(sqlSelect+
    " AND ($1='' OR m.title_ru ILIKE '%'||$1||'%' OR m.original_title ILIKE '%'||$1||'%')"+
    " AND ($2='' OR $2=ANY(m.genres)) ORDER BY m.updated_at DESC,m.id LIMIT $3 OFFSET $4",
    [q,genre,limit,offset]);
   respond(res,200,{movies:result.rows.map(asFilm),nextOffset:result.rowCount===limit?offset+limit:null});return;
  }
  const sourcesMatch=/^\/api\/cinema\/movies\/([a-z0-9][a-z0-9-]{2,90})\/sources$/.exec(url.pathname);
  if(sourcesMatch){
    const r=await pool.query(
      "SELECT x.id,x.provider,x.type,x.playback_url,x.source_page_url,x.rights_basis,"+
      "x.rights_evidence_url,x.attribution,x.spoken_language,x.translation_name,x.quality_label "+
      "FROM cinema_playback_sources x JOIN cinema_movies m ON m.id=x.movie_id "+
      "WHERE m.id=$1 AND m.publishing_status='published' AND x.active=true "+
      "AND x.rights_reviewed_at IS NOT NULL AND cardinality(x.territory_codes)=0 "+
      "ORDER BY x.priority DESC,x.id ASC LIMIT 30",[sourcesMatch[1]]
    );
    respond(res,200,{sources:r.rows.map(x=>({
      id:String(x.id),provider:x.provider,type:x.type,url:x.playback_url,
      sourcePage:x.source_page_url,licensed:true,license:x.rights_basis,
      licenseUrl:x.rights_evidence_url,credit:x.attribution,
      language:x.spoken_language,translation:x.translation_name,quality:x.quality_label
    }))});return;
  }
  const m=/^\/api\/cinema\/movies\/([a-z0-9][a-z0-9-]{2,90})$/.exec(url.pathname);
  if(m){
   const result=await pool.query(sqlSelect+" AND m.id=$1",[m[1]]);
   respond(res,result.rowCount?200:404,result.rowCount?{movie:asFilm(result.rows[0])}:{error:"movie not found"});return;
  }
  respond(res,404,{error:"not found"});
 }catch(e){console.error("cinema db",e.message);respond(res,503,{error:"catalog temporarily unavailable"})}
});
server.listen(port,"127.0.0.1",()=>console.log("Cinema catalog listening on 127.0.0.1:"+port));
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>{server.close(()=>pool.end().then(()=>process.exit(0)))});
