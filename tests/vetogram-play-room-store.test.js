import test from 'node:test';
import assert from 'node:assert/strict';
import { playRoomStore } from '../lib/vetogram-play-room-store.js';

const FIXED=Date.UTC(2026,9,31,10,0);
const HOST='123456789',GUEST='456789123',CODE='ABCD2345';

function fakeNeon() {
  const rows=new Map();
  const statements=[];
  const sql=async (parts,...values)=>{
    const statement=parts.join('$?').replace(/\s+/g,' ').trim();
    statements.push({statement,values});
    if(statement.includes('SELECT count(*)::integer AS n')) {
      return [{n:[...rows.values()].filter(r=>r.owner_id===values[0]&&new Date(r.expires_at).getTime()>FIXED).length}];
    }
    if(statement.startsWith('SELECT code,owner_id,guest_id')) {
      const row=rows.get(values[0]);
      return row?[{...row}]:[];
    }
    if(statement.startsWith('INSERT INTO')) {
      const [code,owner_id,board,turn,status,created_at,expires_at]=values;
      if(rows.has(code))return [];
      const row={code,owner_id,guest_id:null,board,turn,status,winner:null,version:0,created_at,expires_at};
      rows.set(code,row);
      return [{...row}];
    }
    if(statement.startsWith('UPDATE vetogram_play_ttt_rooms')&&statement.includes('SET guest_id=')) {
      const [guestId,code,notOwner,version]=values;
      const row=rows.get(code);
      if(!row||row.guest_id||row.status!=='waiting'||row.owner_id===notOwner||row.version!==version)return [];
      row.guest_id=guestId;row.status='active';row.version+=1;
      return [{...row}];
    }
    if(statement.startsWith('UPDATE vetogram_play_ttt_rooms')&&statement.includes('SET board=')) {
      const [board,turn,status,winner,code,version]=values;
      const row=rows.get(code);
      if(!row||row.version!==version||row.status!=='active')return [];
      Object.assign(row,{board,turn,status,winner,version:row.version+1});
      return [{...row}];
    }
    throw new Error('Unexpected SQL: '+statement);
  };
  return {sql,rows,statements};
}

test('Neon adapter creates owner-scoped room, prevents spectator reads',async()=>{
  const fake=fakeNeon();
  const store=playRoomStore(fake.sql,{now:()=>FIXED,codeGenerator:()=>CODE});
  const created=await store.create(HOST);
  assert.equal(created.ok,true);
  assert.equal(created.room.seat,'X');
  assert.equal(created.room.status,'waiting');
  assert.deepEqual(await store.view(CODE,'999999999'),{ok:false,error:'not_found'});
  assert.equal((await store.view(CODE,HOST)).room.code,CODE);
});
test('Neon join respects authorization and rejects a second guest',async()=>{
  const fake=fakeNeon(),store=playRoomStore(fake.sql,{now:()=>FIXED,codeGenerator:()=>CODE});
  await store.create(HOST);
  assert.equal((await store.join(CODE,HOST)).room.seat,'X');
  const second=await store.join(CODE,GUEST);
  assert.equal(second.ok,true);
  assert.equal(second.room.seat,'O');
  assert.equal(second.room.status,'active');
  assert.equal((await store.join(CODE,'987654321')).error,'full');
  assert.equal((await store.view(CODE,GUEST)).room.guestJoined,true);
});
test('Neon move uses expected version to reject stale double turns',async()=>{
  const fake=fakeNeon(),store=playRoomStore(fake.sql,{now:()=>FIXED,codeGenerator:()=>CODE});
  await store.create(HOST);
  const joined=await store.join(CODE,GUEST);
  const expected=joined.room.version;
  const first=await store.move(CODE,HOST,0,expected);
  assert.equal(first.ok,true);
  assert.equal(first.room.board,'X........');
  assert.equal((await store.move(CODE,GUEST,1,expected)).error,'conflict');
  const second=await store.move(CODE,GUEST,1,first.room.version);
  assert.equal(second.ok,true);
  assert.equal(second.room.board,'XO.......');
  assert.equal((await store.move(CODE,HOST,1,second.room.version)).error,'occupied');
  assert.ok(fake.statements.some(x=>x.statement.includes('version=version+1')));
});
test('Neon store caps active room creation and never guesses a room code',async()=>{
  let n=0;
  const fake=fakeNeon(),store=playRoomStore(fake.sql,{now:()=>FIXED,codeGenerator:()=>{
    return ['ABCD2345','ABCD2346','ABCD2347','ABCD2348','ABCD2349','ABCD235A'][n++];
  }});
  for(let i=0;i<5;i++)assert.equal((await store.create(HOST)).ok,true);
  assert.equal((await store.create(HOST)).error,'too_many_rooms');
});
