import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { BOSSES, EARN, MAX_LEVEL, QUEST_WORDS, STAGES, type GameState, type QuestId, type Reward } from '@tracker/shared';
import { haptic } from '../tg';
import { useT } from '../i18n';
import { useToast } from './Toast';
import { Section, Sheet } from './ui';
import { Icon, Mascot, type MascotMood } from './Mascot';

export type GoTarget = 'reading' | 'words' | 'writing' | 'speaking' | 'boss' | 'today';

/** "+12 XP · +0.5 min · 3 min wait for Reading" */
export function rewardText(r: Reward, t: ReturnType<typeof useT>): string {
  const bits = [`+${r.xp} XP`];
  if (r.minutes > 0) bits.push(`+${r.minutes} ${t('min')}`);
  if (r.held > 0 && r.minutes === 0) bits.push(t('{n} min wait for Reading', { n: r.held }));
  return bits.join(' · ');
}

// ---------- Celebrations: level up, chest, boss ----------

type Celebration = { kind: 'level' | 'chest' | 'boss'; reward: Reward };
const CelebrateCtx = createContext<(r: Reward | null | undefined) => void>(() => {});

/** Show what an action brought: a toast for XP/minutes, a sheet with Elvis for a level, the chest or a boss. */
export function useCelebrate() {
  return useContext(CelebrateCtx);
}

export function CelebrateProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const t = useT();
  const [c, setC] = useState<Celebration | null>(null);
  const celebrate = useCallback(
    (r: Reward | null | undefined) => {
      if (!r) return;
      if (r.boss_won) setC({ kind: 'boss', reward: r });
      else if (r.level_after > r.level_before) setC({ kind: 'level', reward: r });
      else if (r.chest) setC({ kind: 'chest', reward: r });
      if (r.xp > 0 || r.minutes > 0) toast(rewardText(r, t));
      if (r.level_after > r.level_before || r.chest || r.boss_won) haptic.success();
    },
    [toast, t],
  );
  return (
    <CelebrateCtx.Provider value={celebrate}>
      {children}
      {c && (
        <Sheet title={c.kind === 'boss' ? t('Boss defeated') : c.kind === 'level' ? t('New level') : t('Chest opened')} onClose={() => setC(null)}>
          <div className="center celebrate">
            <div className="el-mascot center"><Mascot size={120} mood="cheer" /></div>
            {c.kind === 'level' || c.kind === 'boss' ? (
              <>
                <div className="level-big">{c.reward.level_after}</div>
                <div className="muted">{t('level')}</div>
              </>
            ) : (
              <span className="chest-icon">{Icon.chest(72)}</span>
            )}
            <p style={{ marginTop: 12 }}>
              {c.kind === 'boss'
                ? t('The gate is open — the next stage of the ladder is yours.')
                : c.kind === 'level'
                  ? t('Every level is real work: Reading, words, your own English.')
                  : t('All three quests done: +{n} min and +30 XP.', { n: EARN.chest })}
            </p>
            {c.reward.chest && c.kind !== 'chest' && <p className="muted small">{t('All three quests done: +{n} min and +30 XP.', { n: EARN.chest })}</p>}
            <button className="btn solid block" onClick={() => setC(null)}>{t('Continue')}</button>
          </div>
        </Sheet>
      )}
    </CelebrateCtx.Provider>
  );
}

// ---------- Elvis reacts to the day ----------

export function mascotLine(g: GameState, t: ReturnType<typeof useT>): { mood: MascotMood; text: string } {
  const reading = g.quests.find((q) => q.id === 'reading')!;
  if (g.boss?.unlocked && !g.boss.tried_today) return { mood: 'wait', text: t('The level {n} boss is waiting. Win at band {b} and the next stage opens.', { n: g.boss.level, b: g.boss.pass.toFixed(1) }) };
  if (g.chest.open) return { mood: 'cheer', text: g.streak.current > 1 ? t('All quests done. Streak: {n} days — see you tomorrow.', { n: g.streak.current }) : t('All quests done. Chest opened — see you tomorrow.') };
  if (!reading.done && g.minutes.held > 0) return { mood: 'wait', text: t('{n} min are waiting for Reading. One test and they are yours.', { n: g.minutes.held }) };
  if (!reading.done && g.streak.current > 0) return { mood: 'wait', text: t('Streak {n} days. Today’s Reading keeps it going.', { n: g.streak.current }) };
  if (!reading.done) return { mood: 'calm', text: t('Start with Reading: it pays the most and counts the day.') };
  const left = g.quests.filter((q) => !q.done).length;
  return { mood: 'cheer', text: t('Reading done. {n} more quests to the chest.', { n: left }) };
}

// ---------- Level ----------

export function LevelCard({ g, onLadder }: { g: GameState; onLadder?: () => void }) {
  const t = useT();
  const span = g.level_to != null ? g.level_to - g.level_from : 1;
  const pct = g.level_to != null ? Math.min(100, Math.round(((g.xp - g.level_from) / span) * 100)) : 100;
  return (
    <div className="section level-card">
      <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'center' }}>
        <div className="level-badge">{g.level}</div>
        <div className="grow">
          <div className="label" style={{ margin: 0 }}>{t('Level')} · {t(g.stage.name)}</div>
          <div className="small muted">{g.level_to != null ? t('{a} / {b} XP to level {n}', { a: g.xp, b: g.level_to, n: g.level + 1 }) : t('{a} XP — the top of the ladder', { a: g.xp })}</div>
        </div>
      </div>
      <div className="xp-bar"><i style={{ width: `${g.gated ? 100 : pct}%` }} /></div>
      {g.gated && g.boss && <div className="hint">{t('XP is enough for level {n}, but the boss holds the door. XP keeps counting.', { n: g.level + 1 })}</div>}
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="hint" style={{ margin: 0 }}>{t('Today +{n} XP', { n: g.today_xp })}</span>
        {onLadder && <button className="btn link" onClick={() => { haptic.tap(); onLadder(); }}>{t('See the ladder')}</button>}
      </div>
    </div>
  );
}

// ---------- Streak ----------

export function StreakCard({ g }: { g: GameState }) {
  const t = useT();
  return (
    <div className="section streak-card">
      <div className="row between" style={{ alignItems: 'center' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
          <span className={g.streak.today_done ? 'streak-on' : 'streak-off'}>{Icon.streak(36)}</span>
          <div>
            <div className="streak-num">{g.streak.current}<span>{t('days in a row')}</span></div>
            <div className="small muted">{t('best {n}', { n: g.streak.best })}{g.streak.shields ? ` · ${t('shields: {n}', { n: g.streak.shields })}` : ''}</div>
          </div>
        </div>
        <div className="week-dots">
          {g.week.map((d) => <i key={d.date} className={d.done ? 'on' : d.date === g.today ? 'today' : ''} title={d.date} />)}
        </div>
      </div>
      <div className="hint">{t('A day counts when its Reading quest is done. Miss a day and the streak starts again — unless you have a shield: every 7 days in a row earn one (up to 2), and it saves one missed day by itself.')}</div>
    </div>
  );
}

// ---------- Quests ----------

const QUEST_TEXT: Record<QuestId, { title: string; sub: string; go: GoTarget; icon: () => ReactNode }> = {
  reading: { title: 'Reading: one test', sub: 'The key quest: it counts the day for the streak and releases the minutes that wait for it.', go: 'reading', icon: () => Icon.book(22) },
  words: { title: 'Words: type the answers', sub: 'Russian meaning or a sentence with a gap → type the English word.', go: 'words', icon: () => Icon.star(22) },
  create: { title: 'Your own English', sub: 'One sentence with a word, a Writing text or a Speaking voice message.', go: 'writing', icon: () => Icon.pen(22) },
};

export function QuestList({ g, go }: { g: GameState; go: (to: GoTarget) => void }) {
  const t = useT();
  const done = g.quests.filter((q) => q.done).length;
  return (
    <Section label={`${t('Quests of the day')} · ${done} / 3`}>
      {g.quests.map((q) => {
        const meta = QUEST_TEXT[q.id];
        return (
          <button key={q.id} className={`quest${q.done ? ' done' : ''}`} onClick={() => { haptic.tap(); go(meta.go); }}>
            <span className="quest-icon">{q.done ? Icon.check(20) : meta.icon()}</span>
            <span className="grow">
              <span className="quest-title">{t(meta.title)}{q.id === 'words' ? ` · ${q.progress}/${q.target}` : ''}</span>
              <span className="quest-sub">{q.id === 'words' && q.target < QUEST_WORDS ? t('Fewer words learned so far — today the target is {n}.', { n: q.target }) : t(meta.sub)}</span>
              {q.id === 'words' && q.target > 0 && <span className="quest-bar"><i style={{ width: `${Math.round((q.progress / q.target) * 100)}%` }} /></span>}
            </span>
            {!q.done && <span className="arrow">→</span>}
          </button>
        );
      })}
      <div className={`chest-row${g.chest.open ? ' open' : ''}`}>
        <span className="chest-icon">{Icon.chest(28)}</span>
        <span className="grow small">{g.chest.open ? t('Chest opened today: +{n} min, +30 XP.', { n: g.chest.minutes }) : t('All three quests open the chest: +{n} min, +30 XP.', { n: g.chest.minutes })}</span>
      </div>
    </Section>
  );
}

// ---------- Boss ----------

export function BossCard({ g, onFight }: { g: GameState; onFight: () => void }) {
  const t = useT();
  const b = g.boss;
  if (!b) return null;
  return (
    <div className={`section boss-card${b.unlocked ? ' ready' : ''}`}>
      <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <span className="boss-icon">{b.unlocked ? Icon.trophy(30) : Icon.lock(26)}</span>
        <div className="grow">
          <div className="label" style={{ marginBottom: 2 }}>{t('Boss of level {n}', { n: b.level })}</div>
          <div className="boss-title">{b.title}</div>
          <div className="small muted">
            {t('A harder Reading test, {m} minutes. Win at band {b}.', { m: b.minutes, b: b.pass.toFixed(1) })}
            {b.best_band != null ? ` ${t('Your best: {b}.', { b: b.best_band.toFixed(1) })}` : ''}
          </div>
        </div>
      </div>
      {b.unlocked ? (
        b.tried_today ? (
          <div className="hint">{t('One try a day. Come back tomorrow — the answers stay hidden until you win.')}</div>
        ) : (
          <button className="btn solid block" style={{ marginTop: 12 }} onClick={() => { haptic.tap(); onFight(); }}>{t('Fight the boss')}</button>
        )
      ) : (
        <div className="hint">{t('Opens at level {n}. Until you beat it, the level stops at {n} (XP still counts).', { n: b.level })}</div>
      )}
    </div>
  );
}

// ---------- Ladder (level map) ----------

export function Ladder({ g }: { g: GameState }) {
  const t = useT();
  return (
    <div className="ladder">
      {[...STAGES].reverse().map((s) => {
        const boss = BOSSES.find((b) => b.level === s.to);
        const levels = Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i).reverse();
        return (
          <div key={s.name} className={`ladder-stage${g.level >= s.from ? ' reached' : ''}`}>
            <div className="ladder-name">{t(s.name)} <span className="muted">· {s.from}–{s.to}</span></div>
            <div className="ladder-steps">
              {levels.map((l) => {
                const isBoss = boss?.level === l;
                const beaten = isBoss && g.bosses_beaten.includes(boss!.id);
                const cls = `step${l < g.level || (l === g.level && beaten) ? ' past' : ''}${l === g.level ? ' current' : ''}${isBoss ? ' boss' : ''}`;
                return (
                  <div key={l} className={cls}>
                    <span className="step-n">{l}</span>
                    {isBoss && <span className="step-boss">{beaten ? Icon.check(14) : Icon.trophy(14)} {t('boss {b}', { b: boss!.pass.toFixed(1) })}</span>}
                    {l === g.level && <span className="step-you">{t('you')}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="hint">{t('Each step costs a bit more XP: 100, 125, 150… Levels up to {n}. At 5, 10, 15, 20 and 25 a boss guards the way.', { n: MAX_LEVEL })}</div>
    </div>
  );
}

// ---------- How the exchange works ----------

export function HowItWorks({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Sheet title={t('How it works')} onClose={onClose}>
      <Mascot size={72} message={t('Minutes for social media are earned by work. Reading pays the most; everything else is a small top-up.')} />
      <Section label={t('Minutes for work')}>
        <div className="rate-table">
          <div><span>{t('Reading test')}</span><b>{t('5–30 min by band')}</b></div>
          <div><span>{t('Boss')}</span><b>{t('like Reading + 100 XP')}</b></div>
          <div><span>{t('Writing text (120+ words)')}</span><b>{EARN.writing} {t('min')}</b></div>
          <div><span>{t('Speaking answer (voice, 60+ s)')}</span><b>{EARN.speaking} {t('min')} × {EARN.speakingPerDay}</b></div>
          <div><span>{t('Word typed right')}</span><b>{EARN.word} {t('min')}, {t('up to {n} a day', { n: EARN.wordsCap })}</b></div>
          <div><span>{t('Sentence with a word')}</span><b>{EARN.sentence} {t('min')}, {t('up to {n} a day', { n: EARN.sentencesCap })}</b></div>
          <div><span>{t('Chest (all three quests)')}</span><b>{EARN.chest} {t('min')}</b></div>
        </div>
        <p className="small" style={{ marginTop: 10 }}>{t('Without Reading today only {n} min from the other work are paid. The rest waits and is released the moment you finish a Reading test the same day. At midnight whatever still waits is gone.', { n: EARN.freeWithoutReading })}</p>
        <p className="small muted">{t('A rushed (under 4 minutes) or guessed (under 5 right) Reading test counts for nothing. The daily limit and the bank cap are in Settings → Social-media lock.')}</p>
      </Section>
      <Section label={t('XP and levels')}>
        <p className="small">{t('XP comes from everything: a Reading test 10 + 2 per right answer, a word 2, a sentence 5, Writing 40, Speaking 25, each quest 10, the chest 30, a boss 100. Nothing is entered by hand — the app counts what you actually did.')}</p>
      </Section>
      <button className="btn solid block" onClick={onClose}>{t('Close')}</button>
    </Sheet>
  );
}
