import { useState, type ReactNode } from 'react';
import type { WalletResponse } from '@tracker/shared';
import { api } from '../api';
import { haptic } from '../tg';
import { useT } from '../i18n';
import { Icon, Mascot } from './Mascot';
import { ShortcutsGuide } from './ShortcutsGuide';

const VIDEO = `${import.meta.env.BASE_URL}onboarding/elvis-intro.mp4`;
const POSTER = `${import.meta.env.BASE_URL}onboarding/elvis-poster.svg`;

/** A curved arrow with a label that points at a real button in the mock-up. */
function Pointer({ label, dir = 'down' }: { label: string; dir?: 'down' | 'left' | 'up' }) {
  return (
    <span className={`pointer ${dir}`} aria-hidden="true">
      <span className="pointer-label">{label}</span>
      <svg viewBox="0 0 48 40" width="44" height="36">
        <path d="M6 4 C 10 22, 22 30, 38 30" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M30 22 L 40 30 L 30 37" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Intro video from Elvis; until the file exists (or if it fails) a poster with the mascot stands in, without errors. */
function IntroVideo() {
  const t = useT();
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="onb-video placeholder">
        <Mascot size={84} />
        <div className="small muted">{t('A short video from Elvis will be here soon.')}</div>
      </div>
    );
  }
  return <video className="onb-video" src={VIDEO} poster={POSTER} loop muted playsInline controls preload="metadata" onError={() => setFailed(true)} />;
}

function MockNav({ active }: { active: 'home' | 'shop' | 'progress' | 'settings' }) {
  const t = useT();
  const tabs = [
    { id: 'home', label: t('Home'), icon: Icon.gems(20) },
    { id: 'shop', label: t('Shop'), icon: Icon.star(20) },
    { id: 'progress', label: t('Progress'), icon: Icon.chart(20) },
    { id: 'settings', label: t('Settings'), icon: Icon.gear(20) },
  ];
  return (
    <div className="mock-nav">
      {tabs.map((x) => (
        <span key={x.id} className={x.id === active ? 'on' : ''}>
          {x.icon}
          <span>{x.label}</span>
          {x.id === active && <Pointer label={t('tap here')} />}
        </span>
      ))}
    </div>
  );
}

function Flow({ items }: { items: ReactNode[] }) {
  return (
    <div className="flow">
      {items.map((x, i) => (
        <span key={i} className="flow-item">
          {x}
          {i < items.length - 1 && <span className="flow-arrow">{'→'}</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * First run (and «Как это работает» in Settings): five screens, each with one title, one or two short sentences
 * and a "tap here" diagram of the real buttons. Works at 360px.
 */
export function Onboarding({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [guide, setGuide] = useState<WalletResponse | null>(null);

  const finish = () => {
    haptic.success();
    api.onboarded(true).catch(() => undefined);
    onClose();
  };
  const openGuide = async () => {
    haptic.tap();
    try {
      setGuide(await api.wallet());
    } catch {
      /* the guide is also in Settings */
    }
  };

  const screens: { title: string; text: string; pic: ReactNode }[] = [
    {
      title: t('Study earns social media'),
      text: t('Do small IELTS tasks and get minutes. Minutes open Instagram, TikTok, YouTube and VK.'),
      pic: (
        <>
          <IntroVideo />
          <Flow items={[<span className="flow-chip">{Icon.book(18)} {t('task')}</span>, <span className="flow-chip">+5 {t('min')}</span>, <span className="flow-chip">{Icon.gems(18)} {t('social media')}</span>]} />
        </>
      ),
    },
    {
      title: t('Minutes are earned in the Shop'),
      text: t('Each card says how long it takes and how many minutes it pays. Quick tasks pay less, long or hard ones pay more.'),
      pic: (
        <div className="mock">
          <div className="mock-card">
            <div className="row between" style={{ flexWrap: 'nowrap' }}>
              <b>Reading</b>
              <b className="mock-price">+5 {t('min')}</b>
            </div>
            <div className="small muted">{t('Do it in ~{m} min → get up to {p} min of social media', { m: 8, p: 5 })}</div>
            <div className="mock-btn-row">
              <span className="mock-btn">{t('Start')}</span>
              <Pointer label={t('tap here')} dir="left" />
            </div>
          </div>
          <MockNav active="shop" />
        </div>
      ),
    },
    {
      title: t('Spend them, and when they run out'),
      text: t('Minutes are spent by the real time in the app. At zero the iPhone sends you to the Home Screen; overuse becomes a debt the next task pays back.'),
      pic: (
        <div className="mock">
          <Flow items={[<span className="flow-chip big">12 {t('min')}</span>, <span className="flow-chip">{t('social media open')}</span>]} />
          <Flow items={[<span className="flow-chip big off">0 {t('min')}</span>, <span className="flow-chip">{Icon.lock(18)} {t('Home Screen')}</span>]} />
        </div>
      ),
    },
    {
      title: t('Set up the lock on the iPhone once'),
      text: t('About 10 minutes: two automations in the Shortcuts app. The step-by-step guide is in Settings → Social-media lock. With AmneziaVPN, NextDNS goes inside Amnezia (step 7).'),
      pic: (
        <div className="mock">
          <div className="mock-phone">
            <div className="mock-phone-title">{t('Shortcuts')}</div>
            <div className="mock-phone-plus">+</div>
            <Pointer label={t('tap here')} dir="up" />
            <div className="mock-phone-tabs">
              <span>{t('Shortcuts')}</span>
              <span className="on">{t('Automation')}</span>
              <span>{t('Gallery')}</span>
            </div>
          </div>
          <button className="btn solid block" style={{ marginTop: 12 }} onClick={() => void openGuide()}>{t('Open the guide')}</button>
        </div>
      ),
    },
    {
      title: t('Checks and achievements'),
      text: t('Every task is checked: you see what counted and what to fix. Achievements give bonus minutes — the rule is written under each one.'),
      pic: (
        <div className="mock">
          <div className="mock-card">
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="ach-badge on">{Icon.trophy(20)}</span><b>{t('Reader')}</b></div>
            <div className="ach-bar"><i style={{ width: '30%' }} /></div>
            <div className="small muted">{t('{a} of {b}', { a: 3, b: 10 })} · {t('+{n} min', { n: 5 })}</div>
          </div>
          <ul className="checklist">
            <li className="ok"><span className="mark">{Icon.check(16)}</span><span>{t('Length: {v} words (need {n})', { v: 152, n: 150 })}</span></li>
            <li className="bad"><span className="mark">{Icon.cross(16)}</span><span>{t('Use {n} of your recent words (found {v}). They are listed above the text.', { v: 1, n: 3 })}</span></li>
          </ul>
        </div>
      ),
    },
  ];
  const s = screens[i];
  const last = i === screens.length - 1;

  return (
    <div className="onb" role="dialog" aria-modal="true">
      <div className="onb-top">
        <div className="onb-dots">{screens.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'past' : ''} />)}</div>
        {!last && <button className="btn link" onClick={finish}>{t('Skip')}</button>}
      </div>
      <div className="onb-body">
        {i > 0 && <div className="el-mascot center"><Mascot size={64} mood={last ? 'cheer' : 'calm'} /></div>}
        <div className="onb-pic">{s.pic}</div>
        <h2>{s.title}</h2>
        <p className="muted">{s.text}</p>
      </div>
      <div className="onb-foot">
        {i > 0 && <button className="btn" onClick={() => { haptic.select(); setI(i - 1); }}>{t('Back')}</button>}
        <button className="btn solid grow" onClick={() => { haptic.tap(); if (last) finish(); else setI(i + 1); }}>{last ? t('Start') : t('Next')}</button>
      </div>
      {guide && <ShortcutsGuide gateUrl={guide.gate_url} apps={guide.apps} onClose={() => setGuide(null)} />}
    </div>
  );
}
