/**
 * Writing topics and Speaking cue cards for the shop tasks. A Writing answer is a short (60+ words) or a long
 * (150+ words) text; a Speaking answer is a voice message to the bot.
 */

export interface WritingTopic {
  id: string;
  title: string;
  prompt: string;
}

export interface SpeakingCard {
  id: string;
  title: string;
  /** "Describe …" */
  prompt: string;
  /** "You should say:" points */
  points: string[];
}

export const WRITING_TOPICS: WritingTopic[] = [
  { id: 'wt-01', title: 'Phones at school', prompt: 'Some schools ban smartphones during the school day. Do the advantages of such a ban outweigh the disadvantages? Give reasons and an example.' },
  { id: 'wt-02', title: 'Cars in city centres', prompt: 'Many cities are closing their centres to private cars. Is this a good idea? Explain your view with at least one example.' },
  { id: 'wt-03', title: 'Working from home', prompt: 'More people now work from home. What are the main benefits and drawbacks for workers and for companies?' },
  { id: 'wt-04', title: 'University subjects', prompt: 'Should universities focus on subjects that lead directly to jobs, or is there value in studying history and philosophy? Give your opinion.' },
  { id: 'wt-05', title: 'Advertising to children', prompt: 'Advertising aimed at children should be banned. To what extent do you agree or disagree?' },
  { id: 'wt-06', title: 'Prevention or cure', prompt: 'Governments should spend more on preventing illness than on treating it. Do you agree? Support your answer with reasons.' },
  { id: 'wt-07', title: 'Tourism', prompt: 'Mass tourism brings money to local communities but can also damage them. Discuss both sides and give your opinion.' },
  { id: 'wt-08', title: 'Social media and news', prompt: 'Many young people get their news only from social media. Is this a positive or a negative development?' },
  { id: 'wt-09', title: 'Learning languages', prompt: 'Some people say that with translation apps, learning a foreign language is no longer necessary. Do you agree?' },
  { id: 'wt-10', title: 'Old buildings', prompt: 'Should cities protect old buildings, or replace them with modern ones that are more practical? Explain your view.' },
  { id: 'wt-11', title: 'Sport and health', prompt: 'Building more sports facilities is the best way to improve public health. To what extent do you agree?' },
  { id: 'wt-12', title: 'Plastic', prompt: 'What are the causes of plastic pollution, and what can individuals and governments do about it?' },
  { id: 'wt-13', title: 'Space exploration', prompt: 'Some people think money spent on space exploration should be spent on problems on Earth. What is your opinion?' },
  { id: 'wt-14', title: 'Four-day week', prompt: 'Several companies have tried a four-day working week. Would this be good for society as a whole? Give reasons.' },
  { id: 'wt-15', title: 'Online learning', prompt: 'Online courses are replacing classroom lessons for many adults. Are the benefits greater than the problems?' },
  { id: 'wt-16', title: 'Fast fashion', prompt: 'Cheap clothes encourage people to buy more than they need. Should governments do something about this?' },
];

export const SPEAKING_CARDS: SpeakingCard[] = [
  { id: 'sc-01', title: 'A skill you learned', prompt: 'Describe a skill you learned that was difficult at first.', points: ['what the skill is', 'how you learned it', 'why it was difficult', 'and explain how you feel about it now'] },
  { id: 'sc-02', title: 'A place near water', prompt: 'Describe a place near water (a river, lake or sea) that you enjoyed visiting.', points: ['where it is', 'when you went there', 'what you did there', 'and explain why you enjoyed it'] },
  { id: 'sc-03', title: 'A person who inspires you', prompt: 'Describe a person who has inspired you to do something.', points: ['who this person is', 'how you know them', 'what they inspired you to do', 'and explain why they inspired you'] },
  { id: 'sc-04', title: 'A piece of technology', prompt: 'Describe a piece of technology you find difficult to use.', points: ['what it is', 'when you use it', 'why it is difficult', 'and explain how you feel when using it'] },
  { id: 'sc-05', title: 'A goal', prompt: 'Describe a goal you have set for yourself.', points: ['what the goal is', 'when you set it', 'what you are doing to achieve it', 'and explain why it is important to you'] },
  { id: 'sc-06', title: 'An interesting conversation', prompt: 'Describe an interesting conversation you had with someone you did not know well.', points: ['who you talked to', 'where it happened', 'what you talked about', 'and explain why it was interesting'] },
  { id: 'sc-07', title: 'A change in your life', prompt: 'Describe a change that improved your life.', points: ['what the change was', 'when it happened', 'why you made it', 'and explain how it improved your life'] },
  { id: 'sc-08', title: 'A book or film', prompt: 'Describe a book or film that made you think.', points: ['what it was about', 'when you read or watched it', 'what it made you think about', 'and explain whether you would recommend it'] },
  { id: 'sc-09', title: 'A time you helped someone', prompt: 'Describe a time when you helped someone.', points: ['who you helped', 'what the situation was', 'how you helped', 'and explain how you felt afterwards'] },
  { id: 'sc-10', title: 'A city to live in', prompt: 'Describe a city you would like to live in for a while.', points: ['where it is', 'what you know about it', 'what you would do there', 'and explain why you would like to live there'] },
  { id: 'sc-11', title: 'A habit', prompt: 'Describe a good habit you have, or would like to have.', points: ['what the habit is', 'how you started it', 'how often you do it', 'and explain why it matters to you'] },
  { id: 'sc-12', title: 'A busy day', prompt: 'Describe a day when you were very busy.', points: ['when it was', 'what you had to do', 'how you managed', 'and explain how you felt at the end of the day'] },
  { id: 'sc-13', title: 'An app you use', prompt: 'Describe an app or website you use a lot.', points: ['what it is', 'how you found it', 'what you use it for', 'and explain why you like or dislike it'] },
  { id: 'sc-14', title: 'A journey', prompt: 'Describe a journey you remember well.', points: ['where you went', 'how you travelled', 'who you were with', 'and explain why you remember it'] },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Day number since 2026-01-01, used to rotate topics. */
function dayIndex(date: string): number {
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 86_400_000);
}

/** Today's Writing topic number `n` (0 = the long text, 1 = the short one): rotates daily, with a per-user offset. */
export function writingTopicFor(userKey: number, date: string, n = 0): WritingTopic {
  const i = (dayIndex(date) * 2 + n + hash(`w${userKey}`)) % WRITING_TOPICS.length;
  return WRITING_TOPICS[(i + WRITING_TOPICS.length) % WRITING_TOPICS.length];
}

/** Speaking card number `n` for today (0 = the long answer, 1 = the short one). */
export function speakingCardFor(userKey: number, date: string, n = 0): SpeakingCard {
  const i = (dayIndex(date) * 2 + n + hash(`s${userKey}`)) % SPEAKING_CARDS.length;
  return SPEAKING_CARDS[(i + SPEAKING_CARDS.length) % SPEAKING_CARDS.length];
}

export function writingTopicById(id: string): WritingTopic | undefined {
  return WRITING_TOPICS.find((t) => t.id === id);
}

export function speakingCardById(id: string): SpeakingCard | undefined {
  return SPEAKING_CARDS.find((t) => t.id === id);
}
