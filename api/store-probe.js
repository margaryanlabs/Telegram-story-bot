import { getVercelOidcToken } from '@vercel/oidc';

export default async function handler(req, res) {
  let token = String(process.env.VERCEL_OIDC_TOKEN || '');
  if (!token) {
    try { token = String(await getVercelOidcToken() || ''); } catch {}
  }

  const response = await fetch('https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/story-pilot-store', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ op: 'health', args: {} }),
  });

  const data = await response.json().catch(() => ({}));
  res.setHeader('Cache-Control', 'no-store');
  res.status(response.status).json({
    ok: response.ok && data?.ok === true,
    status: response.status,
    hasOidc: Boolean(token),
    data,
  });
}
