import { createHash } from 'node:crypto';
import { createMusicStore, normalizeAudio } from '../music-bot/library.mjs';

// Reuse the existing bot library. Only a persistent, explicitly mounted directory
// enables this adapter; serverless /tmp must never masquerade as durable storage.
let cached;
export function musicStore() {
  const directory = process.env.VETOGRAM_MUSIC_STORE_PATH;
  if (!directory || process.env.VERCEL) return null;
  if (!cached || cached.directory !== directory) cached = {directory, store:createMusicStore({directory})};
  return cached.store;
}
export const trackId = track => createHash('sha256').update(track.file_unique_id || track.file_id).digest('hex').slice(0,32);
export function incomingMusic(update) {
  const message = update?.message;
  if (!message || message.chat?.type !== 'private' || message.from?.is_bot ||
      !Number.isSafeInteger(message.from?.id) || message.from.id <= 0 || message.chat.id !== message.from.id) return null;
  const file = message.audio || message.document;
  if (!file || (message.document && !/\.(mp3|m4a)$/i.test(file.file_name || ''))) return null;
  const normalized = normalizeAudio(file);
  return normalized ? {owner:message.from.id, audio:{...file,...normalized}} : null;
}
export async function ownerTrack(store, owner, id) {
  if (!/^[a-f0-9]{32}$/.test(String(id))) return null;
  for (let offset=0; offset<300; offset+=30) {
    const page = await store.list(owner,{offset,limit:30});
    const track = page.tracks.find(item=>trackId(item)===id);
    if (track) return track;
    if (offset+30>=page.total) break;
  }
  return null;
}
