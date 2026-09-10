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
  // words
  'Review': 'Повторение', 'of': 'из', 'Show meaning': 'Показать значение', 'Forgot': 'Забыл', 'Knew it': 'Помню',
  'Done for today: {ok} of {n} recalled. Missed words come back tomorrow; the rest move up a step.': 'На сегодня всё: вспомнил {ok} из {n}. Забытые вернутся завтра, остальные поднялись на ступень.',
  'Today’s words': 'Слова дня', 'New words': 'Новые слова', 'The whole bank has been introduced.': 'Весь банк слов уже пройден.',
  'Daily words are switched off in Settings.': 'Слова дня выключены в настройках.',
  'These come back tomorrow, then after 3, 7, 14 and 30 days. Five recalls in a row and a word is yours.': 'Они вернутся завтра, потом через 3, 7, 14 и 30 дней. Пять попаданий подряд — слово твоё.',
  '{n} of {total} introduced': '{n} из {total} пройдено', '{n} mastered': '{n} освоено',
  'Last two weeks: {r} reviews, {p}% recalled.': 'За две недели: {r} повторений, {p}% вспомнил.',
  // practice
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
