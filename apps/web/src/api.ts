import type {
  AuthResponse,
  ProgressResponse,
  ReadingResult,
  ReadingSubmit,
  ReadingTask,
  SentenceResult,
  SentenceState,
  Settings,
  SettingsView,
  ShopResponse,
  SpeakingState,
  TaskSize,
  VocabAnswerResult,
  VocabResponse,
  WalletResponse,
  WalletSettings,
  WritingResult,
  WritingState,
} from '@tracker/shared';
import { deviceTz, getInitData } from './tg';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
let token: string | null = sessionStorage.getItem('token');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && retry && path !== '/api/auth') {
    await auth();
    return request<T>(method, path, body, false);
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, j.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function auth(): Promise<AuthResponse> {
  const initData = getInitData();
  if (!initData) throw new ApiError(401, 'Open the app from Telegram');
  const r = await request<AuthResponse>('POST', '/api/auth', { initData, tz: deviceTz() }, false);
  token = r.token;
  sessionStorage.setItem('token', token);
  return r;
}

export const api = {
  saveSettings: (s: Partial<Settings>) => request<SettingsView>('PUT', '/api/settings', s),
  onboarded: (done: boolean) => request<{ ok: true }>('POST', '/api/onboarded', { done }),
  reset: (word: string) => request<SettingsView>('POST', '/api/reset', { word }),
  shop: () => request<ShopResponse>('GET', '/api/shop'),
  progress: () => request<ProgressResponse>('GET', '/api/progress'),
  reading: (id: string) => request<ReadingTask>('GET', `/api/reading/${encodeURIComponent(id)}`),
  submitReading: (body: ReadingSubmit) => request<ReadingResult>('POST', '/api/reading/submit', body),
  vocab: () => request<VocabResponse>('GET', '/api/vocab'),
  answerWord: (word_id: number, answer: string, hint: boolean) => request<VocabAnswerResult>('POST', '/api/vocab/answer', { word_id, answer, hint }),
  sentences: () => request<SentenceState>('GET', '/api/sentences'),
  submitSentence: (word_id: number, text: string) => request<SentenceResult>('POST', '/api/sentences', { word_id, text }),
  writing: (size: TaskSize) => request<WritingState>('GET', `/api/writing?size=${size}`),
  startWriting: (size: TaskSize) => request<WritingState>('POST', '/api/writing/start', { size }),
  submitWriting: (size: TaskSize, text: string) => request<WritingResult>('POST', '/api/writing', { size, text }),
  speaking: () => request<SpeakingState>('GET', '/api/speaking'),
  wallet: () => request<WalletResponse>('GET', '/api/wallet'),
  saveWallet: (w: Partial<WalletSettings>) => request<WalletResponse>('PUT', '/api/wallet', w),
  lockConfig: (key: string, profile: string) => request<WalletResponse>('POST', '/api/lock/config', { key, profile }),
  lockRemove: () => request<WalletResponse>('DELETE', '/api/lock/config'),
  unlock: (minutes: number) => request<WalletResponse>('POST', '/api/lock/unlock', { minutes }),
  lockCheck: () => request<{ ok: boolean; error?: string; blocked?: Partial<Record<string, boolean>>; state: string | null; repaired?: boolean }>('GET', '/api/lock/check'),
  lockNow: () => request<WalletResponse & { refunded: number }>('POST', '/api/lock/close'),
};
