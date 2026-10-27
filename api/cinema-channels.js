/* Vetogram Cinema public-studio catalogue bridge.
 * Uses only official rights-holder RUTUBE channel metadata, not movie files.
 * Same-origin API handler fits the existing single-function Vercel router.
 */
import {fetchChannelPage,CHANNELS} from "../cinema-service/official-rutube.mjs";

export default async function cinemaChannels(req,res) {
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","public, s-maxage=240, stale-while-revalidate=360");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"GET only"});
  const channel=typeof req.query?.channel==="string"?req.query.channel:"mosfilm";
  const page=Number(req.query?.page||"1");
  const mode=typeof req.query?.mode==="string"?req.query.mode:"";
  if(mode==="list"){
    return res.status(200).json({channels:Object.entries(CHANNELS).map(([id,c])=>({
      id,name:c.label,channelUrl:c.channelUrl
    }))});
  }
  if(!Object.hasOwn(CHANNELS,channel)||!Number.isInteger(page)||page<1||page>120){
    return res.status(400).json({ok:false,error:"invalid studio or page"});
  }
  try{
    const data=await fetchChannelPage(channel,page);
    return res.status(200).json({...data,ok:true});
  }catch(err){
    const reason=String(err?.message||err);
    console.warn("[Cinema studio feed]",channel,page,reason.slice(0,160));
    const code=/HTTP 403|HTTP 401/.test(reason)?"RUTUBE_ACCESS_DENIED":
      /abort|timeout|timed out/i.test(reason)?"RUTUBE_TIMEOUT":
      /Неверный ответ|Invalid JSON|Unexpected token/i.test(reason)?"RUTUBE_BAD_RESPONSE":"RUTUBE_UNAVAILABLE";
    res.setHeader("Cache-Control","no-store");
    return res.status(502).json({ok:false,channel,page,error:code,
      message:"Источник временно не выдаёт каталог. Используйте официальный канал по ссылке."});
  }
}
