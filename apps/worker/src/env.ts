export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BOT_TOKEN: string;
  SESSION_SECRET: string;
  BOT_USERNAME: string;
  WEBAPP_URL: string;
  /** Optional: enables the AI opinion on Writing texts (Worker secret). Without it the rubric alone decides. */
  ANTHROPIC_API_KEY?: string;
  /**
   * Who checks the meaning of a sentence (lib/judge.ts): 'none' (default — rules only, sentences pay nothing),
   * 'workers-ai' (needs the AI binding; a daily ceiling keeps it inside the free allowance) or 'http'
   * (an OpenAI-compatible chat endpoint of your own model: SENTENCE_JUDGE_URL, optional _MODEL and _TOKEN).
   */
  SENTENCE_JUDGE?: string;
  SENTENCE_JUDGE_URL?: string;
  SENTENCE_JUDGE_MODEL?: string;
  SENTENCE_JUDGE_TOKEN?: string;
  /** Workers AI requests per UTC day (default 100, never above 200). */
  WORKERS_AI_DAILY_CAP?: string;
  /** Workers AI binding — present only when the deploy adds it (SENTENCE_JUDGE = workers-ai). */
  AI?: { run(model: string, input: unknown): Promise<unknown> };
}
