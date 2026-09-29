import { createContext, useCallback, useContext } from 'react';

export type Lang = 'en' | 'ru';

/** English is the source; every key is the English string itself. Missing keys fall back to English. */
const RU: Record<string, string> = {
  // nav / generic
  'Today': 'Сегодня', 'Words': 'Слова', 'Practice': 'Практика', 'Progress': 'Прогресс', 'Settings': 'Настройки',
  'Close': 'Закрыть', 'Save': 'Сохранить', 'Saved': 'Сохранено', 'Saving…': 'Сохраняю…', 'Error': 'Ошибка', 'Could not load': 'Не удалось загрузить',
  'Could not save': 'Не удалось сохранить', 'Could not connect': 'Не удалось подключиться', 'Open the app from Telegram': 'Откройте приложение из Telegram',
  'Open the app from the button in the chat with the bot.': 'Откройте приложение кнопкой в чате с ботом.',
  'Delete': 'Удалить', 'Deleted': 'Удалено', 'Add': 'Добавить', 'Copied': 'Скопировано', 'Copy it by hand': 'Скопируй вручную', 'Copy': 'Скопировать', 'Social-media minutes': 'Минуты на соцсети', 'Earn more': 'Заработать ещё', 'Log the day': 'Отметить день', 'Counted today': 'Засчитано сегодня', 'Counted this day': 'Засчитано за день', 'Nothing yet. A Reading test, word review or sentence counts the day by itself.': 'Пока ничего. Reading-тест, повторение слов или предложение засчитают день сами.', 'Nothing was done this day.': 'В этот день занятий не было.', 'Logged automatically: Reading tests by time spent, word reviews, sentences. Nothing to enter by hand.': 'Считается само: Reading-тесты по времени, повторение слов, предложения. Вводить руками ничего не нужно.', 'Welcome. Each morning you get five words and a task. Everything you do here is logged by itself — nothing to fill in. Lessons, homework and the exam date are in Settings.': 'Привет. Каждое утро — пять слов и задание. Всё, что делаешь в приложении, засчитывается само, заполнять ничего не надо. Занятия, домашка и дата экзамена — в Настройках.', 'Earned today {a} · {b} more possible': 'Сегодня заработано {a} · можно ещё {b}', 'Remove the exam date': 'Убрать дату экзамена',
  'The exam date can be moved later once a day — so it stays a deadline, not a wish. Moving it earlier is always allowed.': 'Перенести дату позже можно раз в день — чтобы она оставалась дедлайном, а не пожеланием. Раньше — в любой момент.',
  'The date was already moved later today. Moving it later (or removing it) is possible tomorrow; earlier — right now.': 'Сегодня дату уже переносили позже. Перенести дальше или убрать — завтра, раньше — можно сейчас.', 'Open social media': 'Открыть соцсети',
  'With the Shortcuts lock, apps open by themselves while you have minutes. The lock itself is set up in Settings → Social-media lock.': 'С блокировкой через «Команды» приложения открываются сами, пока есть минуты. Саму блокировку настраивают в Настройках → «Блокировка соцсетей».', 'Great work!': 'Отличная работа!', 'Almost! Try again.': 'Почти! Попробуй ещё.',
  'iPhone: block with Shortcuts': 'iPhone: блокировка через «Команды»', 'Step-by-step guide': 'Пошаговая инструкция',
  'No NextDNS needed: the Shortcuts app closes {apps} when you have no minutes, and a timer sends you to the Home Screen when the paid minutes run out. About 10 minutes to set up, once.':
    'Без NextDNS: «Команды» закрывают {apps}, когда минут нет, а таймер выкидывает на экран «Домой», когда оплаченные минуты кончились. Настройка — около 10 минут, один раз.',
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
  // game: quests, levels, streak, boss, chest
  '{n} min wait for Reading': '{n} мин ждут Reading', 'Boss defeated': 'Босс побеждён', 'New level': 'Новый уровень', 'Chest opened': 'Сундук открыт', 'level': 'уровень',
  'The gate is open — the next stage of the ladder is yours.': 'Дверь открыта — следующая ступень лестницы твоя.',
  'Every level is real work: Reading, words, your own English.': 'Каждый уровень — это настоящая работа: Reading, слова, свой английский.',
  'All three quests done: +{n} min and +30 XP.': 'Все три квеста выполнены: +{n} мин и +30 XP.', 'Continue': 'Продолжить',
  'The level {n} boss is waiting. Win at band {b} and the next stage opens.': 'Босс уровня {n} ждёт. Победишь на band {b} — откроется следующая ступень.',
  'All quests done. Streak: {n} days — see you tomorrow.': 'Все квесты выполнены. Серия: {n} дн. — до завтра.',
  'All quests done. Chest opened — see you tomorrow.': 'Все квесты выполнены. Сундук открыт — до завтра.',
  '{n} min are waiting for Reading. One test and they are yours.': '{n} мин ждут Reading. Один тест — и они твои.',
  'Streak {n} days. Today’s Reading keeps it going.': 'Серия {n} дн. Сегодняшний Reading её продлит.',
  'Start with Reading: it pays the most and counts the day.': 'Начни с Reading: он даёт больше всего минут и засчитывает день.',
  'Reading done. {n} more quests to the chest.': 'Reading сделан. До сундука осталось квестов: {n}.',
  'Level': 'Уровень', '{a} / {b} XP to level {n}': '{a} / {b} XP до уровня {n}', '{a} XP — the top of the ladder': '{a} XP — вершина лестницы', 'See the ladder': 'Лестница уровней',
  'XP is enough for level {n}, but the boss holds the door. XP keeps counting.': 'Опыта хватает на уровень {n}, но дверь держит босс. XP продолжает копиться.',
  'Today +{n} XP': 'Сегодня +{n} XP', 'days in a row': 'дн. подряд', 'best {n}': 'лучшая {n}', 'shields: {n}': 'щитов: {n}',
  'A day counts when its Reading quest is done. Miss a day and the streak starts again — unless you have a shield: every 7 days in a row earn one (up to 2), and it saves one missed day by itself.':
    'День идёт в серию, когда выполнен Reading-квест. Пропустил день — серия начинается заново, если нет щита: каждые 7 дней подряд дают щит (максимум 2), он сам спасает один пропуск.',
  'Quests of the day': 'Квесты дня', 'Fewer words learned so far — today the target is {n}.': 'Выученных слов пока мало — сегодня цель {n}.',
  'Chest opened today: +{n} min, +30 XP.': 'Сундук сегодня открыт: +{n} мин, +30 XP.', 'All three quests open the chest: +{n} min, +30 XP.': 'Три квеста открывают сундук: +{n} мин, +30 XP.',
  'Reading: one test': 'Reading: один тест', 'The key quest: it counts the day for the streak and releases the minutes that wait for it.': 'Главный квест: засчитывает день в серию и открывает минуты, которые его ждут.',
  'Words: type the answers': 'Слова: впиши ответы', 'Russian meaning or a sentence with a gap → type the English word.': 'Русский перевод или предложение с пропуском → впиши английское слово.',
  'Your own English': 'Свой английский', 'One sentence with a word, a Writing text or a Speaking voice message.': 'Одно предложение со словом, Writing-текст или голосовое для Speaking.',
  'Boss of level {n}': 'Босс уровня {n}', 'A harder Reading test, {m} minutes. Win at band {b}.': 'Reading-тест сложнее обычного, {m} минут. Победа — от band {b}.', 'Your best: {b}.': 'Твой лучший: {b}.',
  'One try a day. Come back tomorrow — the answers stay hidden until you win.': 'Одна попытка в день. Приходи завтра — ответы скрыты, пока не победишь.', 'Fight the boss': 'Сразиться с боссом',
  'Opens at level {n}. Until you beat it, the level stops at {n} (XP still counts).': 'Открывается на уровне {n}. Пока не победишь, уровень стоит на {n} (XP при этом копится).',
  'boss {b}': 'босс {b}', 'you': 'ты',
  'Each step costs a bit more XP: 100, 125, 150… Levels up to {n}. At 5, 10, 15, 20 and 25 a boss guards the way.': 'Каждая ступень чуть дороже: 100, 125, 150 XP… Уровней — {n}. На 5, 10, 15, 20 и 25 путь сторожит босс.',
  'Warm-up': 'Разминка', 'Foundation': 'Фундамент', 'Momentum': 'Разгон', 'Band 7 zone': 'Зона band 7', 'Exam ready': 'Готов к экзамену', 'Mastery': 'Мастерство', 'Level ladder': 'Лестница уровней',
  'Minutes for social media are earned by work. Reading pays the most; everything else is a small top-up.': 'Минуты на соцсети зарабатываются работой. Больше всего даёт Reading, остальное — небольшая прибавка.',
  'Minutes for work': 'Минуты за работу', 'Reading test': 'Reading-тест', '5–30 min by band': '5–30 мин по band', 'Boss': 'Босс', 'like Reading + 100 XP': 'как Reading + 100 XP',
  'Writing text (120+ words)': 'Writing-текст (120+ слов)', 'Speaking answer (voice, 60+ s)': 'Ответ Speaking (голосовое, 60+ с)', 'Word typed right': 'Слово вписано верно',
  'up to {n} a day': 'до {n} в день', 'Sentence with a word': 'Предложение со словом', 'Chest (all three quests)': 'Сундук (все три квеста)',
  'Without Reading today only {n} min from the other work are paid. The rest waits and is released the moment you finish a Reading test the same day. At midnight whatever still waits is gone.':
    'Пока сегодня нет Reading, за остальную работу начисляется не больше {n} мин. Остальное ждёт и откроется, как только пройдёшь Reading-тест в тот же день. В полночь всё, что ещё ждёт, сгорает.',
  'A rushed (under 4 minutes) or guessed (under 5 right) Reading test counts for nothing. The daily limit and the bank cap are in Settings → Social-media lock.':
    'Reading-тест наспех (меньше 4 минут) или наугад (меньше 5 верных) не засчитывается. Дневной лимит и потолок банка — в Настройках → «Блокировка соцсетей».',
  'XP and levels': 'Опыт и уровни',
  'XP comes from everything: a Reading test 10 + 2 per right answer, a word 2, a sentence 5, Writing 40, Speaking 25, each quest 10, the chest 30, a boss 100. Nothing is entered by hand — the app counts what you actually did.':
    'Опыт дают за всё: Reading-тест 10 + 2 за каждый верный ответ, слово 2, предложение 5, Writing 40, Speaking 25, каждый квест 10, сундук 30, босс 100. Руками ничего не вводится — приложение считает то, что ты реально сделал.',
  // writing & speaking
  'Too short: {n} words, at least {m} needed.': 'Коротко: {n} слов, нужно минимум {m}.', 'Use at least {m} of your recent words (found: {n}).': 'Используй хотя бы {m} недавних слов (нашёл: {n}).',
  'Too fast: a text like this takes at least {m} minutes from the start.': 'Слишком быстро: на такой текст нужно минимум {m} минут от старта.',
  'This text repeats one you already sent. Write a new one.': 'Этот текст повторяет уже отправленный. Напиши новый.',
  'Press “Start” first — the timer starts on the server.': 'Сначала нажми «Начать» — таймер запускается на сервере.', 'Today’s Writing is already counted. A new topic tomorrow.': 'Writing на сегодня уже засчитан. Новая тема завтра.',
  'Press “Start”: the server notes the time. Then write on the topic below.': 'Нажми «Начать»: сервер запомнит время. Потом пиши на тему ниже.',
  'At least {w} words, and use at least {v} words from your recent vocabulary (the chips below light up when found).': 'Минимум {w} слов и хотя бы {v} слова из недавно выученных (найденные подсвечиваются ниже).',
  'Send it. The server checks length, your words, English and time (at least {m} minutes). Accepted: +40 XP and +{min} min, once a day.': 'Отправь. Сервер проверит длину, слова, английский и время (минимум {m} минут). Засчитано: +40 XP и +{min} мин, раз в день.',
  'Topic': 'Тема', 'Your recent words': 'Твои недавние слова', 'No words learned yet — open Words first.': 'Слов пока нет — сначала открой «Слова».',
  'Accepted: {n} words, used: {v}. A new topic tomorrow.': 'Засчитано: {n} слов, использованы: {v}. Новая тема завтра.', 'Start writing': 'Начать писать', 'Write here in English…': 'Пиши здесь по-английски…',
  '{n} / {m} words': '{n} / {m} слов', 'Send for checking': 'Отправить на проверку', 'The draft is kept on this phone until you send it.': 'Черновик хранится на этом телефоне, пока не отправишь.',
  'Read the card below and think for a minute: what you will say on each point.': 'Прочитай карточку и подумай минуту: что скажешь по каждому пункту.',
  'Press “Open the chat with the bot”, hold the microphone and answer in English — at least {s} seconds (1–2 minutes is ideal, like IELTS Part 2).': 'Нажми «Открыть чат с ботом», зажми микрофон и отвечай по-английски — минимум {s} секунд (1–2 минуты — как в IELTS Part 2).',
  'The bot counts the voice message by itself and replies: +25 XP and +{m} min. Up to {n} answers a day, each on its own card.': 'Бот сам засчитает голосовое и ответит: +25 XP и +{m} мин. До {n} ответов в день, каждый по своей карточке.',
  'Not counted: shorter than {s} seconds, forwarded voice messages, the same voice twice. The bot cannot hear the content — the honesty is yours, the practice too.': 'Не засчитывается: короче {s} секунд, пересланные голосовые, одно и то же голосовое дважды. Смысл бот не слушает — честность на тебе, как и польза.',
  'Card {n} of {m}': 'Карточка {n} из {m}', 'You should say:': 'Расскажи:', 'Open the chat with the bot': 'Открыть чат с ботом', 'Today’s Speaking is done. New cards tomorrow.': 'Speaking на сегодня готов. Новые карточки завтра.',
  // words (typed)
  'Enough sentences for today.': 'На сегодня предложений достаточно.', 'Your own sentence with this word, at least 7 words.': 'Своё предложение с этим словом, минимум 7 слов.',
  '+5 XP and +1 min (first {n} a day)': '+5 XP и +1 мин (первые {n} в день)', '+5 XP (minutes: the daily {n} are done)': '+5 XP (минуты: дневные {n} уже получены)',
  'Enough sentences for today. Tomorrow — new words.': 'На сегодня предложений достаточно. Завтра — новые слова.', 'Counts for the “Your own English” quest.': 'Идёт в квест «Свой английский».',
  'Done for now: {ok} of {n} right. Missed words come back tomorrow.': 'Пока всё: верно {ok} из {n}. Ошибки вернутся завтра.',
  'Nothing to review right now. New words are asked from tomorrow.': 'Сейчас повторять нечего. Новые слова спрашиваются со следующего дня.',
  'Extra practice': 'Доп. практика', 'left': 'осталось', 'Fill the gap': 'Вставь слово', 'Translate': 'Перевод', 'Type the English word': 'Впиши английское слово',
  'Hint: first letter': 'Подсказка: первая буква', 'Hint': 'Подсказка', 'With a hint: +1 XP, no minutes, the word comes back tomorrow.': 'С подсказкой: +1 XP, без минут, слово вернётся завтра.',
  'Right without a hint: +2 XP and +{m} min (up to {c} min a day).': 'Верно без подсказки: +2 XP и +{m} мин (до {c} мин в день).',
  'Right, with a small typo': 'Верно, с небольшой опечаткой', 'Right': 'Верно', 'Not quite': 'Не совсем', 'Type it once to remember': 'Впиши слово ещё раз',
  'The word comes back tomorrow and starts its schedule again.': 'Слово вернётся завтра и начнёт интервалы заново.', 'quest': 'квест',
  'Only typed answers count: you see the Russian meaning or a sentence with a gap and type the English word. Each word once a day; due words first, then extra practice.':
    'Засчитываются только вписанные ответы: видишь русский перевод или предложение с пропуском и вписываешь английское слово. Каждое слово — раз в день; сначала слова по расписанию, потом доп. практика.',
  'Study them now — from tomorrow they are asked by typing: after 1, 3, 7, 14 and 30 days. Five right answers in a row and a word is yours.': 'Изучи их сейчас — с завтрашнего дня их спросят вводом: через 1, 3, 7, 14 и 30 дней. Пять верных ответов подряд — слово твоё.',
  // today & practice
  'Debt': 'Долг', 'In {app} now · {n} min left': 'Сейчас в {app} · осталось {n} мин',
  'Time used beyond the paid minutes. The next earnings pay it back first; until then social media stays locked.': 'Время сверх оплаченных минут. Следующий заработок сначала гасит долг; до этого соцсети закрыты.',
  'Earned today {a} of {b} min': 'Сегодня заработано {a} из {b} мин', '{n} min wait for today’s Reading': '{n} мин ждут сегодняшний Reading', 'How minutes are earned': 'Как зарабатываются минуты',
  'Welcome. Earn social-media minutes with Reading, words and your own English. Three quests a day, levels, a streak and bosses — everything is counted by itself.': 'Привет. Минуты на соцсети зарабатываются Reading, словами и своим английским. Три квеста в день, уровни, серия и боссы — всё считается само.',
  'Nothing yet. Any Reading test, word, sentence, Writing or Speaking counts the day by itself.': 'Пока ничего. Любой Reading-тест, слово, предложение, Writing или Speaking засчитают день сами.',
  'Logged automatically: Reading and Writing by time spent, words, sentences, Speaking by the voice length. Nothing to enter by hand.': 'Считается само: Reading и Writing по времени, слова, предложения, Speaking по длине голосового. Вводить руками ничего не нужно.',
  'The main way to earn. Thirteen questions, band on the official scale:': 'Главный способ заработка. Тринадцать вопросов, band по официальной шкале:', 'below 5.0': 'ниже 5.0',
  'A test counts for the quest and the streak if it took at least {m} minutes and at least {c} answers are right.': 'Тест идёт в квест и серию, если на него ушло не меньше {m} минут и верных ответов хотя бы {c}.',
  '{n} min are waiting for it.': 'Его ждут {n} мин.', 'Writing and Speaking': 'Writing и Speaking',
  'A text of 120+ words on today’s topic with 3 of your recent words. +40 XP, +{m} min.': 'Текст от 120 слов на тему дня с 3 недавними словами. +40 XP, +{m} мин.',
  'A cue card; answer with a voice message to the bot, 60+ seconds. Counted automatically. +25 XP, +{m} min.': 'Карточка с темой; ответ — голосовое боту от 60 секунд. Засчитывается само. +25 XP, +{m} мин.',
  'Less than {m} minutes: this test will not count and pays nothing, and it can’t be taken again for minutes. Send anyway?': 'Меньше {m} минут: тест не засчитается и ничего не даст, а пройти его снова за минуты будет нельзя. Всё равно отправить?',
  'Boss defeated!': 'Босс побеждён!', 'Not this time: band {b} needed. Tomorrow — another try.': 'Не в этот раз: нужен band {b}. Завтра — новая попытка.', 'Reading quest done': 'Reading-квест выполнен',
  'Not counted: under {m} minutes or fewer than {c} right answers.': 'Не засчитано: меньше {m} минут или меньше {c} верных ответов.',
  'Wrong: questions {list}. The right answers stay hidden until you beat the boss.': 'Ошибки в вопросах {list}. Правильные ответы скрыты, пока не победишь босса.',
  'Quests in the morning': 'Квесты по утрам', 'The day’s quests, a Speaking card and a Writing topic': 'Квесты дня, карточка Speaking и тема Writing',
  'The evening message comes only if a quest is still open.': 'Вечернее сообщение приходит, только если квест ещё не выполнен.',
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
