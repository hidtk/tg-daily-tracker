/**
 * A tiny D1 stand-in on top of Node's built-in SQLite (node:sqlite, Node 22+), with every migration applied.
 * Enough of the D1 API for the Repo: prepare/bind/first/all/run and batch.
 */
import type { Env } from '../src/env';

interface SqliteStatement {
  all(...params: unknown[]): Record<string, unknown>[];
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

const clean = (p: unknown[]) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

class Stmt {
  constructor(private db: SqliteDb, private sql: string, private params: unknown[] = []) {}
  bind(...params: unknown[]) {
    return new Stmt(this.db, this.sql, params);
  }
  async first<T>(col?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...clean(this.params));
    if (!row) return null;
    return (col ? row[col] : row) as T;
  }
  async all<T>() {
    const isRead = /^\s*(select|with)/i.test(this.sql);
    if (!isRead) {
      const r = this.db.prepare(this.sql).run(...clean(this.params));
      return { results: [] as T[], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    }
    return { results: this.db.prepare(this.sql).all(...clean(this.params)) as T[], success: true, meta: { changes: 0, last_row_id: 0 } };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...clean(this.params));
    return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

export class FakeD1 {
  constructor(public raw: SqliteDb) {}
  prepare(sql: string) {
    return new Stmt(this.raw, sql);
  }
  async batch(stmts: Stmt[]) {
    const out = [];
    for (const s of stmts) out.push(await s.all());
    return out;
  }
}

export async function freshDb(): Promise<FakeD1> {
  const sqliteName = 'node:sqlite';
  const fsName = 'node:fs';
  const { DatabaseSync } = (await import(/* @vite-ignore */ sqliteName)) as { DatabaseSync: new (path: string) => SqliteDb };
  const fs = (await import(/* @vite-ignore */ fsName)) as { readdirSync(p: string): string[]; readFileSync(p: string, enc: string): string };
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', (import.meta as unknown as { url: string }).url).pathname;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(fs.readFileSync(dir + f, 'utf8'));
  return new FakeD1(db);
}

export function fakeEnv(db: FakeD1): Env {
  return { DB: db as unknown as D1Database, ASSETS: {} as Fetcher, BOT_TOKEN: 'x', SESSION_SECRET: 's', BOT_USERNAME: 'bot', WEBAPP_URL: 'https://app.test' };
}
