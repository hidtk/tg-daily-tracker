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
    ready: noop, expand: noop, close: noop, openLink: noop, openTelegramLink: noop, setHeaderColor: noop, setBackgroundColor: noop, disableVerticalSwipes: noop, onEvent: noop, colorScheme: 'light',
    showConfirm: (_m: string, cb?: (ok: boolean) => void) => cb?.(window.confirm(_m)),
    MainButton: btn,
    HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
  } as unknown as WebAppType;
}

export const tg: WebAppType = window.Telegram?.WebApp ?? stub();

export const inTelegram = Boolean(tg.initData);

function applyTheme() {
  const dark = inTelegram ? tg.colorScheme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (!inTelegram) {
    // Outside Telegram (dev): emulate the default Telegram palette.
    const r = document.documentElement.style;
    const light = { bg: '#ffffff', text: '#000000', hint: '#8e8e93', link: '#2481cc', button: '#2481cc', buttonText: '#ffffff', secondary: '#efeff4', section: '#ffffff', separator: '#e5e5ea', subtitle: '#6d6d72', destructive: '#ff3b30' };
    const darkP = { bg: '#000000', text: '#ffffff', hint: '#8e8e93', link: '#6ab3f3', button: '#5288c1', buttonText: '#ffffff', secondary: '#000000', section: '#1c1c1d', separator: '#2c2c2e', subtitle: '#98989e', destructive: '#ff453a' };
    const p = dark ? darkP : light;
    r.setProperty('--tg-theme-bg-color', p.bg); r.setProperty('--tg-theme-text-color', p.text); r.setProperty('--tg-theme-hint-color', p.hint);
    r.setProperty('--tg-theme-link-color', p.link); r.setProperty('--tg-theme-button-color', p.button); r.setProperty('--tg-theme-button-text-color', p.buttonText);
    r.setProperty('--tg-theme-secondary-bg-color', p.secondary); r.setProperty('--tg-theme-section-bg-color', p.section); r.setProperty('--tg-theme-section-separator-color', p.separator);
    r.setProperty('--tg-theme-subtitle-text-color', p.subtitle); r.setProperty('--tg-theme-destructive-text-color', p.destructive);
    return;
  }
  try {
    tg.setHeaderColor('secondary_bg_color');
    tg.setBackgroundColor('secondary_bg_color');
  } catch {
    /* noop */
  }
}

export function initTelegram() {
  try {
    tg.ready();
    tg.expand();
    if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
    tg.onEvent('themeChanged', applyTheme);
  } catch {
    /* running outside Telegram */
  }
  applyTheme();
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
