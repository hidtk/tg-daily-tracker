import { useState } from 'react';
import type { Settings, SettingsView } from '@tracker/shared';
import { api, ApiError, exportUrl } from '../api';
import { deviceTz, haptic, inTelegram, tg } from '../tg';
import { useToast } from '../components/Toast';
import { Field, Toggle } from '../components/ui';

const TZ_LIST = [
  'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Krasnoyarsk',
  'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Europe/Kyiv', 'Europe/Minsk', 'Asia/Almaty', 'Asia/Tbilisi', 'Asia/Yerevan',
  'Europe/Istanbul', 'Europe/Berlin', 'Europe/London', 'Asia/Dubai', 'Asia/Bangkok', 'America/New_York', 'UTC',
];

export function SettingsScreen({ initial }: { initial: SettingsView }) {
  const toast = useToast();
  const [s, setS] = useState<SettingsView>(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAi, setShowAi] = useState(Boolean(initial.ai_endpoint));
  const tzOptions = TZ_LIST.includes(s.tz) ? TZ_LIST : [s.tz, ...TZ_LIST];
  const devTz = deviceTz();

  const patch = (p: Partial<Settings>) => {
    setS((x) => ({ ...x, ...p }));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const { partner: _p, deadline_editable: _d, bot_username: _b, ...plain } = s;
      const r = await api.saveSettings(plain);
      setS(r);
      setDirty(false);
      haptic.success();
      toast('Сохранено');
    } catch (e) {
      haptic.warning();
      toast(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    haptic.tap();
    if (inTelegram) {
      tg.openLink(exportUrl());
      return;
    }
    const data = await api.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tracker-export.json';
    a.click();
  };

  return (
    <div className="screen">
      <h1>Настройки</h1>

      <div className="section-title">Напоминания</div>
      <div className="card">
        <div className="row">
          <Field label="Утро (план)">
            <input className="input" type="time" value={s.morning_time} onChange={(e) => patch({ morning_time: e.target.value })} />
          </Field>
          <Field label="Вечер (факт)">
            <input className="input" type="time" value={s.evening_time} onChange={(e) => patch({ evening_time: e.target.value })} />
          </Field>
        </div>
        <Field label="Часовой пояс">
          <select className="input" value={s.tz} onChange={(e) => patch({ tz: e.target.value })}>
            {tzOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {devTz !== s.tz && (
            <button className="btn ghost small" style={{ marginTop: 4 }} onClick={() => patch({ tz: devTz })}>Использовать {devTz}</button>
          )}
        </Field>
        <div className="small muted">Напоминание не приходит, если план (утром) или факт (вечером) уже заполнены.</div>
      </div>

      <div className="section-title">Подтверждения</div>
      <div className="card">
        <Toggle label="Строгий режим" sub="Без фото или чата с ИИ занятие не идёт в стрик и статистику" on={s.strict_mode} onChange={(v) => patch({ strict_mode: v })} />
        <div className="small muted" style={{ marginTop: 8 }}>Подтверждение — это фото или пересланный диалог с ИИ, отправленный боту. Он спросит, к какой активности привязать.</div>
      </div>

      <div className="section-title">Партнёр по ответственности</div>
      <div className="card">
        {s.partner ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>🤝 <b>{s.partner.name}</b></div>
              <button className="btn sm danger" onClick={async () => { await api.unlinkPartner(); haptic.success(); setS((x) => ({ ...x, partner: null })); toast('Партнёр отвязан'); }}>Отвязать</button>
            </div>
            <Toggle label="Сообщать о пропусках" sub="Утром, если вчера что-то не засчитано" on={s.partner_notify_missed} onChange={(v) => patch({ partner_notify_missed: v })} />
            <div className="small muted">Недельные итоги по воскресеньям уходят партнёру всегда, пока он привязан.</div>
          </>
        ) : (
          <>
            <div className="small" style={{ marginBottom: 8 }}>Человек или группа, кому бот будет присылать твои итоги недели и пропуски. Социальное давление работает лучше любых напоминаний.</div>
            <button className="btn secondary" onClick={() => { haptic.tap(); try { tg.openTelegramLink(`https://t.me/${s.bot_username}`); } catch { /* noop */ } }}>Получить ссылку: /partner в боте</button>
          </>
        )}
      </div>

      <div className="section-title">Недельная сводка</div>
      <div className="card">
        <Toggle label="Присылать по воскресеньям" on={s.weekly_summary} onChange={(v) => patch({ weekly_summary: v })} />
        {s.weekly_summary && (
          <Field label="Время">
            <input className="input" type="time" value={s.weekly_time} onChange={(e) => patch({ weekly_time: e.target.value })} />
          </Field>
        )}
      </div>

      <div className="section-title">AI-разбор (скоро)</div>
      <div className="card">
        <Toggle label="Подключить свою модель" sub="OpenAI-совместимый API (Ollama, LM Studio, облако)" on={showAi} onChange={(v) => { setShowAi(v); if (!v) patch({ ai_endpoint: null, ai_key: null }); }} />
        {showAi && (
          <>
            <Field label="Endpoint URL">
              <input className="input" placeholder="https://host/v1/chat/completions" value={s.ai_endpoint ?? ''} onChange={(e) => patch({ ai_endpoint: e.target.value || null })} />
            </Field>
            <Field label="API key">
              <input className="input" type="password" placeholder="sk-…" value={s.ai_key ?? ''} onChange={(e) => patch({ ai_key: e.target.value || null })} />
            </Field>
            <div className="small muted">В текущей версии вызовы не выполняются — настройки сохраняются для v2.</div>
          </>
        )}
      </div>

      <div className="section-title">Данные</div>
      <div className="card">
        <button className="btn secondary" onClick={doExport}>⬇️ Экспорт в JSON</button>
        <div className="small muted" style={{ marginTop: 8 }}>Все активности и записи одним файлом — для бэкапа или переноса.</div>
      </div>

      {dirty && (
        <button className="btn savebar" disabled={busy} onClick={save}>{busy ? 'Сохраняю…' : 'Сохранить настройки'}</button>
      )}
    </div>
  );
}
