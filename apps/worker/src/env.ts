export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BOT_TOKEN: string;
  SESSION_SECRET: string;
  BOT_USERNAME: string;
  WEBAPP_URL: string;
  /** Optional: enables the AI opinion on Writing texts (Worker secret). Without it the rubric alone decides. */
  ANTHROPIC_API_KEY?: string;
}
