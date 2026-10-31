import { newRoomCode, makeRoom, joinRoom as joinState, applyMove, normalizeRoomCode, validRoomCode, roomView } from './vetogram-play-room-core.js';

// Uses parameterized Neon queries only. Each request is stateless; mutation
// must pass a version compare-and-swap to prevent double joins and double turns.
export function playRoomStore(sql,{now=()=>Date.now(),codeGenerator=newRoomCode}={}) {
  if(typeof sql!=='function')throw new TypeError('Neon query function required');
  const load=async code=>{
    const rows=await sql`SELECT code,owner_id,guest_id,board,turn,status,winner,version,created_at,expires_at
      FROM vetogram_play_ttt_rooms WHERE code=${code} LIMIT 1`;
    return rows[0]||null;
  };
  return {
    load,
    async create(userId) {
      // Simple abuse bound. Must be supplemented by edge rate limiting.
      const existing=await sql`SELECT count(*)::integer AS n FROM vetogram_play_ttt_rooms
        WHERE owner_id=${String(userId)} AND expires_at > now()`;
      if(Number(existing[0]?.n||0)>=5)return {ok:false,error:'too_many_rooms'};
      for(let attempt=0;attempt<5;attempt++) {
        const room=makeRoom(userId,codeGenerator(),now());
        const rows=await sql`INSERT INTO vetogram_play_ttt_rooms
        (code,owner_id,guest_id,board,turn,status,winner,version,created_at,expires_at)
        VALUES (${room.code},${room.owner_id},NULL,${room.board},${room.turn},${room.status},NULL,0,${room.created_at},${room.expires_at})
        ON CONFLICT (code) DO NOTHING RETURNING code,owner_id,guest_id,board,turn,status,winner,version,created_at,expires_at`;
        if(rows[0])return {ok:true,room:roomView(rows[0],userId,now())};
      }
      return {ok:false,error:'retry'};
    },
    async view(code,userId) {
      const room=await load(normalizeRoomCode(code));
      const view=roomView(room,userId,now());
      return view?{ok:true,room:view}:{ok:false,error:'not_found'};
    },
    async join(code,userId) {
      const normalized=normalizeRoomCode(code);
      if(!validRoomCode(normalized))return {ok:false,error:'invalid_code'};
      const existing=await load(normalized);
      const joined=joinState(existing,userId,now());
      if(!joined.ok)return joined;
      if(joined.room===existing)return {ok:true,room:roomView(existing,userId,now())};
      const rows=await sql`UPDATE vetogram_play_ttt_rooms
        SET guest_id=${String(userId)},status='active',version=version+1,updated_at=now()
        WHERE code=${normalized} AND guest_id IS NULL AND status='waiting'
          AND owner_id <> ${String(userId)} AND version=${Number(existing.version)}
          AND expires_at > now()
        RETURNING code,owner_id,guest_id,board,turn,status,winner,version,created_at,expires_at`;
      return rows[0]?{ok:true,room:roomView(rows[0],userId,now())}:{ok:false,error:'conflict'};
    },
    async move(code,userId,cell,expectedVersion) {
      const normalized=normalizeRoomCode(code);
      if(!validRoomCode(normalized))return {ok:false,error:'invalid_code'};
      if(!Number.isInteger(expectedVersion)||expectedVersion<0)return {ok:false,error:'invalid_version'};
      const existing=await load(normalized);
      if(!existing||Number(existing.version)!==expectedVersion)return {ok:false,error:'conflict'};
      const moved=applyMove(existing,userId,cell,now());
      if(!moved.ok)return moved;
      const next=moved.room;
      const rows=await sql`UPDATE vetogram_play_ttt_rooms
        SET board=${next.board},turn=${next.turn},status=${next.status},winner=${next.winner},
          version=version+1,updated_at=now()
        WHERE code=${normalized} AND version=${expectedVersion}
          AND status='active' AND expires_at > now()
        RETURNING code,owner_id,guest_id,board,turn,status,winner,version,created_at,expires_at`;
      return rows[0]?{ok:true,room:roomView(rows[0],userId,now())}:{ok:false,error:'conflict'};
    },
  };
}

export async function configuredPlayRoomStore() {
  const connectionString=String(process.env.VETOGRAM_PLAY_DATABASE_URL||'').trim();
  if(!connectionString)return null;
  if(!/^postgres(ql)?:\/\//.test(connectionString))throw new Error('Invalid Play database configuration');
  const { neon }=await import('@neondatabase/serverless');
  return playRoomStore(neon(connectionString));
}
