import { useEffect, useMemo, useState } from 'react';
import type { AuthResponse } from '@tracker/shared';
import { api, auth, ApiError } from './api';
import { haptic } from './tg';
import { Today } from './screens/Today';
import { Words } from './screens/Words';
import { Practice } from './screens/Practice';
import { Progress } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';
import { ToastProvider } from './components/Toast';
import { LangContext, readStoredLang, storeLang, translate, type Lang } from './i18n';

type Tab = 'today' | 'words' | 'practice' | 'progress' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'words', label: 'Words' },
  { id: 'practice', label: 'Practice' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
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
      <div className="screen center" style={{ paddingTop: 80 }}>
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
            {translate(lang, t.label)}
          </button>
        ))}
      </nav>
    </ToastProvider>
    </LangContext.Provider>
  );
}
