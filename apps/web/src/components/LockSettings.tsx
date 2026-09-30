import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GATE_APP_LABEL, VOCAB, type GateApp, type VocabWord, type WalletResponse } from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg } from '../tg';
import { useLang, useT } from '../i18n';
import { useToast } from './Toast';
import { Field, Section, Sheet } from './ui';
import { Icon } from './Mascot';
import { ShortcutsGuide } from './ShortcutsGuide';
import { LockReel } from './LockReel';

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

const PROBE: Partial<Record<GateApp, string>> = {
  instagram: 'https://www.instagram.com/favicon.ico',
  tiktok: 'https://www.tiktok.com/favicon.ico',
  youtube: 'https://www.youtube.com/favicon.ico',
  vk: 'https://vk.com/favicon.ico',
};

/** Can this device reach the site? A NextDNS block makes the request fail at DNS level. */
async function reachable(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 6000);
  try {
    await fetch(`${url}?t=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

type Diag = { server: Awaited<ReturnType<typeof api.lockCheck>> | null; device: { app: GateApp; reachable: boolean }[] };

function LockDiagnostics({ w }: { w: WalletResponse }) {
  const { lang } = useLang();
  const ru = lang === 'ru';
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Diag | null>(null);

  const run = async () => {
    haptic.tap();
    setBusy(true);
    try {
      const server = await api.lockCheck().catch(() => null);
      const apps = w.apps.filter((a) => PROBE[a]);
      const device = await Promise.all(apps.map(async (app) => ({ app, reachable: await reachable(PROBE[app]!) })));
      setD({ server, device });
    } finally {
      setBusy(false);
    }
  };

  const open = d?.server?.state === 'open';
  const serverBad = d?.server && (!d.server.ok || Object.values(d.server.blocked ?? {}).some((v) => !v));
  const deviceLeaks = d?.device.filter((x) => x.reachable) ?? [];

  return (
    <div style={{ marginTop: 14 }}>
      <button className="btn" onClick={run} disabled={busy}>{busy ? '…' : ru ? 'Проверить блокировку' : 'Check the lock'}</button>
      {d && (
        <div className="diag">
          <div className="diag-row">
            <b>{ru ? 'NextDNS (сервер):' : 'NextDNS (server):'}</b>{' '}
            {!d.server ? (ru ? 'не удалось проверить' : 'could not check') : !d.server.ok ? (d.server.error ?? 'error') : open ? (ru ? 'сейчас открыто на оплаченные минуты' : 'open for paid minutes right now') : serverBad ? (ru ? 'закрыто не всё' : 'not everything is blocked') : (ru ? 'всё закрыто' : 'everything is blocked')}
            {d.server?.repaired && <div className="muted small">{ru ? 'Замок в NextDNS был снят — я закрыл его заново.' : 'The NextDNS lock was off — I closed it again.'}</div>}
            {d.server?.blocked && (
              <div className="muted small">{Object.entries(d.server.blocked).map(([a, v]) => `${GATE_APP_LABEL[a as GateApp]} ${v ? '✓' : '✗'}`).join(' · ')}</div>
            )}
          </div>
          <div className="diag-row">
            <b>{ru ? 'Этот телефон:' : 'This phone:'}</b>{' '}
            {open ? (ru ? 'окно открыто — сайты и должны открываться' : 'window is open — sites are expected to load') : deviceLeaks.length === 0 ? (ru ? 'соцсети не открываются — замок работает' : 'social media does not load — the lock works') : (ru ? `открываются: ${deviceLeaks.map((x) => GATE_APP_LABEL[x.app]).join(', ')}` : `still loading: ${deviceLeaks.map((x) => GATE_APP_LABEL[x.app]).join(', ')}`)}
          </div>
          {!open && deviceLeaks.length > 0 && !serverBad && (
            <div className="diag-help small">
              <b>{ru ? 'Телефон не ходит через NextDNS. Проверь по порядку:' : 'This phone does not use NextDNS. Check in order:'}</b>
              <ol>
                <li>{ru ? 'VPN (Amnezia и другие) подменяет DNS. Если VPN нужен всегда — пропиши NextDNS внутри VPN, шаг 7 выше.' : 'A VPN (Amnezia etc.) replaces DNS. If you keep the VPN on, set NextDNS inside the VPN — step 7 above.'}</li>
                <li>{ru ? 'iPhone: Настройки → Основные → VPN и управление устройством → DNS → выбери «IELTS lock». Если профиля там нет — установи его кнопкой выше.' : 'iPhone: Settings → General → VPN & Device Management → DNS → choose “IELTS lock”. If it is not there, install the profile with the button above.'}</li>
                <li>{ru ? 'Android: Настройки → Сеть → Частный DNS → имя хоста из шага 6.' : 'Android: Settings → Network → Private DNS → the hostname from step 6.'}</li>
                <li>{ru ? 'Закрой и заново открой Instagram/TikTok — приложения держат старые адреса несколько минут.' : 'Force-close and reopen Instagram/TikTok — apps keep old addresses for a few minutes.'}</li>
              </ol>
              <button className="btn sm" onClick={() => openExternal('https://test.nextdns.io')}>{ru ? 'Открыть проверку NextDNS' : 'Open NextDNS test'} ↗</button>
              <div className="muted tiny" style={{ marginTop: 6 }}>{ru ? 'Там должно быть "status": "ok" и твой ID' : 'It should say "status": "ok" and your ID'} {w.lock.profile_id}.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
      {lock.profile_id && (
        <Step n={7} title={ru ? 'VPN всегда включён (Amnezia)' : 'VPN always on (Amnezia)'}>
          {ru ? 'Пока VPN включён, телефон берёт DNS из VPN, и профиль NextDNS не работает. Пропиши NextDNS прямо в Amnezia:' : 'While a VPN is on, the phone uses the VPN’s DNS and the NextDNS profile does nothing. Put NextDNS inside Amnezia:'}
          <ol className="vpn-steps">
            <li>{ru ? 'Включи Amnezia и открой страницу настройки NextDNS (кнопка ниже). В блоке «Linked IP» нажми «Link IP» — NextDNS запомнит адрес твоего VPN-сервера.' : 'Turn Amnezia on and open the NextDNS setup page (button below). In “Linked IP” tap “Link IP” — NextDNS remembers your VPN server’s address.'}</li>
            <li>{ru ? 'Там же скопируй два DNS-адреса из блока «Linked IP» (вида 45.90.28.… и 45.90.30.…).' : 'Copy the two DNS addresses from the “Linked IP” block (like 45.90.28.… and 45.90.30.…).'}</li>
            <li>{ru ? 'Amnezia → Настройки → Соединение → DNS-серверы: выключи «Использовать AmneziaDNS» и вставь адреса в «Основной» и «Запасной».' : 'Amnezia → Settings → Connection → DNS servers: turn off “Use AmneziaDNS” and paste the addresses as primary and secondary.'}</li>
            <li>{ru ? 'Переподключи VPN, закрой Instagram/TikTok и нажми «Проверить блокировку» ниже.' : 'Reconnect the VPN, force-close Instagram/TikTok and tap “Check the lock” below.'}</li>
          </ol>
          {ru ? 'Сменил сервер или страну в Amnezia — снова нажми «Link IP». Способ 1 («Команды») работает и с VPN, без этой настройки.' : 'Switched server or country in Amnezia — tap “Link IP” again. Option 1 (Shortcuts) works with a VPN as is.'}
          <br />
          <LinkBtn href={`https://my.nextdns.io/${lock.profile_id}/setup`}>{ru ? 'Настройка NextDNS (Linked IP)' : 'NextDNS setup (Linked IP)'}</LinkBtn>
        </Step>
      )}
      <LockDiagnostics w={w} />
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
  const [show, setShow] = useState(false);

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
            <div className="row" style={{ gap: 12, marginTop: 12 }}>
              <button className="btn solid" onClick={() => { haptic.tap(); setChallenge(true); }}>{ru ? 'Открыть настройки' : 'Open settings'}</button>
              <button className="btn" onClick={() => { haptic.tap(); setShow(true); }}>{t('Show how to set it up')}</button>
            </div>
            {show && (
              <Sheet title={t('How to turn on the lock')} onClose={() => setShow(false)}>
                <LockReel />
              </Sheet>
            )}
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
        <p className="muted small">{t('No NextDNS needed: the Shortcuts app closes {apps} when you have no minutes, and a timer sends you to the Home Screen when the paid minutes run out. About 10 minutes to set up, once.', { apps: names })}</p>
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
