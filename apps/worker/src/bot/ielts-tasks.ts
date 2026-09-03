/**
 * Built-in bank of IELTS practice tasks (no AI needed).
 * Weekly rhythm: Mon Writing T2 · Tue Speaking · Wed Reading · Thu Vocabulary · Fri Writing T1 · Sat Listening · Sun Grammar/Review
 */
export type TaskKind = 'writing2' | 'speaking' | 'reading' | 'vocab' | 'writing1' | 'listening' | 'grammar';

export interface IeltsTask {
  id: string;
  kind: TaskKind;
  title: string;
  body: string; // HTML (Telegram subset)
  minutes: number;
}

export const KIND_LABEL: Record<TaskKind, string> = {
  writing2: '✍️ Writing Task 2',
  speaking: '🗣 Speaking Part 2',
  reading: '📖 Reading',
  vocab: '🧠 Vocabulary',
  writing1: '📊 Writing Task 1',
  listening: '🎧 Listening',
  grammar: '🔧 Grammar',
};

/** Weekday (0 = Monday) → task kind */
export const WEEKDAY_KIND: TaskKind[] = ['writing2', 'speaking', 'reading', 'vocab', 'writing1', 'listening', 'grammar'];

const W2_FOOTER = '\n\n<i>Минимум 250 слов, 40 минут. План: позиция → 2 абзаца с аргументом + примером → вывод. Пришли текст сюда — засчитаю как подтверждение.</i>';
const SP_FOOTER = '\n\n<i>1 минута на подготовку, 2 минуты говорить. Запиши голосовое и пришли сюда — засчитаю как подтверждение.</i>';

export const TASKS: IeltsTask[] = [
  // ---------- Writing Task 2 ----------
  { id: 'w2-1', kind: 'writing2', minutes: 40, title: 'Technology & children',
    body: 'Some people believe that children should be banned from using smartphones until they are 16. Others think phones are an essential learning tool.\n\n<b>Discuss both views and give your own opinion.</b>' + W2_FOOTER },
  { id: 'w2-2', kind: 'writing2', minutes: 40, title: 'Cities & cars',
    body: 'In many cities, the number of private cars keeps growing, causing congestion and pollution.\n\n<b>What are the causes of this problem, and what measures could be taken to solve it?</b>' + W2_FOOTER },
  { id: 'w2-3', kind: 'writing2', minutes: 40, title: 'University education',
    body: 'Some people think that universities should only offer courses that lead directly to jobs, such as engineering or medicine. Others believe subjects like history and philosophy are equally valuable.\n\n<b>To what extent do you agree or disagree?</b>' + W2_FOOTER },
  { id: 'w2-4', kind: 'writing2', minutes: 40, title: 'Remote work',
    body: 'Working from home has become common in many countries.\n\n<b>Do the advantages of this trend outweigh the disadvantages?</b>' + W2_FOOTER },
  { id: 'w2-5', kind: 'writing2', minutes: 40, title: 'Advertising',
    body: 'Advertising aimed at children should be banned, because it encourages them to want things they do not need.\n\n<b>To what extent do you agree or disagree?</b>' + W2_FOOTER },
  { id: 'w2-6', kind: 'writing2', minutes: 40, title: 'Environment vs economy',
    body: 'Some people say that economic growth is the only way to end poverty, while others argue that growth is damaging the environment and must be stopped.\n\n<b>Discuss both views and give your opinion.</b>' + W2_FOOTER },
  { id: 'w2-7', kind: 'writing2', minutes: 40, title: 'Health',
    body: 'Governments spend a lot of money on treating illnesses. Some believe more should be spent on prevention instead.\n\n<b>Do you agree or disagree?</b>' + W2_FOOTER },
  { id: 'w2-8', kind: 'writing2', minutes: 40, title: 'Globalisation & culture',
    body: 'As international travel and the internet spread, cultures around the world are becoming more similar.\n\n<b>Is this a positive or negative development?</b>' + W2_FOOTER },
  { id: 'w2-9', kind: 'writing2', minutes: 40, title: 'Crime',
    body: 'Some people think the best way to reduce crime is longer prison sentences. Others believe there are better alternatives.\n\n<b>Discuss both views and give your opinion.</b>' + W2_FOOTER },
  { id: 'w2-10', kind: 'writing2', minutes: 40, title: 'Success',
    body: 'Some people believe that success in life comes from hard work and determination, while others think money and appearance matter more.\n\n<b>Discuss both views and give your own opinion.</b>' + W2_FOOTER },

  // ---------- Speaking Part 2 ----------
  { id: 'sp-1', kind: 'speaking', minutes: 15, title: 'A skill you learned',
    body: 'Describe a skill you learned that was difficult at first.\nYou should say:\n• what the skill is\n• how you learned it\n• why it was difficult\n• and explain how you feel about it now.' + SP_FOOTER },
  { id: 'sp-2', kind: 'speaking', minutes: 15, title: 'A place near water',
    body: 'Describe a place near water (a river, lake or sea) that you enjoyed visiting.\nYou should say:\n• where it is\n• when you went there\n• what you did there\n• and explain why you enjoyed it.' + SP_FOOTER },
  { id: 'sp-3', kind: 'speaking', minutes: 15, title: 'A person who inspires you',
    body: 'Describe a person who has inspired you to do something.\nYou should say:\n• who this person is\n• how you know them\n• what they inspired you to do\n• and explain why they inspired you.' + SP_FOOTER },
  { id: 'sp-4', kind: 'speaking', minutes: 15, title: 'A piece of technology',
    body: 'Describe a piece of technology you find difficult to use.\nYou should say:\n• what it is\n• when you use it\n• why it is difficult\n• and explain how you feel when using it.' + SP_FOOTER },
  { id: 'sp-5', kind: 'speaking', minutes: 15, title: 'A goal',
    body: 'Describe a goal you have set for yourself.\nYou should say:\n• what the goal is\n• when you set it\n• what you are doing to achieve it\n• and explain why this goal is important to you.' + SP_FOOTER },
  { id: 'sp-6', kind: 'speaking', minutes: 15, title: 'An interesting conversation',
    body: 'Describe an interesting conversation you had with someone you did not know well.\nYou should say:\n• who you talked to\n• where it happened\n• what you talked about\n• and explain why it was interesting.' + SP_FOOTER },
  { id: 'sp-7', kind: 'speaking', minutes: 15, title: 'A change in your life',
    body: 'Describe a change that improved your life.\nYou should say:\n• what the change was\n• when it happened\n• why you made it\n• and explain how it improved your life.' + SP_FOOTER },
  { id: 'sp-8', kind: 'speaking', minutes: 15, title: 'A book or film',
    body: 'Describe a book or film that made you think.\nYou should say:\n• what it was about\n• when you read/watched it\n• what it made you think about\n• and explain whether you would recommend it.' + SP_FOOTER },
  { id: 'sp-9', kind: 'speaking', minutes: 15, title: 'A time you helped someone',
    body: 'Describe a time when you helped someone.\nYou should say:\n• who you helped\n• what the situation was\n• how you helped\n• and explain how you felt afterwards.' + SP_FOOTER },
  { id: 'sp-10', kind: 'speaking', minutes: 15, title: 'A city you would like to live in',
    body: 'Describe a city you would like to live in for a while.\nYou should say:\n• where it is\n• what you know about it\n• what you would do there\n• and explain why you would like to live there.' + SP_FOOTER },

  // ---------- Reading ----------
  { id: 'rd-1', kind: 'reading', minutes: 20, title: 'True / False / Not Given',
    body: 'Открой любой текст из Cambridge IELTS (или статью на 600–800 слов с bbc.com/future) и <b>сам придумай 5 утверждений</b>: 2 True, 2 False, 1 Not Given. Затем ответь на них через 10 минут, не глядя в заметки.\n\n<i>Ключ к NG: утверждение не противоречит тексту, но текст его и не подтверждает. Засеки 20 минут.</i>' },
  { id: 'rd-2', kind: 'reading', minutes: 20, title: 'Skimming за 3 минуты',
    body: 'Возьми один Reading passage (Cambridge IELTS 15–19, любой тест). Дай себе <b>3 минуты</b>, чтобы прочитать первое предложение каждого абзаца и написать по 2–3 слова о теме каждого. Потом сделай Matching Headings — сравни с ключом.\n\n<i>Цель: научиться видеть структуру текста до вопросов.</i>' },
  { id: 'rd-3', kind: 'reading', minutes: 20, title: 'Полный passage на время',
    body: 'Один Reading passage с 13–14 вопросами <b>строго за 20 минут</b>. Проверь по ключу, выпиши каждое неверное: тип вопроса + почему ошибся (не то слово-парафраз? не дочитал? NG/False?).\n\n<i>Именно этот список ошибок — твой учебный план на неделю.</i>' },
  { id: 'rd-4', kind: 'reading', minutes: 20, title: 'Парафраз-охота',
    body: 'Возьми 10 вопросов из любого Reading и <b>для каждого найди в тексте синоним/парафраз ключевых слов</b> (например, «reduce» → «cut down», «children» → «young people»). Выпиши пары.\n\n<i>IELTS почти никогда не повторяет слова из вопроса в тексте.</i>' },
  { id: 'rd-5', kind: 'reading', minutes: 20, title: 'Summary completion',
    body: 'Найди задание типа Summary Completion (из списка слов или из текста). Сначала прочитай summary и <b>предскажи часть речи</b> для каждого пропуска (существительное? глагол?). Потом ищи в тексте. 15 минут + разбор.' },
  { id: 'rd-6', kind: 'reading', minutes: 20, title: 'Чтение вслух и пересказ',
    body: 'Прочитай статью 500+ слов (The Guardian / BBC / National Geographic). Затем <b>перескажи вслух за 1 минуту</b> — что за проблема, что нашли, что советуют. Запиши 8 незнакомых слов с контекстом.' },

  // ---------- Vocabulary ----------
  { id: 'vc-1', kind: 'vocab', minutes: 15, title: 'Environment',
    body: '<b>Слова дня — Environment</b>\n• <b>carbon footprint</b> — углеродный след\n• <b>renewable energy</b> — возобновляемая энергия\n• <b>deplete</b> (resources) — истощать\n• <b>biodiversity</b> — биоразнообразие\n• <b>sustainable</b> — устойчивый, не истощающий ресурсы\n• <b>deforestation</b> — вырубка лесов\n• <b>emissions</b> — выбросы\n• <b>eco-friendly</b> — экологичный\n\n<i>Составь 5 предложений с этими словами о своём городе. Пришли — засчитаю.</i>' },
  { id: 'vc-2', kind: 'vocab', minutes: 15, title: 'Education',
    body: '<b>Слова дня — Education</b>\n• <b>curriculum</b> — учебная программа\n• <b>vocational training</b> — профессиональное обучение\n• <b>rote learning</b> — зубрёжка\n• <b>critical thinking</b> — критическое мышление\n• <b>tuition fees</b> — плата за обучение\n• <b>peer pressure</b> — давление сверстников\n• <b>lifelong learning</b> — обучение на протяжении жизни\n• <b>drop out</b> — бросить учёбу\n\n<i>Напиши абзац (80–100 слов): что бы ты изменил в школьном образовании. Пришли — засчитаю.</i>' },
  { id: 'vc-3', kind: 'vocab', minutes: 15, title: 'Technology',
    body: '<b>Слова дня — Technology</b>\n• <b>cutting-edge</b> — передовой\n• <b>obsolete</b> — устаревший\n• <b>automation</b> — автоматизация\n• <b>digital divide</b> — цифровое неравенство\n• <b>breakthrough</b> — прорыв\n• <b>privacy concerns</b> — опасения о приватности\n• <b>user-friendly</b> — удобный для пользователя\n• <b>reliance on</b> — зависимость от\n\n<i>5 предложений про ИИ с этими словами. Пришли — засчитаю.</i>' },
  { id: 'vc-4', kind: 'vocab', minutes: 15, title: 'Health',
    body: '<b>Слова дня — Health</b>\n• <b>sedentary lifestyle</b> — сидячий образ жизни\n• <b>obesity</b> — ожирение\n• <b>preventive measures</b> — профилактические меры\n• <b>well-being</b> — благополучие\n• <b>chronic illness</b> — хроническое заболевание\n• <b>balanced diet</b> — сбалансированное питание\n• <b>burnout</b> — выгорание\n• <b>healthcare system</b> — система здравоохранения\n\n<i>Speaking Part 3: «Should governments tax unhealthy food?» — ответь голосовым на 1 минуту с этими словами.</i>' },
  { id: 'vc-5', kind: 'vocab', minutes: 15, title: 'Work',
    body: '<b>Слова дня — Work</b>\n• <b>job satisfaction</b> — удовлетворённость работой\n• <b>work-life balance</b> — баланс работы и жизни\n• <b>remote work</b> — удалённая работа\n• <b>promotion</b> — повышение\n• <b>redundancy</b> — сокращение\n• <b>freelance</b> — фриланс\n• <b>demanding</b> (job) — требовательная\n• <b>career prospects</b> — карьерные перспективы\n\n<i>Абзац 80–100 слов: работа мечты. Пришли — засчитаю.</i>' },
  { id: 'vc-6', kind: 'vocab', minutes: 15, title: 'Linking words (band 7+)',
    body: '<b>Связки для эссе</b>\n• <b>Admittedly, …</b> — надо признать\n• <b>Nevertheless</b> — тем не менее\n• <b>Consequently</b> — вследствие этого\n• <b>In contrast</b> — напротив\n• <b>To illustrate</b> — чтобы проиллюстрировать\n• <b>Whereas</b> — тогда как\n• <b>Provided that</b> — при условии, что\n• <b>On balance</b> — в целом / взвесив всё\n\n<i>Перепиши любой свой старый абзац эссе, вставив 5 из них. Пришли — засчитаю.</i>' },
  { id: 'vc-7', kind: 'vocab', minutes: 15, title: 'City life',
    body: '<b>Слова дня — City life</b>\n• <b>urban sprawl</b> — разрастание города\n• <b>congestion</b> — заторы\n• <b>infrastructure</b> — инфраструктура\n• <b>affordable housing</b> — доступное жильё\n• <b>commute</b> — ездить на работу\n• <b>pedestrian zone</b> — пешеходная зона\n• <b>overcrowded</b> — переполненный\n• <b>amenities</b> — удобства, инфраструктура услуг\n\n<i>Speaking Part 1: «Do you like living in your city?» — 5 предложений с этими словами.</i>' },
  { id: 'vc-8', kind: 'vocab', minutes: 15, title: 'Describing trends (Task 1)',
    body: '<b>Глаголы и наречия для графиков</b>\n• <b>soar / plummet</b> — резко вырасти / резко упасть\n• <b>rise steadily</b> — расти стабильно\n• <b>fluctuate</b> — колебаться\n• <b>level off / plateau</b> — выйти на плато\n• <b>peak at</b> — достичь пика на уровне\n• <b>a slight dip</b> — небольшое снижение\n• <b>account for</b> — составлять (долю)\n• <b>roughly / approximately</b> — примерно\n\n<i>Опиши за 5 предложений, как менялось твоё время на английский за последние 4 недели (вкладка IELTS).</i>' },

  // ---------- Writing Task 1 ----------
  { id: 'w1-1', kind: 'writing1', minutes: 20, title: 'Line graph',
    body: '<b>Данные</b> (нарисуй в уме или на бумаге): доля людей, пользующихся интернетом, в трёх странах, 2000–2020.\n• Country A: 20% → 45% → 85% → 92% → 95%\n• Country B: 5% → 15% → 40% → 70% → 80%\n• Country C: 50% → 60% → 65% → 66% → 67%\n(значения за 2000, 2005, 2010, 2015, 2020)\n\n<b>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</b>\n\n<i>150+ слов, 20 минут. Overview обязателен (2 главные тенденции). Пришли текст — засчитаю.</i>' },
  { id: 'w1-2', kind: 'writing1', minutes: 20, title: 'Bar chart',
    body: '<b>Данные</b>: среднее число часов в неделю на домашние обязанности, мужчины и женщины, 4 страны.\n• Sweden: M 14, F 17\n• Japan: M 4, F 22\n• USA: M 10, F 18\n• Brazil: M 6, F 24\n\n<b>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</b>\n\n<i>150+ слов, 20 минут. Не описывай каждую цифру — сгруппируй. Пришли — засчитаю.</i>' },
  { id: 'w1-3', kind: 'writing1', minutes: 20, title: 'Process',
    body: '<b>Процесс</b>: производство шоколада.\ncocoa pods harvested → beans removed and fermented (5 days) → dried in the sun → roasted → shells removed → ground into paste → paste pressed/mixed with sugar and milk → moulded → packaged.\n\n<b>Summarise the process by selecting and reporting the main features.</b>\n\n<i>Пассивный залог, последовательность (Firstly / Once … / Subsequently / The final stage). 150+ слов.</i>' },
  { id: 'w1-4', kind: 'writing1', minutes: 20, title: 'Pie charts',
    body: '<b>Данные</b>: источники электроэнергии в стране X, 2000 vs 2020.\n2000: coal 55%, gas 20%, nuclear 15%, hydro 8%, wind/solar 2%\n2020: coal 20%, gas 30%, nuclear 12%, hydro 10%, wind/solar 28%\n\n<b>Summarise the information and make comparisons where relevant.</b>\n\n<i>150+ слов. Главное: что выросло, что упало, что почти не изменилось. Пришли — засчитаю.</i>' },
  { id: 'w1-5', kind: 'writing1', minutes: 20, title: 'Table',
    body: '<b>Таблица</b>: число иностранных студентов (тыс.) в 4 странах.\n• UK: 2010 — 400, 2015 — 430, 2020 — 550\n• Australia: 2010 — 330, 2015 — 300, 2020 — 500\n• Canada: 2010 — 100, 2015 — 220, 2020 — 530\n• Germany: 2010 — 180, 2015 — 230, 2020 — 320\n\n<b>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</b>\n\n<i>150+ слов. Обрати внимание на Canada — самый быстрый рост.</i>' },
  { id: 'w1-6', kind: 'writing1', minutes: 20, title: 'Map',
    body: '<b>Карта</b> (представь): деревня в 1990 и сейчас.\n1990: главная улица с магазинами, ферма на востоке, лес на севере, школа в центре, река на западе.\nСейчас: ферма заменена жилым районом, часть леса вырублена под парковку и супермаркет, добавлен мост через реку, школа расширена, магазины превращены в кафе.\n\n<b>Summarise the changes.</b>\n\n<i>Слова: was converted into, was replaced by, was constructed, expanded, to the north of. 150+ слов.</i>' },

  // ---------- Listening ----------
  { id: 'ls-1', kind: 'listening', minutes: 30, title: 'Section 1 — цифры и имена',
    body: 'Сделай <b>Section 1</b> любого теста Cambridge IELTS (диалог, форма). Перед прослушиванием <b>предскажи тип ответа</b> для каждого пропуска (число? имя? дата?). После проверки перепиши все spelling-ошибки 3 раза.\n\n<i>Бесплатно: ielts.org → Sample test questions, или IELTS Liz / British Council на YouTube.</i>' },
  { id: 'ls-2', kind: 'listening', minutes: 30, title: 'Section 3 — академическая беседа',
    body: 'Сделай <b>Section 3</b> (2–3 студента обсуждают проект). Слушай один раз как на экзамене. Потом второй раз со скриптом: <b>подчеркни, где говорящий меняет мнение</b> («actually», «on second thought», «I\'d rather») — это ловушки для multiple choice.' },
  { id: 'ls-3', kind: 'listening', minutes: 30, title: 'Диктант 5 минут',
    body: 'Возьми любую 2-минутную запись (TED-Ed, BBC 6 Minute English). Слушай по предложению и <b>записывай дословно</b>. Сравни со скриптом. Выпиши, какие звуки/связки ты не расслышал (например, «would\'ve», «gonna»).' },
  { id: 'ls-4', kind: 'listening', minutes: 30, title: 'Section 4 — лекция',
    body: 'Сделай <b>Section 4</b> (монолог-лекция, 10 вопросов, без паузы). За 1 минуту до старта <b>прочитай все вопросы и подчеркни ключевые слова</b>. После — разбери: какие ответы ты «потерял», потому что отвлёкся на предыдущий вопрос.' },
  { id: 'ls-5', kind: 'listening', minutes: 30, title: 'Подкаст на скорости 1.25',
    body: '20 минут подкаста на английском (Huberman Lab, The Diary of a CEO, BBC Global News) на скорости <b>1.25×</b>. Потом перескажи вслух 5 главных пунктов за 1 минуту. Экзаменационная запись покажется медленной.' },
  { id: 'ls-6', kind: 'listening', minutes: 30, title: 'Map labelling',
    body: 'Найди задание <b>Map/Plan labelling</b> (Section 2). Перед прослушиванием разбери карту: где север, где вход, где уже подписано. Слушай направления: «opposite», «adjacent to», «at the far end», «just past».' },

  // ---------- Grammar / review ----------
  { id: 'gr-1', kind: 'grammar', minutes: 20, title: 'Условные предложения',
    body: 'Напиши по 3 предложения на каждый тип: <b>1st conditional</b> (If governments invest…, …will…), <b>2nd</b> (If I were…, I would…), <b>3rd</b> (If people had…, they would have…). Тема — образование. Пришли — засчитаю.\n\n<i>В эссе 2nd conditional — хороший способ показать сложную грамматику.</i>' },
  { id: 'gr-2', kind: 'grammar', minutes: 20, title: 'Relative clauses',
    body: 'Соедини пары простых предложений в одно с <b>which / who / where / whose</b> — 8 штук. Пример: «Cities are growing. They face housing problems.» → «Cities which are growing rapidly face housing problems.» Пришли — засчитаю.' },
  { id: 'gr-3', kind: 'grammar', minutes: 20, title: 'Passive voice (Task 1)',
    body: 'Опиши приготовление кофе в 8 шагов <b>только в пассиве</b>: beans are roasted, then ground… Затем перепиши свой старый Task 1 process, заменив активные формы на пассивные.' },
  { id: 'gr-4', kind: 'grammar', minutes: 20, title: 'Articles a/the/—',
    body: 'Возьми свой любой абзац эссе и <b>проверь каждый артикль</b>: исчисляемое или нет? упоминалось ли раньше? общее понятие (education) или конкретное (the education system in Russia)? Исправь, пришли «до/после».' },
  { id: 'gr-5', kind: 'grammar', minutes: 20, title: 'Complex sentences',
    body: 'Перепиши 6 простых предложений в сложные с помощью <b>although / despite / whereas / unless / as long as / while</b>. Пример: «Cars are convenient. They pollute.» → «Although cars are convenient, they pollute the air.» Пришли — засчитаю.' },
  { id: 'gr-6', kind: 'grammar', minutes: 20, title: 'Обзор недели',
    body: 'Сегодня без нового: открой вкладку <b>IELTS</b>, посмотри минуты по навыкам за неделю и <b>выбери самый слабый навык</b>. Найди свои ошибки этой недели (Reading-разбор, Listening-диктант) и перепиши правильные варианты в тетрадь. 20 минут. Пришли фото тетради — засчитаю.' },
];

const byKind = new Map<TaskKind, IeltsTask[]>();
for (const t of TASKS) {
  if (!byKind.has(t.kind)) byKind.set(t.kind, []);
  byKind.get(t.kind)!.push(t);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic task for a user and date: kind by weekday, item by ISO week with a per-user offset. */
export function taskForDay(tgId: number, date: string, weekdayMon0: number, weekIndex: number): IeltsTask {
  const kind = WEEKDAY_KIND[weekdayMon0];
  const list = byKind.get(kind)!;
  const idx = (weekIndex + hash(String(tgId))) % list.length;
  void date;
  return list[idx];
}

export function randomTask(kind?: TaskKind, excludeId?: string): IeltsTask {
  const list = kind ? byKind.get(kind)! : TASKS;
  const pool = list.filter((t) => t.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function taskById(id: string): IeltsTask | undefined {
  return TASKS.find((t) => t.id === id);
}

export function formatTask(t: IeltsTask, header = 'Задание дня'): string {
  return `📚 <b>${header} · ${KIND_LABEL[t.kind]}</b>\n<b>${t.title}</b> · ~${t.minutes} мин\n\n${t.body}`;
}

export function taskKeyboard(currentId: string) {
  return [
    [
      { text: '🔄 Другое задание', callback_data: `task:any:${currentId}` },
      { text: '✍️ Writing', callback_data: `task:writing2:${currentId}` },
    ],
    [
      { text: '🗣 Speaking', callback_data: `task:speaking:${currentId}` },
      { text: '🧠 Vocab', callback_data: `task:vocab:${currentId}` },
      { text: '📖 Reading', callback_data: `task:reading:${currentId}` },
    ],
  ];
}
