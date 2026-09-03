import WebApp from '@twa-dev/sdk';

export const tg = WebApp;

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
  return tg.initData || (import.meta.env.VITE_DEV_INIT_DATA as string | undefined) || '';
}

export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
