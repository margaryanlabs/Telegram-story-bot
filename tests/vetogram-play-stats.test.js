import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  generatePlayAlias,personalResult,summarizeCounts,playStatsStore,
} from '../lib/vetogram-play-stats.js';

const HOST='123456789',GUEST='456789123';
const finished=[
  {room_code:'ABCD2345',round:1,x_player_id:HOST,o_player_id:GUEST,winner:'X',
    final_board:'XXXOO....',finished_at:'2026-11-01T00:00:00.000Z'},
  {room_code:'ABCD2345',round:2,x_player_id:GUEST,o_player_id:HOST,winner:'draw',
    final_board:'XOXOOXXXO',finished_at:'2026-11-01T00:05:00.000Z'},
  {room_code:'ABCD2346',round:1,x_player_id:HOST,o_player_id:GUEST,winner:'O',
    final_board:'XX.OOOXX.',finished_at:'2026-11-01T00:10:00.000Z'},
];
function fakeDatabase(){
  const profiles=new Map();
  const executed=[];
  const sql=async(strings,...vals)=>{
    const q=strings.join('?').replace(/\s+/g,' ').trim();
    executed.push({q,vals});
    if(q.startsWith('INSERT INTO vetogram_play_profiles')){
      const [id,alias]=vals;
      if(profiles.has(id)||[...profiles.values()].some(p=>p.public_alias===alias))return [];
      const value={public_alias:alias,leaderboard_visible:false};
      profiles.set(id,value);
      return [{...value}];
    }
    if(q.startsWith('SELECT public_alias,leaderboard_visible')){
      const record=profiles.get(vals[0]);return record?[{...record}]:[];
    }
    if(q.startsWith('UPDATE vetogram_play_profiles')){
      const [visible,id]=vals;const record=profiles.get(id);
      if(!record)return [];
      record.leaderboard_visible=visible;return [{...record}];
    }
    if(q.startsWith('SELECT count(*)::integer AS games')){
      const id=vals[0];
      const filtered=finished.filter(r=>r.x_player_id===id||r.o_player_id===id);
      return [{games:filtered.length,wins:filtered.filter(r=>r.winner!=='draw'&&
        ((r.x_player_id===id&&r.winner==='X')||(r.o_player_id===id&&r.winner==='O'))).length,
      draws:filtered.filter(r=>r.winner==='draw').length}];
    }
    if(q.startsWith('SELECT round,x_player_id')){
      const id=vals[0];
      return finished.filter(r=>r.x_player_id===id||r.o_player_id===id).slice().reverse();
    }
    if(q.startsWith('SELECT p.public_alias')){
      return [...profiles.entries()].filter(([,p])=>p.leaderboard_visible).map(([id,p])=>{
        const filtered=finished.filter(r=>r.x_player_id===id||r.o_player_id===id);
        const wins=filtered.filter(r=>r.winner!=='draw'&&
          ((r.x_player_id===id&&r.winner==='X')||(r.o_player_id===id&&r.winner==='O'))).length;
        return {...p,games:filtered.length,wins,draws:filtered.filter(r=>r.winner==='draw').length};
      }).filter(p=>p.games>=3).sort((a,b)=>(b.wins*3+b.draws)-(a.wins*3+a.draws));
    }
    throw new Error('Unexpected SQL '+q);
  };
  return {sql,profiles,executed};
}
test('private alias is random and does not derive from Telegram ID',()=>{
  const alias=generatePlayAlias(()=>Buffer.from([0,1,2,3,4,5,6,7,8,9]));
  assert.match(alias,/^VP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/);
  assert.equal(alias.includes(HOST),false);
});
test('personal match records have no opponent identity or secret room code',()=>{
  const row=personalResult(finished[0],HOST);
  assert.equal(row.result,'win');
  assert.equal(row.seat,'X');
  assert.equal(Object.hasOwn(row,'x_player_id'),false);
  assert.equal(Object.hasOwn(row,'room_code'),false);
  assert.equal(personalResult(finished[0],'55555'),null);
  assert.deepEqual(summarizeCounts({games:3,wins:1,draws:1}),{
    games:3,wins:1,draws:1,losses:1,points:4
  });
});
test('private profile starts hidden; server aggregates only completed results',async()=>{
  const db=fakeDatabase();
  const stats=playStatsStore(db.sql,{randomBytes:()=>Buffer.from([0,1,2,3,4,5,6,7,8,9])});
  const mine=await stats.myStats(HOST);
  assert.equal(mine.profile.leaderboardVisible,false);
  assert.equal(mine.stats.games,3);
  assert.equal(mine.stats.wins,1);
  assert.equal(mine.stats.draws,1);
  assert.equal(mine.stats.losses,1);
  assert.equal(mine.stats.points,4);
  assert.equal(mine.history.length,3);
  assert.ok(mine.history.every(r=>!('room_code' in r)&&!('x_player_id' in r)));
  assert.deepEqual(await stats.leaders(),[],'hidden profiles must not appear');
});
test('public leaderboard requires explicit opt-in and can be revoked',async()=>{
  const db=fakeDatabase();
  const store=playStatsStore(db.sql,{randomBytes:()=>Buffer.from([0,1,2,3,4,5,6,7,8,9])});
  await store.myStats(HOST);
  const enabled=await store.setVisibility(HOST,true);
  assert.equal(enabled.leaderboardVisible,true);
  const entries=await store.leaders();
  assert.equal(entries.length,1);
  assert.equal(entries[0].points,4);
  assert.equal(entries[0].alias,enabled.alias);
  assert.equal(Object.hasOwn(entries[0],'player_id'),false);
  const hidden=await store.setVisibility(HOST,false);
  assert.equal(hidden.leaderboardVisible,false);
  assert.deepEqual(await store.leaders(),[]);
});
test('visibility cannot be set without boolean or signed player identity',async()=>{
  const db=fakeDatabase(),store=playStatsStore(db.sql,{randomBytes:()=>Buffer.alloc(10)});
  await assert.rejects(()=>store.setVisibility(HOST,'true'),/boolean/);
  await assert.rejects(()=>store.myStats('not telegram id'),/Invalid authenticated player/);
});
test('UI and API provide no fake entries or client-reported wins',()=>{
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  const client=readFileSync(new URL('../public/vetogram-play-stats.js',import.meta.url),'utf8');
  const api=readFileSync(new URL('../api/play-stats.js',import.meta.url),'utf8');
  const store=readFileSync(new URL('../lib/vetogram-play-room-store.js',import.meta.url),'utf8');
  assert.match(html,/id="vpLeaderboardConsent"/);
  assert.match(html,/vetogram-play-stats\.js/);
  assert.match(api,/validateTelegramMiniApp/);
  assert.match(store,/WITH advanced AS \(/);
  assert.match(store,/INSERT INTO vetogram_play_ttt_results/);
  assert.doesNotMatch(client,/telegram-chats|sendMessage|document\.cookie|localStorage\.setItem/);
});
