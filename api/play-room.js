import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { configuredPlayRoomStore } from '../lib/vetogram-play-room-store.js';
import { normalizeRoomCode, validRoomCode } from '../lib/vetogram-play-room-core.js';

const messages={
  not_found:'Комната не найдена или недоступна.',
  expired:'Срок действия комнаты истёк.',
  full:'В комнате уже два игрока.',
  conflict:'Состояние изменилось. Обнови комнату.',
  too_many_rooms:'Достигнут лимит активных комнат.',
  invalid_code:'Неверный код комнаты.',
  invalid_version:'Обнови комнату перед следующим ходом.',
  not_your_turn:'Сейчас ход другого игрока.',
  invalid_move:'Неверная клетка.',
  occupied:'Эта клетка уже занята.',
  not_active:'Комната ещё не готова или партия завершена.',
  corrupt_state:'Комната требует проверки. Начни новую партию.',
  retry:'Не удалось создать комнату. Повтори попытку.',
};
const statusFor=code=>['conflict','too_many_rooms','full','not_your_turn','occupied','not_active','expired'].includes(code)?409:
  ['not_found'].includes(code)?404:400;
function reply(res,status,value){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(value);
}
export default async function handler(req,res){
  if(!['GET','POST'].includes(req.method)) {
    res.setHeader('Allow','GET, POST');
    return reply(res,405,{ok:false,error:'method_not_allowed',message:'Неподдерживаемый метод.'});
  }
  // This is status only, not a proof that the database migration was executed.
  if(req.method==='GET'&&req.query?.health==='1'){
    return reply(res,200,{ok:true,configured:Boolean(process.env.VETOGRAM_PLAY_DATABASE_URL),game:'tic'});
  }
  const botToken=String(process.env.TELEGRAM_BOT_TOKEN||'');
  const rawInit=req.headers?.['x-telegram-init-data'];
  const initData=typeof rawInit==='string'&&rawInit.length<8000?rawInit:'';
  const user=validateTelegramMiniApp(initData,botToken,3600);
  if(!user?.id)return reply(res,401,{ok:false,error:'auth_required',message:'Открой Vetogram в Telegram и обнови вход.'});
  if(req.method==='POST') {
    const length=Number(req.headers?.['content-length']||0);
    if(length>2048)return reply(res,413,{ok:false,error:'too_large',message:'Слишком длинный запрос.'});
    const type=String(req.headers?.['content-type']||'');
    if(!type.toLowerCase().startsWith('application/json'))return reply(res,415,{ok:false,error:'bad_content_type'});
  }
  if(!process.env.VETOGRAM_PLAY_DATABASE_URL){
    return reply(res,503,{ok:false,error:'not_configured',message:'Сетевые комнаты ещё не подключены.'});
  }
  let store;
  try{store=await configuredPlayRoomStore();}
  catch(error){
    console.error('[Play room] connection setup:',error?.message);
    return reply(res,503,{ok:false,error:'unavailable',message:'Игровые комнаты временно недоступны.'});
  }
  if(!store)return reply(res,503,{ok:false,error:'not_configured',message:'Сетевые комнаты ещё не подключены.'});
  try{
    const player=String(user.id);
    let result;
    if(req.method==='GET'){
      const code=normalizeRoomCode(req.query?.code);
      if(!validRoomCode(code))return reply(res,400,{ok:false,error:'invalid_code',message:messages.invalid_code});
      result=await store.view(code,player);
    }else{
      let body=req.body;
      if(typeof body==='string')body=JSON.parse(body);
      if(!body||typeof body!=='object'||Array.isArray(body))body={};
      const action=body.action;
      if(action==='create')result=await store.create(player);
      else if(action==='join')result=await store.join(body.code,player);
      else if(action==='move')result=await store.move(body.code,player,body.cell,body.version);
      else return reply(res,400,{ok:false,error:'invalid_action',message:'Неизвестное действие.'});
    }
    if(!result.ok)return reply(res,statusFor(result.error),{ok:false,error:result.error,message:messages[result.error]||'Действие недоступно.'});
    return reply(res,200,{ok:true,room:result.room});
  }catch(error){
    if(error instanceof SyntaxError)return reply(res,400,{ok:false,error:'invalid_json',message:'Неверный формат запроса.'});
    console.error('[Play room] request failed:',error?.message||String(error));
    return reply(res,503,{ok:false,error:'unavailable',message:'Игровые комнаты временно недоступны.'});
  }
}
