import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/** APP_TOKEN stays server-side. A successful runtime login gives an HttpOnly cookie. */
const COOKIE = 'chess_tutor_session';
const hash = (s: string): Buffer => createHash('sha256').update(s).digest();
const equals = (a: string, b: string): boolean => timingSafeEqual(hash(a), hash(b));
const sessionValue = (secret: string): string =>
  createHmac('sha256', secret).update('chess-tutor-session-v1').digest('hex');
function hasSession(req: FastifyRequest, secret: string): boolean {
  const value = (req.headers.cookie ?? '').split(';').map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return Boolean(value && equals(value, sessionValue(secret)));
}
function cookieOptions(req: FastifyRequest): string {
  const secure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
  return `Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}
export function registerAuth(app: FastifyInstance, secret: string): void {
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0];
    if (!path.startsWith('/api/') || !secret) return;
    if (path === '/api/health' || path === '/api/auth/status' || path === '/api/auth/login') return;
    if (hasSession(req, secret)) return;
    const bearer = req.headers.authorization ?? '';
    if (bearer.startsWith('Bearer ') && equals(bearer.slice(7), secret)) return;
    return reply.code(401).send({ error: 'Authentication required' });
  });
  app.get('/api/auth/status', async (req) => ({
    protected: Boolean(secret), authenticated: !secret || hasSession(req, secret),
  }));
  app.post<{ Body: { token?: string } }>('/api/auth/login', async (req, reply) => {
    if (!secret) return { authenticated: true };
    if (typeof req.body?.token !== 'string' || !equals(req.body.token, secret)) {
      return reply.code(401).send({ error: 'Incorrect access token' });
    }
    reply.header('Set-Cookie', `${COOKIE}=${sessionValue(secret)}; ${cookieOptions(req)}; Max-Age=86400`);
    return { authenticated: true };
  });
  app.post('/api/auth/logout', async (req, reply) => {
    reply.header('Set-Cookie', `${COOKIE}=; ${cookieOptions(req)}; Max-Age=0`);
    return { authenticated: false };
  });
}
