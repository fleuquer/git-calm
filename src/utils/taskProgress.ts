/**
 * Lista de tarefas na descrição do card (checkboxes do Markdown: "- [ ] fazer", "- [x] feito"),
 * como o GitHub mostra em "1 de 2 tarefas". Ignora o que está dentro de blocos de código.
 */

export interface TaskItem {
  /** Posição entre as tarefas (0, 1, 2...) */
  index: number;
  /** Linha do texto onde está */
  line: number;
  checked: boolean;
  text: string;
}

const TASK = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)\[([ xX])\][ \t]?(.*)$/;
const FENCE = /^[ \t]*(```|~~~)/;

/** Tarefas da descrição, na ordem em que aparecem (fora de blocos de código). */
export function parseTasks(body?: string): TaskItem[] {
  if (!body) return [];
  const items: TaskItem[] = [];
  let inFence = false;
  body.split('\n').forEach((raw, line) => {
    const l = raw.replace(/\r$/, '');
    if (FENCE.test(l)) { inFence = !inFence; return; }
    if (inFence) return;
    const m = l.match(TASK);
    if (m) items.push({ index: items.length, line, checked: m[2] !== ' ', text: m[3].trim() });
  });
  return items;
}

export function countTasks(body?: string): { done: number; total: number } | null {
  const tasks = parseTasks(body);
  return tasks.length ? { done: tasks.filter(t => t.checked).length, total: tasks.length } : null;
}

/**
 * Acha no texto atual a mesma tarefa que a pessoa via (pelo texto; se houver repetidas, a mais
 * próxima da posição original). Assim, uma edição de outra pessoa no meio não troca a tarefa.
 */
function locate(body: string, target: TaskItem): TaskItem | null {
  const tasks = parseTasks(body);
  const same = tasks.filter(t => t.text === target.text);
  if (!same.length) return null;
  return same.reduce((a, b) => (Math.abs(b.index - target.index) < Math.abs(a.index - target.index) ? b : a));
}

/** Marca ou desmarca a tarefa; null se ela não existe mais no texto atual. */
export function setTaskChecked(body: string, target: TaskItem, checked: boolean): string | null {
  const t = locate(body, target);
  if (!t) return null;
  const lines = body.split('\n');
  const cr = lines[t.line].endsWith('\r') ? '\r' : '';
  lines[t.line] = lines[t.line].replace(/\r$/, '').replace(TASK, (_m, prefix: string, _c: string, rest: string) => `${prefix}[${checked ? 'x' : ' '}] ${rest}`) + cr;
  return lines.join('\n');
}

/** Remove a tarefa; null se ela não existe mais no texto atual. */
export function removeTask(body: string, target: TaskItem): string | null {
  const t = locate(body, target);
  if (!t) return null;
  const lines = body.split('\n');
  lines.splice(t.line, 1);
  return lines.join('\n');
}

/** Adiciona uma tarefa depois da última (mesmo marcador e recuo); sem tarefas, no fim do texto. */
export function addTask(body: string, text: string): string {
  const tasks = parseTasks(body);
  const lines = body.split('\n');
  if (!tasks.length) {
    const base = body.replace(/\s+$/, '');
    return `${base}${base ? '\n\n' : ''}- [ ] ${text}\n`;
  }
  // entra no nível principal da lista (o do primeiro item), depois da última tarefa
  const prefixOf = (t: TaskItem) => lines[t.line].replace(/\r$/, '').match(TASK)?.[1] ?? '- ';
  const indentOf = (t: TaskItem) => prefixOf(t).match(/^[ \t]*/)?.[0].length ?? 0;
  const top = indentOf(tasks[0]);
  const last = tasks[tasks.length - 1];
  const lastTop = [...tasks].reverse().find(t => indentOf(t) === top) ?? tasks[0];
  const prefix = prefixOf(lastTop);
  const cr = lines[last.line].endsWith('\r') ? '\r' : '';
  // lista numerada: continua a numeração
  const numbered = prefix.match(/^([ \t]*)(\d+)([.)])([ \t]+)$/);
  const next = numbered ? `${numbered[1]}${Number(numbered[2]) + 1}${numbered[3]}${numbered[4]}` : prefix;
  lines.splice(last.line + 1, 0, `${next}[ ] ${text}${cr}`);
  return lines.join('\n');
}
