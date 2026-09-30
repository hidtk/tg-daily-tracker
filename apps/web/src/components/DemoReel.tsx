import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Criterion, ShopTask } from '@tracker/shared';
import { useT } from '../i18n';
import { Icon, Mascot } from './Mascot';
import { TaskCard } from './TaskCard';
import { Checklist } from './Checklist';
import { Pointer } from './Pointer';

/** How long each step stays on screen. */
const STEP_MS = 4200;

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

/** The app's own look, in a small phone frame: a status line and the screen. */
function Phone({ children, tab }: { children: ReactNode; tab?: 'home' | 'shop' | null }) {
  const t = useT();
  return (
    <div className="demo-phone">
      <div className="demo-notch" />
      <div className="demo-screen">{children}</div>
      {tab !== null && (
        <div className="demo-nav">
          <span className={tab === 'home' ? 'on' : ''}>{Icon.gems(16)}<b>{t('Home')}</b></span>
          <span className={tab === 'shop' ? 'on' : ''}>{Icon.star(16)}<b>{t('Shop')}</b></span>
          <span>{Icon.chart(16)}<b>{t('Progress')}</b></span>
          <span>{Icon.gear(16)}<b>{t('Settings')}</b></span>
        </div>
      )}
    </div>
  );
}

function Balance({ minutes, open }: { minutes: number; open: boolean }) {
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
function ReadingScreen({ active }: { active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return setN(0);
    const timer = window.setInterval(() => setN((x) => Math.min(3, x + 1)), 900);
    return () => window.clearInterval(timer);
  }, [active]);
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
function SessionScreen({ active }: { active: boolean }) {
  const t = useT();
  const [sec, setSec] = useState(9);
  useEffect(() => {
    if (!active) return setSec(9);
    const timer = window.setInterval(() => setSec((x) => Math.max(0, x - 3)), 700);
    return () => window.clearInterval(timer);
  }, [active]);
  if (sec > 0) {
    return (
      <div className="demo-app">
        <div className="demo-app-bar">{t('Social media')} · {t('{n} min left', { n: sec })}</div>
        <div className="demo-feed"><i /><i /><i /></div>
      </div>
    );
  }
  return (
    <div className="demo-home">
      <div className="demo-home-note">{Icon.lock(18)} {t('Time is up — the Home Screen')}</div>
      <div className="demo-grid">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
    </div>
  );
}

/**
 * The step-by-step show: the app plays itself — no minutes → the Shop → a task → the check → minutes →
 * social media until they run out → an achievement. Loops; the dots jump to a step, the button pauses.
 */
export function DemoReel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // The phone is drawn at 300 × 540 and scaled to the space it has.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / 300, compact ? 330 / 540 : 1));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);

  const steps: { caption: string; screen: (active: boolean) => ReactNode; tab: 'home' | 'shop' | null }[] = [
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
      caption: t('Pick a task: the card says how long it takes and how many minutes it pays.'),
      tab: 'shop',
      screen: () => (
        <div className="demo-pad">
          <div className="demo-title">{t('Shop')}</div>
          <TaskCard task={TASKS[0]} onStart={() => undefined} />
          <div className="demo-pointer"><Pointer label={t('tap here')} dir="up" /></div>
          <TaskCard task={TASKS[1]} onStart={() => undefined} />
        </div>
      ),
    },
    { caption: t('Answer the questions — usually 5 to 10 minutes.'), tab: null, screen: (a) => <ReadingScreen active={a} /> },
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
    { caption: t('Time is up — the iPhone sends you to the Home Screen by itself.'), tab: null, screen: (a) => <SessionScreen active={a} /> },
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

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % steps.length), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [step, paused, steps.length]);

  const cur = steps[step];
  return (
    <div className={`demo${compact ? ' compact' : ''}`}>
      <div className="demo-stage" ref={box} style={{ height: 540 * scale }}>
        <div className="demo-scale" style={{ transform: `scale(${scale})` }}>
          <Phone tab={cur.tab}>
            <div key={step} className="demo-step">{cur.screen(true)}</div>
          </Phone>
        </div>
      </div>
      <div className="demo-caption" aria-live="polite">{cur.caption}</div>
      <div className="demo-controls">
        <div className="demo-dots">
          {steps.map((_, i) => (
            <button key={i} className={i === step ? 'on' : i < step ? 'past' : ''} aria-label={t('Step {n}', { n: i + 1 })} onClick={() => setStep(i)} />
          ))}
        </div>
        <button className="btn link small" onClick={() => setPaused((p) => !p)}>{paused ? t('Play') : t('Pause')}</button>
      </div>
    </div>
  );
}
