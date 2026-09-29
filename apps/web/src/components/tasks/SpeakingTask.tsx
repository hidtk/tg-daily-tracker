import { useEffect, useState } from 'react';
import type { SpeakingState, TaskSize } from '@tracker/shared';
import { api, ApiError } from '../../api';
import { haptic, tg } from '../../tg';
import { useT } from '../../i18n';
import { useToast } from '../Toast';
import { Section, Sheet } from '../ui';
import { Icon, Mascot } from '../Mascot';

/** Speaking: a cue card; the answer is a voice message to the bot, which checks it and replies. */
export function SpeakingTask({ size, botUsername, onClose }: { size: TaskSize; botUsername: string; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const [st, setSt] = useState<SpeakingState | null>(null);

  useEffect(() => {
    api.speaking().then(setSt).catch((e: unknown) => toast(e instanceof ApiError ? t(e.message) : t('Could not load')));
  }, []);

  const title = `Speaking · ${size === 'long' ? t('long answer') : t('short answer')}`;
  const item = st?.cards.find((c) => c.size === size);

  const openBot = () => {
    haptic.tap();
    const url = `https://t.me/${st?.bot_username || botUsername}`;
    try { tg.openTelegramLink(url); } catch { window.open(url, '_blank'); }
  };

  return (
    <Sheet title={title} onClose={onClose}>
      {!item ? <span className="spinner" /> : item.done ? (
        <Mascot size={72} mood="cheer" message={t('Counted today: {s} s, +{m} min. New cards tomorrow.', { s: item.done.seconds, m: item.done.paid })} />
      ) : (
        <>
          <Section label={t('Card')}>
            <div className="boss-title">{item.card.title}</div>
            <p style={{ margin: '6px 0' }}>{item.card.prompt}</p>
            <div className="muted small">{t('You should say:')}</div>
            <ul className="card-points">{item.card.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </Section>
          <Section label={t('How to answer')}>
            <ol className="rules">
              <li>{t('Think for a minute: what you will say on each point.')}</li>
              <li>{t('Press the button below, hold the microphone in the chat and answer in English — at least {s} seconds.', { s: item.min_seconds })}</li>
              <li>{t('The bot checks it and replies: +{m} min of social media.', { m: item.price })}</li>
            </ol>
            <div className="hint">{t('Checked: the length, that you recorded it yourself (not forwarded), that the recording is new. The bot cannot hear the content — the honest practice is yours.')}</div>
          </Section>
          <button className="btn solid block" onClick={openBot}>{Icon.mic(18)} {t('Open the chat with the bot')}</button>
        </>
      )}
    </Sheet>
  );
}
