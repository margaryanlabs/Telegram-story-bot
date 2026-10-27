#!/usr/bin/env node
/**
 * Optional static feed exporter: original video metadata only, no movie bytes.
 *
 * Example:
 * npm run studios:export -- mosfilm 45 ../public/cinema-mosfilm-feed.json
 *
 * Uses RUTUBE public metadata with 700ms+ pacing and publisher validation;
 * this is not a sitewide scraper. Current working host must be allowed
 * to call the public RUTUBE API. Do not use for third-party/unknown channels.
 */
import {writeFile} from "node:fs/promises";
import {fetchChannelPage,CHANNELS} from "./official-rutube.mjs";
const channel=process.argv[2]||"mosfilm";
const count=Number(process.argv[3]||"2");
const output=process.argv[4]||"";
if(!Object.hasOwn(CHANNELS,channel)||!Number.isInteger(count)||count<1||count>80||!output){
  console.error("Usage: node export-studio.mjs <mosfilm|lenfilm|gorky> <pages 1..80> <output.json>");
  process.exit(1);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let page=1;const ids=new Set(),titles=[];
try{
  for(let i=0;i<count&&page!==null;i++){
    const result=await fetchChannelPage(channel,page);
    for(const film of result.movies){
      if(!ids.has(film.id)){ids.add(film.id);titles.push(film)}
    }
    console.error(channel,"page",page,"accepted",result.movies.length,"total",titles.length);
    page=result.nextPage;
    if(page!==null&&i<count-1)await sleep(1100);
  }
  const body={channel,generation:"RUTUBE public metadata; full movies ONLY by studio uploader",movies:titles};
  await writeFile(output,JSON.stringify(body,null,2)+"\n",{encoding:"utf8",flag:"w"});
  console.log("Exported",titles.length,"metadata records to",output);
}catch(e){console.error("No partial export was written:",e.message);process.exitCode=1}
