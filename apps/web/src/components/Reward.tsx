import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ACHIEVEMENTS, type AchievementId, type Payout } from '@tracker/shared';
import { haptic } from '../tg';
import { useT } from '../i18n';
import { useToast } from './Toast';
import { Sheet } from './ui';
import { Icon, Mascot } from './Mascot';

/** Achievement texts: a name and, in plain words, how to get it. */
export const ACHIEVEMENT_TEXT: Record<AchievementId, { title: string; how: string }> = {
  first: { title: 'First task', how: 'Do any task from the Shop and get minutes for it.' },
  reading10: { title: 'Reader', how: 'Pass 10 Reading tasks: at least half of the answers right.' },
  passage: { title: 'Whole passage', how: 'Finish one text: all three parts, or the whole passage at once.' },
  perfect5: { title: 'No mistakes', how: 'Answer every question right in 5 Reading tasks.' },
  words50: { title: 'Vocabulary', how: 'Type 50 words right without a hint.' },
  sentences20: { title: 'Own sentences', how: 'Write 20 sentences that pass the check.' },
  writing5: { title: 'Author', how: 'Get 5 Writing texts accepted.' },
  speaking5: { title: 'Voice', how: 'Get 5 Speaking answers counted.' },
  mix: { title: 'A bit of everything', how: 'In one day: a Reading task, words or a sentence, and Writing or Speaking.' },
  week: { title: 'Week in a row', how: 'Do at least one task with minutes 7 days in a row.' },
  days30: { title: '30 days', how: 'Do tasks with minutes on 30 different days, not necessarily in a row.' },
};

const Ctx = createContext<(p: Payout | null | undefined) => void>(() => {});

/** Show what a task brought: a toast with the minutes, and a sheet with Elvis for a new achievement. */
export function useReward() {
  return useContext(Ctx);
}

export function RewardProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const t = useT();
  const [got, setGot] = useState<AchievementId[]>([]);
  const show = useCallback(
    (p: Payout | null | undefined) => {
      if (!p) return;
      if (p.minutes > 0) toast(t('+{n} min of social media', { n: p.minutes }));
      else if (p.capped) toast(t('Today’s limit of minutes is reached'));
      if (p.achievements.length) {
        haptic.success();
        setGot(p.achievements);
      }
    },
    [toast, t],
  );
  return (
    <Ctx.Provider value={show}>
      {children}
      {got.length > 0 && (
        <Sheet title={t('New achievement')} onClose={() => setGot([])}>
          <div className="center">
            <div className="el-mascot center"><Mascot size={110} mood="cheer" /></div>
            {got.map((id) => {
              const def = ACHIEVEMENTS.find((a) => a.id === id)!;
              return (
                <div key={id} className="ach-new">
                  <span className="ach-badge on">{Icon.trophy(28)}</span>
                  <div className="ach-title">{t(ACHIEVEMENT_TEXT[id].title)}</div>
                  <div className="muted small">{t(ACHIEVEMENT_TEXT[id].how)}</div>
                  <div className="result-earn">{t('+{n} min bonus', { n: def.bonus })}</div>
                </div>
              );
            })}
            <button className="btn solid block" style={{ marginTop: 16 }} onClick={() => setGot([])}>{t('Continue')}</button>
          </div>
        </Sheet>
      )}
    </Ctx.Provider>
  );
}
