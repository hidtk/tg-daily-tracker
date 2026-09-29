import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { AiFeedback } from '@tracker/shared';

/**
 * Optional AI opinion on a Writing text, on top of the deterministic rubric. Runs only when the Worker has the
 * ANTHROPIC_API_KEY secret. Any failure (no key, timeout, refusal, bad output) returns null and the rubric alone decides.
 */
const Feedback = z.object({
  on_topic: z.boolean(),
  band: z.number(),
  tips: z.array(z.string()),
});

const SYSTEM = [
  'You are an IELTS Writing examiner checking a short practice text written by a learner.',
  'Return on_topic = false only if the text does not answer the given topic at all: another subject, a memorised template that ignores the question, or meaningless filler. A weak but relevant answer is on topic.',
  'Return band = your estimate of the IELTS Writing band for this text (4.0 to 9.0, in steps of 0.5), judged for its length.',
  'Return tips = two or three short, concrete tips that would improve this text the most, in plain words a learner understands. No praise, no preamble.',
].join('\n');

export async function aiWritingFeedback(apiKey: string | undefined, o: { topic: string; text: string; lang: 'en' | 'ru' }): Promise<AiFeedback | null> {
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
    const res = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Feedback) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Topic: ${o.topic}\n\nWrite the tips in ${o.lang === 'ru' ? 'Russian' : 'English'}.\n\n<text>\n${o.text}\n</text>`,
        },
      ],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) return null;
    const out = res.parsed_output;
    const band = Math.min(9, Math.max(4, Math.round(out.band * 2) / 2));
    return { on_topic: out.on_topic, band, tips: out.tips.map((t) => t.trim()).filter(Boolean).slice(0, 3) };
  } catch (e) {
    console.warn('AI feedback skipped', e instanceof Error ? e.message : e);
    return null;
  }
}
