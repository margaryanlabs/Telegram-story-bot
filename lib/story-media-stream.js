import { once } from 'node:events';

// Vercel's 4.5 MB limit applies to buffered function responses. Stream large
// Telegram media in bounded chunks without writing private stories to disk/S3.
export async function streamStoryMedia(res, buffer, mime) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1) throw new Error('EMPTY_STORY_MEDIA');
  if (!['image/jpeg', 'video/mp4', 'video/webm'].includes(mime)) throw new Error('UNSUPPORTED_STORY_MEDIA');
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Veto-Story-Mode', 'ghost-no-receipt');
  res.status(200);
  res.flushHeaders?.();
  const chunkSize = 64 * 1024;
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    if (res.destroyed || res.writableEnded) return;
    if (!res.write(buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length)))) {
      await once(res, 'drain');
    }
  }
  res.end();
}
