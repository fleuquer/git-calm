import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDot, CircleSlash, GitFork, Loader2 } from 'lucide-react';
import { GitHubService, type IssueRelations, type RelatedIssue } from '../services/github';
import type { IssueLinkRef } from '../utils/issueLinks';

interface Props {
  token: string;
  org: string;
  repo?: string;
  number: number;
  /** Abre o card vinculado no próprio app */
  onOpen?: (ref: IssueLinkRef) => void;
}

/**
 * Cards vinculados no GitHub (issue #12): o card pai, as sub-issues e as dependências
 * (bloqueado por / bloqueia), com número, título, estado e Status no quadro. Só aparece
 * quando há vínculo.
 */
export function CardRelations({ token, org, repo, number, onOpen }: Props) {
  const [data, setData] = useState<IssueRelations | null | 'carregando' | 'erro'>('carregando');

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    new GitHubService(token).getIssueRelations(org, repo, number)
      .then(r => { if (alive) setData(r); })
      .catch(() => { if (alive) setData('erro'); });
    return () => { alive = false; };
  }, [token, org, repo, number]);

  // Sem vínculo (ou sem como consultar): não ocupa espaço
  if (!repo || data === 'erro' || data === null) return null;
  if (data === 'carregando') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 size={12} className="animate-spin" /> Procurando cards vinculados…
      </div>
    );
  }
  if (!data.parent && !data.children.length && !data.blockedBy.length && !data.blocking.length) return null;

  const pct = data.total ? Math.round((data.completed / data.total) * 100) : 0;

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1.5">
        <GitFork size={12} /> Cards vinculados
      </h4>
      {data.parent && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-400 mb-1">Card pai</p>
          <RelatedRow item={data.parent} sameRepo={data.parent.repo === repo} onOpen={onOpen} />
        </div>
      )}
      {data.children.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-gray-400">Sub-issues</p>
            {data.total > 0 && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{data.completed}/{data.total} concluídas</span>
            )}
          </div>
          {data.total > 0 && (
            <div className="h-1 mb-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="space-y-1">
            {data.children.map(c => (
              <RelatedRow key={`${c.repo}#${c.number}`} item={c} sameRepo={c.repo === repo} onOpen={onOpen} />
            ))}
          </div>
          {data.total > data.children.length && (
            <p className="mt-1 text-[11px] text-gray-400">e mais {data.total - data.children.length} no GitHub</p>
          )}
        </div>
      )}
      {data.blockedBy.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-gray-400 mb-1">Bloqueado por</p>
          <div className="space-y-1">
            {data.blockedBy.map(c => <RelatedRow key={`${c.repo}#${c.number}`} item={c} sameRepo={c.repo === repo} onOpen={onOpen} />)}
          </div>
        </div>
      )}
      {data.blocking.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-gray-400 mb-1">Bloqueia</p>
          <div className="space-y-1">
            {data.blocking.map(c => <RelatedRow key={`${c.repo}#${c.number}`} item={c} sameRepo={c.repo === repo} onOpen={onOpen} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function RelatedRow({ item, sameRepo, onOpen }: { item: RelatedIssue; sameRepo: boolean; onOpen?: (ref: IssueLinkRef) => void }) {
  const closed = item.state === 'CLOSED';
  const notPlanned = closed && (item.stateReason === 'NOT_PLANNED' || item.stateReason === 'DUPLICATE');
  const Icon = notPlanned ? CircleSlash : closed ? CheckCircle2 : CircleDot;
  const color = notPlanned ? 'text-gray-400' : closed ? 'text-purple-500' : 'text-green-600 dark:text-green-500';
  const open = (e: React.MouseEvent) => {
    // Ctrl/Cmd+clique segue o link normal (nova aba no GitHub)
    if (!onOpen || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen({ owner: item.owner, repo: item.repo, number: item.number, kind: 'issue', url: item.url });
  };
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={open}
      title={`${item.owner}/${item.repo}#${item.number} ${item.title}${closed ? ' (fechada)' : ''}`}
      className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
    >
      <Icon size={13} className={`${color} shrink-0 mt-0.5`} />
      <span className="flex-1 min-w-0">
        <span className={`block text-xs line-clamp-2 ${closed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
          <span className="font-mono text-gray-400 mr-1">{sameRepo ? '' : `${item.repo}`}#{item.number}</span>
          {item.title}
        </span>
        {item.status && (
          <span className="inline-block mt-0.5 px-1.5 py-px rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300">{item.status}</span>
        )}
      </span>
    </a>
  );
}
