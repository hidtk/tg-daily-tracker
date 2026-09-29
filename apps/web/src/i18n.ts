import { createContext, useCallback, useContext } from 'react';

export type Lang = 'en' | 'ru';

/** English is the source; every key is the English string itself. Missing keys fall back to English. */
const RU: Record<string, string> = {
  // app, nav, generic
  'Home': 'Главная', 'Shop': 'Магазин', 'Progress': 'Прогресс', 'Settings': 'Настройки',
  'Close': 'Закрыть', 'Cancel': 'Отмена', 'Back': 'Назад', 'Next': 'Дальше', 'Skip': 'Пропустить', 'Start': 'Начать', 'Continue': 'Продолжить',
  'Saved': 'Сохранено', 'Saving…': 'Сохраняю…', 'Save settings': 'Сохранить настройки', 'Error': 'Ошибка', 'Could not load': 'Не удалось загрузить',
  'Could not connect': 'Не удалось подключиться', 'Open the app from Telegram': 'Откройте приложение из Telegram',
  'Open the app from the button in the chat with the bot.': 'Откройте приложение кнопкой в чате с ботом.',
  'Copied': 'Скопировано', 'Copy it by hand': 'Скопируй вручную', 'Copy': 'Скопировать', 'Check': 'Проверить', 'Checking…': 'Проверяю…',
  'min': 'мин', 'Off': 'Выкл.',
  'Mon': 'Пн', 'Tue': 'Вт', 'Wed': 'Ср', 'Thu': 'Чт', 'Fri': 'Пт', 'Sat': 'Сб', 'Sun': 'Вс',
  'Jan': 'янв', 'Feb': 'фев', 'Mar': 'мар', 'Apr': 'апр', 'May': 'мая', 'Jun': 'июн', 'Jul': 'июл', 'Aug': 'авг', 'Sep': 'сен', 'Oct': 'окт', 'Nov': 'ноя', 'Dec': 'дек',

  // server messages
  'This task is already done': 'Это задание уже сделано',
  'This passage is already being done another way': 'Этот текст уже делается по-другому: частями или целиком',
  'Try this task again tomorrow': 'Повторить это задание можно завтра',
  'Unknown task': 'Такого задания нет',
  'New words are asked from tomorrow': 'Новые слова спрашиваются со следующего дня',
  'This word is done for today': 'Это слово на сегодня уже было',
  'Type the word exactly to confirm': 'Для подтверждения напиши слово точно',
  'Not enough minutes': 'Не хватает минут',
  'Lock is not set up': 'Блокировка не настроена',

  // home
  'Social-media minutes': 'Минуты соцсетей', 'Debt': 'Долг',
  'In social media now · {n} min left': 'Сейчас в соцсетях · осталось {n} мин',
  'Open · {n} min left': 'Открыто · осталось {n} мин',
  'Social media is closed. A task opens it.': 'Соцсети закрыты. Их открывает задание.',
  'Social media opens while there are minutes; when they run out, the iPhone sends you to the Home Screen.': 'Соцсети открываются, пока есть минуты; кончились — iPhone выкидывает на экран «Домой».',
  'Earned today {a} of {b} min': 'Сегодня заработано {a} из {b} мин',
  'Open {n} min': 'Открыть на {n} мин', 'Open for {n} min': 'Открыто на {n} мин', 'Close now': 'Закрыть сейчас', 'Closed': 'Закрыто', '{n} min returned': 'Вернулось {n} мин',
  'There is a debt of {n} min: social media stays closed until a task pays it back.': 'Долг {n} мин: соцсети закрыты, пока задание его не покроет.',
  'Today’s limit is earned. Enjoy it — new tasks tomorrow.': 'Лимит дня заработан. Отдыхай — новые задания завтра.',
  'No minutes yet. Pick a task below: the card says how long it takes and what it pays.': 'Минут пока нет. Выбери задание ниже: на карточке написано, сколько оно займёт и сколько даст.',
  'You have {n} min. Earn more with a task below, or spend them.': 'У тебя {n} мин. Заработай ещё заданием ниже или потрать их.',
  'Best tasks now': 'Лучшие задания сейчас', 'Open the Shop': 'Открыть Магазин',
  'Nothing to do right now — come back tomorrow.': 'Сейчас делать нечего — возвращайся завтра.',

  // shop
  'Pick a task: a quick one pays less, a long or hard one pays more. The price is paid when the check passes.': 'Выбери задание: быстрое даёт меньше минут, долгое или сложное — больше. Минуты приходят, когда проверка пройдена.',
  'All': 'Все', 'Reading': 'Reading', 'Words': 'Слова', 'Writing': 'Writing', 'Speaking': 'Speaking',
  'Quick first': 'Сначала быстрые', 'Best value first': 'Сначала выгодные',
  'Earned today {a} of {b} min · {c} more possible': 'Сегодня заработано {a} из {b} мин · можно ещё {c}',
  'Nothing open here right now.': 'Здесь сейчас ничего не открыто.', 'Later': 'Позже', 'Done today': 'Сделано сегодня',
  'Limits: words pay for 10 answers a day, sentences for 5, each Writing and Speaking task once a day, a Reading task once. A task does not pay twice.': 'Лимиты: слова оплачиваются за 10 ответов в день, предложения — за 5, каждое задание Writing и Speaking — раз в день, задание Reading — один раз. Одно и то же задание дважды не платит.',

  // task cards
  'hard text': 'сложный текст', 'A sentence with a word': 'Предложение со словом', 'long text': 'длинный текст', 'short text': 'короткий текст', 'long answer': 'длинный ответ', 'short answer': 'короткий ответ',
  'TRUE / FALSE / NOT GIVEN': 'TRUE / FALSE / NOT GIVEN', 'Choose A, B, C or D': 'Выбор A, B, C или D', 'Fill the gaps': 'Вписать слова', 'The whole passage': 'Весь текст целиком',
  '{n} questions': '{n} вопросов',
  'See the Russian meaning or a sentence with a gap, type the English word.': 'Видишь перевод или предложение с пропуском — печатаешь английское слово.',
  'Your own sentence with a word of the day. {n} more today.': 'Своё предложение со словом дня. Сегодня ещё {n}.',
  '150+ words': 'от 150 слов', '60+ words': 'от 60 слов',
  'a voice message of 100+ seconds': 'голосовое от 100 секунд', 'a voice message of 45+ seconds': 'голосовое от 45 секунд',
  'Difficulty': 'Сложность', 'Easy': 'Лёгкое', 'Medium': 'Среднее', 'Hard': 'Сложное',
  'Retry: last time it was not passed': 'Повтор: в прошлый раз не сдано',
  'Not passed today — a retry opens tomorrow': 'Сегодня не сдано — повтор откроется завтра',
  'Done today: +{n} min': 'Сделано сегодня: +{n} мин',
  'Today’s limit of minutes is reached — back tomorrow': 'Лимит минут на сегодня исчерпан — до завтра',
  'Nothing to review yet: new words are asked from the next day': 'Пока нечего повторять: новые слова спрашиваются со следующего дня',
  'Do it in ~{m} min → get up to {p} min of social media': 'Сделаешь за ~{m} мин → получишь до {p} мин соцсетей',
  'Do it in ~{m} min → get {p} min of social media': 'Сделаешь за ~{m} мин → получишь {p} мин соцсетей',
  'Retry': 'Повторить',

  // rewards
  '+{n} min of social media': '+{n} мин соцсетей', 'Today’s limit of minutes is reached': 'Лимит минут на сегодня исчерпан',
  'New achievement': 'Новое достижение', '+{n} min bonus': '+{n} мин бонус', '+{n} min': '+{n} мин',

  // reading
  'Less than {m} min: this is counted as a guess and pays nothing. Send anyway?': 'Меньше {m} мин — это считается угадыванием, минут не будет. Всё равно отправить?',
  'Too fast: under {m} min is a guess, so no minutes. A retry opens tomorrow.': 'Слишком быстро: меньше {m} мин — это угадывание, минут нет. Повтор откроется завтра.',
  'Less than half is right — no minutes this time. Look at the hints below; a retry opens tomorrow.': 'Верно меньше половины — в этот раз минут нет. Посмотри подсказки ниже; повтор откроется завтра.',
  'Every answer is right!': 'Все ответы верные!', 'Passed. Minutes are paid for the share of right answers.': 'Сдано. Минуты — за долю верных ответов.',
  'Result': 'Результат', 'right answers': 'верных ответов', 'no minutes': 'без минут',
  'Today’s limit of minutes cut the payment.': 'Дневной лимит минут урезал оплату.',
  'How it is paid: {p} min × share of right answers; under half right — nothing.': 'Как платится: {p} мин × доля верных ответов; меньше половины — ничего.',
  'Mistakes': 'Ошибки', 'yours': 'твой ответ', 'correct': 'верно',
  'Look again at paragraph {p}.': 'Перечитай абзац {p}.', 'Read the whole text again.': 'Перечитай текст целиком.',
  'The right answers are shown once the task is passed — so the retry is real practice.': 'Верные ответы появятся, когда задание будет сдано, — так повтор остаётся настоящей практикой.',
  'Back to the Shop': 'Вернуться в Магазин', 'about {m} min': 'около {m} мин', 'answered {a} of {b}': 'отвечено {a} из {b}', 'Questions': 'Вопросы',
  'one or two words from the text': 'одно-два слова из текста', 'Check the answers ({a}/{b})': 'Проверить ответы ({a}/{b})',
  'Checked by the answer key. Case, “a/the”, spaces and British or American spelling do not matter; spelling does, like in the exam.': 'Проверка по ключу. Регистр, «a/the», пробелы и британское или американское написание не важны; орфография важна, как на экзамене.',

  // words
  'Paid today: {a} of {b} words': 'Оплачено сегодня: {a} из {b} слов', '{n} min per word': '{n} мин за слово',
  'Done for now: {ok} of {n} right. Missed words come back tomorrow.': 'Пока всё: верно {ok} из {n}. Ошибки вернутся завтра.',
  'Nothing to review right now. Study the new words below — they are asked from tomorrow.': 'Сейчас повторять нечего. Выучи новые слова ниже — их спросят завтра.',
  '{n} left': 'осталось {n}', 'Fill the gap': 'Вставь слово', 'Translate': 'Переведи', 'Type the English word': 'Напечатай английское слово',
  'Hint: the first letter': 'Подсказка: первая буква', 'Show a hint': 'Показать подсказку',
  'With a hint the word does not pay and comes back tomorrow.': 'С подсказкой слово не оплачивается и вернётся завтра.',
  'Other forms are fine (-s, -ed, -ing); in words longer than 5 letters one wrong letter is forgiven.': 'Другие формы подходят (-s, -ed, -ing); в словах длиннее 5 букв одна ошибка в букве прощается.',
  'Right, with one wrong letter': 'Верно, с одной опечаткой', 'Right': 'Верно', 'Not quite': 'Не совсем',
  'Type it once to remember': 'Напечатай один раз, чтобы запомнить', 'The word comes back tomorrow and starts its schedule again.': 'Слово вернётся завтра и начнёт повторения заново.',
  'Next word': 'Следующее слово', 'New words today': 'Новые слова сегодня',
  'Study them now: from tomorrow they are asked by typing — after 1, 3, 7, 14 and 30 days.': 'Выучи их сейчас: со следующего дня их спросят вводом — через 1, 3, 7, 14 и 30 дней.',
  '{a} of {b} words of the bank learned.': 'Выучено {a} из {b} слов банка.',

  // sentence
  'Today: {a} of {b}': 'Сегодня: {a} из {b}', 'Accepted. Here is the next word.': 'Принято. Вот следующее слово.',
  'Hide': 'Скрыть', 'Meaning': 'Значение', 'Your own sentence with this word, at least {n} words.': 'Своё предложение с этим словом, не меньше {n} слов.',
  '{n} words': '{n} слов', 'Enough sentences for today. New words tomorrow.': 'На сегодня предложений достаточно. Завтра — новые слова.',
  'Not accepted yet. What to fix:': 'Пока не засчитано. Что исправить:', 'This word is done for today.': 'Это слово на сегодня уже было.',
  'Checked: the word is used (any form), {n}+ words, English, no filler or random letters, not a copy of the example or of your earlier sentences.': 'Проверяется: слово использовано (в любой форме), от {n} слов, по-английски, без повторов и случайных букв, не копия примера и твоих прошлых предложений.',

  // writing
  'Topic': 'Тема', 'What is checked': 'Что проверяется', 'At least {n} words': 'Не меньше {n} слов',
  '{n} of your recent words (they light up below when found)': '{n} слова из недавних (подсвечиваются ниже, когда найдены)',
  '{n} linking words: because, however, for example…': '{n} слова-связки: because, however, for example…',
  'At least {n} full sentences': 'Не меньше {n} полных предложений',
  'English, your own words: no filler, no random letters, not a copy of your earlier texts or of the topic': 'По-английски и своими словами: без воды, без случайных букв, не копия прошлых текстов или темы',
  'At least {n} min from Start (the server keeps the time)': 'Не меньше {n} мин от «Начать» (время считает сервер)',
  'On topic — an AI check reads the text and gives tips': 'По теме — ИИ-проверка читает текст и даёт советы',
  'Accepted: +{n} min of social media, once a day.': 'Засчитано: +{n} мин соцсетей, раз в день.',
  'Your recent words': 'Недавние слова', 'Accepted today': 'Засчитано сегодня',
  'Accepted: {n} words, +{m} min. A new topic tomorrow.': 'Засчитано: {n} слов, +{m} мин. Новая тема завтра.',
  'Start writing': 'Начать писать', 'Write here in English…': 'Пиши здесь по-английски…', '{n} / {m} words': '{n} / {m} слов', 'links {n}/{m}': 'связки {n}/{m}',
  'Send for checking': 'Отправить на проверку', 'The draft is kept on this phone until you send it.': 'Черновик хранится на этом телефоне, пока не отправишь.',
  'AI opinion': 'Мнение ИИ', 'Estimated band: {b}': 'Примерный балл: {b}',
  'An estimate to learn from; the minutes depend on the checks above.': 'Это оценка для учёбы; минуты зависят от проверок выше.',

  // checklist
  'Length: {v} words (need {n})': 'Объём: {v} слов (нужно {n})',
  'Too short: {v} words, need at least {n}. Add a few sentences.': 'Коротко: {v} слов, нужно не меньше {n}. Добавь несколько предложений.',
  'Recent words: none learned yet, so this rule is skipped': 'Недавних слов пока нет — это правило пропущено',
  'Recent words used: {v} (need {n})': 'Недавних слов использовано: {v} (нужно {n})',
  'Use {n} of your recent words (found {v}). They are listed above the text.': 'Используй {n} слова из недавних (найдено {v}). Они перечислены над текстом.',
  'The word “{v}” is used': 'Слово «{v}» использовано', 'Use the word “{v}” itself (any form: -s, -ed, -ing).': 'Используй само слово «{v}» (в любой форме: -s, -ed, -ing).',
  'Linking words: {v} (need {n})': 'Слова-связки: {v} (нужно {n})',
  'Connect the ideas: use {n} linking words like because, however, for example (found {v}).': 'Свяжи мысли: нужно {n} слова-связки вроде because, however, for example (найдено {v}).',
  'Sentences: {v}': 'Предложений: {v}',
  'Write at least {n} full sentences, each ending with a full stop, none endlessly long (found {v}).': 'Напиши не меньше {n} полных предложений, каждое с точкой в конце и не бесконечное (найдено {v}).',
  'Written in English': 'Написано по-английски', 'Write it in English.': 'Напиши по-английски.',
  'Different words, no filler': 'Разные слова, без воды', 'Too many repeats: say it with different words.': 'Слишком много повторов: скажи это другими словами.',
  'Real words, no random letters': 'Настоящие слова, без случайных букв', 'Some words look like random letters. Check the spelling.': 'Некоторые слова похожи на случайный набор букв. Проверь написание.',
  'Your own text, not a copy': 'Свой текст, не копия', 'Too close to an earlier answer or the example. Write it anew.': 'Слишком похоже на прошлый ответ или пример. Напиши заново.',
  'Not the task text copied back': 'Не переписан текст задания', 'Large parts repeat the task text. Say it in your own words.': 'Большие куски повторяют текст задания. Скажи своими словами.',
  'Time from Start: {v} min (need {n})': 'Время от «Начать»: {v} мин (нужно {n})',
  'Too fast: {v} min from Start, a text like this takes at least {n} min. Re-read it, improve it, then send.': 'Слишком быстро: {v} мин от «Начать», такой текст пишется не меньше {n} мин. Перечитай, улучши и отправь.',
  'Length {v} — enough': 'Длина {v} — достаточно', 'Too short: {v}, need at least {n}. Cover every point on the card.': 'Коротко: {v}, нужно не меньше {n}. Расскажи о каждом пункте карточки.',
  'Recorded by you': 'Записано тобой', 'Forwarded voice messages do not count. Record your own.': 'Пересланные голосовые не считаются. Запиши своё.',
  'A new recording': 'Новая запись', 'This voice message was already counted.': 'Это голосовое уже засчитано.',
  'On topic (AI check)': 'По теме (ИИ-проверка)', 'Off topic, says the AI check: answer the question of the topic.': 'ИИ-проверка: не по теме. Ответь на вопрос из темы.',

  // speaking
  'Counted today: {s} s, +{m} min. New cards tomorrow.': 'Засчитано сегодня: {s} с, +{m} мин. Новые карточки завтра.',
  'Card': 'Карточка', 'You should say:': 'Расскажи:', 'How to answer': 'Как ответить',
  'Think for a minute: what you will say on each point.': 'Подумай минуту: что скажешь по каждому пункту.',
  'Press the button below, hold the microphone in the chat and answer in English — at least {s} seconds.': 'Нажми кнопку ниже, зажми микрофон в чате и ответь по-английски — не меньше {s} секунд.',
  'The bot checks it and replies: +{m} min of social media.': 'Бот проверит и ответит: +{m} мин соцсетей.',
  'Checked: the length, that you recorded it yourself (not forwarded), that the recording is new. The bot cannot hear the content — the honest practice is yours.': 'Проверяется: длина, что записал ты сам (не переслано), что запись новая. Содержание бот не слышит — честная практика на тебе.',
  'Open the chat with the bot': 'Открыть чат с ботом',

  // progress
  'days in a row with tasks · best {n}': 'дней подряд с заданиями · рекорд {n}', 'tasks with minutes': 'заданий с минутами', 'minutes earned': 'минут заработано',
  'hours of study (counted by itself)': 'часов учёбы (считается само)', 'This week': 'Эта неделя', 'study, min': 'учёба, мин', 'earned for social media, min': 'заработано на соцсети, мин',
  'Study time is counted by itself from what you do in the app — nothing to enter by hand.': 'Время учёбы считается само по тому, что делаешь в приложении, — вводить ничего не нужно.',
  'Achievements · {a} of {b}': 'Достижения · {a} из {b}', 'Done on {d} — bonus paid': 'Получено {d} — бонус начислен', '{a} of {b}': '{a} из {b}',
  'Progress is counted from what you really did. Each bonus is paid once, on top of the daily limit.': 'Прогресс считается по тому, что ты реально сделал. Каждый бонус начисляется один раз, сверх дневного лимита.',
  'Minutes: recent': 'Минуты: последние', 'Achievement': 'Достижение', 'Sentence': 'Предложение', 'Social media': 'Соцсети', 'Returned': 'Возврат',

  // achievements
  'First task': 'Первое задание', 'Do any task from the Shop and get minutes for it.': 'Сделай любое задание из Магазина и получи за него минуты.',
  'Reader': 'Читатель', 'Pass 10 Reading tasks: at least half of the answers right.': 'Сдай 10 заданий Reading: хотя бы половина ответов верная.',
  'Whole passage': 'Весь текст', 'Finish one text: all three parts, or the whole passage at once.': 'Закончи один текст: все три части или весь текст сразу.',
  'No mistakes': 'Без ошибок', 'Answer every question right in 5 Reading tasks.': 'Ответь без единой ошибки в 5 заданиях Reading.',
  'Vocabulary': 'Словарь', 'Type 50 words right without a hint.': 'Напечатай верно 50 слов без подсказки.',
  'Own sentences': 'Свои предложения', 'Write 20 sentences that pass the check.': 'Напиши 20 предложений, которые прошли проверку.',
  'Author': 'Автор', 'Get 5 Writing texts accepted.': 'Сдай 5 текстов Writing.',
  'Voice': 'Голос', 'Get 5 Speaking answers counted.': 'Сдай 5 ответов Speaking.',
  'A bit of everything': 'Всё понемногу', 'In one day: a Reading task, words or a sentence, and Writing or Speaking.': 'За один день: Reading, слова или предложение, и Writing или Speaking.',
  'Week in a row': 'Неделя подряд', 'Do at least one task with minutes 7 days in a row.': '7 дней подряд делай хотя бы одно задание с минутами.',
  '30 days': '30 дней', 'Do tasks with minutes on 30 different days, not necessarily in a row.': 'Делай задания с минутами 30 разных дней, не обязательно подряд.',

  // settings
  'How it works': 'Как это работает', 'Show how it works': 'Показать, как это работает',
  'Five short screens: how minutes are earned and spent, the iPhone lock, achievements and checks.': 'Пять коротких экранов: как заработать и потратить минуты, блокировка на iPhone, достижения и проверки.',
  'Language': 'Язык', 'Bot message in the morning': 'Сообщение бота утром', 'Three tasks for the day': 'Три задания на день',
  'A short message with buttons that open the tasks': 'Короткое сообщение с кнопками, которые открывают задания', 'At': 'Во сколько',
  'Time zone': 'Часовой пояс', 'Use {tz}': 'Использовать {tz}', 'New words a day': 'Новых слов в день',
  'New words appear in the Words task; from the next day they are asked by typing.': 'Новые слова появляются в задании «Слова»; со следующего дня их спрашивают вводом.',
  'Start again': 'Начать заново', 'Started again': 'Начато заново', 'Erase and start again': 'Стереть и начать заново', 'Type {w} to confirm': 'Напиши {w}, чтобы подтвердить',
  'Minutes, tasks, words, achievements and history go to zero. The iPhone lock, NextDNS, limits and language stay as they are.': 'Минуты, задания, слова, достижения и история обнулятся. Блокировка на iPhone, NextDNS, лимиты и язык останутся как есть.',

  // lock settings (LockSettings.tsx)
  'Lock connected': 'Замок подключён', 'Connect': 'Подключить', 'Install the iPhone profile': 'Установить профиль на iPhone', 'Disconnect': 'Отключить',
  'Which apps': 'Какие приложения', 'Bank, max min': 'Банк, макс. мин', 'Daily limit': 'Лимит за день', 'Step-by-step guide': 'Пошаговая инструкция',
  'No NextDNS needed: the Shortcuts app closes {apps} when you have no minutes, and a timer sends you to the Home Screen when the paid minutes run out. About 10 minutes to set up, once.':
    'Без NextDNS: «Команды» закрывают {apps}, когда минут нет, а таймер выкидывает на экран «Домой», когда оплаченные минуты кончились. Настройка — около 10 минут, один раз.',

  // onboarding
  'A short video from Elvis will be here soon.': 'Здесь скоро будет короткое видео от Элвиса.',
  'tap here': 'нажми сюда', 'task': 'задание', 'social media': 'соцсети', 'social media open': 'соцсети открыты', 'Home Screen': 'экран «Домой»',
  'Study earns social media': 'Учёба открывает соцсети',
  'Do small IELTS tasks and get minutes. Minutes open Instagram, TikTok, YouTube and VK.': 'Делай небольшие задания по IELTS и получай минуты. Минуты открывают Instagram, TikTok, YouTube и VK.',
  'Minutes are earned in the Shop': 'Минуты зарабатываются в Магазине',
  'Each card says how long it takes and how many minutes it pays. Quick tasks pay less, long or hard ones pay more.': 'На каждой карточке написано, сколько времени займёт и сколько минут даст. Быстрое — меньше, долгое или сложное — больше.',
  'Spend them, and when they run out': 'Трать их, а когда кончатся',
  'Minutes are spent by the real time in the app. At zero the iPhone sends you to the Home Screen; overuse becomes a debt the next task pays back.': 'Минуты тратятся по реальному времени в приложении. На нуле iPhone выкидывает на экран «Домой»; перерасход становится долгом, его покроет следующее задание.',
  'Set up the lock on the iPhone once': 'Один раз настрой блокировку на iPhone',
  'About 10 minutes: two automations in the Shortcuts app. The step-by-step guide is in Settings → Social-media lock. With AmneziaVPN, NextDNS goes inside Amnezia (step 7).': 'Около 10 минут: две автоматизации в приложении «Команды». Пошаговая инструкция — в Настройках → Блокировка соцсетей. С AmneziaVPN NextDNS прописывается внутри Amnezia (шаг 7).',
  'Shortcuts': 'Команды', 'Automation': 'Автоматизация', 'Gallery': 'Галерея', 'Open the guide': 'Открыть инструкцию',
  'Checks and achievements': 'Проверка и достижения',
  'Every task is checked: you see what counted and what to fix. Achievements give bonus minutes — the rule is written under each one.': 'Каждое задание проверяется: видно, что засчитано и что исправить. Достижения дают бонус-минуты — условие написано под каждым.',
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
