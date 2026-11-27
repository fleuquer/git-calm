import { useEffect, useRef, useState } from 'react';
import { setPresenceEditing } from '../services/presence';
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { GitHubService } from '../services/github';
import { addTask, parseTasks, removeTask, setTaskChecked, type TaskItem } from '../utils/taskProgress';

interface Props {
  token: string;
  org: string;
  repo: string;
  number: number;
  /** Descrição do card já carregada no quadro (mostra na hora, antes de buscar a atual) */
  initialBody?: string;
  /** A descrição mudou no GitHub: recarregar o card e o quadro */
  onChanged: (body: string) => void;
}

/**
 * Aba "Etapas" do card: as tarefas (checkboxes) da descrição, para marcar, adicionar e remover
 * sem editar a descrição. Cada mudança lê a descrição atual no GitHub antes de gravar, para não
 * apagar o que outra pessoa mudou nesse meio tempo.
 */
export function CardStepsPanel({ token, org, repo, number, initialBody, onChanged }: Props) {
  const [body, setBody] = useState(initialBody ?? '');
  const [busy, setBusy] = useState<string | null>('carregando');
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState('');
  // Avisa quem mais está com o card aberto que estou adicionando uma etapa
  const writingStep = !!novo.trim();
  useEffect(() => {
    setPresenceEditing('etapas', writingStep ? 'adicionando uma etapa' : null);
    return () => setPresenceEditing('etapas', null);
  }, [writingStep]);
  const inputRef = useRef<HTMLInputElement>(null);
  const service = useRef(new GitHubService(token));

  // a descrição do quadro pode estar desatualizada: busca a atual ao abrir a aba
  const reload = async () => {
    setBusy('carregando');
    setErro('');
    try {
      setBody(await service.current.getIssueBody(org, repo, number));
    } catch (e) {
      setErro(`Não foi possível ler a descrição: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };
  useEffect(() => {
    let alive = true;
    service.current = new GitHubService(token);
    service.current.getIssueBody(org, repo, number)
      .then(b => { if (alive) { setBody(b); setBusy(null); } })
      .catch(e => { if (alive) { setErro(`Não foi possível ler a descrição: ${e instanceof Error ? e.message : e}`); setBusy(null); } });
    return () => { alive = false; };
  }, [token, org, repo, number]);

  /** Lê a descrição atual, aplica a mudança e grava */
  const change = async (key: string, apply: (current: string) => string | null, optimistic?: string | null) => {
    setBusy(key);
    setErro('');
    const before = body;
    if (optimistic) setBody(optimistic);
    try {
      const current = await service.current.getIssueBody(org, repo, number);
      const next = apply(current);
      if (next === null) {
        setBody(current);
        setErro('Essa etapa mudou ou foi removida por outra pessoa: a lista foi atualizada.');
        return;
      }
      await service.current.updateIssueBody(org, repo, number, next);
      setBody(next);
      onChanged(next);
    } catch (e) {
      setBody(before);
      setErro(`Não foi possível salvar no GitHub: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (t: TaskItem) =>
    change(`t${t.index}`, cur => setTaskChecked(cur, t, !t.checked), setTaskChecked(body, t, !t.checked));
  const remove = (t: TaskItem) =>
    change(`r${t.index}`, cur => removeTask(cur, t), removeTask(body, t));
  const add = () => {
    const text = novo.trim().replace(/\s*\n\s*/g, ' ');
    if (!text) return;
    setNovo('');
    change('novo', cur => addTask(cur, text), addTask(body, text)).then(() => inputRef.current?.focus());
  };

  const tasks = parseTasks(body);
  const done = tasks.filter(t => t.checked).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const saving = !!busy && busy !== 'carregando';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Etapas</h4>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{done}/{tasks.length} · {pct}%</span>
        {(busy === 'carregando' || saving) && <Loader2 size={12} className="animate-spin text-gray-400" />}
        <button
          onClick={reload}
          disabled={!!busy}
          title="Buscar a descrição atual no GitHub"
          className="ml-auto p-1 rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-0.5">
        {tasks.map(t => (
          <li key={`${t.index}-${t.text}`} className="group flex items-start gap-2 px-1.5 py-1 rounded hover:bg-white dark:hover:bg-gray-800">
            <input
              type="checkbox"
              checked={t.checked}
              disabled={saving}
              onChange={() => toggle(t)}
              className="mt-0.5 shrink-0 accent-blue-600 cursor-pointer disabled:cursor-wait"
            />
            <span
              onClick={() => !saving && toggle(t)}
              className={`flex-1 min-w-0 text-xs break-words cursor-pointer ${t.checked ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}
            >
              {t.text || <i className="text-gray-400">(sem texto)</i>}
            </span>
            <button
              onClick={() => remove(t)}
              disabled={saving}
              title="Remover etapa"
              className="shrink-0 p-0.5 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 disabled:opacity-0"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={novo}
          onChange={e => setNovo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          disabled={saving}
          placeholder="Nova etapa…"
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500"
        />
        <button
          onClick={add}
          disabled={saving || !novo.trim()}
          title="Adicionar etapa (Enter)"
          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>

      {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
      <p className="text-[11px] text-gray-400">As etapas ficam na descrição do card, como caixinhas de marcar do GitHub.</p>
    </div>
  );
}
