import type { TaskSize } from '@tracker/shared';
import { ReadingTask } from './ReadingTask';
import { WordsTask } from './WordsTask';
import { SentenceTask } from './SentenceTask';
import { QuizTask } from './QuizTask';
import { WritingTask } from './WritingTask';
import { SpeakingTask } from './SpeakingTask';

/** Open a shop task by its id: r:<test>:<part>, words, quiz, sentence, writing:<size>, speaking:<size>. */
export function TaskSheet({ id, botUsername, onClose, onDone }: { id: string; botUsername: string; onClose: () => void; onDone: () => void }) {
  if (id.startsWith('r:')) return <ReadingTask id={id} onClose={onClose} onDone={onDone} />;
  if (id === 'words') return <WordsTask onClose={onClose} onDone={onDone} />;
  if (id === 'quiz') return <QuizTask onClose={onClose} onDone={onDone} />;
  if (id === 'sentence') return <SentenceTask onClose={onClose} onDone={onDone} />;
  const [kind, size] = id.split(':') as [string, TaskSize];
  if (kind === 'writing') return <WritingTask size={size === 'long' ? 'long' : 'short'} onClose={onClose} onDone={onDone} />;
  if (kind === 'speaking') return <SpeakingTask size={size === 'long' ? 'long' : 'short'} botUsername={botUsername} onClose={onClose} />;
  return null;
}
