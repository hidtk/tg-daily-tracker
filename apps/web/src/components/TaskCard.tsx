import type { ShopTask } from '@tracker/shared';
import { haptic } from '../tg';
import { useT } from '../i18n';
import { Icon } from './Mascot';

type T = ReturnType<typeof useT>;

const PART_LABEL = { tfng: 'TRUE / FALSE / NOT GIVEN', mcq: 'Choose A, B, C or D', gap: 'Fill the gaps', all: 'The whole passage' } as const;

/** "Reading", "Writing · long text"… */
export function taskName(task: ShopTask, t: T): string {
  switch (task.kind) {
    case 'reading':
      return task.hard ? `Reading · ${t('hard text')}` : 'Reading';
    case 'words':
      return t('Words');
    case 'sentence':
      return t('A sentence with a word');
    case 'writing':
      return `Writing · ${task.size === 'long' ? t('long text') : t('short text')}`;
    case 'speaking':
      return `Speaking · ${task.size === 'long' ? t('long answer') : t('short answer')}`;
  }
}

/** What exactly: the passage and the question type, the topic, the card. */
export function taskWhat(task: ShopTask, t: T): string {
  switch (task.kind) {
    case 'reading':
      return `${task.title} · ${t(PART_LABEL[task.part ?? 'all'])} · ${t('{n} questions', { n: task.questions ?? 0 })}`;
    case 'words':
      return t('See the Russian meaning or a sentence with a gap, type the English word.');
    case 'sentence':
      return t('Your own sentence with a word of the day. {n} more today.', { n: task.left ?? 0 });
    case 'writing':
      return `${task.title} · ${task.size === 'long' ? t('150+ words') : t('60+ words')}`;
    case 'speaking':
      return `${task.title} · ${task.size === 'long' ? t('a voice message of 100+ seconds') : t('a voice message of 45+ seconds')}`;
  }
}

/** Paid in proportion to the answers: "up to". */
const upTo = (task: ShopTask) => task.kind === 'reading' || task.kind === 'words';

export function Level({ level }: { level: 1 | 2 | 3 }) {
  const t = useT();
  return (
    <span className={`level l${level}`} title={t('Difficulty')}>
      {[1, 2, 3].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}
      <span>{t(level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Hard')}</span>
    </span>
  );
}

function statusText(task: ShopTask, t: T): string | null {
  switch (task.status) {
    case 'retry':
      return t('Retry: last time it was not passed');
    case 'wait':
      return t('Not passed today — a retry opens tomorrow');
    case 'done':
      return t('Done today: +{n} min', { n: task.earned });
    case 'cap':
      return t('Today’s limit of minutes is reached — back tomorrow');
    case 'empty':
      return t('Nothing to review yet: new words are asked from the next day');
    default:
      return null;
  }
}

/** A shop card: what it is, time, difficulty and the deal in plain words. */
export function TaskCard({ task, onStart }: { task: ShopTask; onStart: (task: ShopTask) => void }) {
  const t = useT();
  const doable = task.status === 'open' || task.status === 'retry';
  const status = statusText(task, t);
  return (
    <div className={`task-card k-${task.kind}${doable ? '' : ' off'}`}>
      <div className="task-top">
        <span className="task-icon">{task.kind === 'reading' ? Icon.book(22) : task.kind === 'writing' || task.kind === 'sentence' ? Icon.pen(22) : task.kind === 'speaking' ? Icon.mic(22) : Icon.star(22)}</span>
        <div className="grow">
          <div className="task-name">{taskName(task, t)}</div>
          <div className="task-what">{taskWhat(task, t)}</div>
        </div>
        <div className="task-price">
          <b>+{task.price}</b>
          <span>{t('min')}</span>
        </div>
      </div>
      <div className="task-deal">
        {upTo(task)
          ? t('Do it in ~{m} min → get up to {p} min of social media', { m: task.minutes, p: task.price })
          : t('Do it in ~{m} min → get {p} min of social media', { m: task.minutes, p: task.price })}
      </div>
      <div className="task-foot">
        <Level level={task.level} />
        {doable ? (
          <button className="btn solid sm" onClick={() => { haptic.tap(); onStart(task); }}>{task.status === 'retry' ? t('Retry') : t('Start')}</button>
        ) : (
          <span className={`task-status s-${task.status}`}>{status}</span>
        )}
      </div>
      {doable && status && <div className="task-status s-retry">{status}</div>}
    </div>
  );
}
