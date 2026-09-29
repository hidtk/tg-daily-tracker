import { useState } from 'react';
import { UNLOCK_PRESETS, type ShopResponse, type ShopTask, type WalletResponse } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic } from '../tg';
import { useT } from '../i18n';
import { useToast } from '../components/Toast';
import { Section } from '../components/ui';
import { Icon, Mascot, type MascotMood } from '../components/Mascot';
import { TaskCard } from '../components/TaskCard';

/** Elvis says one thing that matters now. */
function mascotLine(s: ShopResponse, t: ReturnType<typeof useT>): { mood: MascotMood; text: string } {
  if (s.balance < 0) return { mood: 'wait', text: t('There is a debt of {n} min: social media stays closed until a task pays it back.', { n: Math.ceil(-s.balance) }) };
  if (s.earn_left <= 0) return { mood: 'cheer', text: t('Today’s limit is earned. Enjoy it — new tasks tomorrow.') };
  if (s.balance < 1) return { mood: 'wait', text: t('No minutes yet. Pick a task below: the card says how long it takes and what it pays.') };
  return { mood: 'calm', text: t('You have {n} min. Earn more with a task below, or spend them.', { n: Math.floor(s.balance) }) };
}

/** Home: the balance and the three best tasks right now. */
export function Home({ shop, wallet, onStart, onShop, onWallet }: { shop: ShopResponse | null; wallet: WalletResponse | null; onStart: (task: ShopTask) => void; onShop: () => void; onWallet: (w: WalletResponse) => void }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!shop) return <span className="spinner" />;

  const debt = shop.balance < 0;
  const top = shop.top.map((id) => shop.tasks.find((x) => x.id === id)).filter((x): x is ShopTask => !!x);
  const line = mascotLine(shop, t);
  const pct = shop.daily_cap ? Math.min(100, Math.round((shop.earned_today / shop.daily_cap) * 100)) : 0;
  const lock = wallet?.lock;

  const unlock = async (m: number) => {
    setBusy(true);
    try {
      onWallet(await api.unlock(m));
      haptic.success();
      toast(t('Open for {n} min', { n: m }));
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      const r = await api.lockNow();
      onWallet(r);
      haptic.success();
      toast(r.refunded ? t('{n} min returned', { n: r.refunded }) : t('Closed'));
    } catch (e) {
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <div className="section minutes-card">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>{debt ? t('Debt') : t('Social-media minutes')}</div>
            <div className={`balance${debt ? ' debt' : ''}`}>{debt ? `−${Math.ceil(-shop.balance)}` : Math.floor(shop.balance)}<span>{t('min')}</span></div>
          </div>
          <span style={{ color: shop.balance < 1 ? 'var(--ink-muted)' : 'var(--primary)' }}>{shop.balance < 1 ? Icon.lock(40) : Icon.gems(40)}</span>
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>
          {shop.session
            ? t('In social media now · {n} min left', { n: Math.floor(shop.session.seconds_left / 60) })
            : lock?.state === 'open'
              ? t('Open · {n} min left', { n: lock.remaining_min })
              : shop.balance < 1
                ? t('Social media is closed. A task opens it.')
                : t('Social media opens while there are minutes; when they run out, the iPhone sends you to the Home Screen.')}
        </div>
        <div className="day-bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="muted small">{t('Earned today {a} of {b} min', { a: shop.earned_today, b: shop.daily_cap })}</div>
        {lock?.state === 'open' && (
          <button className="btn sm" style={{ marginTop: 10 }} disabled={busy} onClick={() => void close()}>{t('Close now')}</button>
        )}
        {lock?.configured && lock.state !== 'open' && shop.balance >= UNLOCK_PRESETS[0] && (
          <div className="unlock-grid">
            {UNLOCK_PRESETS.map((m) => (
              <button key={m} className="chip" disabled={busy || shop.balance < m} onClick={() => void unlock(m)}>{t('Open {n} min', { n: m })}</button>
            ))}
          </div>
        )}
      </div>

      <Mascot size={76} mood={line.mood} message={line.text} />

      <Section label={t('Best tasks now')}>
        {top.length ? top.map((x) => <TaskCard key={x.id} task={x} onStart={onStart} />) : <p className="muted small" style={{ margin: 0 }}>{t('Nothing to do right now — come back tomorrow.')}</p>}
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => { haptic.tap(); onShop(); }}>{t('Open the Shop')}</button>
      </Section>
    </div>
  );
}
