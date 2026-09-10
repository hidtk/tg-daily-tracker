import { createContext, useCallback, useContext } from 'react';

export type Lang = 'en' | 'ru';

/** English is the source; every key is the English string itself. Missing keys fall back to English. */
const RU: Record<string, string> = {
  // nav / generic
  'Today': 'Сегодня', 'Words': 'Слова', 'Practice': 'Практика', 'Progress': 'Прогресс', 'Settings': 'Настройки',
  'Close': 'Закрыть', 'Save': 'Сохранить', 'Saved': 'Сохранено', 'Saving…': 'Сохраняю…', 'Error': 'Ошибка', 'Could not load': 'Не удалось загрузить',
  'Could not save': 'Не удалось сохранить', 'Could not connect': 'Не удалось подключиться', 'Open the app from Telegram': 'Откройте приложение из Telegram',
  'Open the app from the button in the chat with the bot.': 'Откройте приложение кнопкой в чате с ботом.',
  'Delete': 'Удалить', 'Deleted': 'Удалено', 'Add': 'Добавить', 'Copied': 'Скопировано', 'Copy it by hand': 'Скопируй вручную',
  // today
  'days to the exam': 'дней до экзамена', 'target': 'цель', 'The exam date has passed': 'Дата экзамена прошла',
  'Target': 'Цель', 'set the exam date in Settings': 'задай дату экзамена в настройках', 'read-only': 'только просмотр',
  'Welcome. Each morning you get five words and a task; in the evening, log what you did here. Lessons, homework and the exam date are in Settings.':
    'Добро пожаловать. Каждое утро — пять слов и задание; вечером отмечай здесь, что сделал. Занятия, домашка и дата экзамена — в настройках.',
  'Lesson': 'Занятие', 'Homework': 'Домашка', 'today at': 'сегодня в', 'Done': 'Сделал', 'due today': 'на сегодня', 'overdue': 'просрочено', 'due': 'к', 'no deadline': 'без срока',
  'Add homework in the chat:': 'Добавить домашку в чате:', 'or a photo captioned “hw”.': 'или фото с подписью «дз».',
  'Planned': 'План', 'Skip': 'Не буду', 'Why? (ill, exam, no energy — be honest)': 'Почему? (болею, экзамен, нет сил — честно)',
  'Plan (e.g. Listening section 2, 30 min)': 'План (напр. Listening, часть 2, 30 мин)', 'Minutes': 'Минуты', 'Skills': 'Навыки',
  'How did it go? (optional)': 'Как прошло? (необязательно)',
  'A deliberate skip: once a week it does not break the streak. Your partner sees the reason.': 'Осознанный пропуск: раз в неделю не ломает стрик. Партнёр увидит причину.',
  'Planned, not yet done.': 'Запланировано, ещё не отмечено.',
  // sentences
  'Earn minutes': 'Заработать минуты', 'Hide': 'Скрыть', 'Meaning': 'Значение',
  'Write a sentence with this word — one minute of social media for each.': 'Напиши предложение с этим словом — минута соцсетей за каждое.',
  '{n} min in the wallet': '{n} мин в кошельке', 'At least 7 words.': 'Минимум 7 слов.', 'Use the word itself (any form).': 'Используй само слово (в любой форме).',
  'Too close to the example — write your own.': 'Слишком похоже на пример — напиши своё.', 'Write it in English.': 'Пиши по-английски.',
  'Daily limit reached — Reading only from here.': 'Дневной лимит достигнут — дальше только Reading.', 'This word is done for today.': 'Это слово на сегодня уже сделано.',
  'Forty sentences today — the limit. More minutes only through Reading now.': 'Сорок предложений за сегодня — лимит. Дальше минуты только через Reading.',
  // words
  'Review': 'Повторение', 'of': 'из', 'Show meaning': 'Показать значение', 'Forgot': 'Забыл', 'Knew it': 'Помню',
  'Done for today: {ok} of {n} recalled. Missed words come back tomorrow; the rest move up a step.': 'На сегодня всё: вспомнил {ok} из {n}. Забытые вернутся завтра, остальные поднялись на ступень.',
  'Today’s words': 'Слова дня', 'New words': 'Новые слова', 'The whole bank has been introduced.': 'Весь банк слов уже пройден.',
  'Daily words are switched off in Settings.': 'Слова дня выключены в настройках.',
  'These come back tomorrow, then after 3, 7, 14 and 30 days. Five recalls in a row and a word is yours.': 'Они вернутся завтра, потом через 3, 7, 14 и 30 дней. Пять попаданий подряд — слово твоё.',
  '{n} of {total} introduced': '{n} из {total} пройдено', '{n} mastered': '{n} освоено',
  'Last two weeks: {r} reviews, {p}% recalled.': 'За две недели: {r} повторений, {p}% вспомнил.',
  // practice
  'to do': 'осталось', 'All done. Refresh the library to unlock the next four.': 'Всё пройдено. Обнови библиотеку — откроются следующие четыре.',
  'All tests in the bank are done — new ones will come with an update.': 'Все тесты банка пройдены — новые появятся с обновлением.',
  'Refresh library': 'Обновить библиотеку', 'Four new tests unlocked': 'Открыто четыре новых теста', '{a} of {b} tests unlocked': 'Открыто {a} из {b} тестов',
  'Archive': 'Архив', 'Retake any test for practice — minutes are paid once.': 'Любой тест можно пройти снова для практики — минуты начисляются один раз.',
  'Reading': 'Reading',
  'Thirteen questions, band on the official scale. A pass earns social-media minutes:': 'Тринадцать вопросов, band по официальной шкале. За тест начисляются минуты соцсетей:',
  'and up': 'и выше', 'Over the time limit the reward is halved; a test counts once.': 'Дольше лимита — награда пополам; тест засчитывается один раз.',
  'questions': 'вопросов', 'about': 'около', 'min': 'мин',
  'Social media is locked. Pass a Reading test to open it.': 'Соцсети закрыты. Пройди Reading-тест, чтобы открыть.',
  'About {n} minutes in {apps}.': 'Примерно {n} минут в {apps}.', 'the gated apps': 'закрытых приложениях',
  'Earned today {a} · {b} more possible · bank up to {c}': 'Сегодня заработано {a} · ещё возможно {b} · банк до {c}',
  'Locked apps': 'Блокировка', 'Wallet on': 'Кошелёк включён', 'Off, and the apps stop being blocked': 'Выключишь — приложения перестанут блокироваться',
  'Which apps': 'Какие приложения', 'Bank, max min': 'Банк, макс. мин', 'Daily limit': 'Лимит за день', 'Set up on iPhone': 'Настроить на iPhone',
  'Recent sessions': 'Последние заходы', 'Result': 'Результат', 'no minutes': 'без минут',
  'This test was already counted — a repeat earns nothing.': 'Этот тест уже засчитан — повтор минут не даёт.',
  'Over the limit ({n} min) — the reward is halved.': 'Дольше лимита ({n} мин) — награда уменьшена вдвое.',
  'Daily limit or bank cap reached.': 'Упёрся в дневной лимит или потолок банка.', 'Balance': 'Баланс', 'Mistakes': 'Ошибки', 'yours': 'твой ответ', 'correct': 'верно',
  'limit': 'лимит', 'answered': 'отвечено', 'Questions': 'Вопросы', 'one word': 'одно слово', 'Checking…': 'Проверяю…', 'Check': 'Проверить',
  'No point cheating: the minutes are yours, and the band shows your real level before the exam.': 'Списывать смысла нет: минуты твои, а band показывает реальный уровень перед экзаменом.',
  'Open · {n} min left': 'Открыто · осталось {n} мин', 'Locked': 'Закрыто', 'Lock now': 'Закрыть', '{n} min returned': '{n} мин возвращено', 'Open for {n} min': 'Открыто на {n} мин', 'Open {n} min': 'Открыть {n} мин',
  'Minutes are spent when you open; closing early returns the unused ones. When time runs out the lock closes by itself and the bot tells you.': 'Минуты списываются при открытии; закроешь раньше — неиспользованные вернутся. Когда время выйдет, замок закроется сам, бот напишет.',
  'Install the iPhone profile': 'Установить профиль на iPhone', 'How it works': 'Как это работает', 'Disconnect': 'Отключить', 'Lock connected': 'Замок подключён', 'Connect': 'Подключить', 'Configuration ID': 'ID конфигурации',
  'Social media is locked at the DNS level through NextDNS (free). Create an account at nextdns.io, then paste the API key (My account → API) and the six-character configuration ID.': 'Соцсети блокируются на уровне DNS через NextDNS (бесплатно). Заведи аккаунт на nextdns.io, вставь сюда API-ключ (My account → API) и шестизначный ID конфигурации.',
  'How the lock works': 'Как работает замок', 'The idea': 'Идея', 'Setup, once': 'Настройка, один раз', 'Limits': 'Ограничения',
  'Every request from {apps} goes through NextDNS. While the lock is on, those domains do not resolve: the app opens, but nothing loads.': 'Каждый запрос {apps} идёт через NextDNS. Пока замок закрыт, эти домены не отвечают: приложение открывается, но ничего не грузится.',
  'Tap “Open N min” here or send /unlock 15 to the bot: the minutes are spent, the lock lifts within seconds. When the time is up, the lock closes by itself.': 'Нажми «Открыть N мин» здесь или отправь боту /unlock 15: минуты списываются, замок снимается за секунды. Когда время выйдет, он закроется сам.',
  'nextdns.io → sign up (email only). A configuration is created automatically; its ID is the six characters in the address bar.': 'nextdns.io → регистрация (только email). Конфигурация создаётся автоматически; её ID — шесть символов в адресной строке.',
  'My account → API → copy the key. Paste both here and tap Connect.': 'My account → API → скопируй ключ. Вставь оба значения сюда и нажми «Подключить».',
  'Install the iPhone profile: open the link in Safari, then Settings → Profile Downloaded → Install. It routes DNS to NextDNS on Wi-Fi and mobile data.': 'Установи профиль на iPhone: открой ссылку в Safari, затем Настройки → Профиль загружен → Установить. Он направляет DNS в NextDNS и по Wi-Fi, и по сотовой.',
  'The profile has a removal password — give it to your partner. Without it the lock cannot be removed.': 'У профиля есть пароль на удаление — отдай его партнёру. Без него замок не снять.',
  'A VPN with its own DNS bypasses the lock — switch it off or set its DNS to NextDNS.': 'VPN со своим DNS обходит замок — выключи его или укажи в нём DNS NextDNS.',
  'Already-loaded content keeps working until the app asks for more; the first seconds after unlocking may still show errors.': 'Уже загруженное продолжает работать, пока приложение не запросит новое; в первые секунды после открытия ещё могут быть ошибки.',
  'iPhone Shortcuts': 'Быстрые команды · iPhone',
  'iOS cannot ask a server for permission by itself, but Shortcuts can. Two automations per app ({apps}).': 'iOS сам не умеет спрашивать разрешение у сервера, но «Быстрые команды» умеют. Две автоматизации на каждое приложение ({apps}).',
  'Gate link': 'Ссылка-шлюз', 'Test it': 'Проверить', 'Copy “opened”': 'Скопировать «открыл»', 'Copy “closed”': 'Скопировать «закрыл»',
  'For other apps replace': 'Для других приложений замени', 'with': 'на', 'or': 'или', 'The link is personal — do not share it.': 'Ссылка личная — никому не показывай.',
  'Automation 1 — open': 'Автоматизация 1 — открытие', 'Automation 2 — close': 'Автоматизация 2 — закрытие', 'Make it stick': 'Усилить',
  'Shortcuts → Automation → + → App.': 'Быстрые команды → Автоматизация → «+» → Приложение.',
  'App: Instagram. When: Is Opened. Run Immediately, notifications off.': 'Приложение: Instagram. Когда: Открыто. «Запускать сразу», уведомление выключить.',
  'Action Get Contents of URL → paste the “opened” link.': 'Действие «Получить содержимое URL» → вставь ссылку «открыл».',
  'Action If: [Contents of URL] contains ALLOW.': 'Действие «Если»: [Содержимое URL] содержит ALLOW.',
  'In Otherwise: Show Notification (“Out of minutes — do a Reading”) and Open App → Shortcuts (or go Home via Open App → Settings).': 'В ветке «Иначе»: «Показать уведомление» («Минуты кончились — иди делать Reading») и «Открыть приложение» → Быстрые команды (или «Настройки» — чтобы выкинуло из Instagram).',
  'The same, but When: Is Closed, with the “closed” link — it charges the minutes you used.': 'То же самое, но Когда: Закрыто и ссылка «закрыл» — она списывает потраченные минуты.',
  'If the close event never fires, the session closes itself after 45 minutes at most.': 'Если событие закрытия не сработает, сессия закроется сама максимум через 45 минут.',
  'Screen Time → a one-minute limit on these apps, and give the passcode to your partner. Then bypassing the automation stops being a two-second job.': 'Экранное время → лимит 1 минута на эти приложения, а код-пароль отдай партнёру. Тогда обойти автоматизацию будет не делом двух секунд.',
  'Apple’s guide to automations': 'Справка Apple по автоматизациям',
  // progress
  'Words and Reading': 'Слова и Reading', 'words introduced': 'слов пройдено', 'mastered': 'освоено', 'sentences written': 'предложений написано',
  'reading tests': 'Reading-тестов', 'average band': 'средний band', 'best': 'лучший', 'new words': 'новые слова', 'recalled': 'вспомнил', 'sentences': 'предложения', 'reading band': 'band за Reading',
  'exam date not set': 'дата экзамена не задана', 'last mock · target': 'последний пробный · цель', 'no mock tests yet': 'пробных пока нет', 'this week': 'на этой неделе',
  'day streak · best {b} · {d}% over 4 weeks': 'дней подряд · лучший {b} · {d}% за 4 недели', 'Calendar': 'Календарь', 'Mock tests': 'Пробные тесты',
  'Add your first mock test result and the band chart appears here.': 'Добавь результат первого пробного — здесь появится график band.',
  'Date': 'Дата', 'All': 'Все', 'Delete this result?': 'Удалить результат?', 'Add a mock test': 'Добавить пробный', 'Minutes by week': 'Минуты по неделям',
  'untagged': 'без навыка', '{h} hours over twelve weeks.': '{h} часов за двенадцать недель.', 'Discipline · done of planned days': 'Дисциплина · сделано из запланированных',
  'Overall': 'Overall', 'Mock test': 'Пробный тест', 'Enter at least one section': 'Укажи хотя бы одну секцию', 'Overall:': 'Overall:',
  '— (all four sections needed)': '— (нужны все четыре секции)', 'Note': 'Заметка',
  // settings
  'Exam': 'Экзамен', 'Target band': 'Целевой балл', 'Exam date': 'Дата экзамена', 'Exam date · changed today': 'Дата экзамена · уже меняли сегодня',
  'Practice hours per week': 'Часов практики в неделю', 'The exam date can be changed once a day — so it stays a deadline, not a wish.': 'Дату экзамена можно менять раз в день — чтобы она оставалась дедлайном, а не пожеланием.',
  'Mornings and evenings': 'Утро и вечер', 'Morning': 'Утро', 'Evening': 'Вечер', 'Time zone': 'Часовой пояс', 'Use {tz}': 'Использовать {tz}',
  'Words in the morning': 'Слова по утрам', '{n} new words a day, plus reviews': '{n} новых слов в день плюс повторение', 'no': 'нет',
  'Task in the morning': 'Задание по утрам', 'Mon Writing 2 · Tue Speaking · Wed Reading · Thu Listening · Fri Writing 1 · Sat Grammar · Sun Review': 'Пн Writing 2 · Вт Speaking · Ср Reading · Чт Listening · Пт Writing 1 · Сб Grammar · Вс обзор',
  'Weekly summary on Sunday': 'Итоги недели в воскресенье', 'Sunday, at': 'Воскресенье, в', 'The evening message is skipped if the day is already logged.': 'Вечернее сообщение не приходит, если день уже отмечен.',
  'Lessons': 'Занятия', 'Accountability partner': 'Партнёр по ответственности', 'Unlink': 'Отвязать', 'Partner unlinked': 'Партнёр отвязан',
  'Report missed days': 'Сообщать о пропусках', 'In the morning, if yesterday was not logged': 'Утром, если вчера ничего не отмечено',
  'The weekly summary always goes to the partner while they are linked.': 'Итоги недели уходят партнёру всегда, пока он привязан.',
  'A person or a group who receives your weekly summary and missed days. Social pressure works better than any reminder.': 'Человек или группа, кому приходят твои итоги недели и пропуски. Социальное давление работает лучше любых напоминаний.',
  'Get a link: /partner in the bot': 'Получить ссылку: /partner в боте', 'Data': 'Данные', 'Export everything as JSON': 'Экспорт всего в JSON', 'Save settings': 'Сохранить настройки',
  'Language': 'Язык', 'English': 'English', 'Russian': 'Русский',
  // lessons
  'Lessons with a teacher: a reminder in the morning and N minutes before, and homework attaches to the next one automatically.': 'Занятия с преподавателем: напоминание утром и за N минут, домашка привязывается к ближайшему автоматически.',
  'min before': 'мин до', 'morning': 'утром', 'Add a lesson': 'Добавить занятие',
  'Send homework to the bot:': 'Домашку присылай боту:', 'or a photo captioned “hw” — the morning task adapts to it.': 'или фото с подписью «дз» — утреннее задание подстроится.',
  'Delete “{t}”?': 'Удалить «{t}»?', 'English lesson': 'Английский', 'Enter a title': 'Введи название', 'Pick the days': 'Выбери дни', 'New lesson': 'Новое занятие',
  'Title': 'Название', 'Days': 'Дни', 'Starts at': 'Начало', 'Remind before': 'Напомнить за', 'no reminder': 'не напоминать', 'Lesson time zone': 'Часовой пояс занятия',
  'Morning reminder': 'Напоминать утром', 'Together with the morning message': 'Вместе с утренним сообщением',
  // dates
  'January': 'Январь', 'February': 'Февраль', 'March': 'Март', 'April': 'Апрель', 'May': 'Май', 'June': 'Июнь', 'July': 'Июль', 'August': 'Август', 'September': 'Сентябрь', 'October': 'Октябрь', 'November': 'Ноябрь', 'December': 'Декабрь',
  'Jan': 'янв', 'Feb': 'фев', 'Mar': 'мар', 'Apr': 'апр', 'Jun': 'июн', 'Jul': 'июл', 'Aug': 'авг', 'Sep': 'сен', 'Oct': 'окт', 'Nov': 'ноя', 'Dec': 'дек',
  'Mon': 'Пн', 'Tue': 'Вт', 'Wed': 'Ср', 'Thu': 'Чт', 'Fri': 'Пт', 'Sat': 'Сб', 'Sun': 'Вс',
  'Monday': 'Понедельник', 'Tuesday': 'Вторник', 'Wednesday': 'Среда', 'Thursday': 'Четверг', 'Friday': 'Пятница', 'Saturday': 'Суббота', 'Sunday': 'Воскресенье',
  // skills
  'Listening': 'Listening', 'Writing': 'Writing', 'Speaking': 'Speaking', 'Vocab': 'Слова', 'Grammar': 'Грамматика',
};

const KEY = 'lang';

export function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ru' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function storeLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l;
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = lang === 'ru' ? (RU[key] ?? key) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}

export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });

/** Hook: t('English text', { vars }) → text in the current language. */
export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

export function useLang() {
  return useContext(LangContext);
}
