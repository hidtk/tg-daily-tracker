import { useState, type ReactNode } from 'react';
import { GATE_APP_LABEL, GATE_TICK_SECONDS, type GateApp } from '@tracker/shared';
import { haptic, tg } from '../tg';
import { useLang, useT } from '../i18n';
import { useToast } from './Toast';
import { Section, Sheet } from './ui';
import { Mascot } from './Mascot';

const SHORTCUTS_APP = 'shortcuts://';
/** Timer loop length: LOOP_REPEATS × GATE_TICK_SECONDS = 2 hours, more than the default minutes bank. */
const LOOP_REPEATS = 360;
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
  const tickUrl = `${base}?e=tick`;
  const statusUrl = `${base}?e=status`;
  const names = (apps.length ? apps : (['instagram', 'tiktok', 'youtube', 'vk'] as GateApp[])).map((a) => GATE_APP_LABEL[a]).join(', ');
  const loopMin = Math.round((LOOP_REPEATS * GATE_TICK_SECONDS) / 60);
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
      <Mascot size={72} message={ru ? 'Десять минут настройки — и соцсети открываются только на заработанные минуты, а когда они кончаются, iPhone сам выкидывает на экран «Домой».' : 'Ten minutes of setup: social media opens only for earned minutes, and when they run out the iPhone sends you to the Home Screen by itself.'} />
      <Section label={ru ? 'Как это работает' : 'How it works'}>
        <div className="steps">
          {ru ? (
            <>
              <p>{`Когда ты открываешь ${names}, iPhone запускает автоматизацию. Она спрашивает сервер: есть минуты? Нет (или сервер не ответил) — сразу на экран «Домой».`}</p>
              <p>{`Есть — приложение открывается, а автоматизация не завершается: каждые ${GATE_TICK_SECONDS} секунд она спрашивает сервер «таймер», сколько осталось. Как только оплаченные минуты кончились, сервер отвечает BLOCK — и тебя выкидывает на экран «Домой», даже если ты сам ничего не закрывал. Точность — около ${GATE_TICK_SECONDS} секунд: одна заработанная минута = одна минута.`}</p>
              <p>{'Вторая автоматизация сообщает серверу, что приложение закрыто. Сервер считает реальное время от открытия до закрытия. Если iPhone почему-то не выкинул вовремя, лишнее время всё равно спишется — баланс уйдёт в минус (долг), и соцсети не откроются, пока не отработаешь.'}</p>
              <p className="muted">Нужен iOS 17 или новее. Настройка — около 10 минут, делается один раз.</p>
            </>
          ) : (
            <>
              <p>{`When you open ${names}, the iPhone runs an automation. It asks the server: any minutes? No (or no answer) — straight to the Home Screen.`}</p>
              <p>{`Yes — the app opens and the automation keeps running: every ${GATE_TICK_SECONDS} seconds it asks the server how much is left. When the paid minutes are over the server answers BLOCK and you are sent to the Home Screen, even if you didn't close anything. Accuracy is about ${GATE_TICK_SECONDS} seconds: one earned minute is one minute.`}</p>
              <p>{'The second automation tells the server the app was closed. The server charges the real time from open to close. If the iPhone failed to send you out in time, the extra time is charged anyway — the balance goes below zero (a debt) and social media stays shut until you work it off.'}</p>
              <p className="muted">Needs iOS 17 or later. Setup takes about 10 minutes, once.</p>
            </>
          )}
        </div>
      </Section>

      <Section label={ru ? 'Твои ссылки' : 'Your links'}>
        <CopyUrl label={ru ? 'Ссылка 1 — «Открыто»' : 'Link 1 — “Is Opened”'} url={openUrl} />
        <CopyUrl label={ru ? 'Ссылка 2 — «Таймер»' : 'Link 2 — “Timer”'} url={tickUrl} />
        <CopyUrl label={ru ? 'Ссылка 3 — «Закрыто»' : 'Link 3 — “Is Closed”'} url={closeUrl} />
        <button className="btn link" onClick={test}>{ru ? 'Проверить ссылку' : 'Test the link'}</button>
        {check && <div className="hint">{check}</div>}
        <div className="hint">{ru ? 'Ссылки личные: в них твой ключ. Никому их не отправляй.' : 'These links are personal — they contain your key. Do not share them.'}</div>
      </Section>

      <Section label={ru ? 'Автоматизация 1: вход и таймер' : 'Automation 1: entry and timer'}>
        {ru ? (
          <>
            <div className="hint" style={{ marginTop: 0, marginBottom: 6 }}>Уже есть автоматизация «Открыто» из старой инструкции? Открой её и начни с шага 10 — первые шаги у тебя уже сделаны.</div>
            <Step n={1} title="Скопируй ссылку 1">Кнопка «Скопировать» выше.</Step>
            <Step n={2} title="Открой приложение «Команды»">Оно стоит на iPhone по умолчанию. Если удалено — скачай бесплатно из App Store.<AppLinks ru /></Step>
            <Step n={3} title="Внизу вкладка «Автоматизация» → «+»">Если автоматизаций ещё нет, нажми <A>Новая автоматизация</A>.</Step>
            <Step n={4} title="Выбери «Приложение»">Нажми <A>Выбрать</A>, отметь {names}, нажми <A>Готово</A>.</Step>
            <Step n={5} title="Галочка только «Открыто»">«Закрыто» оставь выключенным — для него будет автоматизация 2.</Step>
            <Step n={6} title="Выбери «Запускать сразу»">Не «После подтверждения». Выключи <A>Уведомлять при запуске</A>. Нажми <A>Далее</A>.</Step>
            <Step n={7} title="«Новая пустая автоматизация»" />
            <Step n={8} title="Действие «Получить содержимое URL»">Нажми <A>Добавить действие</A>, в поиске набери «URL». Нажми на синее поле <A>URL</A> и вставь ссылку 1.</Step>
            <Step n={9} title="Действие «Если» → «не содержит» ALLOW → «Перейти „Домой“»">Найди поиском «Если». Оно само подставит <A>Содержимое URL</A>. Если в условиях только «есть любое значение», нажми на <A>Содержимое URL</A> и выбери тип <A>Текст</A>. Нажми <A>Условие</A> → <A>не содержит</A>, в поле <A>Текст</A> впиши <code>ALLOW</code> большими буквами. Потом найди поиском «Домой» и перетащи <A>Перейти „Домой“</A> между <A>Если</A> и <A>Иначе</A>. Так приложение закроется, и когда минут нет, и когда сервер не ответил — лазейки «выключил интернет и зашёл» нет.</Step>
            <Step n={10} title="Скопируй ссылку 2 («Таймер»)">Вернись сюда кнопкой «Скопировать» у ссылки 2, потом снова в «Команды».</Step>
            <Step n={11} title={`Действие «Повторять» — ${LOOP_REPEATS} раз`}>Поиск «Повторять». Оно встанет в самый низ, под концом блока «Если» — так и нужно. Нажми на число в строке <A>Повторять</A> и впиши <code>{LOOP_REPEATS}</code>. Это до {loopMin} минут наблюдения — больше, чем вмещает банк минут.</Step>
            <Step n={12} title={`Внутрь «Повторять»: «Ожидать» ${GATE_TICK_SECONDS} с`}>Поиск «Ожидать». Перетащи действие внутрь блока — между <A>Повторять</A> и <A>Конец повтора</A>. Нажми на время и поставь <code>{GATE_TICK_SECONDS}</code> секунд.</Step>
            <Step n={13} title="Внутрь «Повторять», под «Ожидать»: «Получить содержимое URL» со ссылкой 2">Добавь ещё одно <A>Получить содержимое URL</A>, перетащи его под <A>Ожидать</A> (всё ещё внутри повтора) и вставь в поле <A>URL</A> ссылку 2.</Step>
            <Step n={14} title="Ниже внутри повтора: «Если» → «содержит» BLOCK → «Перейти „Домой“»">Добавь <A>Если</A> и перетащи его под последнее <A>Получить содержимое URL</A>. Проверь, что в строке стоит именно оно (нижнее). Условие <A>содержит</A>, текст <code>BLOCK</code>. Внутрь этого «Если» перетащи ещё одно <A>Перейти „Домой“</A>. Здесь именно «содержит BLOCK»: если во время сессии на секунду пропала сеть или переподключается VPN, тебя не выкинет зря — время всё равно посчитается при закрытии.</Step>
            <Step n={15} title="Ещё ниже внутри повтора: «Если» → «содержит» STOP → «Остановить эту команду»">Так же добавь третье <A>Если</A>: <A>содержит</A> <code>STOP</code>. Внутрь — действие, которое находится поиском «Остановить»: <A>Остановить эту команду</A>. Сервер отвечает STOP, когда приложение уже закрыто, — таймер выключается и не тратит батарею.</Step>
            <Step n={16} title="Нажми «Готово»">Сверься со схемой ниже.</Step>
            <pre className="sc-scheme">{`Получить содержимое URL (ссылка 1)
Если Содержимое URL не содержит ALLOW
    Перейти «Домой»
Иначе
Конец
Повторять ${LOOP_REPEATS} раз
    Ожидать ${GATE_TICK_SECONDS} с
    Получить содержимое URL (ссылка 2)
    Если Содержимое URL содержит BLOCK
        Перейти «Домой»
    Конец
    Если Содержимое URL содержит STOP
        Остановить эту команду
    Конец
Конец повтора`}</pre>
          </>
        ) : (
          <>
            <div className="hint" style={{ marginTop: 0, marginBottom: 6 }}>Already have an “Is Opened” automation from the old guide? Open it and start at step 10.</div>
            <Step n={1} title="Copy link 1">The Copy button above.</Step>
            <Step n={2} title="Open the Shortcuts app">It is preinstalled. If you deleted it, get it free from the App Store.<AppLinks ru={false} /></Step>
            <Step n={3} title="Automation tab at the bottom → “+”">With no automations yet, tap <A>New Automation</A>.</Step>
            <Step n={4} title="Choose “App”">Tap <A>Choose</A>, select {names}, tap <A>Done</A>.</Step>
            <Step n={5} title="Only “Is Opened”">Leave “Is Closed” off — automation 2 handles it.</Step>
            <Step n={6} title="Choose “Run Immediately”">Not “Run After Confirmation”. Turn off <A>Notify When Run</A>. Tap <A>Next</A>.</Step>
            <Step n={7} title="“New Blank Automation”" />
            <Step n={8} title="Action “Get Contents of URL”">Tap <A>Add Action</A>, search “URL”. Tap the blue <A>URL</A> field and paste link 1.</Step>
            <Step n={9} title="“If” → “does not contain” ALLOW → “Go to Home Screen”">Search “If”. It picks <A>Contents of URL</A> by itself; if the only condition is “has any value”, tap <A>Contents of URL</A> and set its type to <A>Text</A>. Tap <A>Condition</A> → <A>does not contain</A>, type <code>ALLOW</code> in capitals. Then search “Home” and drag <A>Go to Home Screen</A> between <A>If</A> and <A>Otherwise</A>. No minutes or no answer from the server — the app closes.</Step>
            <Step n={10} title="Copy link 2 (“Timer”)">Come back here, tap Copy under link 2, return to Shortcuts.</Step>
            <Step n={11} title={`Action “Repeat” — ${LOOP_REPEATS} times`}>Search “Repeat”. It lands at the very bottom, below the end of the If block — that is right. Tap the number and enter <code>{LOOP_REPEATS}</code>: up to {loopMin} minutes of watching.</Step>
            <Step n={12} title={`Inside Repeat: “Wait” ${GATE_TICK_SECONDS} s`}>Search “Wait”, drag it between <A>Repeat</A> and <A>End Repeat</A>, set <code>{GATE_TICK_SECONDS}</code> seconds.</Step>
            <Step n={13} title="Inside Repeat, below Wait: “Get Contents of URL” with link 2">Add another <A>Get Contents of URL</A>, drag it under <A>Wait</A> and paste link 2.</Step>
            <Step n={14} title="Below it: “If” → “contains” BLOCK → “Go to Home Screen”">Add <A>If</A> under the last <A>Get Contents of URL</A> (make sure the If uses that one). Condition <A>contains</A>, text <code>BLOCK</code>, and drag another <A>Go to Home Screen</A> inside. “Contains BLOCK” here, so a network blip mid-session doesn't throw you out — the time is charged at close anyway.</Step>
            <Step n={15} title="Below: “If” → “contains” STOP → “Stop This Shortcut”">A third <A>If</A>: <A>contains</A> <code>STOP</code>, with <A>Stop This Shortcut</A> inside (search “Stop”). The server says STOP once the app is closed, so the timer ends and saves battery.</Step>
            <Step n={16} title="Tap “Done”">Compare with the outline below.</Step>
            <pre className="sc-scheme">{`Get Contents of URL (link 1)
If Contents of URL does not contain ALLOW
    Go to Home Screen
Otherwise
End If
Repeat ${LOOP_REPEATS} times
    Wait ${GATE_TICK_SECONDS} s
    Get Contents of URL (link 2)
    If Contents of URL contains BLOCK
        Go to Home Screen
    End If
    If Contents of URL contains STOP
        Stop This Shortcut
    End If
End Repeat`}</pre>
          </>
        )}
      </Section>

      <Section label={ru ? 'Автоматизация 2: закрытие' : 'Automation 2: close'}>
        {ru ? (
          <>
            <Step n={1} title="Снова «+» → «Приложение» → те же приложения">Сначала скопируй ссылку 3 кнопкой выше.<AppLinks ru /></Step>
            <Step n={2} title="Галочка только «Закрыто», «Запускать сразу»" />
            <Step n={3} title="Одно действие: «Получить содержимое URL» со ссылкой 3">Больше ничего не нужно.</Step>
            <div className="hint">Без неё сервер не знает, когда ты вышел, и таймер работает до конца повтора.</div>
          </>
        ) : (
          <>
            <Step n={1} title="“+” again → “App” → the same apps">Copy link 3 with the button above first.<AppLinks ru={false} /></Step>
            <Step n={2} title="Only “Is Closed”, “Run Immediately”" />
            <Step n={3} title="One action: “Get Contents of URL” with link 3">Nothing else.</Step>
            <div className="hint">Without it the server doesn't know when you left, and the timer runs until the repeat ends.</div>
          </>
        )}
      </Section>

      <Section label={ru ? 'Проверка' : 'Check'}>
        <div className="steps">
          {ru ? (
            <>
              <p>1. Нажми «Проверить ссылку» выше — должно появиться «Ссылка работает».</p>
              <p>2. Без минут открой Instagram — тебя сразу выкинет на экран «Домой».</p>
              <p>3. Заработай пару минут (например, задание «Предложение со словом» в Магазине), открой Instagram и ничего не делай. Когда минуты кончатся, iPhone сам выкинет на экран «Домой» — в пределах {GATE_TICK_SECONDS} секунд.</p>
              <p>4. На Главной баланс уменьшится, а в «Прогрессе» → «Минуты: последние» появится строка «Соцсети».</p>
            </>
          ) : (
            <>
              <p>1. Tap “Test the link” — you should see “The link works”.</p>
              <p>2. With no minutes, open Instagram — you land on the Home Screen at once.</p>
              <p>3. Earn a couple of minutes (e.g. the “A sentence with a word” task in the Shop), open Instagram and just wait. When they run out, the iPhone sends you Home within {GATE_TICK_SECONDS} seconds.</p>
              <p>4. The balance on Home goes down, and Progress → “Minutes: recent” shows a “Social media” line.</p>
            </>
          )}
        </div>
      </Section>

      <Section label={ru ? 'Честно: что можно и что нельзя' : 'Honest limits'}>
        <div className="steps">
          {ru ? (
            <>
              <p><b>Работает надёжно:</b> вход без минут закрыт; выход по окончании минут — через таймер; сервер считает реальное время по открытию и закрытию, так что переиграть «лишние» минуты нельзя — они станут долгом.</p>
              <p><b>Ограничения iOS:</b> Apple не даёт гарантий, сколько автоматизация живёт в фоне. При заблокированном экране, в режиме энергосбережения или если запустить другую команду, iOS может приостановить или остановить таймер. Тогда выкинет позже (как только таймер снова спросит сервер), а время всё равно спишется при закрытии — баланс уйдёт в минус.</p>
              <p>• Автоматизацию можно выключить в «Командах» — это защита от импульса, а не от решения.</p>
              <p>• Веб-версии (instagram.com в Safari) команда не видит.</p>
              <p><b>Усиление:</b> NextDNS внутри AmneziaVPN (Способ 2, шаг 7 в настройках блокировки). Там окно открывает и закрывает сам сервер по часам — от iPhone это не зависит, и закрываются также сайты в браузере. Пароль от профиля отдай партнёру.</p>
            </>
          ) : (
            <>
              <p><b>Reliable:</b> no entry without minutes; out when the minutes end, via the timer; the server charges real time from open to close, so extra minutes can't be won — they become a debt.</p>
              <p><b>iOS limits:</b> Apple guarantees nothing about how long an automation lives in the background. With the screen locked, in Low Power Mode or when another shortcut starts, iOS may pause or stop the timer. Then you are sent out later (on the next timer check), and the time is still charged at close.</p>
              <p>• An automation can be switched off in Shortcuts — this stops the impulse, not a decision.</p>
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
