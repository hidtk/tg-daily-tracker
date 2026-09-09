/**
 * Built-in bank of IELTS practice tasks (no AI needed).
 * Weekly rhythm: Mon Writing T2 · Tue Speaking · Wed Reading · Thu Listening · Fri Writing T1 · Sat Grammar · Sun Review.
 * Vocabulary is handled separately by the daily words feature.
 */
export type TaskKind = 'writing2' | 'speaking' | 'reading' | 'writing1' | 'listening' | 'grammar';

export interface IeltsTask {
  id: string;
  kind: TaskKind;
  title: string;
  body: string; // HTML (Telegram subset)
  minutes: number;
}

export const KIND_LABEL: Record<TaskKind, string> = {
  writing2: 'Writing Task 2',
  speaking: 'Speaking Part 2',
  reading: 'Reading',
  writing1: 'Writing Task 1',
  listening: 'Listening',
  grammar: 'Grammar',
};

/** Weekday (0 = Monday) → task kind */
export const WEEKDAY_KIND: TaskKind[] = ['writing2', 'speaking', 'reading', 'listening', 'writing1', 'grammar', 'grammar'];

const W2_FOOTER = '\n\n<i>At least 250 words, 40 minutes. Plan: position → two body paragraphs, each with one argument and one example → conclusion.</i>';
const SP_FOOTER = '\n\n<i>One minute to prepare, two minutes to speak. Record yourself and listen back once.</i>';

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
    body: 'Open any Cambridge IELTS passage (or a 600–800-word article from bbc.com/future) and <b>write five statements of your own</b>: two True, two False, one Not Given. Ten minutes later answer them without looking at your notes.\n\n<i>The key to Not Given: the statement neither contradicts the text nor is confirmed by it. Set a 20-minute timer.</i>' },
  { id: 'rd-2', kind: 'reading', minutes: 20, title: 'Three-minute skim',
    body: 'Take one Reading passage (Cambridge IELTS 15–19, any test). Give yourself <b>three minutes</b> to read the first sentence of every paragraph and jot down two or three words on what each is about. Then do the Matching Headings task and compare with the key.\n\n<i>Goal: see the structure of the text before you see the questions.</i>' },
  { id: 'rd-3', kind: 'reading', minutes: 20, title: 'Full passage against the clock',
    body: 'One Reading passage with 13–14 questions <b>in exactly 20 minutes</b>. Check against the key and write down every wrong answer: question type + why you missed it (paraphrase not spotted? did not read to the end? NG vs False?).\n\n<i>That list of mistakes is your study plan for the week.</i>' },
  { id: 'rd-4', kind: 'reading', minutes: 20, title: 'Paraphrase hunt',
    body: 'Take ten questions from any Reading and <b>find the synonym or paraphrase of each key word in the text</b> (e.g. “reduce” → “cut down”, “children” → “young people”). Write the pairs down.\n\n<i>IELTS almost never repeats the words of the question in the passage.</i>' },
  { id: 'rd-5', kind: 'reading', minutes: 20, title: 'Summary completion',
    body: 'Find a Summary Completion task (from a word list or from the text). First read the summary and <b>predict the part of speech</b> for every gap (noun? verb?). Only then search the passage. 15 minutes plus review.' },
  { id: 'rd-6', kind: 'reading', minutes: 20, title: 'Read aloud and retell',
    body: 'Read a 500+ word article (The Guardian, BBC, National Geographic). Then <b>retell it aloud in one minute</b>: the problem, the finding, the recommendation. Note eight new words with their context.' },

  // ---------- Writing Task 1 ----------
  { id: 'w1-1', kind: 'writing1', minutes: 20, title: 'Line graph',
    body: '<b>Data</b> (sketch it on paper): share of people using the internet in three countries, 2000–2020.\n• Country A: 20% → 45% → 85% → 92% → 95%\n• Country B: 5% → 15% → 40% → 70% → 80%\n• Country C: 50% → 60% → 65% → 66% → 67%\n(values for 2000, 2005, 2010, 2015, 2020)\n\n<b>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</b>\n\n<i>150+ words, 20 minutes. The overview is compulsory: two main trends.</i>' },
  { id: 'w1-2', kind: 'writing1', minutes: 20, title: 'Bar chart',
    body: '<b>Data</b>: average hours per week spent on housework, men and women, four countries.\n• Sweden: M 14, F 17\n• Japan: M 4, F 22\n• USA: M 10, F 18\n• Brazil: M 6, F 24\n\n<b>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</b>\n\n<i>150+ words, 20 minutes. Do not describe every figure — group them.</i>' },
  { id: 'w1-3', kind: 'writing1', minutes: 20, title: 'Process',
    body: '<b>Process</b>: making chocolate.\ncocoa pods harvested → beans removed and fermented (5 days) → dried in the sun → roasted → shells removed → ground into paste → paste pressed/mixed with sugar and milk → moulded → packaged.\n\n<b>Summarise the process by selecting and reporting the main features.</b>\n\n<i>Passive voice and sequencing (Firstly / Once … / Subsequently / The final stage). 150+ words.</i>' },
  { id: 'w1-4', kind: 'writing1', minutes: 20, title: 'Pie charts',
    body: '<b>Data</b>: sources of electricity in country X, 2000 vs 2020.\n2000: coal 55%, gas 20%, nuclear 15%, hydro 8%, wind/solar 2%\n2020: coal 20%, gas 30%, nuclear 12%, hydro 10%, wind/solar 28%\n\n<b>Summarise the information and make comparisons where relevant.</b>\n\n<i>150+ words. What rose, what fell, what barely changed.</i>' },
  { id: 'w1-5', kind: 'writing1', minutes: 20, title: 'Table',
    body: '<b>Table</b>: international students (thousands) in four countries.\n• UK: 2010 — 400, 2015 — 430, 2020 — 550\n• Australia: 2010 — 330, 2015 — 300, 2020 — 500\n• Canada: 2010 — 100, 2015 — 220, 2020 — 530\n• Germany: 2010 — 180, 2015 — 230, 2020 — 320\n\n<b>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</b>\n\n<i>150+ words. Note Canada — the fastest growth.</i>' },
  { id: 'w1-6', kind: 'writing1', minutes: 20, title: 'Map',
    body: '<b>Map</b> (imagine it): a village in 1990 and today.\n1990: a high street with shops, a farm to the east, woodland to the north, a school in the centre, a river to the west.\nToday: the farm replaced by housing, part of the woodland cleared for a car park and a supermarket, a bridge added across the river, the school extended, the shops turned into cafés.\n\n<b>Summarise the changes.</b>\n\n<i>Useful: was converted into, was replaced by, was constructed, expanded, to the north of. 150+ words.</i>' },

  // ---------- Listening ----------
  { id: 'ls-1', kind: 'listening', minutes: 30, title: 'Section 1 — numbers and names',
    body: 'Do <b>Section 1</b> of any Cambridge IELTS test (a dialogue, a form). Before listening, <b>predict the answer type</b> for every gap (a number? a name? a date?). After checking, write out every spelling mistake three times.\n\n<i>Free: ielts.org → Sample test questions, or IELTS Liz / British Council on YouTube.</i>' },
  { id: 'ls-2', kind: 'listening', minutes: 30, title: 'Section 3 — academic discussion',
    body: 'Do <b>Section 3</b> (two or three students discussing a project). Listen once, exam conditions. Then a second time with the script: <b>underline where a speaker changes their mind</b> (“actually”, “on second thought”, “I\'d rather”) — these are the multiple-choice traps.' },
  { id: 'ls-3', kind: 'listening', minutes: 30, title: 'Five-minute dictation',
    body: 'Take any two-minute recording (TED-Ed, BBC 6 Minute English). Listen sentence by sentence and <b>write it down word for word</b>. Compare with the script. Note which sounds and contractions you missed (“would\'ve”, “gonna”).' },
  { id: 'ls-4', kind: 'listening', minutes: 30, title: 'Section 4 — lecture',
    body: 'Do <b>Section 4</b> (a monologue, ten questions, no pause). In the minute before it starts, <b>read all the questions and underline the key words</b>. Afterwards work out which answers you lost because you were still on the previous question.' },
  { id: 'ls-5', kind: 'listening', minutes: 30, title: 'Podcast at 1.25×',
    body: 'Twenty minutes of an English podcast (Huberman Lab, The Diary of a CEO, BBC Global News) at <b>1.25× speed</b>. Then retell the five main points aloud in one minute. The exam recording will feel slow.' },
  { id: 'ls-6', kind: 'listening', minutes: 30, title: 'Map labelling',
    body: 'Find a <b>Map/Plan labelling</b> task (Section 2). Before listening, study the map: where is north, where is the entrance, what is already labelled. Listen for directions: “opposite”, “adjacent to”, “at the far end”, “just past”.' },

  // ---------- Grammar / review ----------
  { id: 'gr-1', kind: 'grammar', minutes: 20, title: 'Conditionals',
    body: 'Write three sentences of each type: <b>1st conditional</b> (If governments invest…, …will…), <b>2nd</b> (If I were…, I would…), <b>3rd</b> (If people had…, they would have…). Topic: education.\n\n<i>In an essay the 2nd conditional is an easy way to show complex grammar.</i>' },
  { id: 'gr-2', kind: 'grammar', minutes: 20, title: 'Relative clauses',
    body: 'Join eight pairs of simple sentences into one using <b>which / who / where / whose</b>. Example: “Cities are growing. They face housing problems.” → “Cities which are growing rapidly face housing problems.”' },
  { id: 'gr-3', kind: 'grammar', minutes: 20, title: 'Passive voice (Task 1)',
    body: 'Describe making coffee in eight steps <b>using only the passive</b>: beans are roasted, then ground… Then rewrite one of your old Task 1 process answers, turning active forms into passive ones.' },
  { id: 'gr-4', kind: 'grammar', minutes: 20, title: 'Articles a / the / —',
    body: 'Take any paragraph of your own essay and <b>check every article</b>: countable or not? mentioned before? general (education) or specific (the education system in Russia)? Correct it and keep the before/after.' },
  { id: 'gr-5', kind: 'grammar', minutes: 20, title: 'Complex sentences',
    body: 'Rewrite six simple sentences as complex ones using <b>although / despite / whereas / unless / as long as / while</b>. Example: “Cars are convenient. They pollute.” → “Although cars are convenient, they pollute the air.”' },
  { id: 'gr-6', kind: 'grammar', minutes: 20, title: 'Weekly review',
    body: 'Nothing new today: open <b>Progress</b>, look at your minutes by skill this week and <b>pick the weakest skill</b>. Collect this week\'s mistakes (Reading review, Listening dictation) and write the corrected versions into your notebook. 20 minutes.' },
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
  // Sunday is the review day.
  if (weekdayMon0 === 6) return list.find((t) => t.id === 'gr-6') ?? list[0];
  const pool = kind === 'grammar' ? list.filter((t) => t.id !== 'gr-6') : list;
  const idx = (weekIndex + hash(String(tgId))) % pool.length;
  void date;
  return pool[idx];
}

export function randomTask(kind?: TaskKind, excludeId?: string): IeltsTask {
  const list = kind ? byKind.get(kind)! : TASKS;
  const pool = list.filter((t) => t.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function taskById(id: string): IeltsTask | undefined {
  return TASKS.find((t) => t.id === id);
}

export function formatTask(t: IeltsTask, header = 'Today’s task'): string {
  return `<b>${header} · ${KIND_LABEL[t.kind]}</b>\n<b>${t.title}</b> · about ${t.minutes} min\n\n${t.body}`;
}

export function taskKeyboard(currentId: string) {
  return [
    [
      { text: 'Done ✓', callback_data: 'done' },
      { text: 'Another task', callback_data: `task:any:${currentId}` },
      { text: 'Writing', callback_data: `task:writing2:${currentId}` },
    ],
    [
      { text: 'Speaking', callback_data: `task:speaking:${currentId}` },
      { text: 'Reading', callback_data: `task:reading:${currentId}` },
      { text: 'Listening', callback_data: `task:listening:${currentId}` },
    ],
  ];
}
