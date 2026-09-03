import type { WebApp as WebAppType } from '@twa-dev/types';

declare global {
  interface Window {
    Telegram?: { WebApp: WebAppType };
  }
}

/** Official Telegram script is loaded in index.html; outside Telegram we fall back to a harmless stub. */
function stub(): WebAppType {
  const noop = () => {};
  const btn = { show: noop, hide: noop, setText: noop, onClick: noop, offClick: noop, showProgress: noop, hideProgress: noop };
  return {
    initData: '',
    initDataUnsafe: {},
    ready: noop, expand: noop, close: noop, openLink: noop, setHeaderColor: noop, disableVerticalSwipes: noop,
    showConfirm: (_m: string, cb?: (ok: boolean) => void) => cb?.(window.confirm(_m)),
    MainButton: btn,
    HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
  } as unknown as WebAppType;
}

export const tg: WebAppType = window.Telegram?.WebApp ?? stub();

export const inTelegram = Boolean(tg.initData);

export function initTelegram() {
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('secondary_bg_color');
    if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
  } catch {
    /* running outside Telegram */
  }
}

export const haptic = {
  tap: () => safe(() => tg.HapticFeedback.impactOccurred('light')),
  success: () => safe(() => tg.HapticFeedback.notificationOccurred('success')),
  warning: () => safe(() => tg.HapticFeedback.notificationOccurred('warning')),
  select: () => safe(() => tg.HapticFeedback.selectionChanged()),
};

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    /* noop outside Telegram */
  }
}

/** initData for the API: real one in Telegram, or a dev fallback from .env (VITE_DEV_INIT_DATA). */
export function getInitData(): string {
  if (tg.initData) return tg.initData;
  // Fallback: Telegram passes init params in the URL hash (#tgWebAppData=...).
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const raw = hash.get('tgWebAppData');
    if (raw) return raw;
  } catch {
    /* ignore */
  }
  return (import.meta.env.VITE_DEV_INIT_DATA as string | undefined) || '';
}

export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
