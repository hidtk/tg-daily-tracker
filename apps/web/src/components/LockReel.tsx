import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { Icon } from './Mascot';
import { Target } from './Pointer';
import { Reel, type ReelStep } from './Reel';
import { SessionScreen } from './DemoReel';

/** A Shortcuts action block; `tok` pieces are the blue variables. */
function Action({ children, indent = 0 }: { children: ReactNode; indent?: number }) {
  return <div className="ios-action" style={{ marginLeft: indent * 14 }}>{children}</div>;
}
const Tok = ({ children }: { children: ReactNode }) => <span className="ios-tok">{children}</span>;

function IosScreen({ title, right, children, tabs }: { title: string; right?: ReactNode; children: ReactNode; tabs?: boolean }) {
  const t = useT();
  return (
    <div className="ios">
      <div className="ios-bar"><span /> {right}</div>
      <div className="ios-title">{title}</div>
      <div className="ios-body">{children}</div>
      {tabs && (
        <div className="ios-tabs">
          <span>{t('Shortcuts')}</span>
          <span className="on">{t('Automation')}</span>
          <span>{t('Gallery')}</span>
        </div>
      )}
    </div>
  );
}

function Row({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="ios-row">
      <span>{children}</span>
      {right ?? <span className="ios-chev">›</span>}
    </div>
  );
}

/**
 * How to turn on the iPhone lock, step by step: in Elvis (Settings → the guide, copy the links), then in the
 * Shortcuts app (two automations), then a check. Names match the real iOS menus (see ShortcutsGuide).
 */
export function LockReel({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const tap = t('tap here');
  const check = <span className="ios-check">{Icon.check(16)}</span>;
  const steps: ReelStep[] = [
    {
      caption: t('In Elvis: Settings → Social-media lock → «Open settings» (translate three words).'),
      tab: 'settings',
      screen: () => (
        <div className="demo-pad">
          <div className="demo-title">{t('Settings')}</div>
          <div className="section">
            <div className="label">{t('Social-media lock')}</div>
            <p className="muted small" style={{ marginTop: 0 }}>{t('Shortcuts on iPhone, NextDNS, which apps to lock and minute limits.')}</p>
            <Target label={tap} side="bottom" align="start"><span className="btn solid sm">{t('Open settings')}</span></Target>
          </div>
        </div>
      ),
    },
    {
      caption: t('Option 1, Shortcuts: press «Step-by-step guide».'),
      tab: 'settings',
      screen: () => (
        <div className="demo-pad">
          <div className="section">
            <div className="label">{t('Option 1 · iPhone: Shortcuts')}</div>
            <p className="muted small" style={{ marginTop: 0 }}>{t('The Shortcuts app closes social media when you have no minutes.')}</p>
            <Target label={tap} side="bottom" align="start"><span className="btn solid sm">{t('Step-by-step guide')}</span></Target>
          </div>
        </div>
      ),
    },
    {
      caption: t('Copy link 1 — you paste it into Shortcuts. Links 2 and 3 come later.'),
      tab: null,
      screen: () => (
        <div className="demo-pad">
          <div className="demo-title">{t('Your links')}</div>
          <div className="small muted">{t('Link 1 — “Is Opened”')}</div>
          <code className="gate-url">…/gate/3f9c…?app=any&amp;e=open</code>
          <Target label={tap} side="bottom" align="start"><span className="btn sm">{t('Copy')}</span></Target>
          <div className="small muted" style={{ marginTop: 58 }}>{t('Link 2 — “Timer”')}</div>
          <code className="gate-url">…/gate/3f9c…?e=tick</code>
          <div className="small muted">{t('Link 3 — “Is Closed”')}</div>
          <code className="gate-url">…/gate/3f9c…?app=any&amp;e=close</code>
        </div>
      ),
    },
    {
      caption: t('Open the Shortcuts app → the «Automation» tab → «+».'),
      tab: null,
      screen: () => (
        <IosScreen title={t('Automation')} right={<Target label={tap} side="bottom" align="end"><span className="ios-plus">+</span></Target>} tabs>
          <div className="ios-empty">{t('No automations yet')}</div>
        </IosScreen>
      ),
    },
    {
      caption: t('Choose «App».'),
      tab: null,
      screen: () => (
        <IosScreen title={t('New Automation')}>
          <div className="ios-list">
            <Row>{t('Time of Day')}</Row>
            <Row>{t('Alarm')}</Row>
            <Row><Target label={tap} side="right">{t('App')}</Target></Row>
            <Row>{t('Airplane Mode')}</Row>
          </div>
        </IosScreen>
      ),
    },
    {
      caption: t('Choose Instagram, TikTok, YouTube, VK; tick only «Is Opened»; choose «Run Immediately».'),
      tab: null,
      screen: () => (
        <IosScreen title={t('App')} right={<span className="ios-link">{t('Next')}</span>}>
          <div className="ios-list">
            <Row right={<span className="ios-link">{t('Choose')}</span>}>Instagram, TikTok, YouTube, VK</Row>
            <Row right={check}>{t('Is Opened')}</Row>
            <Row right={<span />}>{t('Is Closed')}</Row>
          </div>
          <div className="ios-list">
            <Row right={<span />}>{t('Run After Confirmation')}</Row>
            <Row right={check}><Target label={tap} side="bottom" align="start">{t('Run Immediately')}</Target></Row>
          </div>
        </IosScreen>
      ),
    },
    {
      caption: t('«New Blank Automation»: «Get Contents of URL» with link 1, then «If … does not contain ALLOW» → «Go to Home Screen».'),
      tab: null,
      screen: () => (
        <IosScreen title={t('Actions')}>
          <Action>{t('Get Contents of URL')} <Tok>{t('link 1')}</Tok></Action>
          <Action>{t('If')} <Tok>{t('Contents of URL')}</Tok> <Target label={tap} side="bottom"><b className="ios-key">{t('does not contain')}</b></Target> <Tok>ALLOW</Tok></Action>
          <div className="ios-hint-gap" />
          <Action indent={1}><span className="ios-go">{t('Go to Home Screen')}</span></Action>
          <Action>{t('Otherwise')}</Action>
          <Action>{t('End If')}</Action>
        </IosScreen>
      ),
    },
    {
      caption: t('Below it the timer: «Repeat» 360 times — «Wait» 20 s, link 2; BLOCK → Home, STOP → stop.'),
      tab: null,
      screen: () => (
        <IosScreen title={t('Actions')}>
          <Action><Target label={tap} side="bottom" align="start">{t('Repeat')}</Target> <Tok>360</Tok></Action>
          <div className="ios-hint-gap" />
          <Action indent={1}>{t('Wait')} <Tok>20 s</Tok></Action>
          <Action indent={1}>{t('Get Contents of URL')} <Tok>{t('link 2')}</Tok></Action>
          <Action indent={1}>{t('If')} <Tok>{t('Contents of URL')}</Tok> {t('contains')} <Tok>BLOCK</Tok> → <span className="ios-go">{t('Go to Home Screen')}</span></Action>
          <Action indent={1}>{t('If')} <Tok>{t('Contents of URL')}</Tok> {t('contains')} <Tok>STOP</Tok> → <span className="ios-go">{t('Stop This Shortcut')}</span></Action>
          <Action>{t('End Repeat')}</Action>
        </IosScreen>
      ),
    },
    {
      caption: t('Second automation: the same apps, only «Is Closed» → «Get Contents of URL» with link 3.'),
      tab: null,
      screen: () => (
        <IosScreen title={t('App')}>
          <div className="ios-list">
            <Row right={<span className="ios-link">{t('Choose')}</span>}>Instagram, TikTok, YouTube, VK</Row>
            <Row right={<span />}>{t('Is Opened')}</Row>
            <Row right={check}><Target label={tap} side="bottom" align="start">{t('Is Closed')}</Target></Row>
          </div>
          <div style={{ marginTop: 34 }}><Action>{t('Get Contents of URL')} <Tok>{t('link 3')}</Tok></Action></div>
        </IosScreen>
      ),
    },
    {
      caption: t('Check: with no minutes Instagram closes at once. Done — about 10 minutes, once.'),
      tab: null,
      screen: () => <SessionScreen start={0} note={t('No minutes — the Home Screen')} />,
    },
  ];
  return <Reel steps={steps} compact={compact} stepMs={5500} />;
}
