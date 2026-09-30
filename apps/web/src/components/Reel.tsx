import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { Icon } from './Mascot';
import { Target } from './Pointer';

export type ReelTab = 'home' | 'shop' | 'progress' | 'settings';

export interface ReelStep {
  caption: string;
  /** the app's bottom nav with this tab on; null — a full screen (a task, iOS) */
  tab: ReelTab | null;
  /** a nav tab to point at */
  tapTab?: ReelTab;
  screen: () => ReactNode;
}

/** The app's own look, in a small phone frame. */
function Phone({ step }: { step: ReelStep }) {
  const t = useT();
  const tabs: { id: ReelTab; label: string; icon: ReactNode }[] = [
    { id: 'home', label: t('Home'), icon: Icon.gems(16) },
    { id: 'shop', label: t('Shop'), icon: Icon.star(16) },
    { id: 'progress', label: t('Progress'), icon: Icon.chart(16) },
    { id: 'settings', label: t('Settings'), icon: Icon.gear(16) },
  ];
  return (
    <div className="demo-phone">
      <div className="demo-notch" />
      <div className={`demo-screen${step.tab ? '' : ' full'}`}>{step.screen()}</div>
      {step.tab && (
        <div className="demo-nav">
          {tabs.map((x) => {
            const inner = <span className={`demo-tab${step.tab === x.id ? ' on' : ''}`}>{x.icon}<b>{x.label}</b></span>;
            return <span key={x.id}>{step.tapTab === x.id ? <Target label={t('tap here')} side="top" align={x.id === 'settings' ? 'end' : 'center'}>{inner}</Target> : inner}</span>;
          })}
        </div>
      )}
    </div>
  );
}

/**
 * A step-by-step show in a phone frame: plays by itself and loops; the dots jump to a step, the button pauses.
 * The phone is drawn at 300 × 540 and scaled to the space it has.
 */
export function Reel({ steps, compact = false, stepMs = 4500 }: { steps: ReelStep[]; compact?: boolean; stepMs?: number }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / 300, compact ? 330 / 540 : 1));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % steps.length), stepMs);
    return () => window.clearTimeout(timer);
  }, [step, paused, steps.length, stepMs]);

  const cur = steps[step];
  return (
    <div className={`demo${compact ? ' compact' : ''}`}>
      <div className="demo-stage" ref={box} style={{ height: 540 * scale }}>
        <div className="demo-scale" style={{ transform: `scale(${scale})` }}>
          <div key={step} className="demo-step"><Phone step={cur} /></div>
        </div>
      </div>
      <div className="demo-caption" aria-live="polite"><span className="demo-num">{step + 1}/{steps.length}</span> {cur.caption}</div>
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
