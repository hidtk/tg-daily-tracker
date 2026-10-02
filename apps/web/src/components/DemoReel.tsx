import { useEffect, useState } from 'react';
import type { Criterion, ShopTask } from '@tracker/shared';
import { useT } from '../i18n';
import { Icon, Mascot } from './Mascot';
import { TaskCard } from './TaskCard';
import { Checklist } from './Checklist';
import { Reel, type ReelStep } from './Reel';

const TASKS: ShopTask[] = [
  { id: 'demo-r', kind: 'reading', status: 'open', minutes: 8, price: 5, level: 2, earned: 0, title: 'The Return of the Tram', part: 'tfng', questions: 5 },
  { id: 'demo-w', kind: 'writing', status: 'open', minutes: 8, price: 5, level: 1, earned: 0, title: 'Phones at school', size: 'short' },
];

const WRITING_CHECK: Criterion[] = [
  { id: 'length', ok: true, value: 74, need: 60 },
  { id: 'vocab', ok: true, value: 2, need: 2 },
  { id: 'linking', ok: true, value: 2, need: 1 },
  { id: 'time', ok: true, value: 9, need: 4 },
];

export function Balance({ minutes, open }: { minutes: number; open: boolean }) {
  const t = useT();
  return (
    <div className="section minutes-card demo-balance">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="label" style={{ marginBottom: 2 }}>{t('Social-media minutes')}</div>
          <div className="balance">{minutes}<span>{t('min')}</span></div>
        </div>
        <span style={{ color: open ? 'var(--primary)' : 'var(--ink-muted)' }}>{open ? Icon.gems(34) : Icon.lock(34)}</span>
      </div>
      <div className="muted small">{open ? t('Social media is open while there are minutes.') : t('Social media is closed. A task opens it.')}</div>
    </div>
  );
}

/** Answers appear one by one, like someone tapping them. */
function ReadingScreen() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setN((x) => Math.min(3, x + 1)), 900);
    return () => window.clearInterval(timer);
  }, []);
  const qs = [
    { q: 'Many cities removed their trams in the mid-twentieth century.', a: 'TRUE' },
    { q: 'Modern trams are cheaper to build than bus lanes.', a: 'NOT GIVEN' },
    { q: 'Paris opened France’s first tramway in the 1990s.', a: 'FALSE' },
  ];
  return (
    <div className="demo-pad">
      <div className="demo-title">The Return of the Tram</div>
      <p className="demo-passage">A. For most of the twentieth century, the tram was treated as an embarrassment. Between 1930 and 1960, cities across Europe tore up thousands of kilometres of rail…</p>
      {qs.map((x, i) => (
        <div key={i} className="demo-q">
          <div className="small"><b>{i + 1}.</b> {x.q}</div>
          <div className="chips">
            {['TRUE', 'FALSE', 'NOT GIVEN'].map((o) => <span key={o} className={`chip${i < n && o === x.a ? ' on' : ''}`}>{o}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Minutes run down in an app, then the iPhone sends you to the Home Screen. */
export function SessionScreen({ start = 9, note }: { start?: number; note?: string }) {
  const t = useT();
  const [left, setLeft] = useState(start);
  useEffect(() => {
    const timer = window.setInterval(() => setLeft((x) => Math.max(0, x - 3)), 700);
    return () => window.clearInterval(timer);
  }, []);
  if (left > 0) {
    return (
      <div className="demo-app">
        <div className="demo-app-bar">{t('Social media')} · {t('{n} min left', { n: left })}</div>
        <div className="demo-feed"><i /><i /><i /></div>
      </div>
    );
  }
  return (
    <div className="demo-home">
      <div className="demo-home-note">{Icon.lock(18)} {note ?? t('Time is up — the Home Screen')}</div>
      <div className="demo-grid">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
    </div>
  );
}

/**
 * The app plays itself: no minutes → set up the lock once → the Shop → a task → the check → minutes →
 * social media until they run out → an achievement.
 */
export function DemoReel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const steps: ReelStep[] = [
    {
      caption: t('No minutes — Instagram, TikTok, YouTube and VK are closed.'),
      tab: 'home',
      screen: () => (
        <div className="demo-pad">
          <Balance minutes={0} open={false} />
          <Mascot size={56} mood="wait" message={t('Pick a task in the Shop.')} />
        </div>
      ),
    },
    {
      caption: t('Once: turn on the lock — Settings → Social-media lock (shown step by step below).'),
      tab: 'home',
      tapTab: 'settings',
      screen: () => (
        <div className="demo-pad">
          <Balance minutes={0} open={false} />
          <div className="section small"><b>{t('Social-media lock')}</b><div className="muted">{t('Without it social media opens freely. It takes about 5 minutes, once.')}</div></div>
        </div>
      ),
    },
    {
      caption: t('Pick a task: the card says how long it takes and how many minutes it pays.'),
      tab: 'shop',
      screen: () => (
        <div className="demo-pad">
          <div className="demo-title">{t('Shop')}</div>
          <div className="demo-gap"><TaskCard task={TASKS[0]} onStart={() => undefined} hint={t('tap here')} /></div>
          <TaskCard task={TASKS[1]} onStart={() => undefined} />
        </div>
      ),
    },
    { caption: t('Answer the questions — usually 5 to 10 minutes.'), tab: null, screen: () => <ReadingScreen /> },
    {
      caption: t('The server checks by the answer key and pays the minutes at once.'),
      tab: null,
      screen: () => (
        <div className="demo-pad center">
          <div className="el-mascot center"><Mascot size={70} mood="cheer" /></div>
          <div className="result-band">4<span className="muted" style={{ fontSize: 24 }}> / 5</span></div>
          <div className="muted small">{t('right answers')}</div>
          <div className="result-earn" style={{ marginTop: 10 }}>{t('+{n} min of social media', { n: 4 })}</div>
        </div>
      ),
    },
    {
      caption: t('Writing and Speaking are checked point by point: you see what counted and what to fix.'),
      tab: null,
      screen: () => (
        <div className="demo-pad">
          <div className="demo-title">Writing · {t('short text')}</div>
          <div className="answer-box ok"><Checklist criteria={WRITING_CHECK} /></div>
          <div className="result-earn" style={{ marginTop: 12 }}>{t('+{n} min of social media', { n: 5 })}</div>
        </div>
      ),
    },
    {
      caption: t('Minutes open social media.'),
      tab: 'home',
      screen: () => (
        <div className="demo-pad">
          <Balance minutes={9} open />
          <Mascot size={56} mood="cheer" message={t('You have {n} min. Earn more with a task below, or spend them.', { n: 9 })} />
        </div>
      ),
    },
    { caption: t('Time is up — the iPhone sends you to the Home Screen by itself.'), tab: null, screen: () => <SessionScreen /> },
    {
      caption: t('Achievements give bonus minutes; the rule is written under each one.'),
      tab: null,
      screen: () => (
        <div className="demo-pad center">
          <div className="el-mascot center"><Mascot size={70} mood="cheer" /></div>
          <span className="ach-badge on" style={{ margin: '0 auto' }}>{Icon.trophy(26)}</span>
          <div className="ach-title" style={{ marginTop: 8 }}>{t('First task')}</div>
          <div className="muted small">{t('Do any task from the Shop and get minutes for it.')}</div>
          <div className="result-earn" style={{ marginTop: 10 }}>{t('+{n} min bonus', { n: 2 })}</div>
        </div>
      ),
    },
  ];
  return <Reel steps={steps} compact={compact} stepMs={4200} />;
}
