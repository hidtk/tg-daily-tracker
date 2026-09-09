import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GATE_APP_LABEL,
  MCQ_LETTERS,
  READING_TESTS,
  TFNG_OPTIONS,
  minutesForBand,
  type GateApp,
  type ReadingResult,
  type ReadingTest,
  type WalletResponse,
} from '@tracker/shared';
import { api, ApiError } from '../api';
import { haptic, tg } from '../tg';
import { useToast } from '../components/Toast';
import { Field, Sheet, Toggle } from '../components/ui';

const ALL_APPS: GateApp[] = ['instagram', 'tiktok', 'youtube', 'vk'];

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

export function Wallet() {
  const toast = useToast();
  const [w, setW] = useState<WalletResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [test, setTest] = useState<ReadingTest | null>(null);
  const [howto, setHowto] = useState(false);

  const load = () =>
    api
      .wallet()
      .then(setW)
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Ошибка'));

  useEffect(() => {
    void load();
  }, []);

  if (err) return <div className="screen"><p className="muted">{err}</p></div>;
  if (!w) return <span className="spinner" />;

  const done = new Set(w.done_test_ids);
  const patch = async (p: Parameters<typeof api.saveWallet>[0]) => {
    setW(await api.saveWallet(p));
    haptic.success();
  };

  return (
    <div className="screen">
      <h1>Минуты</h1>

      <div className="card wallet-hero">
        <div className="wallet-balance">{Math.floor(w.balance)}<span> мин</span></div>
        <div className="muted small">
          {w.balance < 1
            ? 'Соцсети закрыты. Пройди Reading-тест, чтобы открыть.'
            : `Хватит примерно на ${Math.floor(w.balance)} мин в ${w.apps.map((a) => GATE_APP_LABEL[a]).join(' / ') || 'приложениях'}.`}
        </div>
        <div className="wallet-meta">
          <span>Сегодня заработано: <b>{w.earned_today}</b></span>
          <span>Осталось за день: <b>{w.earn_left}</b></span>
          <span>Банк: <b>{w.bank_cap}</b></span>
        </div>
      </div>

      <div className="section-title">Заработать · Reading</div>
      <div className="card">
        <div className="hint" style={{ marginTop: 0 }}>
          13 вопросов, band по официальной шкале. <b>5.0–5.5 → 10 мин</b>, <b>6.0 → 15 мин</b>, <b>6.5+ → 30 мин</b>.
          Дольше лимита — награда пополам. Пройденный тест второй раз минут не даёт.
        </div>
        <div className="tests">
          {READING_TESTS.map((t) => (
            <button
              key={t.id}
              className={`test-row${done.has(t.id) ? ' done' : ''}`}
              onClick={() => {
                haptic.tap();
                setTest(t);
              }}
            >
              <div>
                <b>{t.title}</b>
                <div className="muted small">{t.topic} · {t.questions.length} вопросов · ~{t.minutes} мин</div>
              </div>
              <span className="test-badge">{done.has(t.id) ? '✓' : '→'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">Блокировка приложений</div>
      <div className="card">
        <Toggle label="Кошелёк включён" sub="Выключишь — приложения перестанут блокироваться" on={w.wallet_enabled} onChange={(v) => void patch({ wallet_enabled: v })} />
        <div className="field">
          <label>Что закрывать</label>
          <div className="chips">
            {ALL_APPS.map((a) => (
              <button
                key={a}
                className={`chip${w.apps.includes(a) ? ' on' : ''}`}
                onClick={() => {
                  haptic.select();
                  void patch({ apps: w.apps.includes(a) ? w.apps.filter((x) => x !== a) : [...w.apps, a] });
                }}
              >
                {GATE_APP_LABEL[a]}
              </button>
            ))}
          </div>
        </div>
        <div className="field-grid">
          <Field label="Банк, макс. мин">
            <input className="input" type="number" min={0} max={600} defaultValue={w.bank_cap} onBlur={(e) => void patch({ bank_cap: Number(e.target.value) })} />
          </Field>
          <Field label="Лимит за день">
            <input className="input" type="number" min={0} max={600} defaultValue={w.daily_earn_cap} onBlur={(e) => void patch({ daily_earn_cap: Number(e.target.value) })} />
          </Field>
        </div>
        <button className="btn secondary" onClick={() => { haptic.tap(); setHowto(true); }}>📱 Настроить на iPhone</button>
      </div>

      {w.sessions.length > 0 && (
        <>
          <div className="section-title">Последние заходы</div>
          <div className="card">
            {w.sessions.slice(0, 8).map((s) => (
              <div key={s.id} className="ledger-row">
                <span>{GATE_APP_LABEL[s.app]}</span>
                <span className="muted small">{s.started_at.slice(5, 16).replace('T', ' ')}</span>
                <b>{s.ended_at ? `−${s.minutes < 1 ? '<1' : Math.round(s.minutes)}` : '…'}</b>
              </div>
            ))}
          </div>
        </>
      )}

      {test && (
        <ReadingRunner
          test={test}
          onClose={() => setTest(null)}
          onDone={(r) => {
            void load();
            toast(r.earned ? `+${r.earned} мин · band ${r.band.toFixed(1)}` : `Band ${r.band.toFixed(1)} · минут не начислено`);
          }}
        />
      )}
      {howto && <Howto url={w.gate_url} apps={w.apps} onClose={() => setHowto(false)} />}
    </div>
  );
}

function ReadingRunner({ test, onClose, onDone }: { test: ReadingTest; onClose: () => void; onDone: (r: ReadingResult) => void }) {
  const toast = useToast();
  const startedAt = useRef(Date.now());
  const [sec, setSec] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => test.questions.map(() => ''));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReadingResult | null>(null);

  useEffect(() => {
    const t = setInterval(() => setSec(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const limit = (test.minutes + 10) * 60;
  const answered = answers.filter(Boolean).length;
  const set = (i: number, v: string) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.submitReading({ test_id: test.id, seconds: sec, answers });
      setResult(r);
      haptic.success();
      onDone(r);
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Sheet title="Результат" onClose={onClose}>
        <div className="result-hero">
          <div className="result-band">{result.band.toFixed(1)}</div>
          <div className="muted">{result.correct} из {result.total} · {fmtClock(sec)}</div>
          <div className={`result-earn${result.earned ? '' : ' zero'}`}>{result.earned ? `+${result.earned} мин` : '0 мин'}</div>
          {result.repeat && <div className="hint">Этот тест уже был засчитан — повтор минут не даёт.</div>}
          {result.halved && !result.repeat && <div className="hint">Дольше лимита ({test.minutes + 10} мин) — награда уменьшена вдвое.</div>}
          {result.capped && !result.repeat && <div className="hint">Упёрся в дневной лимит или в потолок банка.</div>}
          <div className="muted small">Баланс: {Math.floor(result.balance)} мин</div>
        </div>
        {result.wrong.length > 0 && (
          <>
            <div className="section-title">Разбор ошибок</div>
            {result.wrong.map((x) => (
              <div key={x.n} className="card wrong">
                <b>#{x.n}</b> — твой ответ: <i>{x.given || '—'}</i>, верный: <b>{x.answer}</b>
                <div className="muted small">{x.explain}</div>
              </div>
            ))}
          </>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet title={test.title} onClose={onClose}>
      <div className={`timer${sec > limit ? ' over' : ''}`}>
        ⏱ {fmtClock(sec)} <span className="muted small">лимит {test.minutes + 10} мин · отвечено {answered}/{test.questions.length}</span>
      </div>
      <div className="passage">
        {test.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="section-title">Вопросы</div>
      {test.questions.map((q, i) => (
        <div key={q.n} className="card q">
          <div className="q-prompt"><b>{q.n}.</b> {q.prompt}</div>
          {q.type === 'tfng' && (
            <div className="chips">
              {TFNG_OPTIONS.map((o) => (
                <button key={o} className={`chip${answers[i] === o ? ' on' : ''}`} onClick={() => { haptic.select(); set(i, o); }}>{o}</button>
              ))}
            </div>
          )}
          {q.type === 'mcq' && (
            <div className="opts">
              {(q.options ?? []).map((o, k) => (
                <button key={k} className={`opt${answers[i] === MCQ_LETTERS[k] ? ' on' : ''}`} onClick={() => { haptic.select(); set(i, MCQ_LETTERS[k]); }}>
                  <b>{MCQ_LETTERS[k]}</b> {o}
                </button>
              ))}
            </div>
          )}
          {q.type === 'gap' && (
            <input className="input" placeholder="ONE WORD" value={answers[i]} onChange={(e) => set(i, e.target.value)} />
          )}
        </div>
      ))}
      <button className="btn" disabled={busy || !answered} onClick={submit}>
        {busy ? 'Проверяю…' : `Проверить (${answered}/${test.questions.length})`}
      </button>
      <div className="hint">Списывать смысла нет: минуты — твои, а band показывает реальный уровень к экзамену.</div>
    </Sheet>
  );
}

function Howto({ url, apps, onClose }: { url: string; apps: GateApp[]; onClose: () => void }) {
  const toast = useToast();
  const names = useMemo(() => apps.map((a) => GATE_APP_LABEL[a]).join(', ') || 'Instagram', [apps]);
  const copy = (s: string) => {
    navigator.clipboard?.writeText(s).then(
      () => toast('Скопировано'),
      () => toast('Скопируй вручную'),
    );
  };
  return (
    <Sheet title="Быстрые команды · iPhone" onClose={onClose}>
      <div className="hint" style={{ marginTop: 0 }}>
        iOS сам не умеет спрашивать разрешение у сервера, но «Быстрые команды» умеют. Нужны две автоматизации на каждое приложение ({names}).
      </div>

      <div className="section-title">Ссылка-шлюз</div>
      <div className="card">
        <code className="gate-url">{url}?app=instagram&e=open</code>
        <button className="btn secondary sm" onClick={() => copy(`${url}?app=instagram&e=open`)}>Скопировать «открыл»</button>
        <button className="btn secondary sm" onClick={() => copy(`${url}?app=instagram&e=close`)}>Скопировать «закрыл»</button>
        <div className="hint">Для других приложений замени <code>app=instagram</code> на <code>tiktok</code>, <code>youtube</code> или <code>vk</code>.</div>
      </div>

      <div className="section-title">Автоматизация 1 — открытие</div>
      <div className="card steps">
        <p>1. Быстрые команды → <b>Автоматизация</b> → «+» → <b>Приложение</b>.</p>
        <p>2. Приложение: <b>Instagram</b>. Событие: <b>Открыто</b>. <b>Запускать сразу</b>, уведомление выключить.</p>
        <p>3. Действие <b>«Содержимое URL-адреса»</b> → вставь ссылку «открыл».</p>
        <p>4. Действие <b>«Если»</b>: [Содержимое URL] <b>содержит</b> <code>ALLOW</code>.</p>
        <p>5. В ветке <b>«Иначе»</b>: «Показать уведомление» («Минуты кончились — иди делай Reading») и <b>«Открыть приложение» → Быстрые команды</b> (или «Домой» через «Открыть приложение → Настройки»).</p>
      </div>

      <div className="section-title">Автоматизация 2 — закрытие</div>
      <div className="card steps">
        <p>Такая же, но событие <b>«Закрыто»</b> и ссылка «закрыл» — она списывает потраченные минуты.</p>
        <p className="muted small">Если закрытие не сработает, сессия закроется сама максимум через 45 минут.</p>
      </div>

      <div className="section-title">Усилить</div>
      <div className="card steps">
        <p>Экранное время → лимит 1 минута на эти приложения, пароль лимита отдай другу/партнёру. Тогда обойти автоматизацию будет заметно сложнее.</p>
      </div>

      <button className="btn secondary" onClick={() => { haptic.tap(); try { tg.openLink('https://support.apple.com/ru-ru/guide/shortcuts/apd690170742/ios'); } catch { /* noop */ } }}>
        Справка Apple по автоматизациям
      </button>
      <div className="hint">Награда: band {'>='} 6.5 → {minutesForBand(7)} мин, 6.0 → {minutesForBand(6)} мин, 5.0–5.5 → {minutesForBand(5)} мин.</div>
    </Sheet>
  );
}
