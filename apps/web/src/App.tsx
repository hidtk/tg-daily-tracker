import { useEffect, useState } from 'react';
import type { AuthResponse } from '@tracker/shared';
import { auth, ApiError } from './api';
import { haptic } from './tg';
import { Today } from './screens/Today';
import { Words } from './screens/Words';
import { Practice } from './screens/Practice';
import { Progress } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';
import { ToastProvider } from './components/Toast';

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

  useEffect(() => {
    auth()
      .then(setSession)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Could not connect'));
  }, []);

  if (error) {
    return (
      <div className="screen center" style={{ paddingTop: 80 }}>
        <h2>{error}</h2>
        <p className="muted small" style={{ marginTop: 10 }}>Open the app from the button in the chat with the bot.</p>
      </div>
    );
  }
  if (!session) return <span className="spinner" />;

  return (
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
            {t.label}
          </button>
        ))}
      </nav>
    </ToastProvider>
  );
}
