import crypto from 'node:crypto';
import sharp from 'sharp';

function telegramUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tg(token, method, body) {
  const response = await fetch(telegramUrl(token, method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `${method} failed`);
  }
  return data.result;
}

function sign(token, value) {
  return crypto.createHmac('sha256', token).update(value).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('Method not allowed');
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const fileId = String(req.query.file_id || '');
  const sig = String(req.query.sig || '');

  if (!token || !fileId || !sig) {
    res.status(400).end('Missing parameters');
    return;
  }

  const expected = sign(token, fileId);
  const valid = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid) {
    res.status(403).end('Invalid signature');
    return;
  }

  try {
    const file = await tg(token, 'getFile', { file_id: fileId });
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!response.ok) throw new Error(`Telegram file download failed: ${response.status}`);

    const original = Buffer.from(await response.arrayBuffer());
    const prepared = await sharp(original)
      .rotate()
      .resize(1080, 1920, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.status(200).send(prepared);
  } catch (error) {
    console.error('media proxy error', error);
    res.status(500).end(error.message || 'Media proxy failed');
  }
}
