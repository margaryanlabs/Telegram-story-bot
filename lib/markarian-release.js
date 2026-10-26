/** Self-reported build identity. This is never independent image attestation. */
export function vetogramStagingMarker(env=process.env){
 if(env.MARKARIAN_RELEASE_ENABLED!=='staging-only'||
    env.MARKARIAN_ENVIRONMENT!=='staging'||
    !/^[a-f0-9]{40}$/.test(env.MARKARIAN_SOURCE_SHA||''))return null;
 return {schema:'markarian-app-release/v1',environment:'staging',
  product:'vetogram',repository:'margaryanlabs/Telegram-story-bot',
  commit:env.MARKARIAN_SOURCE_SHA};
}
