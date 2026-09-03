import { useEffect, useState } from 'react';
import type { AuthResponse } from '@tracker/shared';
import { auth, ApiError } from './api';
import { haptic } from './tg';
import { Today } from './screens/Today';
import { Calendar } from './screens/Calendar';
import { Activities } from './screens/Activities';
import { SettingsScreen } from './screens/Settings';
import { ToastProvider } from './components/Toast';

type Tab = 'today' | 'calendar' | 'activities' | 'settings';

const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: 'today', label: 'Сегодня', ico: '☀️' },
  { id: 'calendar', label: 'Календарь', ico: '📅' },
  { id: 'activities', label: 'Активности', ico: '🎯' },
  { id: 'settings', label: 'Настройки', ico: '⚙️' },
];

export function App() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  // bump to force Today to refetch when activities change
  const [version, setVersion] = useState(0);

  useEffect(() => {
    auth()
      .then(setSession)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Не удалось подключиться'));
  }, []);

  if (error) {
    return (
      <div className="screen center" style={{ paddingTop: 80 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <p>{error}</p>
        <p className="muted small">Откройте приложение через кнопку в чате с ботом.</p>
      </div>
    );
  }
  if (!session) return <span className="spinner" />;

  return (
    <ToastProvider>
      {tab === 'today' && <Today key={version} isNew={session.user.is_new} />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'activities' && <Activities onChanged={() => setVersion((v) => v + 1)} />}
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
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </ToastProvider>
  );
}
