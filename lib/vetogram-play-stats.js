import crypto from 'node:crypto';

const PLAYER_PATTERN=/^\d{1,20}$/;
const ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const sanitizePlayer=id=>{
  const value=String(id||'');
  if(!PLAYER_PATTERN.test(value))throw new Error('Invalid authenticated player');
  return value;
};
export function generatePlayAlias(randomBytes=crypto.randomBytes){
  const bytes=randomBytes(10);
  if(!bytes||bytes.length!==10)throw new Error('Invalid random alias entropy');
  return 'VP-'+Array.from(bytes,b=>ALPHABET[b&31]).join('');
}
export function personalResult(row,userId){
  const id=sanitizePlayer(userId);
  const seat=String(row.x_player_id)===id?'X':String(row.o_player_id)===id?'O':null;
  if(!seat)return null;
  return {
    round:Number(row.round),
    seat,
    result:row.winner==='draw'?'draw':row.winner===seat?'win':'loss',
    finalBoard:String(row.final_board),
    finishedAt:row.finished_at,
    // The room code and both players' Telegram IDs stay server-private.
  };
}
const asCount=value=>Math.max(0,Number.isFinite(Number(value))?Number(value):0);
export function summarizeCounts(row={}){
  const games=asCount(row.games);
  const wins=asCount(row.wins);
  const draws=asCount(row.draws);
  return {games,wins,draws,losses:Math.max(0,games-wins-draws),points:wins*3+draws};
}
export function leaderboardRow(row){
  return {
    alias:String(row.public_alias),
    ...summarizeCounts(row),
  };
}
export function playStatsStore(sql,{randomBytes=crypto.randomBytes}={}){
  if(typeof sql!=='function')throw new TypeError('SQL client required');
  async function ensureProfile(playerId){
    const id=sanitizePlayer(playerId);
    for(let i=0;i<3;i++){
      const alias=generatePlayAlias(randomBytes);
      const created=await sql`INSERT INTO vetogram_play_profiles (player_id,public_alias)
        VALUES (${id},${alias}) ON CONFLICT DO NOTHING
        RETURNING public_alias,leaderboard_visible`;
      if(created[0])return created[0];
      const existing=await sql`SELECT public_alias,leaderboard_visible
        FROM vetogram_play_profiles WHERE player_id=${id} LIMIT 1`;
      if(existing[0])return existing[0];
    }
    throw new Error('Cannot allocate profile alias');
  }
  async function myStats(userId){
    const id=sanitizePlayer(userId);
    const profile=await ensureProfile(id);
    const summary=await sql`SELECT count(*)::integer AS games,
        count(*) FILTER (WHERE
          (x_player_id=${id} AND winner='X')
          OR (o_player_id=${id} AND winner='O')
        )::integer AS wins,
        count(*) FILTER (WHERE winner='draw')::integer AS draws
      FROM vetogram_play_ttt_results
      WHERE x_player_id=${id} OR o_player_id=${id}`;
    const history=await sql`SELECT round,x_player_id,o_player_id,winner,final_board,finished_at
      FROM vetogram_play_ttt_results
      WHERE x_player_id=${id} OR o_player_id=${id}
      ORDER BY finished_at DESC,room_code DESC,round DESC LIMIT 20`;
    return {
      profile:{alias:String(profile.public_alias),leaderboardVisible:profile.leaderboard_visible===true},
      stats:summarizeCounts(summary[0]),
      history:history.map(row=>personalResult(row,id)).filter(Boolean),
    };
  }
  async function setVisibility(userId,visible){
    const id=sanitizePlayer(userId);
    if(typeof visible!=='boolean')throw new Error('Visibility must be boolean');
    await ensureProfile(id);
    const updated=await sql`UPDATE vetogram_play_profiles
      SET leaderboard_visible=${visible}
      WHERE player_id=${id}
      RETURNING public_alias,leaderboard_visible`;
    if(!updated[0])throw new Error('Profile not available');
    return {alias:String(updated[0].public_alias),leaderboardVisible:updated[0].leaderboard_visible===true};
  }
  async function leaders(){
    // Public ranking only includes opted-in aliases, never Telegram IDs.
    // 3 verified completed rounds required to discourage accidental exposure.
    const rows=await sql`SELECT p.public_alias,
      count(*)::integer AS games,
      count(*) FILTER (WHERE
        (r.x_player_id=p.player_id AND r.winner='X') OR
        (r.o_player_id=p.player_id AND r.winner='O')
      )::integer AS wins,
      count(*) FILTER (WHERE r.winner='draw')::integer AS draws
      FROM vetogram_play_profiles p
      JOIN vetogram_play_ttt_results r
        ON r.x_player_id=p.player_id OR r.o_player_id=p.player_id
      WHERE p.leaderboard_visible=true
      GROUP BY p.player_id,p.public_alias
      HAVING count(*)>=3
      ORDER BY (3*count(*) FILTER (WHERE
        (r.x_player_id=p.player_id AND r.winner='X') OR
        (r.o_player_id=p.player_id AND r.winner='O')
      )+count(*) FILTER (WHERE r.winner='draw')) DESC,
        count(*) FILTER (WHERE
        (r.x_player_id=p.player_id AND r.winner='X') OR
        (r.o_player_id=p.player_id AND r.winner='O')) DESC,
        p.public_alias ASC LIMIT 20`;
    return rows.map(leaderboardRow);
  }
  return {myStats,setVisibility,leaders,ensureProfile};
}
export async function configuredPlayStatsStore(){
  const connectionString=String(process.env.VETOGRAM_PLAY_DATABASE_URL||'').trim();
  if(!connectionString)return null;
  if(!/^postgres(ql)?:\/\//.test(connectionString))throw new Error('Invalid Play database configuration');
  const {neon}=await import('@neondatabase/serverless');
  return playStatsStore(neon(connectionString));
}
