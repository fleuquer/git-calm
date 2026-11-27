import { Eye, PencilLine } from 'lucide-react';
import { useCardViewers } from '../utils/presenceContext';
import type { OnlinePerson } from '../services/presence';

const describe = (p: OnlinePerson) => (p.editando ? `${p.nome} está ${p.editando}` : `${p.nome} está com este card aberto`);

/** No card do quadro: fotinhas de quem está com o card aberto agora */
export function CardViewersBadge({ repo, number }: { repo?: string; number: number }) {
  const viewers = useCardViewers(repo, number);
  if (!viewers.length) return null;
  const editing = viewers.some(p => p.editando);
  return (
    <span
      title={viewers.map(describe).join('\n')}
      className={`flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full ${
        editing ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-green-100 dark:bg-green-500/15'
      }`}
    >
      <span className="flex -space-x-1.5">
        {viewers.slice(0, 3).map(p => (
          <img key={p.login} src={p.avatar} alt="" className="w-4 h-4 rounded-full ring-1 ring-white dark:ring-gray-800" />
        ))}
      </span>
      {editing
        ? <PencilLine size={11} className="text-amber-600 dark:text-amber-400" />
        : <Eye size={11} className="text-green-600 dark:text-green-400" />}
    </span>
  );
}

/** Dentro do card aberto: aviso de quem mais está nele e se está editando */
export function CardViewersNotice({ repo, number, className = '' }: { repo?: string; number?: number; className?: string }) {
  const viewers = useCardViewers(repo, number);
  if (!viewers.length) return null;
  const editing = viewers.filter(p => p.editando);
  const watching = viewers.filter(p => !p.editando);
  const names = (list: OnlinePerson[]) =>
    list.length === 1 ? list[0].nome : `${list.slice(0, -1).map(p => p.nome).join(', ')} e ${list[list.length - 1].nome}`;
  return (
    <div className={`space-y-1 ${className}`}>
      {editing.map(p => (
        <p key={p.login} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300">
          <img src={p.avatar} alt="" className="w-5 h-5 rounded-full" />
          <PencilLine size={13} className="shrink-0" />
          <span><strong className="font-semibold">{p.nome}</strong> está {p.editando} neste card agora.</span>
        </p>
      ))}
      {watching.length > 0 && (
        <p className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 text-xs text-green-800 dark:text-green-300">
          <span className="flex -space-x-1.5">
            {watching.slice(0, 4).map(p => <img key={p.login} src={p.avatar} alt="" className="w-5 h-5 rounded-full ring-1 ring-white dark:ring-gray-800" />)}
          </span>
          <Eye size={13} className="shrink-0" />
          <span>
            <strong className="font-semibold">{names(watching)}</strong> {watching.length === 1 ? 'também está' : 'também estão'} com este card aberto.
          </span>
        </p>
      )}
    </div>
  );
}
