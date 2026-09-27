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
import { LangContext, readStoredLang, storeLang, translate, type Lang } from './i18n';

type Tab = 'today' | 'words' | 'practice' | 'progress' | 'settings';

const TABS: { id: Tab; label: string; icon: () => ReactElement }[] = [
  { id: 'today', label: 'Today', icon: () => Icon.streak(24) },
  { id: 'words', label: 'Words', icon: () => Icon.book(24) },
  { id: 'practice', label: 'Practice', icon: () => Icon.star(24) },
  { id: 'progress', label: 'Progress', icon: () => Icon.chart(24) },
  { id: 'settings', label: 'Settings', icon: () => Icon.gear(24) },
];

export function App() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
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
      {tab === 'today' && <Today isNew={session.user.is_new} />}
      {tab === 'words' && <Words />}
      {tab === 'practice' && <Practice />}
      {tab === 'progress' && <Progress />}
      {tab === 'settings' && <SettingsScreen initial={session.settings} />}
      <nav className="nav">
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
    </ToastProvider>
    </LangContext.Provider>
  );
}
