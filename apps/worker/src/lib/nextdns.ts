import type { GateApp } from '@tracker/shared';

const API = 'https://api.nextdns.io';

/** NextDNS parental-control service ids for the apps we gate. */
const SERVICE: Record<GateApp, string | null> = { instagram: 'instagram', tiktok: 'tiktok', youtube: 'youtube', vk: 'vk', other: null };

/** Backup domain lists in case a service id is not recognised. */
const DOMAINS: Record<GateApp, string[]> = {
  instagram: ['instagram.com', 'cdninstagram.com'],
  tiktok: ['tiktok.com', 'tiktokcdn.com', 'tiktokv.com', 'byteoversea.com'],
  youtube: ['youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com'],
  vk: ['vk.com', 'vk-cdn.net', 'userapi.com', 'vkuservideo.net', 'vkvideo.ru'],
  other: [],
};

async function call(key: string, method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'X-Api-Key': key, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    // NextDNS can answer 200 with {"errors":[...]} — that is a failure, not a success.
    const errs = (data as { errors?: unknown[] } | null)?.errors;
    return { ok: res.ok && !(Array.isArray(errs) && errs.length), status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/** Check the key and profile; returns the profile name or an error message. */
export async function checkProfile(key: string, profile: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const r = await call(key, 'GET', `/profiles/${profile}`);
  if (!r.ok) return { ok: false, error: r.status === 401 || r.status === 403 ? 'Invalid API key' : r.status === 404 ? 'Profile not found' : r.status === 0 ? 'NextDNS unreachable' : `NextDNS error ${r.status}` };
  const name = (r.data as { data?: { name?: string } })?.data?.name ?? profile;
  return { ok: true, name };
}

/** Block (locked = true) or allow the given apps on the profile. Uses services, then domains as a fallback. */
export async function setLocked(key: string, profile: string, apps: GateApp[], locked: boolean): Promise<{ ok: boolean; error?: string }> {
  const errors: string[] = [];
  for (const app of apps) {
    const svc = SERVICE[app];
    if (svc) {
      const patch = await call(key, 'PATCH', `/profiles/${profile}/parentalControl/services/${svc}`, { active: locked });
      if (patch.ok) continue;
      // Not in the list yet (NextDNS answers 404 or 200 with errors): add it.
      const add = await call(key, 'POST', `/profiles/${profile}/parentalControl/services`, { id: svc, active: locked, recreation: false });
      if (add.ok) continue;
    }
    // domain fallback
    for (const d of DOMAINS[app]) {
      const patch = await call(key, 'PATCH', `/profiles/${profile}/denylist/${d}`, { active: locked });
      if (patch.ok) continue;
      const add = await call(key, 'POST', `/profiles/${profile}/denylist`, { id: d, active: locked });
      if (!add.ok) errors.push(`${d}: ${add.status}`);
    }
  }
  return errors.length ? { ok: false, error: errors.slice(0, 3).join('; ') } : { ok: true };
}

export type LockCheck = { ok: true; blocked: Partial<Record<GateApp, boolean>> } | { ok: false; error: string };

/** Read the profile back and report, per app, whether NextDNS currently blocks it (service or all fallback domains). */
export async function checkBlocked(key: string, profile: string, apps: GateApp[]): Promise<LockCheck> {
  const r = await call(key, 'GET', `/profiles/${profile}`);
  if (!r.ok) return { ok: false, error: r.status === 401 || r.status === 403 ? 'Invalid API key' : r.status === 404 ? 'Profile not found' : `NextDNS error ${r.status}` };
  type Item = { id: string; active?: boolean };
  const d = (r.data as { data?: { parentalControl?: { services?: Item[] }; denylist?: Item[] } })?.data ?? {};
  const services = new Map((d.parentalControl?.services ?? []).map((s) => [s.id, s.active !== false]));
  const deny = new Map((d.denylist ?? []).map((s) => [s.id, s.active !== false]));
  const blocked: Partial<Record<GateApp, boolean>> = {};
  for (const app of apps) {
    const svc = SERVICE[app];
    blocked[app] = (svc ? services.get(svc) === true : false) || (DOMAINS[app].length > 0 && DOMAINS[app].every((x) => deny.get(x) === true));
  }
  return { ok: true, blocked };
}

/** Whether the profile keeps query logs (bypass detection reads them). null: could not tell. */
export async function logsEnabled(key: string, profile: string): Promise<boolean | null> {
  const r = await call(key, 'GET', `/profiles/${profile}`);
  if (!r.ok) return null;
  const on = (r.data as { data?: { settings?: { logs?: { enabled?: boolean } } } })?.data?.settings?.logs?.enabled;
  return typeof on === 'boolean' ? on : null;
}

/** The gated app a queried domain belongs to (the domain itself or any of its parents is on the app's list). */
export function appForDomain(domain: string): GateApp | null {
  const d = domain.toLowerCase().replace(/\.$/, '');
  for (const [app, list] of Object.entries(DOMAINS) as [GateApp, string[]][]) {
    if (list.some((x) => d === x || d.endsWith(`.${x}`))) return app;
  }
  return null;
}

export interface LogEntry {
  timestamp: string;
  domain: string;
  /** 'default' (resolved), 'blocked', 'allowed', 'error' */
  status: string;
}

/**
 * Query log between two moments, oldest first (GET /profiles/:id/logs, paged by cursor). null when NextDNS can't be
 * read — the caller keeps its place and tries again later.
 */
export async function fetchLogs(key: string, profile: string, from: Date, to: Date, search?: string, maxPages = 5): Promise<LogEntry[] | null> {
  const out: LogEntry[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), limit: '1000' });
    if (search) q.set('search', search);
    if (cursor) q.set('cursor', cursor);
    const r = await call(key, 'GET', `/profiles/${profile}/logs?${q}`);
    if (!r.ok) return null;
    const d = r.data as { data?: LogEntry[]; meta?: { pagination?: { cursor?: string | null } } };
    for (const e of Array.isArray(d.data) ? d.data : []) if (e?.timestamp && e.domain) out.push({ timestamp: e.timestamp, domain: e.domain, status: e.status ?? 'default' });
    cursor = d.meta?.pagination?.cursor ?? null;
    if (!cursor) break;
  }
  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function uuid(): string {
  return crypto.randomUUID().toUpperCase();
}

/** Apple configuration profile: DNS-over-HTTPS to the NextDNS profile, removable only with the password. */
export function mobileconfig(profile: string, deviceLabel: string, removalPassword: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      <dict>
        <key>DNSProtocol</key><string>HTTPS</string>
        <key>ServerURL</key><string>https://dns.nextdns.io/${esc(profile)}/${esc(deviceLabel)}</string>
      </dict>
      <key>PayloadDescription</key><string>Routes DNS through NextDNS so the IELTS trainer can lock social media until minutes are earned.</string>
      <key>PayloadDisplayName</key><string>IELTS lock · DNS</string>
      <key>PayloadIdentifier</key><string>io.nextdns.dns.${esc(profile)}</string>
      <key>PayloadType</key><string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key><string>${uuid()}</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>ProhibitDisablement</key><false/>
    </dict>
    <dict>
      <key>PayloadDescription</key><string>Removal password held by your accountability partner.</string>
      <key>PayloadDisplayName</key><string>Removal password</string>
      <key>PayloadIdentifier</key><string>io.nextdns.removal.${esc(profile)}</string>
      <key>PayloadType</key><string>com.apple.profileRemovalPassword</string>
      <key>PayloadUUID</key><string>${uuid()}</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>RemovalPassword</key><string>${esc(removalPassword)}</string>
    </dict>
  </array>
  <key>HasRemovalPasscode</key><true/>
  <key>PayloadDescription</key><string>IELTS trainer: social media lock</string>
  <key>PayloadDisplayName</key><string>IELTS lock</string>
  <key>PayloadIdentifier</key><string>io.nextdns.ielts.${esc(profile)}</string>
  <key>PayloadOrganization</key><string>IELTS trainer</string>
  <key>PayloadRemovalDisallowed</key><false/>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>${uuid()}</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
`;
}
