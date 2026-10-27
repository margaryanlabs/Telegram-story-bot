#!/usr/bin/env node
// Accept reviewed JSON metadata only; do not download or proxy any film.
import {readFile} from "node:fs/promises";
import process from "node:process";
import pg from "pg";
import {normalizeFilm} from "./normalize.mjs";

async function main() {
 const path=process.argv[2];
 if(!path)throw Error("Usage: npm run import -- ./movies.json");
 if(!process.env.DATABASE_URL)throw Error("DATABASE_URL отсутствует");
 const allowed=(process.env.CINEMA_ALLOWED_PROVIDER_ORIGINS||"https://rutube.ru").split(",").map(x=>x.trim()).filter(Boolean);
 const input=JSON.parse(await readFile(path,"utf8"));
 if(!Array.isArray(input)||input.length>1000)throw Error("Нужен массив из 1–1000 записей");
 const films=input.map(v=>normalizeFilm(v,{allowedOrigins:allowed}));
 const client=new pg.Client({connectionString:process.env.DATABASE_URL});
 await client.connect();
 try {
  await client.query("BEGIN");
  for(const f of films) {
   await client.query(
    "INSERT INTO cinema_movies (id,title_ru,original_title,release_year,synopsis,poster_url,duration_seconds,spoken_language,genres,hue,rights_holder,publishing_status)"+
    " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published')"+
    " ON CONFLICT (id) DO UPDATE SET title_ru=EXCLUDED.title_ru,original_title=EXCLUDED.original_title,"+
    " release_year=EXCLUDED.release_year,synopsis=EXCLUDED.synopsis,poster_url=EXCLUDED.poster_url,"+
    " duration_seconds=EXCLUDED.duration_seconds,spoken_language=EXCLUDED.spoken_language,"+
    " genres=EXCLUDED.genres,hue=EXCLUDED.hue,rights_holder=EXCLUDED.rights_holder,publishing_status='published',updated_at=now()",
    [f.id,f.title,f.original_title,f.year,f.synopsis,f.poster_url,f.duration_seconds,f.spoken_language,f.genres,f.hue,f.rights_holder]
   );
   await client.query(
    "INSERT INTO cinema_playback_sources (movie_id,provider,type,playback_url,source_page_url,rights_basis,rights_evidence_url,attribution,spoken_language,territory_codes,translation_name,quality_label,priority,active,rights_reviewed_at)"+
    " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,now())"+
    " ON CONFLICT (movie_id,provider,playback_url) DO UPDATE SET source_page_url=EXCLUDED.source_page_url,"+
    " rights_basis=EXCLUDED.rights_basis,rights_evidence_url=EXCLUDED.rights_evidence_url,"+
    " attribution=EXCLUDED.attribution,spoken_language=EXCLUDED.spoken_language,"+
    " territory_codes=EXCLUDED.territory_codes,translation_name=EXCLUDED.translation_name,"+
    " quality_label=EXCLUDED.quality_label,priority=EXCLUDED.priority,active=true,rights_reviewed_at=now()",
    [f.id,f.provider,f.source_type,f.playback_url,f.source_page_url,f.rights_basis,
     f.rights_evidence_url,f.attribution,f.spoken_language,f.territories,f.translation_name,f.quality_label,f.priority]
   );
  }
  await client.query("COMMIT");
  console.log("Imported movies:",films.length);
 }catch(e){await client.query("ROLLBACK");throw e}
 finally{await client.end()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
