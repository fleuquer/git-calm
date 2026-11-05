import React from 'react';
import { Clock, Trash2 } from 'lucide-react';
import type { ProjectCard } from '../types';
import type { CardHistoryEntry } from '../utils/cardHistory';
import { normalizeTitleCase } from '../utils/titleCase';

interface Props {
  history: CardHistoryEntry[];
  onOpen: (entry: CardHistoryEntry) => void;
  onClear: () => void;
  // Card correspondente no board (para mostrar a coluna atual), se estiver carregado
  findOnBoard: (entry: CardHistoryEntry) => ProjectCard | undefined;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/**
 * Últimos cards visualizados (issue #6). Exibido na busca do cabeçalho enquanto nada foi digitado.
 */
export const CardHistoryList: React.FC<Props> = ({ history, onOpen, onClear, findOnBoard }) => (
  <>
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
        <Clock size={12} className="text-gray-400" />
        Vistos recentemente
      </p>
      {history.length > 0 && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Limpar histórico"
        >
          <Trash2 size={12} /> Limpar
        </button>
      )}
    </div>

    {history.length === 0 ? (
      <p className="px-3 py-6 text-xs text-center text-gray-400 dark:text-gray-500">
        Os cards que você abrir aparecem aqui.
      </p>
    ) : (
      <ul className="max-h-[60vh] overflow-y-auto py-1">
        {history.map((entry, i) => {
          const onBoard = findOnBoard(entry);
          return (
            <li key={`${entry.repo}-${entry.number}`}>
              <button
                onClick={() => onOpen(entry)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                title={entry.title}
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 shrink-0">#{entry.number}</span>
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {normalizeTitleCase(onBoard?.title ?? entry.title)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 pl-0.5 text-[11px] text-gray-400 dark:text-gray-500 min-w-0">
                  {entry.repo && <span className="truncate">{entry.repo}</span>}
                  {onBoard && <><span>·</span><span className="truncate">{onBoard.status}</span></>}
                  <span>·</span>
                  <span className="shrink-0">{timeAgo(entry.viewedAt)}</span>
                  {i === 0 && <span className="ml-auto shrink-0 px-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" title="Com nenhum card aberto, Alt+← reabre o último">Alt+←</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </>
);
