import type { Activity, ActivityInput, AuthResponse, Entry, Homework, IeltsResponse, Lesson, LessonInput, MockTest, Settings, SettingsView, StatsResponse, TodayResponse } from '@tracker/shared';
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
  if (!initData) throw new ApiError(401, 'Откройте приложение из Telegram');
  const r = await request<AuthResponse>('POST', '/api/auth', { initData, tz: deviceTz() }, false);
  token = r.token;
  sessionStorage.setItem('token', token);
  return r;
}

export function exportUrl(): string {
  return `${BASE}/api/export?token=${encodeURIComponent(token ?? '')}`;
}

export function proofImageUrl(id: number): string {
  return `${BASE}/api/proofs/${id}/image?token=${encodeURIComponent(token ?? '')}`;
}

export const api = {
  today: (date?: string) => request<TodayResponse>('GET', `/api/today${date ? `?date=${date}` : ''}`),
  saveEntries: (entries: Omit<Entry, 'updated_at' | 'proofs'>[]) => request<{ ok: true; entries: Entry[] }>('PUT', '/api/entries', { entries }),
  activities: (archived = false) => request<{ activities: Activity[] }>('GET', `/api/activities${archived ? '?archived=1' : ''}`),
  createActivity: (a: ActivityInput) => request<Activity>('POST', '/api/activities', a),
  updateActivity: (id: number, a: Partial<ActivityInput> & { sort?: number; archived_at?: string | null }) =>
    request<Activity>('PUT', `/api/activities/${id}`, a),
  archiveActivity: (id: number) => request<Activity>('DELETE', `/api/activities/${id}`),
  stats: (month: string) => request<StatsResponse>('GET', `/api/stats?month=${month}`),
  settings: () => request<SettingsView>('GET', '/api/settings'),
  saveSettings: (s: Partial<Settings>) => request<SettingsView>('PUT', '/api/settings', s),
  export: () => request<unknown>('GET', '/api/export'),
  ielts: () => request<IeltsResponse>('GET', '/api/ielts'),
  addMock: (m: Omit<MockTest, 'id'>) => request<MockTest>('POST', '/api/mocks', m),
  deleteMock: (id: number) => request<{ ok: true }>('DELETE', `/api/mocks/${id}`),
  deleteProof: (id: number) => request<{ ok: true }>('DELETE', `/api/proofs/${id}`),
  unlinkPartner: () => request<{ ok: true }>('DELETE', '/api/partner'),
  lessons: () => request<{ lessons: Lesson[] }>('GET', '/api/lessons'),
  createLesson: (l: LessonInput) => request<Lesson>('POST', '/api/lessons', l),
  updateLesson: (id: number, l: Partial<LessonInput>) => request<Lesson>('PUT', `/api/lessons/${id}`, l),
  deleteLesson: (id: number) => request<{ ok: true }>('DELETE', `/api/lessons/${id}`),
  homeworks: () => request<{ homeworks: Homework[] }>('GET', '/api/homeworks'),
  completeHomework: (id: number) => request<{ ok: true }>('POST', `/api/homeworks/${id}/done`),
  deleteHomework: (id: number) => request<{ ok: true }>('DELETE', `/api/homeworks/${id}`),
};
