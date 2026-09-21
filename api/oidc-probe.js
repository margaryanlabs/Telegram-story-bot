function decodePart(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const token = String(process.env.VERCEL_OIDC_TOKEN || '');
  const [header, payload] = token.split('.');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    hasToken: Boolean(token),
    header: decodePart(header),
    payload: decodePart(payload),
    environment: process.env.VERCEL_ENV || null,
    projectId: process.env.VERCEL_PROJECT_ID || null,
    teamId: process.env.VERCEL_TEAM_ID || null,
  });
}
