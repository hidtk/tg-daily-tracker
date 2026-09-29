import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBlocked, mobileconfig, setLocked } from '../src/lib/nextdns';

type Call = { method: string; url: string; body?: unknown };

function mockFetch(handler: (c: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const c = { method: init.method ?? 'GET', url, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const r = handler(c);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('NextDNS lock', () => {
  it('treats 200 with errors as a failure and falls back to adding the service', async () => {
    const calls = mockFetch((c) => (c.method === 'PATCH' ? { json: { errors: [{ code: 'notFound' }] } } : { json: {} }));
    const r = await setLocked('k', 'abc123', ['instagram'], true);
    expect(r.ok).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'POST']);
    expect(calls[1].body).toMatchObject({ id: 'instagram', active: true });
  });

  it('reports which apps are really blocked', async () => {
    mockFetch(() => ({
      json: { data: { parentalControl: { services: [{ id: 'instagram', active: true }, { id: 'tiktok', active: false }] }, denylist: [{ id: 'vk.com', active: true }] } },
    }));
    const r = await checkBlocked('k', 'abc123', ['instagram', 'tiktok', 'vk']);
    expect(r).toEqual({ ok: true, blocked: { instagram: true, tiktok: false, vk: false } });
  });
});

describe('mobileconfig', () => {
  it('is a plist with a DoH payload and a removal password', () => {
    const x = mobileconfig('abc123', 'IELTS-1', '654321');
    expect(x).toContain('<key>DNSProtocol</key><string>HTTPS</string>');
    expect(x).toContain('https://dns.nextdns.io/abc123/IELTS-1');
    expect(x).toContain('com.apple.profileRemovalPassword');
    expect(x).toContain('<key>RemovalPassword</key><string>654321</string>');
  });
});
