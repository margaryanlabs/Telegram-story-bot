import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { configuredPlayStatsStore } from '../lib/vetogram-play-stats.js';

function reply(res,status,payload){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(payload);
}
export default async function handler(req,res){
  if(req.method!=='GET'&&req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return reply(res,405,{ok:false,error:'method_not_allowed'});
  }
  const raw=req.headers?.['x-telegram-init-data'];
  const initData=typeof raw==='string'&&raw.length<8000?raw:'';
  const user=validateTelegramMiniApp(initData,String(process.env.TELEGRAM_BOT_TOKEN||''),3600);
  if(!user?.id)return reply(res,401,{ok:false,error:'auth_required',message:'Войди через Telegram.'});
  if(!process.env.VETOGRAM_PLAY_DATABASE_URL){
    return reply(res,503,{ok:false,error:'not_configured',message:'Статистика появится после подключения игровой базы.'});
  }
  if(req.method==='POST'){
    const size=Number(req.headers?.['content-length']||0);
    if(size>2048)return reply(res,413,{ok:false,error:'too_large'});
    if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json')){
      return reply(res,415,{ok:false,error:'bad_content_type'});
    }
  }
  try {
    const store=await configuredPlayStatsStore();
    if(!store)return reply(res,503,{ok:false,error:'not_configured'});
    const id=String(user.id);
    if(req.method==='GET'){
      const view=String(req.query?.view||'mine');
      if(view==='mine')return reply(res,200,{ok:true,...await store.myStats(id)});
      if(view==='leaders')return reply(res,200,{ok:true,leaders:await store.leaders()});
      return reply(res,400,{ok:false,error:'invalid_view'});
    }
    let body=req.body;
    if(typeof body==='string')body=JSON.parse(body);
    if(!body||typeof body!=='object'||Array.isArray(body))return reply(res,400,{ok:false,error:'invalid_body'});
    if(body.action!=='leaderboard_visibility'||typeof body.visible!=='boolean'){
      return reply(res,400,{ok:false,error:'invalid_action'});
    }
    return reply(res,200,{ok:true,profile:await store.setVisibility(id,body.visible)});
  } catch(error){
    if(error instanceof SyntaxError)return reply(res,400,{ok:false,error:'invalid_json'});
    console.error('[Play stats] failed:',error?.message||String(error));
    return reply(res,503,{ok:false,error:'unavailable',message:'Статистика временно недоступна.'});
  }
}
