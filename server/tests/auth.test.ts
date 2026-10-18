import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { registerAuth } from '../src/auth.js';

describe('single-user API authentication', () => {
  it('protects APIs while allowing the login page and supports an HttpOnly session', async () => {
    const app = Fastify();
    registerAuth(app, 'correct-private-token');
    app.get('/', async () => 'app shell');
    app.get('/api/private', async () => ({ ok: true }));
    expect((await app.inject({ method: 'GET', url: '/api/private' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/auth/status' })).json()).toEqual({ protected: true, authenticated: false });
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { token: 'wrong' } })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { token: 'correct-private-token' } });
    expect(login.statusCode).toBe(200);
    const cookie = (login.headers['set-cookie'] as string).split(';')[0];
    expect(cookie).not.toContain('correct-private-token');
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect((await app.inject({ method: 'GET', url: '/api/private', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/private', headers: { authorization: 'Bearer correct-private-token' } })).statusCode).toBe(200);
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(logout.headers['set-cookie']).toContain('Max-Age=0');
    await app.close();
  });
  it('allows local mode without APP_TOKEN', async () => {
    const app = Fastify();
    registerAuth(app, '');
    app.get('/api/private', async () => ({ ok: true }));
    expect((await app.inject({ method: 'GET', url: '/api/private' })).statusCode).toBe(200);
    await app.close();
  });
});
