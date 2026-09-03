import { hmacSha256, toB64Url, timingSafeEqual } from './crypto';

const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

/** Stateless signed token: "<tg_id>.<exp>.<sig>" */
export async function issueToken(tgId: number, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = `${tgId}.${exp}`;
  const sig = toB64Url(await hmacSha256(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string | null, secret: string): Promise<number | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expected = toB64Url(await hmacSha256(secret, `${id}.${exp}`));
  if (!timingSafeEqual(expected, sig)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const tgId = Number(id);
  return Number.isFinite(tgId) ? tgId : null;
}
