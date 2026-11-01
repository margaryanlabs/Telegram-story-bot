import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newRoomCode, validRoomCode, normalizeRoomCode, makeRoom,
  gameResult, validateGameState, roomView, joinRoom, applyMove, requestRematch,
} from '../lib/vetogram-play-room-core.js';

const FIXED=Date.UTC(2026,9,31,10,0,0);
const HOST='123456789';
const GUEST='456789123';

test('room codes contain 8 unbiased alphabet characters and normalize user entry',()=>{
  const code=newRoomCode(()=>Buffer.from([0,1,2,3,30,31,255,128]));
  assert.equal(code.length,8);
  assert.ok(validRoomCode(code));
  assert.equal(normalizeRoomCode('  '+code.toLowerCase().slice(0,4)+'-'+code.slice(4)+'  '),code);
  assert.equal(validRoomCode('ABCD'),false);
  assert.equal(validRoomCode('INVALID!'),false);
  assert.throws(()=>newRoomCode(()=>Buffer.alloc(7)),/entropy/);
});
test('new room belongs only to creator and expires after six hours',()=>{
  const room=makeRoom(HOST,'ABCD2345',FIXED);
  assert.equal(room.status,'waiting');
  assert.equal(room.board,'.........');
  assert.equal(room.turn,'X');
  assert.equal(validateGameState(room),true);
  assert.equal(roomView(room,HOST,FIXED).seat,'X');
  assert.equal(roomView(room,GUEST,FIXED),null);
  assert.equal(roomView(room,HOST,FIXED+6*3600*1000).status,'expired');
  assert.throws(()=>makeRoom('fake','ABCD2345',FIXED),/player/);
});
test('second player joins exactly once and owner can reconnect',()=>{
  const room=makeRoom(HOST,'ABCD2345',FIXED);
  const first=joinRoom(room,GUEST,FIXED+1000);
  assert.equal(first.ok,true);
  assert.equal(first.room.status,'active');
  assert.equal(first.room.version,1);
  assert.equal(validateGameState(first.room),true);
  assert.equal(joinRoom(first.room,GUEST,FIXED+1000).ok,true);
  assert.equal(joinRoom(first.room,HOST,FIXED+1000).ok,true);
  assert.deepEqual(joinRoom(first.room,'789123456',FIXED+1000),{ok:false,error:'full'});
});
test('server enforces turn ownership, occupied cells and spectator privacy',()=>{
  const active=joinRoom(makeRoom(HOST,'ABCD2345',FIXED),GUEST,FIXED).room;
  assert.deepEqual(applyMove(active,GUEST,0,FIXED),{ok:false,error:'not_your_turn'});
  assert.deepEqual(applyMove(active,'99999999',0,FIXED),{ok:false,error:'not_found'});
  assert.deepEqual(applyMove(active,HOST,-1,FIXED),{ok:false,error:'invalid_move'});
  const first=applyMove(active,HOST,0,FIXED);
  assert.equal(first.ok,true);
  assert.equal(first.room.board,'X........');
  assert.equal(first.room.turn,'O');
  assert.equal(first.room.version,2);
  assert.equal(validateGameState(first.room),true);
  assert.deepEqual(applyMove(first.room,GUEST,0,FIXED),{ok:false,error:'occupied'});
  assert.deepEqual(applyMove(first.room,HOST,1,FIXED),{ok:false,error:'not_your_turn'});
  assert.equal(roomView(first.room,'111111111',FIXED),null);
});
test('X wins legitimately and no moves are accepted after game ends',()=>{
  let room=joinRoom(makeRoom(HOST,'ABCD2345',FIXED),GUEST,FIXED).room;
  const sequence=[[HOST,0],[GUEST,3],[HOST,1],[GUEST,4],[HOST,2]];
  for(const [user,cell] of sequence){
    const result=applyMove(room,user,cell,FIXED);
    assert.equal(result.ok,true,result.error);
    room=result.room;
    assert.equal(validateGameState(room),true);
  }
  assert.equal(room.board,'XXXOO....');
  assert.equal(room.status,'finished');
  assert.equal(room.winner,'X');
  assert.equal(gameResult(room.board),'X');
  assert.deepEqual(applyMove(room,GUEST,5,FIXED),{ok:false,error:'not_active'});
});
test('draw is represented as finished without fake victory',()=>{
  let room=joinRoom(makeRoom(HOST,'ABCD2345',FIXED),GUEST,FIXED).room;
  const cells=[0,1,2,4,3,5,7,6,8];
  for(let i=0;i<cells.length;i++){
    const r=applyMove(room,i%2?GUEST:HOST,cells[i],FIXED);
    assert.equal(r.ok,true,r.error);
    room=r.room;
  }
  assert.equal(room.status,'finished');
  assert.equal(room.winner,'draw');
  assert.equal(gameResult(room.board),'draw');
});
test('corrupt board or simultaneous wins cannot be accepted',()=>{
  const room=joinRoom(makeRoom(HOST,'ABCD2345',FIXED),GUEST,FIXED).room;
  assert.equal(validateGameState({...room,board:'XXXOOO...',status:'finished',winner:'X'}),false);
  assert.equal(validateGameState({...room,board:'X..',status:'active'}),false);
  assert.equal(validateGameState({...room,board:'XX.......',turn:'O'}),false);
  assert.deepEqual(applyMove({...room,board:'XXXOOO...'},HOST,8,FIXED),{ok:false,error:'corrupt_state'});
});
test('expired room blocks new join or moves even if code is known',()=>{
  const room=makeRoom(HOST,'ABCD2345',FIXED);
  assert.deepEqual(joinRoom(room,GUEST,FIXED+6*3600*1000),{ok:false,error:'expired'});
  const active=joinRoom(room,GUEST,FIXED).room;
  assert.deepEqual(applyMove(active,HOST,0,FIXED+6*3600*1000),{ok:false,error:'expired'});
});

test('rematch requires BOTH players and next round switches starting side',()=>{
  let room=joinRoom(makeRoom(HOST,'ABCD2345',FIXED),GUEST,FIXED).room;
  for(const [user,cell] of [[HOST,0],[GUEST,3],[HOST,1],[GUEST,4],[HOST,2]]){
    const action=applyMove(room,user,cell,FIXED);
    assert.equal(action.ok,true,action.error);
    room=action.room;
  }
  const voted=requestRematch(room,HOST,FIXED);
  assert.equal(voted.ok,true);
  assert.equal(voted.room.status,'finished','first vote must NOT start a new game');
  assert.equal(roomView(voted.room,HOST,FIXED).rematchRequested,true);
  assert.equal(roomView(voted.room,GUEST,FIXED).opponentRequested,true);
  assert.equal(validateGameState(voted.room),true);
  assert.equal(requestRematch(voted.room,HOST,FIXED).unchanged,true,'duplicate proposal must be idempotent');

  const next=requestRematch(voted.room,GUEST,FIXED);
  assert.equal(next.ok,true);
  assert.equal(next.room.round,2);
  assert.equal(next.room.status,'active');
  assert.equal(next.room.board,'.........');
  assert.equal(next.room.turn,'X');
  assert.equal(next.room.winner,null);
  assert.equal(next.room.rematch_x,false);
  assert.equal(next.room.rematch_o,false);
  assert.equal(roomView(next.room,HOST,FIXED).seat,'O');
  assert.equal(roomView(next.room,GUEST,FIXED).seat,'X');
  assert.equal(applyMove(next.room,HOST,0,FIXED).error,'not_your_turn');
  const opening=applyMove(next.room,GUEST,4,FIXED);
  assert.equal(opening.ok,true);
  assert.equal(opening.room.board,'....X....');
  assert.equal(validateGameState(opening.room),true);
});
test('rematch is unavailable to spectators, before finish and after expiry',()=>{
  const waiting=makeRoom(HOST,'ABCD2345',FIXED);
  const active=joinRoom(waiting,GUEST,FIXED).room;
  assert.equal(requestRematch(active,HOST,FIXED).error,'not_finished');
  assert.equal(requestRematch(active,'987654321',FIXED).error,'not_found');
  let room=active;
  for(const [user,cell] of [[HOST,0],[GUEST,3],[HOST,1],[GUEST,4],[HOST,2]]){
    room=applyMove(room,user,cell,FIXED).room;
  }
  assert.equal(requestRematch(room,HOST,FIXED+6*3600*1000).error,'expired');
  assert.equal(validateGameState({...room,rematch_x:true,rematch_o:true}),false);
});
