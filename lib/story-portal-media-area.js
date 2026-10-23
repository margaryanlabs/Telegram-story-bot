import {decodePublicPortal} from '../public/story-portal-share.js';

// Clickable Telegram Story regions may only link to this deployment's
// stateless, explicitly shared /portal.html page. No arbitrary external links.
export const PORTAL_STORY_MAX_URL_LENGTH=1900;
export function validateStoryPortalLink(input,{host,now=Date.now()}={}){
  if(input===undefined || input===null || input==='')return null;
  if(typeof input!=='string' || input.length>PORTAL_STORY_MAX_URL_LENGTH)
    throw Error('STORY_PORTAL_LINK_TOO_LONG');
  let url;
  try{url=new URL(input)}catch{throw Error('STORY_PORTAL_LINK_INVALID')}
  const expected=String(host||'').trim().toLowerCase();
  if(!expected || !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/.test(expected))
    throw Error('STORY_PORTAL_ORIGIN_INVALID');
  const local=expected==='localhost'||expected.startsWith('localhost:');
  if((url.protocol!=='https:' && !(local&&url.protocol==='http:')) ||
     url.host.toLowerCase()!==expected ||
     url.username || url.password || url.pathname!=='/portal.html' ||
     url.search || !url.hash.startsWith('#p='))
    throw Error('STORY_PORTAL_LINK_INVALID');
  // URL fragments are unsigned public cards; check contents + lifetime but
  // never pretend server authentication or revocation exists here.
  try{decodePublicPortal(url.hash,now)}
  catch{throw Error('STORY_PORTAL_LINK_INVALID_OR_EXPIRED')}
  return url.toString();
}
export function buildPortalStoryArea(url){
  if(!url)return [];
  return [{position:{
    x_percentage:50,y_percentage:88.5,
    width_percentage:58,height_percentage:6,
    rotation_angle:0,corner_radius_percentage:8
  },type:{type:'link',url}}];
}
