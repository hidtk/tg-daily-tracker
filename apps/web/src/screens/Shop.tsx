import { useState } from 'react';
import { value, type ShopKind, type ShopResponse, type ShopTask } from '@tracker/shared';
import { haptic } from '../tg';
import { useT } from '../i18n';
import { Section } from '../components/ui';
import { TaskCard } from '../components/TaskCard';

type Filter = 'all' | 'reading' | 'words' | 'writing' | 'speaking';
type Sort = 'quick' | 'value';

const FILTERS: { id: Filter; label: string; kinds: ShopKind[] }[] = [
  { id: 'all', label: 'All', kinds: ['reading', 'words', 'quiz', 'sentence', 'writing', 'speaking'] },
  { id: 'reading', label: 'Reading', kinds: ['reading'] },
  { id: 'words', label: 'Words', kinds: ['words', 'quiz', 'sentence'] },
  { id: 'writing', label: 'Writing', kinds: ['writing'] },
  { id: 'speaking', label: 'Speaking', kinds: ['speaking'] },
];

/** The Shop: every task with its price in minutes, time and difficulty. Quick = fewer minutes, long or hard = more. */
export function Shop({ shop, onStart }: { shop: ShopResponse | null; onStart: (task: ShopTask) => void }) {
  const t = useT();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('quick');
  if (!shop) return <span className="spinner" />;

  const kinds = FILTERS.find((f) => f.id === filter)!.kinds;
  const mine = shop.tasks.filter((x) => kinds.includes(x.kind));
  const cmp = (a: ShopTask, b: ShopTask) => (sort === 'quick' ? a.minutes - b.minutes || b.price - a.price : value(b) - value(a) || a.minutes - b.minutes);
  const now = mine.filter((x) => x.status === 'open' || x.status === 'retry').sort(cmp);
  const later = mine.filter((x) => x.status === 'wait' || x.status === 'cap' || x.status === 'empty');
  const done = mine.filter((x) => x.status === 'done');

  return (
    <div className="screen">
      <h1>{t('Shop')}</h1>
      <p className="muted small">{t('Pick a task: a quick one pays less, a long or hard one pays more. The price is paid when the check passes.')}</p>
      <div className="chips" style={{ marginBottom: 10 }}>
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip ${filter === f.id ? 'on' : ''}`} onClick={() => { haptic.select(); setFilter(f.id); }}>{t(f.label)}</button>
        ))}
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {(['quick', 'value'] as Sort[]).map((s) => (
          <button key={s} className={`chip ${sort === s ? 'on' : ''}`} onClick={() => { haptic.select(); setSort(s); }}>{s === 'quick' ? t('Quick first') : t('Best value first')}</button>
        ))}
      </div>
      <div className="muted small" style={{ marginBottom: 12 }}>{t('Earned today {a} of {b} min · {c} more possible', { a: shop.earned_today, b: shop.daily_cap, c: shop.earn_left })}</div>

      {now.map((x) => <TaskCard key={x.id} task={x} onStart={onStart} />)}
      {!now.length && <p className="muted">{t('Nothing open here right now.')}</p>}

      {later.length > 0 && (
        <Section label={t('Later')}>
          {later.map((x) => <TaskCard key={x.id} task={x} onStart={onStart} />)}
        </Section>
      )}
      {done.length > 0 && (
        <Section label={t('Done today')}>
          {done.map((x) => <TaskCard key={x.id} task={x} onStart={onStart} />)}
        </Section>
      )}
      <div className="hint">{t('Limits: words pay for 10 answers a day, the Quick test for 5 tests, sentences for 5 (only when the meaning check is on), each Writing and Speaking task once a day, a Reading task once. A task does not pay twice.')}</div>
    </div>
  );
}
