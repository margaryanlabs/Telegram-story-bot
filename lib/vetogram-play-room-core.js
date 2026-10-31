import crypto from 'node:crypto';

// Server-authoritative Tic-Tac-Toe. Never trust client-side boards or results.
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const CODE_ALPHABET='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_PATTERN=/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;
const EXPIRES_MS=6*60*60*1000;

export function newRoomCode(randomBytes=crypto.randomBytes) {
  // Alphabet is 32 chars: every random byte's five low bits are unbiased.
  const bytes=randomBytes(8);
  if(!bytes || bytes.length!==8)throw new Error('Unreliable room code entropy');
  return Array.from(bytes,b=>CODE_ALPHABET[b&31]).join('');
}
export function validRoomCode(value) {
  return typeof value==='string' && CODE_PATTERN.test(value);
}
export function normalizeRoomCode(value) {
  return String(value||'').trim().toUpperCase().replace(/[\s-]/g,'');
}
export function gameResult(board) {
  if(typeof board!=='string'||!/^[XO.]{9}$/.test(board))throw new Error('Invalid game board');
  for(const [a,b,c] of LINES) {
    if(board[a]!=='.'&&board[a]===board[b]&&board[a]===board[c])return board[a];
  }
  return board.includes('.')?null:'draw';
}
export function validateGameState(state) {
  const board=String(state.board||'');
  if(!/^[XO.]{9}$/.test(board))return false;
  const x=(board.match(/X/g)||[]).length;
  const o=(board.match(/O/g)||[]).length;
  if(x!==o&&x!==o+1)return false;
  const xWins=LINES.some(([a,b,c])=>board[a]==='X'&&board[a]===board[b]&&board[a]===board[c]);
  const oWins=LINES.some(([a,b,c])=>board[a]==='O'&&board[a]===board[b]&&board[a]===board[c]);
  if(xWins&&oWins)return false;
  if(xWins&&x!==o+1)return false;
  if(oWins&&x!==o)return false;
  if(state.turn!==(x===o?'X':'O'))return false;
  const result=gameResult(board);
  const expectedResult=result===null?'active':'finished';
  if(state.status=== 'waiting')return board==='.........'&&state.turn==='X'&&!state.guest_id&&!state.winner;
  if(state.status!==expectedResult)return false;
  if(state.status==='active' && !state.guest_id)return false;
  return state.winner===(result||null);
}
export function makeRoom(userId,code,now=Date.now()) {
  if(!validRoomCode(code))throw new Error('Invalid room code');
  if(!/^\d{1,20}$/.test(String(userId||'')))throw new Error('Invalid player');
  return {
    code,owner_id:String(userId),guest_id:null,board:'.........',turn:'X',
    status:'waiting',winner:null,version:0,
    created_at:new Date(now).toISOString(),expires_at:new Date(now+EXPIRES_MS).toISOString(),
  };
}
export function roomView(room,userId,now=Date.now()) {
  if(!room||![room.owner_id,room.guest_id].includes(String(userId)))return null;
  return {
    code:room.code,
    seat:String(userId)===String(room.owner_id)?'X':'O',
    guestJoined:Boolean(room.guest_id),
    board:room.board,
    turn:room.turn,
    status:new Date(room.expires_at).getTime()<=now?'expired':room.status,
    winner:room.winner,
    version:Number(room.version),
    expiresAt:room.expires_at,
  };
}
export function joinRoom(room,userId,now=Date.now()) {
  if(!room||!validRoomCode(room.code))return {ok:false,error:'not_found'};
  if(new Date(room.expires_at).getTime()<=now)return {ok:false,error:'expired'};
  const viewer=String(userId);
  if(viewer===String(room.owner_id)||viewer===String(room.guest_id))return {ok:true,room};
  if(room.status!=='waiting'||room.guest_id)return {ok:false,error:'full'};
  return {ok:true,room:{...room,guest_id:viewer,status:'active',version:Number(room.version)+1}};
}
export function applyMove(room,userId,cell,now=Date.now()) {
  if(!room || ![room.owner_id,room.guest_id].includes(String(userId)))return {ok:false,error:'not_found'};
  if(new Date(room.expires_at).getTime()<=now)return {ok:false,error:'expired'};
  if(room.status!=='active'||!room.guest_id)return {ok:false,error:'not_active'};
  if(!validateGameState(room))return {ok:false,error:'corrupt_state'};
  const seat=String(userId)===String(room.owner_id)?'X':'O';
  if(seat!==room.turn)return {ok:false,error:'not_your_turn'};
  if(!Number.isInteger(cell)||cell<0||cell>8)return {ok:false,error:'invalid_move'};
  if(room.board[cell]!=='.')return {ok:false,error:'occupied'};
  const nextBoard=room.board.slice(0,cell)+seat+room.board.slice(cell+1);
  const outcome=gameResult(nextBoard);
  const updated={
    ...room,board:nextBoard,turn:seat==='X'?'O':'X',
    status:outcome?'finished':'active',winner:outcome||null,
    version:Number(room.version)+1,
  };
  return validateGameState(updated)?{ok:true,room:updated}:{ok:false,error:'corrupt_state'};
}
