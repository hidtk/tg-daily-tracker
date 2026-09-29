import { describe, expect, it } from 'vitest';
import { checkSentence, checkVoice, checkWriting, copiedShare, gibberishShare, linkingUsed } from '@tracker/shared';

const failed = (r: { criteria: { id: string; ok: boolean }[] }) => r.criteria.filter((c) => !c.ok).map((c) => c.id);

describe('sentence rubric', () => {
  const ex = 'Planting trees helps mitigate the effects of air pollution.';
  const check = (text: string) => checkSentence({ word: 'mitigate', example: ex, text });
  it('accepts a real sentence using the word in any form', () => {
    expect(check('Governments can mitigate traffic problems by building more cycle lanes.').ok).toBe(true);
    expect(check('The new law mitigated the damage caused by the floods last spring.').ok).toBe(true);
    expect(checkSentence({ word: 'phase out', example: 'x', text: 'The city will phase out diesel buses by the end of the decade.' }).ok).toBe(true);
  });
  it('names what is wrong', () => {
    expect(failed(check('Mitigate this.'))).toContain('length');
    expect(failed(check('Planting trees helps mitigate the effects of air pollution in cities.'))).toContain('copy');
    expect(failed(check('Это предложение написано по-русски и слово mitigate тут есть.'))).toContain('english');
    expect(failed(check('This sentence is long enough but it does not contain the target.'))).toEqual(['word']);
    expect(failed(check('mitigate mitigate mitigate mitigate mitigate mitigate mitigate'))).toContain('variety');
    expect(failed(check('mitigate qwrtzx bbbbbb kjhgfdsz xcvbnmq pltkrvz dfghjkl'))).toContain('gibberish');
  });
  it('rejects a copy of an earlier sentence', () => {
    const prev = 'Governments can mitigate traffic problems by building more cycle lanes.';
    expect(failed(checkSentence({ word: 'mitigate', example: ex, text: prev, previous: [prev] }))).toContain('copy');
  });
});

const ESSAY = (w: string[]) =>
  `Many schools now ban phones, and I think this policy can ${w[0]} the problem of distraction. ` +
  `Teachers report that pupils ${w[1]} more of each lesson when screens are away, because attention is not split. ` +
  `However, a total ban may ${w[2]} learning in some cases, since phones are also useful tools for research and for contacting parents. ` +
  'For example, a sensible rule would allow phones in the bag but not on the desk, so that pupils learn self-control instead of simply obeying. ' +
  'Moreover, clear rules help younger pupils, who often find it hard to stop checking messages during quiet reading or long tests at the end of the week. ' +
  'In my own school the change took about a month to settle, and afterwards most students agreed that break times felt more social and lessons more focused. ' +
  'In conclusion, the advantages of limiting phones outweigh the disadvantages, provided teachers explain the reasons and parents support the idea at home.';

describe('Writing rubric', () => {
  const vocab = [{ id: 1, word: 'mitigate' }, { id: 2, word: 'retain' }, { id: 3, word: 'hinder' }];
  const base = { size: 'long' as const, seconds: 900, vocab, previous: [], prompt: 'Some schools ban smartphones during the school day. Do the advantages of such a ban outweigh the disadvantages?' };
  it('passes a real text: length, words, linking, sentences, English, variety, time', () => {
    const r = checkWriting({ ...base, text: ESSAY(['mitigate', 'retain', 'hinder']) });
    expect(failed(r)).toEqual([]);
    expect(r.used).toEqual(['mitigate', 'retain', 'hinder']);
    expect(r.linking.length).toBeGreaterThanOrEqual(3);
  });
  it('says exactly which criterion failed', () => {
    expect(failed(checkWriting({ ...base, text: ESSAY(['reduce', 'keep', 'slow']) }))).toEqual(['vocab']);
    expect(failed(checkWriting({ ...base, seconds: 120, text: ESSAY(['mitigate', 'retain', 'hinder']) }))).toEqual(['time']);
    expect(failed(checkWriting({ ...base, previous: [ESSAY(['mitigate', 'retain', 'hinder'])], text: ESSAY(['mitigate', 'retain', 'hinder']) }))).toEqual(['copy']);
    const short = checkWriting({ ...base, text: 'I mitigate, retain and hinder things because it is good. However it is fine.' });
    expect(failed(short)).toEqual(expect.arrayContaining(['length', 'sentences']));
  });
  it('catches filler, random letters and the prompt copied back', () => {
    const filler = Array.from({ length: 40 }, () => 'Phones are good and phones are bad because phones.').join(' ');
    expect(failed(checkWriting({ ...base, text: filler }))).toContain('variety');
    expect(gibberishShare('qwrtzp zzzzzz hello world')).toBe(0.5);
    const prompt = `${base.prompt} ${base.prompt} ${base.prompt}`;
    expect(copiedShare(prompt, base.prompt)).toBeGreaterThan(0.3);
  });
  it('asks only for as many recent words as are learned', () => {
    const r = checkWriting({ ...base, vocab: [], text: ESSAY(['reduce', 'keep', 'slow']) });
    expect(r.criteria.find((c) => c.id === 'vocab')).toMatchObject({ ok: true, need: 0 });
  });
  it('finds linking words and phrases', () => {
    expect(linkingUsed('However, it works. For example, cities. On the other hand, costs.')).toEqual(expect.arrayContaining(['however', 'for example', 'on the other hand']));
  });
});

describe('Speaking checks', () => {
  it('length for the task, own recording, new recording', () => {
    expect(checkVoice({ size: 'short', seconds: 50, forwarded: false, duplicate: false }).ok).toBe(true);
    expect(failed(checkVoice({ size: 'long', seconds: 50, forwarded: false, duplicate: false }))).toEqual(['duration']);
    expect(failed(checkVoice({ size: 'short', seconds: 90, forwarded: true, duplicate: true }))).toEqual(['own_voice', 'new_voice']);
  });
});
