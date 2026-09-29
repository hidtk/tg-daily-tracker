import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { AuthResponse } from '@tracker/shared';
import { api, auth, ApiError } from './api';
import { haptic } from './tg';
import { Today } from './screens/Today';
import { Words } from './screens/Words';
import { Practice } from './screens/Practice';
import { Progress } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';
import { ToastProvider } from './components/Toast';
import { Icon, Mascot } from './components/Mascot';
import { CelebrateProvider, type GoTarget } from './components/Game';
import { LangContext, readStoredLang, storeLang, translate, type Lang } from './i18n';

type Tab = 'today' | 'words' | 'practice' | 'progress' | 'settings';
export type PracticeFocus = 'reading' | 'writing' | 'speaking' | 'boss' | null;

/** Bot buttons open the app on a screen: ?go=reading|words|writing|speaking|boss|today. */
function initialGo(): GoTarget | null {
  try {
    const v = new URLSearchParams(window.location.search).get('go');
    return v && ['reading', 'words', 'writing', 'speaking', 'boss', 'today'].includes(v) ? (v as GoTarget) : null;
  } catch {
    return null;
  }
}

const TABS: { id: Tab; label: string; icon: () => ReactElement }[] = [
  { id: 'today', label: 'Today', icon: () => Icon.streak(24) },
  { id: 'words', label: 'Words', icon: () => Icon.book(24) },
  { id: 'practice', label: 'Practice', icon: () => Icon.star(24) },
  { id: 'progress', label: 'Progress', icon: () => Icon.chart(24) },
  { id: 'settings', label: 'Settings', icon: () => Icon.gear(24) },
];

/**
 * True while the on-screen keyboard is up. The bottom nav hides then: otherwise it rides on top of the
 * keyboard and is easy to tap by accident while pasting or typing.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type)));
    let timer: number | undefined;
    const onIn = (e: FocusEvent) => { if (isField(e.target)) { window.clearTimeout(timer); setOpen(true); } };
    const onOut = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setOpen(isField(document.activeElement)), 250); };
    const vv = window.visualViewport;
    const onResize = () => { if (vv && window.innerHeight - vv.height > 150) setOpen(true); };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    vv?.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
      vv?.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, []);
  return open;
}

export function App() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    const g = initialGo();
    return g === 'words' ? 'words' : g && g !== 'today' ? 'practice' : 'today';
  });
  const [focus, setFocus] = useState<PracticeFocus>(() => {
    const g = initialGo();
    return g && g !== 'words' && g !== 'today' ? g : null;
  });
  const go = (to: GoTarget) => {
    haptic.select();
    if (to === 'words') setTab('words');
    else if (to === 'today') setTab('today');
    else {
      setFocus(to);
      setTab('practice');
    }
    window.scrollTo(0, 0);
  };
  const keyboard = useKeyboardOpen();
  const [lang, setLangState] = useState<Lang>(() => readStoredLang() ?? 'en');
  const langCtx = useMemo(
    () => ({
      lang,
      setLang: (l: Lang) => {
        setLangState(l);
        storeLang(l);
        api.saveSettings({ lang: l }).catch(() => undefined);
      },
    }),
    [lang],
  );

  useEffect(() => {
    auth()
      .then((r) => {
        setSession(r);
        if (!readStoredLang()) {
          setLangState(r.settings.lang);
          storeLang(r.settings.lang);
        }
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Could not connect'));
  }, []);

  if (error) {
    return (
      <div className="screen center" style={{ paddingTop: 60 }}>
        <div className="el-mascot center"><Mascot size={120} /></div>
        <h2>{translate(lang, error)}</h2>
        <p className="muted small" style={{ marginTop: 10 }}>{translate(lang, 'Open the app from the button in the chat with the bot.')}</p>
      </div>
    );
  }
  if (!session) return <span className="spinner" />;

  return (
    <LangContext.Provider value={langCtx}>
    <ToastProvider>
    <CelebrateProvider>
      {tab === 'today' && <Today isNew={session.user.is_new} go={go} />}
      {tab === 'words' && <Words />}
      {tab === 'practice' && <Practice focus={focus} onFocused={() => setFocus(null)} botUsername={session.settings.bot_username} />}
      {tab === 'progress' && <Progress />}
      {tab === 'settings' && <SettingsScreen initial={session.settings} />}
      <nav className={`nav${keyboard ? ' nav-hidden' : ''}`} aria-hidden={keyboard}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => {
              haptic.select();
              setTab(t.id);
            }}
          >
            {t.icon()}
            <span>{translate(lang, t.label)}</span>
          </button>
        ))}
      </nav>
    </CelebrateProvider>
    </ToastProvider>
    </LangContext.Provider>
  );
}
