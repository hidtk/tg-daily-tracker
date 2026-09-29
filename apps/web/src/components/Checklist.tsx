import type { Criterion } from '@tracker/shared';
import { useT } from '../i18n';
import { Icon } from './Mascot';

type T = ReturnType<typeof useT>;

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** One criterion in plain words: what was found, and for a failed one what to fix. */
export function criterionText(c: Criterion, t: T): string {
  const v = c.value ?? '';
  const n = c.need ?? '';
  switch (c.id) {
    case 'length':
      return c.ok ? t('Length: {v} words (need {n})', { v, n }) : t('Too short: {v} words, need at least {n}. Add a few sentences.', { v, n });
    case 'vocab':
      if (c.ok && Number(n) === 0) return t('Recent words: none learned yet, so this rule is skipped');
      return c.ok ? t('Recent words used: {v} (need {n})', { v, n }) : t('Use {n} of your recent words (found {v}). They are listed above the text.', { v, n });
    case 'word':
      return c.ok ? t('The word “{v}” is used', { v }) : t('Use the word “{v}” itself (any form: -s, -ed, -ing).', { v });
    case 'linking':
      return c.ok ? t('Linking words: {v} (need {n})', { v, n }) : t('Connect the ideas: use {n} linking words like because, however, for example (found {v}).', { v, n });
    case 'sentences':
      return c.ok ? t('Sentences: {v}', { v }) : t('Write at least {n} full sentences, each ending with a full stop, none endlessly long (found {v}).', { v, n });
    case 'english':
      return c.ok ? t('Written in English') : t('Write it in English.');
    case 'variety':
      return c.ok ? t('Different words, no filler') : t('Too many repeats: say it with different words.');
    case 'gibberish':
      return c.ok ? t('Real words, no random letters') : t('Some words look like random letters. Check the spelling.');
    case 'copy':
      return c.ok ? t('Your own text, not a copy') : t('Too close to an earlier answer or the example. Write it anew.');
    case 'prompt':
      return c.ok ? t('Not the task text copied back') : t('Large parts repeat the task text. Say it in your own words.');
    case 'time':
      return c.ok ? t('Time from Start: {v} min (need {n})', { v, n }) : t('Too fast: {v} min from Start, a text like this takes at least {n} min. Re-read it, improve it, then send.', { v, n });
    case 'duration':
      return c.ok ? t('Length {v} — enough', { v: mmss(Number(v)) }) : t('Too short: {v}, need at least {n}. Cover every point on the card.', { v: mmss(Number(v)), n: mmss(Number(n)) });
    case 'own_voice':
      return c.ok ? t('Recorded by you') : t('Forwarded voice messages do not count. Record your own.');
    case 'new_voice':
      return c.ok ? t('A new recording') : t('This voice message was already counted.');
    case 'topic_ai':
      return c.ok ? t('On topic (AI check)') : t('Off topic, says the AI check: answer the question of the topic.');
  }
}

/** The rubric result: every criterion with a mark; failed ones first, so it is clear what to fix. */
export function Checklist({ criteria }: { criteria: Criterion[] }) {
  const t = useT();
  const sorted = [...criteria].sort((a, b) => Number(a.ok) - Number(b.ok));
  return (
    <ul className="checklist">
      {sorted.map((c) => (
        <li key={c.id} className={c.ok ? 'ok' : 'bad'}>
          <span className="mark">{c.ok ? Icon.check(16) : Icon.cross(16)}</span>
          <span>{criterionText(c, t)}</span>
        </li>
      ))}
    </ul>
  );
}
