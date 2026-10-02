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
      <Mascot size={72} message={ru ? 'Пять минут настройки — и без минут соцсети не открываются: iPhone сразу выкидывает на экран «Домой». Время считает сервер: минуты кончились — NextDNS закрывает соцсети сам.' : 'Five minutes of setup: without minutes social media doesn’t open — the iPhone sends you to the Home Screen at once. The server keeps the time: when the minutes run out, NextDNS closes social media by itself.'} />
      <Section label={ru ? 'Как это работает' : 'How it works'}>
        <div className="steps">
          {ru ? (
            <>
              <p>{`Когда ты открываешь ${names}, iPhone запускает автоматизацию. Она спрашивает сервер: есть минуты? Нет (или сервер не ответил) — сразу на экран «Домой».`}</p>
              <p>{'Есть — сервер начинает сессию и сам следит за временем: он открывает NextDNS ровно на остаток минут. Как только минуты кончились, сервер закрывает NextDNS — приложение перестаёт грузиться, даже если команда в фоне прервалась. Ничего в «Командах» для этого держать не нужно.'}</p>
              <p>{'Вторая автоматизация сообщает серверу, что приложение закрыто: списывается реальное время, остаток минут остаётся. Без неё приложение считается открытым, пока не кончатся минуты.'}</p>
              <p className="muted">Нужен iOS 17 или новее. Настройка — около 5 минут, делается один раз. Без NextDNS (способ 2) остановить приложение по времени некому — поставь его.</p>
            </>
          ) : (
            <>
              <p>{`When you open ${names}, the iPhone runs an automation. It asks the server: any minutes? No (or no answer) — straight to the Home Screen.`}</p>
              <p>{'Yes — the server starts a session and keeps the time itself: it opens NextDNS for exactly the minutes left and closes it when they run out. The app stops loading even if the shortcut was interrupted in the background. Nothing has to keep running in Shortcuts.'}</p>
              <p>{'The second automation tells the server the app was closed: the real time is charged and the rest stays. Without it the app counts as open until the minutes run out.'}</p>
              <p className="muted">Needs iOS 17 or later. About 5 minutes to set up, once. Without NextDNS (option 2) nothing can stop the app on time — set it up.</p>
            </>
          )}
        </div>
      </Section>

      <Section label={ru ? 'Твои ссылки' : 'Your links'}>
        <CopyUrl label={ru ? 'Ссылка 1 — «Открыто»' : 'Link 1 — “Is Opened”'} url={openUrl} />
        <CopyUrl label={ru ? 'Ссылка 2 — «Закрыто»' : 'Link 2 — “Is Closed”'} url={closeUrl} />
        <button className="btn link" onClick={test}>{ru ? 'Проверить ссылку' : 'Test the link'}</button>
        {check && <div className="hint">{check}</div>}
        <div className="hint">{ru ? 'Ссылки личные: в них твой ключ. Никому их не отправляй.' : 'These links are personal — they contain your key. Do not share them.'}</div>
      </Section>

      <Section label={ru ? 'Автоматизация 1: вход' : 'Automation 1: entry'}>
        {ru ? (
          <>
            <div className="hint" style={{ marginTop: 0, marginBottom: 6 }}>Уже есть автоматизация «Открыто» со старым таймером («Повторять»)? Её можно оставить как есть — она не мешает. Нужна только первая часть: шаги 1–9.</div>
            <Step n={1} title="Скопируй ссылку 1">Кнопка «Скопировать» выше.</Step>
            <Step n={2} title="Открой приложение «Команды»">Оно стоит на iPhone по умолчанию. Если удалено — скачай бесплатно из App Store.<AppLinks ru /></Step>
            <Step n={3} title="Внизу вкладка «Автоматизация» → «+»">Если автоматизаций ещё нет, нажми <A>Новая автоматизация</A>.</Step>
            <Step n={4} title="Выбери «Приложение»">Нажми <A>Выбрать</A>, отметь {names}, нажми <A>Готово</A>.</Step>
            <Step n={5} title="Галочка только «Открыто»">«Закрыто» оставь выключенным — для него будет автоматизация 2.</Step>
            <Step n={6} title="Выбери «Запускать сразу»">Не «После подтверждения». Выключи <A>Уведомлять при запуске</A>. Нажми <A>Далее</A>.</Step>
            <Step n={7} title="«Новая пустая автоматизация»" />
            <Step n={8} title="Действие «Получить содержимое URL»">Нажми <A>Добавить действие</A>, в поиске набери «URL». Нажми на синее поле <A>URL</A> и вставь ссылку 1.</Step>
            <Step n={9} title="Действие «Если» → «не содержит» ALLOW → «Перейти „Домой“»">Найди поиском «Если». Оно само подставит <A>Содержимое URL</A>. Если в условиях только «есть любое значение», нажми на <A>Содержимое URL</A> и выбери тип <A>Текст</A>. Нажми <A>Условие</A> → <A>не содержит</A>, в поле <A>Текст</A> впиши <code>ALLOW</code> большими буквами. Потом найди поиском «Домой» и перетащи <A>Перейти „Домой“</A> между <A>Если</A> и <A>Иначе</A>. Так приложение закроется, и когда минут нет, и когда сервер не ответил — лазейки «выключил интернет и зашёл» нет.</Step>
            <Step n={10} title="Нажми «Готово»">Сверься со схемой ниже.</Step>
            <pre className="sc-scheme">{`Получить содержимое URL (ссылка 1)
Если Содержимое URL не содержит ALLOW
    Перейти «Домой»
Иначе
Конец`}</pre>
          </>
        ) : (
          <>
            <div className="hint" style={{ marginTop: 0, marginBottom: 6 }}>Already have an “Is Opened” automation with the old timer (“Repeat”)? It can stay as it is. Only the first part is needed: steps 1–9.</div>
            <Step n={1} title="Copy link 1">The Copy button above.</Step>
            <Step n={2} title="Open the Shortcuts app">It is preinstalled. If you deleted it, get it free from the App Store.<AppLinks ru={false} /></Step>
            <Step n={3} title="Automation tab at the bottom → “+”">With no automations yet, tap <A>New Automation</A>.</Step>
            <Step n={4} title="Choose “App”">Tap <A>Choose</A>, select {names}, tap <A>Done</A>.</Step>
            <Step n={5} title="Only “Is Opened”">Leave “Is Closed” off — automation 2 handles it.</Step>
            <Step n={6} title="Choose “Run Immediately”">Not “Run After Confirmation”. Turn off <A>Notify When Run</A>. Tap <A>Next</A>.</Step>
            <Step n={7} title="“New Blank Automation”" />
            <Step n={8} title="Action “Get Contents of URL”">Tap <A>Add Action</A>, search “URL”. Tap the blue <A>URL</A> field and paste link 1.</Step>
            <Step n={9} title="“If” → “does not contain” ALLOW → “Go to Home Screen”">Search “If”. It picks <A>Contents of URL</A> by itself; if the only condition is “has any value”, tap <A>Contents of URL</A> and set its type to <A>Text</A>. Tap <A>Condition</A> → <A>does not contain</A>, type <code>ALLOW</code> in capitals. Then search “Home” and drag <A>Go to Home Screen</A> between <A>If</A> and <A>Otherwise</A>. No minutes or no answer from the server — the app closes.</Step>
            <Step n={10} title="Tap “Done”">Compare with the outline below.</Step>
            <pre className="sc-scheme">{`Get Contents of URL (link 1)
If Contents of URL does not contain ALLOW
    Go to Home Screen
Otherwise
End If`}</pre>
          </>
        )}
      </Section>

      <Section label={ru ? 'Автоматизация 2: закрытие' : 'Automation 2: close'}>
        {ru ? (
          <>
            <Step n={1} title="Снова «+» → «Приложение» → те же приложения">Сначала скопируй ссылку 2 кнопкой выше.<AppLinks ru /></Step>
            <Step n={2} title="Галочка только «Закрыто», «Запускать сразу»" />
            <Step n={3} title="Одно действие: «Получить содержимое URL» со ссылкой 2">Больше ничего не нужно.</Step>
            <div className="hint">Без неё сервер не знает, когда ты вышел, и списывает время, пока не кончатся минуты.</div>
          </>
        ) : (
          <>
            <Step n={1} title="“+” again → “App” → the same apps">Copy link 2 with the button above first.<AppLinks ru={false} /></Step>
            <Step n={2} title="Only “Is Closed”, “Run Immediately”" />
            <Step n={3} title="One action: “Get Contents of URL” with link 2">Nothing else.</Step>
            <div className="hint">Without it the server doesn't know when you left and charges until the minutes run out.</div>
          </>
        )}
      </Section>

      <Section label={ru ? 'Проверка' : 'Check'}>
        <div className="steps">
          {ru ? (
            <>
              <p>1. Нажми «Проверить ссылку» выше — должно появиться «Ссылка работает».</p>
              <p>2. Без минут открой Instagram — тебя сразу выкинет на экран «Домой».</p>
              <p>3. Заработай пару минут (например, «Быстрый тест» в Магазине), открой Instagram и ничего не делай. Когда минуты кончатся, сервер закроет NextDNS: в течение минуты лента перестанет обновляться. Около минуты она ещё может показывать уже загруженное (кэш DNS) — это нормально.</p>
              <p>4. На Главной баланс уменьшится, а в «Прогрессе» → «Минуты: последние» появится строка «Соцсети».</p>
            </>
          ) : (
            <>
              <p>1. Tap “Test the link” — you should see “The link works”.</p>
              <p>2. With no minutes, open Instagram — you land on the Home Screen at once.</p>
              <p>3. Earn a couple of minutes (e.g. the Quick test in the Shop), open Instagram and just wait. When they run out the server closes NextDNS: within a minute the feed stops loading. For about a minute it may still show what it already loaded (the DNS cache) — that is normal.</p>
              <p>4. The balance on Home goes down, and Progress → “Minutes: recent” shows a “Social media” line.</p>
            </>
          )}
        </div>
      </Section>

      <Section label={ru ? 'Честно: что можно и что нельзя' : 'Honest limits'}>
        <div className="steps">
          {ru ? (
            <>
              <p><b>Работает надёжно:</b> вход без минут закрыт; время считает сервер, а не iPhone — когда минуты кончились, NextDNS закрывает соцсети сам, и переиграть время нельзя.</p>
              <p><b>Если выключить автоматизацию:</b> сервер это заметит — «Команды» перестанут звонить, а NextDNS увидит соцсети. На Главной появится красная плашка, а приложение без минут, открытое мимо сессии, — это обход: штраф и сообщение другу-контролёру. Как сделать выключение сложнее — раздел «Сделать обход сложнее» в настройках блокировки.</p>
              <p>• Веб-версии (instagram.com в Safari) команда не видит.</p>
              <p><b>Усиление:</b> NextDNS внутри AmneziaVPN (Способ 2, шаг 7 в настройках блокировки). Там окно открывает и закрывает сам сервер по часам — от iPhone это не зависит, и закрываются также сайты в браузере. Пароль от профиля отдай партнёру.</p>
            </>
          ) : (
            <>
              <p><b>Reliable:</b> no entry without minutes; the server, not the iPhone, keeps the time — when the minutes run out NextDNS closes social media by itself, so extra time can't be won.</p>
              <p><b>Switching the automation off:</b> the server notices — Shortcuts stops calling while NextDNS sees social media. Home shows a red banner, and an app used with no minutes outside a session is a bypass: a penalty and a message to your lock buddy. See “Make a bypass harder” in the lock settings.</p>
              <p>• Web versions (instagram.com in Safari) are not covered by Shortcuts.</p>
              <p><b>Stronger:</b> NextDNS inside AmneziaVPN (Option 2, step 7 in the lock settings): the server opens and closes the window by the clock, independent of the iPhone, and blocks the websites too.</p>
            </>
          )}
        </div>
      </Section>
      <button className="btn solid block" onClick={onClose}>{t('Close')}</button>
    </Sheet>
  );
}
