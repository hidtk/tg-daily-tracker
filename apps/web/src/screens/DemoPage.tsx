import { useMemo, useState } from 'react';
import { DemoReel } from '../components/DemoReel';
import { LockReel } from '../components/LockReel';
import { LangContext, readStoredLang, storeLang, useT, type Lang } from '../i18n';

function Content() {
  const t = useT();
  return (
    <div className="screen demo-page">
      <h1>{t('Elvis · IELTS')}</h1>
      <p className="muted">{t('Study earns social media: small IELTS tasks give minutes, minutes open Instagram, TikTok, YouTube and VK. Here is how it looks.')}</p>
      <DemoReel />
      <ul className="rules" style={{ marginTop: 16 }}>
        <li>{t('Every task shows its time and its price in minutes.')}</li>
        <li>{t('Every answer is checked on the server: you see what counted and what to fix.')}</li>
        <li>{t('When the minutes run out, the iPhone lock sends you to the Home Screen.')}</li>
      </ul>
      <h2 style={{ marginTop: 28 }}>{t('How to turn on the lock')}</h2>
      <p className="muted">{t('Once, about 5 minutes: two short automations in the iPhone Shortcuts app, and NextDNS keeps the time.')}</p>
      <LockReel />
    </div>
  );
}

/** /demo: the step-by-step show without Telegram and without signing in — nothing real is touched. */
export function DemoPage() {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang() ?? (navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en'));
  const ctx = useMemo(() => ({ lang, setLang: (l: Lang) => { setLangState(l); storeLang(l); } }), [lang]);
  return (
    <LangContext.Provider value={ctx}>
      <div className="demo-lang">
        {(['ru', 'en'] as Lang[]).map((l) => (
          <button key={l} className={`chip ${lang === l ? 'on' : ''}`} onClick={() => ctx.setLang(l)}>{l === 'ru' ? 'Русский' : 'English'}</button>
        ))}
      </div>
      <Content />
    </LangContext.Provider>
  );
}
