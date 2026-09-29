import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { AuthResponse, SettingsView, ShopResponse, ShopTask, WalletResponse } from '@tracker/shared';
import { api, auth, ApiError } from './api';
import { haptic } from './tg';
import { Home } from './screens/Home';
import { Shop } from './screens/Shop';
import { Progress } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';
import { ToastProvider } from './components/Toast';
import { RewardProvider } from './components/Reward';
import { Onboarding } from './components/Onboarding';
import { TaskSheet } from './components/tasks/TaskSheet';
import { Icon, Mascot } from './components/Mascot';
import { LangContext, readStoredLang, storeLang, translate, type Lang } from './i18n';

type Tab = 'home' | 'shop' | 'progress' | 'settings';

/** Bot buttons open the app on a screen (?go=shop|progress|settings) or straight on a task (?task=<id>). */
function initialLink(): { tab: Tab; task: string | null } {
  try {
    const q = new URLSearchParams(window.location.search);
    const go = q.get('go');
    const task = q.get('task');
    const tab: Tab = go === 'shop' || go === 'progress' || go === 'settings' ? go : task ? 'shop' : 'home';
    return { tab, task: task && /^(r:[a-z0-9:-]+|words|sentence|writing:(short|long)|speaking:(short|long))$/.test(task) ? task : null };
  } catch {
    return { tab: 'home', task: null };
  }
}

const TABS: { id: Tab; label: string; icon: () => ReactElement }[] = [
  { id: 'home', label: 'Home', icon: () => Icon.gems(24) },
  { id: 'shop', label: 'Shop', icon: () => Icon.star(24) },
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
  const link = useMemo(initialLink, []);
  const [tab, setTab] = useState<Tab>(link.tab);
  const [task, setTask] = useState<string | null>(link.task);
  const [guide, setGuide] = useState(false);
  const [shop, setShop] = useState<ShopResponse | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
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

  const refresh = useCallback(() => {
    api.shop().then(setShop).catch(() => undefined);
    api.wallet().then(setWallet).catch(() => undefined);
  }, []);

  useEffect(() => {
    auth()
      .then((r) => {
        setSession(r);
        if (!r.settings.onboarded && !link.task) setGuide(true);
        if (!readStoredLang()) {
          setLangState(r.settings.lang);
          storeLang(r.settings.lang);
        }
        refresh();
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

  const start = (x: ShopTask) => setTask(x.id);
  const afterReset = (s: SettingsView) => {
    setSession({ ...session, settings: s });
    setTab('home');
    setGuide(true);
    refresh();
  };

  return (
    <LangContext.Provider value={langCtx}>
    <ToastProvider>
    <RewardProvider>
      {tab === 'home' && <Home shop={shop} wallet={wallet} onStart={start} onShop={() => setTab('shop')} onWallet={(w) => { setWallet(w); refresh(); }} />}
      {tab === 'shop' && <Shop shop={shop} onStart={start} />}
      {tab === 'progress' && <Progress />}
      {tab === 'settings' && <SettingsScreen initial={session.settings} onGuide={() => setGuide(true)} onReset={afterReset} />}
      <nav className={`nav${keyboard ? ' nav-hidden' : ''}`} aria-hidden={keyboard}>
        {TABS.map((x) => (
          <button
            key={x.id}
            className={tab === x.id ? 'on' : ''}
            onClick={() => {
              haptic.select();
              setTab(x.id);
              if (x.id === 'home' || x.id === 'shop') refresh();
              window.scrollTo(0, 0);
            }}
          >
            {x.icon()}
            <span>{translate(lang, x.label)}</span>
          </button>
        ))}
      </nav>
      {task && <TaskSheet id={task} botUsername={session.settings.bot_username} onClose={() => { setTask(null); refresh(); }} onDone={refresh} />}
      {guide && <Onboarding onClose={() => { setGuide(false); setSession((x) => (x ? { ...x, settings: { ...x.settings, onboarded: true } } : x)); }} />}
    </RewardProvider>
    </ToastProvider>
    </LangContext.Provider>
  );
}
