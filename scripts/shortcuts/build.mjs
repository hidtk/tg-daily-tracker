// Builds the two ready-made iOS Shortcuts («Элвис вход», «Элвис выход») as unsigned XML plists.
// iOS imports only signed files: .github/workflows/shortcuts.yml signs them on a macOS runner
// (`shortcuts sign --mode anyone`) and commits the result to apps/web/public/shortcuts/.
// No personal data inside: on import the Shortcuts app asks for the personal link (Import Question).
//
//   node scripts/shortcuts/build.mjs <out dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOOP_REPEATS = 360; // × 20 s = 2 hours, as in the in-app guide (ShortcutsGuide.tsx)
const TICK_SECONDS = 20; // GATE_TICK_SECONDS

// Fixed ids keep the output byte-for-byte stable between builds.
const id = (n) => `E1715000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const QUESTION = 'Вставь личную ссылку из Элвиса: Настройки → Блокировка соцсетей → Пошаговая инструкция → «Скопировать». Paste your personal link from Elvis.';
const PLACEHOLDER = 'ВСТАВЬ ССЫЛКУ ИЗ ЭЛВИСА';

const action = (identifier, params = {}) => ({ WFWorkflowActionIdentifier: identifier, WFWorkflowActionParameters: params });
const output = (uuid, name) => ({ Type: 'ActionOutput', OutputUUID: uuid, OutputName: name });
/** The personal link + a query string, e.g. `<link>?e=tick`. */
const linkWith = (textUuid, query) => ({
  Value: { string: `￼${query}`, attachmentsByRange: { '{0, 1}': output(textUuid, 'Text') } },
  WFSerializationType: 'WFTextTokenString',
});
/** "Contents of URL" read as text, so the If can use contains / does not contain. */
const asText = (uuid) => ({
  Type: 'Variable',
  Variable: {
    Value: { ...output(uuid, 'Contents of URL'), Aggrandizements: [{ Type: 'WFCoercionVariableAggrandizement', CoercionItemClass: 'WFStringContentItem' }] },
    WFSerializationType: 'WFTextTokenAttachment',
  },
});
const CONTAINS = 99;
const NOT_CONTAINS = 999;
const ifStart = (group, input, condition, text) => action('is.workflow.actions.conditional', { GroupingIdentifier: group, WFControlFlowMode: 0, WFInput: input, WFCondition: condition, WFConditionalActionString: text });
const ifElse = (group) => action('is.workflow.actions.conditional', { GroupingIdentifier: group, WFControlFlowMode: 1 });
const ifEnd = (group, uuid) => action('is.workflow.actions.conditional', { GroupingIdentifier: group, WFControlFlowMode: 2, UUID: uuid });
const get = (uuid, url) => action('is.workflow.actions.downloadurl', { UUID: uuid, WFURL: url, WFHTTPMethod: 'GET' });
const home = () => action('is.workflow.actions.returntohomescreen');
const linkText = (uuid) => action('is.workflow.actions.gettext', { UUID: uuid, WFTextActionText: PLACEHOLDER });

function shortcut(actions, glyph, color) {
  return {
    WFWorkflowClientVersion: '2302.0.4',
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: '900',
    WFWorkflowIcon: { WFWorkflowIconStartColor: color, WFWorkflowIconGlyphNumber: glyph },
    WFWorkflowTypes: [],
    WFWorkflowInputContentItemClasses: [],
    WFWorkflowOutputContentItemClasses: [],
    WFWorkflowHasOutputFallback: false,
    WFWorkflowHasShortcutInputVariables: false,
    WFQuickActionSurfaces: [],
    WFWorkflowImportQuestions: [{ ActionIndex: 0, Category: 'Parameter', DefaultValue: '', ParameterKey: 'WFTextActionText', Text: QUESTION }],
    WFWorkflowActions: actions,
  };
}

/**
 * «Элвис вход» — the "app opened" automation runs it:
 *   no ALLOW (no minutes or no answer) → Home; then every 20 s ask the timer: BLOCK → Home, STOP → stop.
 */
function openShortcut() {
  const [link, first, tick] = [id(1), id(2), id(3)];
  const [g1, g2, g3, g4] = [id(11), id(12), id(13), id(14)];
  return shortcut([
    linkText(link),
    get(first, linkWith(link, '?app=any&e=open')),
    ifStart(g1, asText(first), NOT_CONTAINS, 'ALLOW'),
    home(),
    ifElse(g1),
    ifEnd(g1, id(21)),
    action('is.workflow.actions.repeat.count', { GroupingIdentifier: g2, WFControlFlowMode: 0, WFRepeatCount: LOOP_REPEATS }),
    action('is.workflow.actions.delay', { WFDelayTime: TICK_SECONDS }),
    get(tick, linkWith(link, '?e=tick')),
    ifStart(g3, asText(tick), CONTAINS, 'BLOCK'),
    home(),
    ifEnd(g3, id(22)),
    ifStart(g4, asText(tick), CONTAINS, 'STOP'),
    action('is.workflow.actions.exit'),
    ifEnd(g4, id(23)),
    action('is.workflow.actions.repeat.count', { GroupingIdentifier: g2, WFControlFlowMode: 2, UUID: id(24) }),
  ], 59511, 463140863);
}

/** «Элвис выход» — the "app closed" automation runs it: the server charges the real time. */
function closeShortcut() {
  const link = id(31);
  return shortcut([linkText(link), get(id(32), linkWith(link, '?app=any&e=close'))], 59511, 4282601983);
}

// --- a tiny XML plist writer (no dependencies) ---
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function node(v, pad) {
  const p = '\t'.repeat(pad);
  if (typeof v === 'string') return `${p}<string>${esc(v)}</string>`;
  if (typeof v === 'boolean') return `${p}<${v}/>`;
  if (typeof v === 'number') return Number.isInteger(v) ? `${p}<integer>${v}</integer>` : `${p}<real>${v}</real>`;
  if (Array.isArray(v)) return v.length ? `${p}<array>\n${v.map((x) => node(x, pad + 1)).join('\n')}\n${p}</array>` : `${p}<array/>`;
  const keys = Object.keys(v);
  if (!keys.length) return `${p}<dict/>`;
  return `${p}<dict>\n${keys.map((k) => `${p}\t<key>${esc(k)}</key>\n${node(v[k], pad + 1)}`).join('\n')}\n${p}</dict>`;
}
const plist = (v) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${node(v, 0)}\n</plist>\n`;

const out = process.argv[2] ?? 'build/shortcuts';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'elvis-open.plist'), plist(openShortcut()));
writeFileSync(join(out, 'elvis-close.plist'), plist(closeShortcut()));
console.log(`written to ${out}`);
