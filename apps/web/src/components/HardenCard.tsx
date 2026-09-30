import { useState } from 'react';
import type { WalletResponse } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg } from '../tg';
import { useT } from '../i18n';
import { useToast } from './Toast';
import { Section } from './ui';

/** A menu path, shown like the real iPhone items. */
const P = ({ items }: { items: string[] }) => (
  <span>
    {items.map((x, i) => (
      <span key={x}>
        {i > 0 && ' → '}
        <b className="sc-action">{x}</b>
      </span>
    ))}
  </span>
);

/**
 * «Сделать обход сложнее»: a bypass can't be forbidden by code, so make it slow and visible — a one-minute limit on
 * the Shortcuts app with a Screen Time passcode someone else keeps, no deleting apps, and a friend who hears about
 * every bypass. Item names are the real ones on a Russian iPhone.
 */
export function HardenCard({ w, onChange }: { w: WalletResponse; onChange: (r: WalletResponse) => void }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<WalletResponse>) => {
    setBusy(true);
    try {
      onChange(await fn());
      haptic.success();
    } catch (e) {
      toast(e instanceof ApiError ? t(e.message) : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  const share = (link: string) => {
    haptic.tap();
    const text = t('Be my lock buddy: you get a Telegram message if I get around my social-media lock. Nothing else.');
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    try {
      tg.openTelegramLink(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <Section label={t('Make a bypass harder')}>
      <p className="muted small" style={{ marginTop: 0 }}>{t('Code can’t forbid switching the lock off, but it can make it slow and visible. Three things, once:')}</p>

      <div className="sc-step">
        <div className="sc-num">1</div>
        <div className="sc-body">
          <div className="sc-title">{t('A 1-minute limit on the Shortcuts app, with someone else’s passcode')}</div>
          <div className="small">
            <P items={[t('Settings'), t('Screen Time'), t('App Limits'), t('Add Limit')]} />. {t('Find «Shortcuts», tick it, «Next», set 1 min, turn on «Block at End of Limit», «Add».')}
            <br />
            {t('Then')} <P items={[t('Screen Time'), t('Use Screen Time Passcode')]} />{t(': let a friend or someone close type the code and keep it. Then opening Shortcuts to switch the automation off takes their code. Check afterwards: open Instagram with no minutes — you should land on the Home Screen.')}
          </div>
        </div>
      </div>

      <div className="sc-step">
        <div className="sc-num">2</div>
        <div className="sc-body">
          <div className="sc-title">{t('Don’t let the VPN and the lock be deleted')}</div>
          <div className="small">
            <P items={[t('Screen Time'), t('Content & Privacy Restrictions')]} /> {t('— turn it on, then')} <P items={[t('iTunes & App Store Purchases'), t('Deleting Apps'), t('Don’t Allow')]} />{t('. AmneziaVPN (with NextDNS inside) and the IELTS lock profile stay; the profile can’t be removed without its password, which your friend keeps (step 5 of NextDNS).')}
          </div>
        </div>
      </div>

      <div className="sc-step">
        <div className="sc-num">3</div>
        <div className="sc-body">
          <div className="sc-title">{t('A lock buddy')}</div>
          <div className="small">
            {t('A friend gets a Telegram message about every bypass the server notices — and nothing else.')}
            {w.friend.name != null ? (
              <div style={{ marginTop: 8 }}>
                {t('Your lock buddy: {name}', { name: w.friend.name || t('connected') })}
                <br />
                <button className="btn link" disabled={busy} onClick={() => void act(api.friendRemove)}>{t('Remove the buddy')}</button>
              </div>
            ) : w.friend.invite ? (
              <div style={{ marginTop: 8 }}>
                <code className="gate-url">{w.friend.invite}</code>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  <button className="btn solid sm" onClick={() => share(w.friend.invite!)}>{t('Send to a friend')}</button>
                  <button className="btn sm" onClick={async () => { haptic.tap(); try { await navigator.clipboard.writeText(w.friend.invite!); toast(t('Copied')); } catch { toast(t('Copy it by hand')); } }}>{t('Copy')}</button>
                </div>
                <div className="muted tiny" style={{ marginTop: 4 }}>{t('The friend opens the link and presses Start in the bot. Then it shows here.')}</div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <button className="btn solid sm" disabled={busy} onClick={() => void act(api.friendInvite)}>{t('Invite a friend')}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hint">{t('What the server does by itself: reads the NextDNS log every 5 minutes. Social media that loaded with no minutes and no session is a bypass: a penalty of {n}+ min (a debt to work off with tasks), the streak starts over, a line in Progress and a message to you and your buddy. If the Shortcut hasn’t called for a day while NextDNS sees the apps, Home shows a red banner.', { n: 15 })}</div>
    </Section>
  );
}
