import { useState, type ReactNode } from 'react';
import { GATE_APP_LABEL, type GateApp } from '@tracker/shared';
import { haptic, tg } from '../tg';
import { useLang, useT } from '../i18n';
import { useToast } from './Toast';
import { Section, Sheet } from './ui';
import { Mascot } from './Mascot';

const SHORTCUTS_APP = 'shortcuts://';
const SHORTCUTS_STORE = 'https://apps.apple.com/app/shortcuts/id915249334';

function AppLinks({ ru }: { ru: boolean }) {
  return (
    <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
      <a className="btn sm" href={SHORTCUTS_APP} onClick={() => haptic.tap()}>{ru ? 'Открыть «Команды»' : 'Open Shortcuts'} ↗</a>
      <button className="btn sm" onClick={() => { haptic.tap(); try { tg.openLink(SHORTCUTS_STORE); } catch { window.open(SHORTCUTS_STORE, '_blank'); } }}>{ru ? 'App Store' : 'App Store'} ↗</button>
    </div>
  );
}

/** Absolute gate URL (WEBAPP_URL may be empty on the server → relative path). */
export function absoluteGateUrl(gateUrl: string): string {
  return gateUrl.startsWith('/') ? `${window.location.origin}${gateUrl}` : gateUrl;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyUrl({ label, url }: { label: string; url: string }) {
  const t = useT();
  const toast = useToast();
  return (
    <div className="copy-url">
      <div className="small muted">{label}</div>
      <code className="gate-url">{url}</code>
      <button
        className="btn solid"
        onClick={async () => {
          haptic.tap();
          const ok = await copyText(url);
          if (ok) haptic.success();
          toast(ok ? t('Copied') : t('Copy it by hand'));
        }}
      >
        {t('Copy')}
      </button>
    </div>
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

/** A Shortcuts action / menu name, shown like a button in the Shortcuts app. */
const A = ({ children }: { children: ReactNode }) => <b className="sc-action">{children}</b>;

export function ShortcutsGuide({ gateUrl, apps, onClose }: { gateUrl: string; apps: GateApp[]; onClose: () => void }) {
  const { lang } = useLang();
  const t = useT();
  const ru = lang === 'ru';
  const base = absoluteGateUrl(gateUrl);
  const openUrl = `${base}?app=any&e=open`;
  const closeUrl = `${base}?app=any&e=close`;
  const statusUrl = `${base}?e=status`;
  const names = (apps.length ? apps : (['instagram', 'tiktok', 'youtube', 'vk'] as GateApp[])).map((a) => GATE_APP_LABEL[a]).join(', ');
  const [check, setCheck] = useState<string | null>(null);

  const test = async () => {
    haptic.tap();
    setCheck('…');
    try {
      const r = await fetch(statusUrl, { cache: 'no-store' });
      const body = (await r.text()).trim();
      const [word, n] = body.split(/\s+/);
      if (word === 'ALLOW') setCheck(ru ? `Ссылка работает. Сейчас доступ открыт, на балансе ${n} мин.` : `The link works. Access is open, ${n} min on the balance.`);
      else if (word === 'BLOCK' && !body.includes('bad key')) setCheck(ru ? 'Ссылка работает. Сейчас минут нет — соцсети будут закрываться.' : 'The link works. No minutes now — social media will be closed.');
      else setCheck(ru ? 'Ключ не принят. Закрой и снова открой приложение.' : 'Key rejected. Reopen the app.');
      haptic.success();
    } catch {
      setCheck(ru ? 'Нет связи с сервером.' : 'Cannot reach the server.');
      haptic.warning();
    }
  };

  return (
    <Sheet title={ru ? 'Блокировка на iPhone через «Команды»' : 'iPhone lock with Shortcuts'} onClose={onClose}>
      <Mascot size={72} message={ru ? 'Пять минут настройки — и соцсети открываются только за минуты, заработанные на тестах.' : 'Five minutes of setup, and social media opens only for minutes earned on tests.'} />
      <Section label={ru ? 'Как это работает' : 'How it works'}>
        <div className="steps">
          <p>
            {ru
              ? `Когда ты открываешь ${names}, iPhone сам запускает автоматизацию. Она спрашивает сервер, есть ли у тебя минуты. Минут нет — тебя выкидывает на экран «Домой», а бот присылает кнопку «Заработать минуты». Минуты есть — приложение открывается, а время списывается, когда ты его закрываешь.`
              : `When you open ${names}, the iPhone runs an automation. It asks the server whether you have minutes. No minutes — you are sent to the Home Screen and the bot sends an “Earn minutes” button. Minutes left — the app opens and the time is charged when you close it.`}
          </p>
          <p className="muted">
            {ru
              ? 'Нужен iOS 17 или новее (на iOS 16 тоже работает, но придётся выключать «Спрашивать до запуска»). Настройка — около 5 минут, делается один раз.'
              : 'Needs iOS 17 or later (iOS 16 works too, but you have to turn off “Ask Before Running”). Setup takes about 5 minutes, once.'}
          </p>
        </div>
      </Section>

      <Section label={ru ? 'Твои ссылки' : 'Your links'}>
        <CopyUrl label={ru ? 'Ссылка 1 — «Открыто»' : 'Link 1 — “Is Opened”'} url={openUrl} />
        <CopyUrl label={ru ? 'Ссылка 2 — «Закрыто»' : 'Link 2 — “Is Closed”'} url={closeUrl} />
        <button className="btn link" onClick={test}>{ru ? 'Проверить ссылку' : 'Test the link'}</button>
        {check && <div className="hint">{check}</div>}
        <div className="hint">{ru ? 'Ссылки личные: в них твой ключ. Никому их не отправляй.' : 'These links are personal — they contain your key. Do not share them.'}</div>
      </Section>

      <Section label={ru ? 'Автоматизация 1: блокировка при открытии' : 'Automation 1: block on open'}>
        {ru ? (
          <>
            <Step n={1} title="Скопируй ссылку 1">Кнопка «Скопировать» выше.</Step>
            <Step n={2} title="Открой приложение «Команды»">Оно стоит на iPhone по умолчанию. Если удалено — скачай его из App Store бесплатно.<AppLinks ru /></Step>
            <Step n={3} title="Внизу вкладка «Автоматизация» → «+»">Если автоматизаций ещё нет, нажми <A>Новая автоматизация</A>.</Step>
            <Step n={4} title="Выбери «Приложение»">Нажми <A>Выбрать</A> и отметь {names}. Нажми <A>Готово</A>.</Step>
            <Step n={5} title="Поставь галочку «Открыто»">«Закрыто» оставь выключенным — для него будет вторая автоматизация.</Step>
            <Step n={6} title="Выбери «Запускать сразу»">Не «После подтверждения», иначе iPhone будет каждый раз спрашивать. Выключи <A>Уведомлять при запуске</A>. Нажми <A>Далее</A>.</Step>
            <Step n={7} title="«Новая пустая автоматизация»" />
            <Step n={8} title="Добавь действие «Получить содержимое URL»">Нажми <A>Добавить действие</A>, в поиске набери «URL». Нажми на синее поле <A>URL</A> в действии и вставь ссылку 1.</Step>
            <Step n={9} title="Добавь действие «Если»">Найди поиском «Если». Оно само подставит <A>Содержимое URL</A>. Если в условиях только «есть любое значение», сначала нажми на <A>Содержимое URL</A> в строке «Если» и выбери тип <A>Текст</A> (или добавь перед «Если» действие <A>Текст</A> и вставь в него переменную <A>Содержимое URL</A>). Потом нажми <A>Условие</A> → <A>не содержит</A>, в поле <A>Текст</A> впиши <code>ALLOW</code> большими буквами. Так приложение закроется и когда минут нет, и когда сервер не ответил (нет сети, VPN переподключается) — лазейки «выключил интернет и зашёл» не будет.</Step>
            <Step n={10} title="Внутрь «Если» добавь «На экран „Домой“»">Найди поиском «Домой» и перетащи действие между <A>Если</A> и <A>Иначе</A>. Если хочешь, добавь рядом <A>Показать уведомление</A> с текстом «Нет минут — пройди Reading-тест».</Step>
            <Step n={11} title="Нажми «Готово»">Готово: открой Instagram без минут — тебя сразу выкинет на экран «Домой».</Step>
          </>
        ) : (
          <>
            <Step n={1} title="Copy link 1">The Copy button above.</Step>
            <Step n={2} title="Open the Shortcuts app">It is preinstalled. If you deleted it, get it free from the App Store.<AppLinks ru={false} /></Step>
            <Step n={3} title="Automation tab at the bottom → “+”">With no automations yet, tap <A>New Automation</A>.</Step>
            <Step n={4} title="Choose “App”">Tap <A>Choose</A>, select {names}, tap <A>Done</A>.</Step>
            <Step n={5} title="Tick “Is Opened”">Leave “Is Closed” off — the second automation handles it.</Step>
            <Step n={6} title="Choose “Run Immediately”">Not “Run After Confirmation”. Turn off <A>Notify When Run</A>. Tap <A>Next</A>.</Step>
            <Step n={7} title="“New Blank Automation”" />
            <Step n={8} title="Add “Get Contents of URL”">Tap <A>Add Action</A>, search “URL”. Tap the blue <A>URL</A> field and paste link 1.</Step>
            <Step n={9} title="Add “If”">Search “If”. It picks <A>Contents of URL</A> by itself. If the only conditions are “has any value”, first tap <A>Contents of URL</A> in the If row and set its type to <A>Text</A> (or add a <A>Text</A> action before If with the <A>Contents of URL</A> variable inside). Then tap <A>Condition</A> → <A>does not contain</A>, type <code>ALLOW</code> in capitals in <A>Text</A>. This way the app closes both with no minutes and when the server did not answer (no network, VPN reconnecting) — no “go offline and get in” loophole.</Step>
            <Step n={10} title="Inside “If”, add “Go to Home Screen”">Search “Home” and drag it between <A>If</A> and <A>Otherwise</A>. Optionally add <A>Show Notification</A> “No minutes — pass a Reading test”.</Step>
            <Step n={11} title="Tap “Done”">That’s it: open Instagram with no minutes and you land on the Home Screen.</Step>
          </>
        )}
      </Section>

      <Section label={ru ? 'Автоматизация 2: учёт времени при закрытии' : 'Automation 2: track time on close'}>
        {ru ? (
          <>
            <Step n={1} title="Снова «+» → «Приложение» → те же приложения">Сначала скопируй ссылку 2 кнопкой выше.<AppLinks ru /></Step>
            <Step n={2} title="Галочка только «Закрыто», «Запускать сразу»" />
            <Step n={3} title="Одно действие: «Получить содержимое URL» со ссылкой 2">Больше ничего не нужно.</Step>
            <div className="hint">Без неё время сессии посчитается только при следующем открытии, и спишется до 45 минут за раз.</div>
          </>
        ) : (
          <>
            <Step n={1} title="“+” again → “App” → the same apps">Copy link 2 with the button above first.<AppLinks ru={false} /></Step>
            <Step n={2} title="Only “Is Closed”, “Run Immediately”" />
            <Step n={3} title="One action: “Get Contents of URL” with link 2">Nothing else.</Step>
            <div className="hint">Without it the session is settled on the next open and up to 45 minutes are charged at once.</div>
          </>
        )}
      </Section>

      <Section label={ru ? 'Проверка' : 'Check'}>
        <div className="steps">
          {ru ? (
            <>
              <p>1. Нажми «Проверить ссылку» выше — должно появиться «Ссылка работает».</p>
              <p>2. Открой Instagram. Если минут нет, приложение закроется, а бот пришлёт сообщение.</p>
              <p>3. Пройди Reading-тест, открой снова — приложение пустит. Закрой его: в разделе «Последние сессии» появится запись.</p>
            </>
          ) : (
            <>
              <p>1. Tap “Test the link” above — you should see “The link works”.</p>
              <p>2. Open Instagram. With no minutes it closes and the bot messages you.</p>
              <p>3. Pass a Reading test and open it again — it lets you in. Close it: an entry appears under “Recent sessions”.</p>
            </>
          )}
        </div>
      </Section>

      <Section label={ru ? 'Честно об ограничениях' : 'Honest limits'}>
        <div className="steps">
          {ru ? (
            <>
              <p>• Автоматизацию можно выключить в «Командах» — это защита от импульса, а не от решения. Для строгого режима добавь DNS-замок (Способ 2 в настройках): профиль с паролем, пароль отдай партнёру.</p>
              <p>• Без интернета проверка не проходит, и приложение откроется.</p>
              <p>• Если сидеть дольше, чем есть минут, выкинет только при следующем открытии: баланс уйдёт в ноль.</p>
              <p>• Веб-версии (instagram.com в Safari) команда не видит — их закрывает DNS-замок.</p>
            </>
          ) : (
            <>
              <p>• An automation can be switched off in Shortcuts — this stops the impulse, not a decision. For a strict mode add the DNS lock (Option 2 in Settings): a profile with a password your partner keeps.</p>
              <p>• Offline the check fails and the app opens.</p>
              <p>• Staying longer than your minutes only blocks you on the next open; the balance goes to zero.</p>
              <p>• Web versions (instagram.com in Safari) are not covered — the DNS lock handles those.</p>
            </>
          )}
        </div>
      </Section>
      <button className="btn solid block" onClick={onClose}>{t('Close')}</button>
    </Sheet>
  );
}
