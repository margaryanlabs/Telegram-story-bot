import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import api from '../api/music-library.js';
import webhook from '../api/webhook-v7.js';
import {incomingMusic,ownerTrack,trackId} from '../lib/vetogram-music-library.js';
import {createMusicStore} from '../music-bot/library.mjs';
const token='universe-local-test-token';
function signed(id,date=Math.floor(Date.now()/1000)){
 const p=new URLSearchParams({auth_date:String(date),query_id:'test',user:JSON.stringify({id,first_name:'Test'})});
 const data=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();
 p.set('hash',crypto.createHmac('sha256',secret).update(data).digest('hex'));return p.toString();
}
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.value=value;return this;},send(value){this.value=value;return this;}};}
const audio=(n,size=100)=>({file_id:'file-'+n,file_unique_id:'unique-'+n,file_name:'owned.m4a',mime_type:'audio/mp4',title:'Мой трек '+n,performer:'Мой исполнитель',duration:12,file_size:size,thumbnail:{file_id:'cover-'+n}});
const update=(id,content)=>({message:{chat:{id,type:'private'},from:{id,is_bot:false},message_id:7,...content}});
async function fixture(work){
 const directory=await mkdtemp(join(tmpdir(),'universe-library-'));
 const previous={token:process.env.TELEGRAM_BOT_TOKEN,path:process.env.VETOGRAM_MUSIC_STORE_PATH,vercel:process.env.VERCEL,fetch:globalThis.fetch};
 process.env.TELEGRAM_BOT_TOKEN=token;process.env.VETOGRAM_MUSIC_STORE_PATH=directory;delete process.env.VERCEL;
 const store=createMusicStore({directory});
 async function call(body,method='POST'){const res=response();await api({method,body,headers:{}},res);return res;}
 try{return await work({store,call,directory});}finally{
  globalThis.fetch=previous.fetch;
  for(const [key,val]of [['TELEGRAM_BOT_TOKEN',previous.token],['VETOGRAM_MUSIC_STORE_PATH',previous.path],['VERCEL',previous.vercel]])if(val===undefined)delete process.env[key];else process.env[key]=val;
  await rm(directory,{recursive:true,force:true});
 }
}
test('incoming audio/documents are strictly private, sender-bound MP3/M4A records',()=>{
 assert.equal(incomingMusic(update(11,{audio:audio(1)})).owner,11);
 assert.ok(incomingMusic(update(11,{document:audio(2)})));
 assert.equal(incomingMusic(update(11,{document:{...audio(2),file_name:'bad.exe'}})),null);
 assert.equal(incomingMusic({...update(11,{audio:audio(1)}),message:{...update(11,{audio:audio(1)}).message,chat:{id:22,type:'private'}}}),null);
 assert.equal(incomingMusic({business_message:update(11,{audio:audio(1)}).message}),null);
 assert.equal(incomingMusic(update(11,{audio:{...audio(1),mime_type:'video/mp4'}})),null);
});
test('auth rejects missing, forged, expired and caller-supplied owners before any network access',()=>fixture(async({call})=>{
 let requests=0;globalThis.fetch=async()=>{requests++;throw Error('must not fetch');};
 assert.equal((await call({action:'list',user_id:11})).code,401);
 assert.equal((await call({action:'list',initData:signed(11).replace('Test','Forged')})).code,401);
 assert.equal((await call({action:'list',initData:signed(11,Math.floor(Date.now()/1000)-7200)})).code,401);
 assert.equal((await call({},'GET')).code,405);assert.equal(requests,0);
}));
test('library response exposes only owner metadata and never Telegram file IDs or download tokens',()=>fixture(async({store,call})=>{
 await store.add(11,audio(1));await store.add(22,audio(2));
 const res=await call({action:'list',initData:signed(11),user_id:22});
 assert.equal(res.code,200);assert.equal(res.value.total,1);assert.equal(res.value.tracks[0].title,'Мой трек 1');
 assert.equal(res.value.tracks[0].hasArtwork,true);assert.equal(res.value.tracks[0].downloadable,true);
 assert.doesNotMatch(JSON.stringify(res.value),/file-1|unique-1|cover-1|universe-local-test-token/);
 assert.match(res.headers['Cache-Control'],/no-store/);
}));
test('stable opaque IDs remain valid after reordering; another owner cannot use one',()=>fixture(async({store})=>{
 await store.add(11,audio(1));const id=trackId(await store.get(11,1));await store.add(11,audio(2));
 assert.equal((await ownerTrack(store,11,id)).file_id,'file-1');assert.equal(await ownerTrack(store,22,id),null);
 assert.equal(await ownerTrack(store,11,'../../22.json'),null);
}));
test('streaming requires ownership and server-resolved file ID, preserves M4A content type',()=>fixture(async({store,call})=>{
 await store.add(11,audio(1));const id=trackId(await store.get(11,1));let requests=0;
 globalThis.fetch=async(url,options)=>{requests++;if(url.endsWith('/getFile')){assert.equal(JSON.parse(options.body).file_id,'file-1');return Response.json({ok:true,result:{file_path:'music/file.m4a',file_size:3}});}return new Response(new Uint8Array([1,2,3]));};
 assert.equal((await call({action:'stream',initData:signed(22),id,user_id:11,file_id:'file-1'})).code,404);assert.equal(requests,0);
 const res=await call({action:'stream',initData:signed(11),id,file_id:'other-file'});
 assert.equal(res.code,200);assert.deepEqual([...res.value],[1,2,3]);assert.equal(res.headers['Content-Type'],'audio/mp4');assert.equal(requests,2);
}));
test('thumbnail lookup is owner-bound and keeps bot credentials off the client',()=>fixture(async({store,call})=>{
 await store.add(11,audio(1));const id=trackId(await store.get(11,1));
 globalThis.fetch=async(url,options)=>url.endsWith('/getFile')?(assert.equal(JSON.parse(options.body).file_id,'cover-1'),Response.json({ok:true,result:{file_path:'photos/cover.jpg',file_size:3}})):new Response(new Uint8Array([255,216,255]));
 const res=await call({action:'artwork',initData:signed(11),id});assert.equal(res.code,200);assert.equal(res.headers['Content-Type'],'image/jpeg');
}));
test('large audio, serverless storage and upstream failure cannot claim a playable track',()=>fixture(async({store,call})=>{
 await store.add(11,audio(1,21*1024*1024));const id=trackId(await store.get(11,1));
 const list=await call({action:'list',initData:signed(11)});assert.equal(list.value.tracks[0].downloadable,false);
 assert.equal((await call({action:'stream',initData:signed(11),id})).code,413);
 process.env.VERCEL='1';assert.equal((await call({action:'list',initData:signed(11)})).code,503);delete process.env.VERCEL;
 await store.add(11,audio(2));const other=trackId(await store.get(11,1));globalThis.fetch=async()=>{throw Error('private URL must not leak');};
 const failed=await call({action:'stream',initData:signed(11),id:other});assert.equal(failed.code,502);assert.doesNotMatch(JSON.stringify(failed.value),/private URL/);
}));
test('existing webhook saves private audio exactly once and does not accept unauthenticated updates',()=>fixture(async({store})=>{
 let requests=0;globalThis.fetch=async()=>{requests++;return Response.json({ok:true,result:{message_id:8}});};
 const message=update(11,{audio:audio(1)}),secret=crypto.createHash('sha256').update(token).digest('hex').slice(0,32);
 const denied=response();await webhook({method:'POST',headers:{},body:message},denied);assert.equal(denied.code,401);assert.equal(requests,0);
 for(let n=0;n<2;n++){const res=response();await webhook({method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:message},res);assert.equal(res.code,200);assert.equal(res.value.music_saved,true);}
 assert.equal((await store.list(11)).total,1);assert.equal((await store.list(22)).total,0);assert.equal(requests,2);
}));
