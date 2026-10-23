import {validateTelegramMiniApp} from '../lib/telegram-miniapp-auth.js';
import {normalizeAiInput,normalizeAiOutput,systemInstruction} from '../lib/vetogram-ai-core.js';
const BOT=String(process.env.TELEGRAM_BOT_TOKEN||'');
const reply=(res,status,body)=>res.status(status).json({ok:status<400,...body});
function providerConfig(){
  if(process.env.VETOGRAM_GEMINI_API_KEY)return {provider:'gemini',key:process.env.VETOGRAM_GEMINI_API_KEY};
  if(process.env.VETOGRAM_OPENAI_API_KEY)return {provider:'openai',key:process.env.VETOGRAM_OPENAI_API_KEY};
  return null;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return reply(res,405,{error:'POST required'});
  if(!BOT)return reply(res,503,{error:'Telegram не настроен'});
  const signed=String(req.headers['x-telegram-init-data']||'');
  const owner=validateTelegramMiniApp(signed,BOT);
  if(!owner?.id)return reply(res,401,{error:'Открой VETOGRAM через свой Telegram'});
  if(req.headers['x-vetogram-ai-consent']!=='yes')return reply(res,403,{error:'Для AI-запроса нужно явно разрешить передачу текста'});
  if(process.env.VETOGRAM_AI_ENABLED!=='true')return reply(res,503,{error:'VETOGRAM AI ещё не включён администратором'});
  const provider=providerConfig();
  if(!provider)return reply(res,503,{error:'AI-провайдер ещё не подключён'});
  let parsed;
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(JSON.stringify(body||{}).length>12500)throw Error('AI_INPUT_TOO_LARGE');
    parsed=normalizeAiInput(body);
  }catch(error){return reply(res,400,{error:String(error.message||'AI_INPUT_INVALID')})}
  // This endpoint never opens Telegram conversations or invokes a send action.
  // Only explicitly supplied text is passed to the model. No OTP, session or user ID.
  const instruction=systemInstruction(parsed.mode);
  const history=parsed.history;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),17000);
  try{
    let output='';
    if(provider.provider==='gemini'){
      const contents=[...history.map(row=>({role:row.role==='assistant'?'model':'user',parts:[{text:row.text}]})),{role:'user',parts:[{text:parsed.prompt}]}];
      const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':provider.key},
        body:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},contents,generationConfig:{maxOutputTokens:700,temperature:0.45}}),
        signal:controller.signal
      });
      if(!response.ok)throw Error('AI_PROVIDER_UNAVAILABLE');
      const result=await response.json();
      output=(result?.candidates?.[0]?.content?.parts||[]).map(part=>part.text||'').join('');
    }else{
      const input=[{role:'developer',content:instruction},...history.map(row=>({role:row.role,content:row.text})),{role:'user',content:parsed.prompt}];
      const response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+provider.key},
        body:JSON.stringify({model:process.env.VETOGRAM_OPENAI_MODEL||'gpt-4.1-mini',input,max_output_tokens:700}),
        signal:controller.signal
      });
      if(!response.ok)throw Error('AI_PROVIDER_UNAVAILABLE');
      const result=await response.json();
      output=result?.output_text|| (result?.output||[]).flatMap(item=>item.content||[]).map(item=>item.text||'').join('');
    }
    const answer=normalizeAiOutput(parsed.mode,output);
    return reply(res,200,{...answer,mode:parsed.mode,provider:provider.provider,
      sent:false,published:false,requiresOwnerApproval:true});
  }catch(error){
    // Never log prompts, responses, provider keys, Telegram signed initData, or IDs.
    const unavailable=error?.name==='AbortError'?'AI не успел ответить. Попробуй снова.':'AI сейчас недоступен или вернул неподходящий ответ.';
    return reply(res,503,{error:unavailable});
  }finally{clearTimeout(timeout)}
}
