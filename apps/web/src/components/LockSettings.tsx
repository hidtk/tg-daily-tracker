import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GATE_APP_LABEL, VOCAB, type GateApp, type VocabWord, type WalletResponse } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg } from '../tg';
import { useLang, useT } from '../i18n';
import { useToast } from './Toast';
import { Field, Section } from './ui';
import { Icon } from './Mascot';
import { ShortcutsGuide } from './ShortcutsGuide';

const ALL_APPS: GateApp[] = ['instagram', 'tiktok', 'youtube', 'vk'];
const CHALLENGE_SIZE = 3;
/** After a correct answer the settings stay open this long (per app session). */
const UNLOCK_MS = 10 * 60_000;
let unlockedUntil = 0;

const LINKS = {
  nextdnsSignup: 'https://my.nextdns.io/signup',
  nextdnsAccount: 'https://my.nextdns.io/account',
  nextdnsHome: 'https://my.nextdns.io/',
  shortcutsApp: 'shortcuts://',
  shortcutsStore: 'https://apps.apple.com/app/shortcuts/id915249334',
};

/** Open an https link outside Telegram (Safari / browser). */
export function openExternal(url: string) {
  haptic.tap();
  try {
    tg.openLink(url);
  } catch {
    window.open(url, '_blank');
  }
}

function pickWords(n: number): VocabWord[] {
  const pool = VOCAB.filter((w) => /^[a-z]+$/.test(w.word) && w.word.length <= 12);
  const out: VocabWord[] = [];
  while (out.length < n && out.length < pool.length) {
    const w = pool[Math.floor(Math.random() * pool.length)];
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A deliberate speed bump: translate a few words before you can weaken the lock.
 * Forgiving: a correct word stays solved; only the missed ones are swapped for new words.
 */
function WordChallenge({ onPass }: { onPass: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const ru = lang === 'ru';
  const [words, setWords] = useState(() => pickWords(CHALLENGE_SIZE));
  const [answers, setAnswers] = useState<string[]>(() => words.map(() => ''));
  const [solved, setSolved] = useState<boolean[]>(() => words.map(() => false));
  /** For a slot whose word was missed: the word it replaced, to show the right answer. */
  const [missed, setMissed] = useState<(VocabWord | null)[]>(() => words.map(() => null));

  const check = () => {
    const nowSolved = words.map((w, i) => solved[i] || norm(answers[i]) === w.word);
    if (nowSolved.every(Boolean)) {
      setSolved(nowSolved);
      haptic.success();
      unlockedUntil = Date.now() + UNLOCK_MS;
      onPass();
      return;
    }
    haptic.warning();
    // Replace only the wrong words with fresh ones (not already on screen).
    const pool = pickWords(CHALLENGE_SIZE * 4).filter((x) => !words.some((w) => w.id === x.id));
    const nextWords = words.map((w, i) => (nowSolved[i] ? w : pool.shift() ?? w));
    setMissed(words.map((w, i) => (nowSolved[i] ? null : w)));
    setWords(nextWords);
    setAnswers(answers.map((a, i) => (nowSolved[i] ? a : '')));
    setSolved(nowSolved);
  };

  const left = solved.filter((x) => !x).length;
  return (
    <>
      <p className="muted small">
        {ru
          ? 'Чтобы изменить блокировку, переведи три слова на английский. Верные слова засчитываются, ошибёшься — заменим только это слово.'
          : 'To change the lock, translate three words into English. Correct words count; miss one and only that word is replaced.'}
      </p>
      {words.map((w, i) => (
        <div key={`${i}-${w.id}`} className={`challenge-row${solved[i] ? ' ok' : ''}`}>
          {missed[i] && !solved[i] && (
            <div className="challenge-answer">
              {Icon.cross(16)} {missed[i]!.ru} — <b>{missed[i]!.word}</b>, {ru ? 'новое слово:' : 'new word:'}
            </div>
          )}
          <div className="challenge-ru">{w.ru}</div>
          <div className="muted tiny">
            {w.pos} · {ru ? 'начинается на' : 'starts with'} «{w.word[0]}» · {w.word.length} {ru ? 'букв' : 'letters'}
          </div>
          <input
            value={answers[i]}
            placeholder={ru ? 'по-английски' : 'in English'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={solved[i]}
            onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
          />
          {solved[i] && <div className="challenge-ok">{Icon.check(16)} {ru ? 'Засчитано' : 'Counted'}</div>}
        </div>
      ))}
      <div className="row" style={{ gap: 12, marginTop: 8, alignItems: 'center' }}>
        <button className="btn solid" disabled={words.some((_, i) => !solved[i] && !answers[i].trim())} onClick={check}>{t('Check')}</button>
        {left < CHALLENGE_SIZE && <span className="muted small">{ru ? `Осталось: ${left}` : `Left: ${left}`}</span>}
      </div>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <div className="sc-step">
      <div className="sc-num">{n}</div>
      <div className="sc-body">
        <div className="sc-title">{title}</div>
        {children && <div className="small">{children}</div>}
      </div>
    </div>
  );
}

function LinkBtn({ href, children }: { href: string; children: ReactNode }) {
  return <button className="btn sm" style={{ marginTop: 8 }} onClick={() => openExternal(href)}>{children} ↗</button>;
}

function NextDnsSetup({ w, onChange }: { w: WalletResponse; onChange: (r: WalletResponse) => void }) {
  const t = useT();
  const toast = useToast();
  const { lang } = useLang();
  const ru = lang === 'ru';
  const [key, setKey] = useState('');
  const [profile, setProfile] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = w.lock;

  const connect = async () => {
    setBusy(true);
    try {
      onChange(await api.lockConfig(key.trim(), profile.trim()));
      haptic.success();
      toast(t('Lock connected'));
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : t('Error'));
    } finally {
      setBusy(false);
    }
  };

  if (!lock.configured) {
    return (
      <>
        <Step n={1} title={ru ? 'Зарегистрируйся в NextDNS' : 'Sign up at NextDNS'}>
          {ru ? 'Бесплатно, нужна только почта. После входа откроется твоя конфигурация: её ID — шесть символов в адресе, например my.nextdns.io/' : 'Free, email only. After signing in you land on your configuration: its ID is the six characters in the address, e.g. my.nextdns.io/'}
          <b>abc123</b>/setup.
          <br />
          <LinkBtn href={LINKS.nextdnsSignup}>{ru ? 'Открыть NextDNS' : 'Open NextDNS'}</LinkBtn>
        </Step>
        <Field label={ru ? 'ID конфигурации' : 'Configuration ID'}>
          <input value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="abc123" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </Field>
        <Step n={2} title={ru ? 'Скопируй API-ключ' : 'Copy the API key'}>
          {ru ? 'На странице аккаунта внизу блок API → Show → скопируй ключ и вернись сюда.' : 'On the account page, at the bottom: API → Show → copy the key and come back.'}
          <br />
          <LinkBtn href={LINKS.nextdnsAccount}>{ru ? 'Страница API-ключа' : 'API key page'}</LinkBtn>
        </Step>
        <Field label="NextDNS API key">
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="a1b2c3…" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </Field>
        <Step n={3} title={ru ? 'Подключи' : 'Connect'} />
        <button className="btn solid" disabled={busy || key.trim().length < 10 || profile.trim().length < 4} onClick={connect}>{busy ? '…' : t('Connect')}</button>
      </>
    );
  }

  const host = lock.profile_id ? `${lock.profile_id}.dns.nextdns.io` : '';
  return (
    <>
      <div className="row between">
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{ru ? 'NextDNS подключён' : 'NextDNS connected'}</div>
          <div className="muted small">{ru ? 'Конфигурация' : 'Configuration'} {lock.profile_id}</div>
        </div>
        {Icon.check(24)}
      </div>
      {lock.error && <div className="hint" style={{ color: 'var(--danger)' }}>NextDNS: {lock.error}</div>}
      <Step n={4} title={ru ? 'iPhone: установи профиль' : 'iPhone: install the profile'}>
        {ru ? 'Ссылка откроется в Safari → «Разрешить» → Настройки → «Профиль загружен» → «Установить». DNS пойдёт через NextDNS и по Wi-Fi, и по мобильной сети.' : 'Opens in Safari → Allow → Settings → Profile Downloaded → Install. DNS goes through NextDNS on Wi-Fi and mobile data.'}
        <br />
        {lock.profile_url && <LinkBtn href={lock.profile_url}>{t('Install the iPhone profile')}</LinkBtn>}
      </Step>
      {lock.removal_password && (
        <Step n={5} title={ru ? 'Отдай пароль партнёру' : 'Give the password to your partner'}>
          {ru ? 'Без него профиль не удалить. Перешли его другу и не запоминай:' : 'Without it the profile cannot be removed. Send it to a friend and don’t memorise it:'} <code>{lock.removal_password}</code>
        </Step>
      )}
      {host && (
        <Step n={6} title={ru ? 'Android: частный DNS' : 'Android: Private DNS'}>
          {ru ? 'Настройки → Сеть и интернет → Частный DNS → «Имя хоста» →' : 'Settings → Network & internet → Private DNS → Hostname →'} <code>{host}</code>
          <br />
          <button className="btn sm" style={{ marginTop: 8 }} onClick={async () => { haptic.tap(); try { await navigator.clipboard.writeText(host); toast(t('Copied')); } catch { toast(t('Copy it by hand')); } }}>{t('Copy')}</button>
        </Step>
      )}
      <div className="row" style={{ gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn link" onClick={() => openExternal(LINKS.nextdnsHome)}>{ru ? 'Открыть NextDNS' : 'Open NextDNS'} ↗</button>
        <button className="btn link" style={{ color: 'var(--danger)' }} onClick={async () => { haptic.warning(); try { onChange(await api.lockRemove()); } catch (e) { toast(e instanceof ApiError ? e.message : t('Error')); } }}>{t('Disconnect')}</button>
      </div>
    </>
  );
}

/** Settings → social-media lock. Hidden behind a short translation challenge. */
export function LockSettings() {
  const t = useT();
  const toast = useToast();
  const { lang } = useLang();
  const ru = lang === 'ru';
  const [open, setOpen] = useState(() => Date.now() < unlockedUntil);
  const [challenge, setChallenge] = useState(false);
  const [w, setW] = useState<WalletResponse | null>(null);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if (open && !w) api.wallet().then(setW).catch((e: unknown) => toast(e instanceof ApiError ? e.message : t('Could not load')));
  }, [open]);

  const patch = async (p: Parameters<typeof api.saveWallet>[0]) => {
    try {
      setW(await api.saveWallet(p));
      haptic.success();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('Error'));
    }
  };
  const names = useMemo(() => (w?.apps.length ? w.apps : ALL_APPS).map((a) => GATE_APP_LABEL[a]).join(', '), [w]);

  if (!open) {
    return (
      <Section label={ru ? 'Блокировка соцсетей' : 'Social-media lock'}>
        {!challenge ? (
          <>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--primary)', marginTop: 2 }}>{Icon.lock(22)}</span>
              <p className="muted small" style={{ margin: 0 }}>
                {ru ? 'Настройка «Команд» на iPhone, NextDNS, какие приложения закрывать и лимиты минут. Доступ — через перевод трёх слов.' : 'Shortcuts on iPhone, NextDNS, which apps to lock and minute limits. Access takes translating three words.'}
              </p>
            </div>
            <button className="btn solid" style={{ marginTop: 12 }} onClick={() => { haptic.tap(); setChallenge(true); }}>{ru ? 'Открыть настройки' : 'Open settings'}</button>
          </>
        ) : (
          <WordChallenge onPass={() => setOpen(true)} />
        )}
      </Section>
    );
  }

  if (!w) return <Section label={ru ? 'Блокировка соцсетей' : 'Social-media lock'}><span className="spinner" /></Section>;

  return (
    <>
      <Section label={ru ? 'Способ 1 · iPhone: «Команды»' : 'Option 1 · iPhone: Shortcuts'}>
        <p className="muted small">{t('No NextDNS needed: the Shortcuts app closes {apps} when you have no minutes and counts the time you spend. About 5 minutes to set up, once.', { apps: names })}</p>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn solid" onClick={() => { haptic.tap(); setGuide(true); }}>{t('Step-by-step guide')}</button>
          <a className="btn" href={LINKS.shortcutsApp} onClick={() => haptic.tap()}>{ru ? 'Открыть «Команды»' : 'Open Shortcuts'}</a>
        </div>
      </Section>

      <Section label={ru ? 'Способ 2 · NextDNS (строже, iPhone и Android)' : 'Option 2 · NextDNS (stricter, iPhone and Android)'}>
        <p className="muted small">{ru ? `Домены ${names} перестают открываться на уровне DNS — в приложении, в браузере, везде. Открываются только на оплаченные минуты.` : `${names} stop resolving at the DNS level — in the app, in the browser, everywhere. They open only for paid minutes.`}</p>
        <NextDnsSetup w={w} onChange={setW} />
      </Section>

      <Section label={ru ? 'Что закрывать и лимиты' : 'What to lock and limits'}>
        <div className="field">
          <label>{t('Which apps')}</label>
          <div className="chips">
            {ALL_APPS.map((a) => (
              <button key={a} className={`chip ${w.apps.includes(a) ? 'on' : ''}`} onClick={() => { haptic.select(); void patch({ apps: w.apps.includes(a) ? w.apps.filter((x) => x !== a) : [...w.apps, a] }); }}>{GATE_APP_LABEL[a]}</button>
            ))}
          </div>
        </div>
        <div className="field-grid">
          <Field label={t('Bank, max min')}><input type="number" min={0} max={600} defaultValue={w.bank_cap} onBlur={(e) => { const v = e.target.value.trim() === '' ? NaN : Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v !== w.bank_cap) void patch({ bank_cap: Math.round(v) }); else e.target.value = String(w.bank_cap); }} /></Field>
          <Field label={t('Daily limit')}><input type="number" min={0} max={600} defaultValue={w.daily_earn_cap} onBlur={(e) => { const v = e.target.value.trim() === '' ? NaN : Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v !== w.daily_earn_cap) void patch({ daily_earn_cap: Math.round(v) }); else e.target.value = String(w.daily_earn_cap); }} /></Field>
        </div>
        <div className="hint">{ru ? 'Настройки остаются открытыми 10 минут, потом снова понадобится перевод.' : 'Settings stay open for 10 minutes, then the translation is needed again.'}</div>
        <button className="btn link" style={{ marginTop: 8 }} onClick={() => { unlockedUntil = 0; setOpen(false); setChallenge(false); }}>{ru ? 'Закрыть сейчас' : 'Close now'}</button>
      </Section>

      {guide && <ShortcutsGuide gateUrl={w.gate_url} apps={w.apps} onClose={() => setGuide(false)} />}
    </>
  );
}
