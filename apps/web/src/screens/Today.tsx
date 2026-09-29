import { useCallback, useEffect, useState } from 'react';
import type { GameState, TodayResponse, WalletResponse } from '@tracker/shared';
import { GATE_APP_LABEL, SKILL_LABEL, addDays, diffDays, isEditable } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic } from '../tg';
import { Section, Sheet, fmtDate } from '../components/ui';
import { BossCard, HowItWorks, Ladder, LevelCard, QuestList, StreakCard, mascotLine, type GoTarget } from '../components/Game';
import { useLang, useT } from '../i18n';
import { Icon, Mascot } from '../components/Mascot';

/** Social-media minutes: the first thing on the home screen. Shows a debt, minutes waiting for Reading and a running session. */
function MinutesCard({ g, onEarn, onHow }: { g: GameState | null; onEarn?: () => void; onHow: () => void }) {
  const t = useT();
  const [w, setW] = useState<WalletResponse | null>(null);
  useEffect(() => {
    api.wallet().then(setW).catch(() => undefined);
  }, []);
  if (!w) return <div className="section minutes-card"><span className="spinner" style={{ margin: '18px auto' }} /></div>;
  const debt = w.balance < 0;
  const bal = Math.floor(w.balance);
  const open = w.lock.state === 'open';
  const held = g?.minutes.held ?? 0;
  return (
    <div className="section minutes-card">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>{debt ? t('Debt') : t('Social-media minutes')}</div>
          <div className={`balance${debt ? ' debt' : ''}`}>{debt ? `−${Math.ceil(-w.balance)}` : bal}<span>{t('min')}</span></div>
        </div>
        <span style={{ color: bal < 1 ? 'var(--ink-muted)' : 'var(--primary)' }}>{Icon.gems(40)}</span>
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>
        {w.session
          ? t('In {app} now · {n} min left', { app: GATE_APP_LABEL[w.session.app], n: Math.floor(w.session.seconds_left / 60) })
          : open
            ? t('Open · {n} min left', { n: w.lock.remaining_min })
            : debt
              ? t('Time used beyond the paid minutes. The next earnings pay it back first; until then social media stays locked.')
              : bal < 1
                ? t('Social media is locked. Pass a Reading test to open it.')
                : t('Earned today {a} of {b} min', { a: g?.minutes.earned ?? w.earned_today, b: w.daily_earn_cap })}
      </div>
      {held > 0 && <div className="held-chip">{Icon.lock(16)} {t('{n} min wait for today’s Reading', { n: held })}</div>}
      {onEarn && <button className="btn solid block" style={{ marginTop: 12 }} onClick={() => { haptic.tap(); onEarn(); }}>{bal < 1 ? t('Earn minutes') : t('Earn more')}</button>}
      <button className="btn link" style={{ marginTop: 10 }} onClick={() => { haptic.tap(); onHow(); }}>{t('How minutes are earned')}</button>
    </div>
  );
}

export function Today({ isNew, go }: { isNew: boolean; go: (to: GoTarget) => void }) {
  const t = useT();
  const { lang } = useLang();
  const [date, setDate] = useState<string | undefined>(undefined);
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [g, setG] = useState<GameState | null>(null);
  const [how, setHow] = useState(false);
  const [ladder, setLadder] = useState(false);

  useEffect(() => {
    api.game().then(setG).catch(() => undefined);
  }, []);

  const load = useCallback(async (d?: string) => {
    setError(null);
    try {
      setData(await api.today(d));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Could not load'));
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  if (error) return <div className="screen"><div className="err">{error}</div></div>;
  if (!data) return <span className="spinner" />;

  const today = data.today;
  const cur = data.date;
  const canBack = isEditable(addDays(cur, -1), today, 60);
  const canFwd = diffDays(cur, today) > 0;
  const act = data.activities.find((a) => a.kind === 'ielts') ?? data.activities[0];
  const e = act ? data.entries.find((x) => x.activity_id === act.id) : undefined;
  const counted = !!e?.done && (e.minutes > 0 || !!e.skills?.length);
  const daysLeft = data.exam_date ? diffDays(cur, data.exam_date) : null;

  return (
    <div className="screen">
      <div className="date-head">
        <h1 style={{ margin: 0 }}>{fmtDate(cur, today, lang)}</h1>
        <div className="nav-arrows">
          <button disabled={!canBack} onClick={() => { haptic.tap(); setDate(addDays(cur, -1)); }}>‹</button>
          <button disabled={!canFwd} onClick={() => { haptic.tap(); setDate(diffDays(cur, today) === 1 ? undefined : addDays(cur, 1)); }}>›</button>
        </div>
      </div>
      <div className="countdown">
        {daysLeft != null
          ? daysLeft >= 0
            ? <><b>{daysLeft}</b> {t('days to the exam')} · {t('target')} <b>{data.target.toFixed(1)}</b></>
            : t('The exam date has passed')
          : <>{t('Target')} <b>{data.target.toFixed(1)}</b> · {t('set the exam date in Settings')}</>}
      </div>

      {cur === today && <MinutesCard g={g} onEarn={() => go('reading')} onHow={() => setHow(true)} />}

      {cur === today && g && (() => {
        const line = mascotLine(g, t);
        return <Mascot size={80} mood={line.mood} message={isNew ? t('Welcome. Earn social-media minutes with Reading, words and your own English. Three quests a day, levels, a streak and bosses — everything is counted by itself.') : line.text} />;
      })()}

      {cur === today && g && (
        <>
          <QuestList g={g} go={go} />
          <LevelCard g={g} onLadder={() => setLadder(true)} />
          <StreakCard g={g} />
          <BossCard g={g} onFight={() => go('boss')} />
        </>
      )}

      {(data.lessons_today.length > 0 || data.homeworks.length > 0) && (
        <Section label={data.lessons_today.length ? t('Lesson') : t('Homework')}>
          {data.lessons_today.map((l) => (
            <div key={l.id}><b>{l.title}</b> {t('today at')} {l.time}</div>
          ))}
          {data.homeworks.length > 0 && (
            <div style={{ marginTop: data.lessons_today.length ? 10 : 0 }}>
              {data.homeworks.map((h) => (
                <div key={h.id} className="hw-row">
                  <button type="button" className="hw-check" title="Done" onClick={async () => {
                    haptic.success();
                    await api.completeHomework(h.id);
                    void load(date);
                  }} />
                  <div className="grow">
                    <div>{h.text}</div>
                    <div className="muted small">
                      {h.due_date ? (diffDays(today, h.due_date) === 0 ? t('due today') : diffDays(today, h.due_date) < 0 ? t('overdue') : `${t('due')} ${h.due_date}`) : t('no deadline')}
                      {h.tags.length ? ` · ${h.tags.join(', ')}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              <div className="hint">{t('Add homework in the chat:')} <i>/hw text</i>, {t('or a photo captioned “hw”.')}</div>
            </div>
          )}
        </Section>
      )}

      <Section label={cur === today ? t('Counted today') : t('Counted this day')}>
        {counted ? (
          <>
            <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
              <span className="balance" style={{ fontSize: 32 }}>{Math.round(e!.minutes)}<span>{t('min')}</span></span>
              <span style={{ color: 'var(--success, var(--primary))' }}>{Icon.check(22)}</span>
            </div>
            {!!e!.skills?.length && (
              <div className="chips" style={{ marginTop: 8 }}>
                {e!.skills.map((sk) => <span key={sk} className="chip on">{t(SKILL_LABEL[sk])}</span>)}
              </div>
            )}
          </>
        ) : (
          <div className="muted small">{cur === today ? t('Nothing yet. Any Reading test, word, sentence, Writing or Speaking counts the day by itself.') : t('Nothing was done this day.')}</div>
        )}
        <div className="hint">{t('Logged automatically: Reading and Writing by time spent, words, sentences, Speaking by the voice length. Nothing to enter by hand.')}</div>
      </Section>

      {how && <HowItWorks onClose={() => setHow(false)} />}
      {ladder && g && (
        <Sheet title={t('Level ladder')} onClose={() => setLadder(false)}>
          <Ladder g={g} />
        </Sheet>
      )}
    </div>
  );
}
