import { useEffect, useState } from 'react';
import type { ProgressResponse, WalletLedgerEntry } from '@tracker/shared';
import { api, ApiError } from '../api';
import { useLang, useT } from '../i18n';
import { Section, fmtShort, WD } from '../components/ui';
import { Icon } from '../components/Mascot';
import { ACHIEVEMENT_TEXT } from '../components/Reward';
import { weekdayMon0 } from '@tracker/shared';

const REASON: Record<string, string> = {
  reading: 'Reading',
  words: 'Words',
  quiz: 'Quick test',
  sentence: 'Sentence',
  writing: 'Writing',
  speaking: 'Speaking',
  achievement: 'Achievement',
  spend: 'Social media',
  manual: 'Returned',
  penalty: 'Penalty for a bypass',
};

const APP_NAME: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', vk: 'VK' };

function ledgerLabel(l: WalletLedgerEntry, t: ReturnType<typeof useT>): string {
  if (l.reason === 'achievement' && l.note && l.note in ACHIEVEMENT_TEXT) return `${t('Achievement')}: ${t(ACHIEVEMENT_TEXT[l.note as keyof typeof ACHIEVEMENT_TEXT].title)}`;
  return t(REASON[l.reason] ?? l.reason);
}

/** Progress: achievements with plain rules and progress, the week, the streak, where the minutes came from. */
export function Progress() {
  const t = useT();
  const { lang } = useLang();
  const [p, setP] = useState<ProgressResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.progress().then(setP).catch((e: unknown) => setErr(e instanceof ApiError ? e.message : t('Could not load')));
  }, []);

  if (err) return <div className="screen"><div className="err">{err}</div></div>;
  if (!p) return <span className="spinner" />;

  const max = Math.max(10, ...p.week.map((d) => Math.max(d.study, d.earned)));
  const earned = p.achievements.filter((a) => a.earned_on).length;

  return (
    <div className="screen">
      <h1>{t('Progress')}</h1>

      <div className="tiles section">
        <div className="tile"><div className="v">{p.streak.current}</div><div className="l">{t('days in a row with tasks · best {n}', { n: p.streak.best })}</div></div>
        <div className="tile"><div className="v">{p.totals.tasks}</div><div className="l">{t('tasks with minutes')}</div></div>
        <div className="tile"><div className="v">{p.totals.earned}</div><div className="l">{t('minutes earned')}</div></div>
        <div className="tile"><div className="v">{Math.round(p.totals.study_minutes / 6) / 10}</div><div className="l">{t('hours of study (counted by itself)')}</div></div>
      </div>

      <Section label={t('This week')}>
        <div className="week-bars">
          {p.week.map((d) => (
            <div key={d.date} className={`wb${d.date === p.today ? ' today' : ''}`}>
              <div className="wb-cols">
                <i className="study" style={{ height: `${Math.round((d.study / max) * 100)}%` }} title={`${d.study}`} />
                <i className="earned" style={{ height: `${Math.round((d.earned / max) * 100)}%` }} title={`${d.earned}`} />
              </div>
              <span>{t(WD[weekdayMon0(d.date)])}</span>
            </div>
          ))}
        </div>
        <div className="legend-row"><span><i className="lg study" />{t('study, min')}</span><span><i className="lg earned" />{t('earned for social media, min')}</span></div>
        <div className="hint">{t('Study time is counted by itself from what you do in the app — nothing to enter by hand.')}</div>
      </Section>

      <Section label={t('Achievements · {a} of {b}', { a: earned, b: p.achievements.length })}>
        {p.achievements.map((a) => {
          const text = ACHIEVEMENT_TEXT[a.id];
          const pct = Math.round((a.progress / a.target) * 100);
          return (
            <div key={a.id} className={`ach${a.earned_on ? ' got' : ''}`}>
              <span className={`ach-badge${a.earned_on ? ' on' : ''}`}>{Icon.trophy(24)}</span>
              <div className="grow">
                <div className="row between" style={{ alignItems: 'baseline' }}>
                  <span className="ach-title">{t(text.title)}</span>
                  <span className="ach-bonus">{t('+{n} min', { n: a.bonus })}</span>
                </div>
                <div className="ach-how">{t(text.how)}</div>
                <div className="ach-bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="ach-progress">{a.earned_on ? t('Done on {d} — bonus paid', { d: fmtShort(a.earned_on, lang) }) : t('{a} of {b}', { a: a.progress, b: a.target })}</div>
              </div>
            </div>
          );
        })}
        <div className="hint">{t('Progress is counted from what you really did. Each bonus is paid once, on top of the daily limit.')}</div>
      </Section>

      {p.bypasses.length > 0 && (
        <Section label={t('Bypasses noticed')}>
          {p.bypasses.map((b) => (
            <div key={b.at} className="bypass-row">
              <span>{t('Bypass noticed: {d}, {app}, about {m} min', { d: `${fmtShort(b.date, lang)} ${new Date(b.at).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`, app: APP_NAME[b.app] ?? b.app, m: b.minutes })}</span>
              <b>−{b.penalty}</b>
            </div>
          ))}
          <div className="hint">{t('NextDNS saw the app open without minutes and outside a session. Each bypass is a penalty to work off with tasks, and the streak starts over.')}</div>
        </Section>
      )}

      {p.ledger.length > 0 && (
        <Section label={t('Minutes: recent')}>
          {p.ledger.slice(0, 15).map((l) => (
            <div key={l.id} className="ledger-row">
              <span>{ledgerLabel(l, t)}</span>
              <span className="muted">{fmtShort(l.date, lang)}</span>
              <b className={l.delta > 0 ? 'ok-ink' : ''}>{l.delta > 0 ? '+' : '−'}{Math.abs(Math.round(l.delta * 10) / 10)}</b>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
