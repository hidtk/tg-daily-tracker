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
    return { ok: res.ok, status: res.status, data };
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
      if (patch.status === 404) {
        const add = await call(key, 'POST', `/profiles/${profile}/parentalControl/services`, { id: svc, active: locked, recreation: false });
        if (add.ok) continue;
      }
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
