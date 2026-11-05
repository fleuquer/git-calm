import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Check, RefreshCw, ExternalLink } from 'lucide-react';
import type { PendingMention } from '../utils/pendingMentions';
import { normalizeTitleCase } from '../utils/titleCase';

interface Props {
  pending: PendingMention[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpen: (mention: PendingMention) => void;
  onMarkAnswered: (key: string) => void;
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

/** Botão do cabeçalho com as menções ainda sem resposta (issue #7). */
export const PendingMentionsButton: React.FC<Props> = ({ pending, loading, error, onRefresh, onOpen, onMarkAnswered }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const count = pending.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setIsOpen(v => !v); if (!isOpen) onRefresh(); }}
        className={`relative flex items-center justify-center w-8 h-8 rounded-md transition-all ${
          isOpen
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title={count > 0 ? `${count} ${count === 1 ? 'menção pendente' : 'menções pendentes'} de resposta` : 'Menções pendentes de resposta'}
      >
        <AtSign size={15} className={count > 0 ? 'text-blue-600 dark:text-blue-400' : ''} />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-[28rem] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Menções pendentes</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Saem da lista quando você comenta no card</p>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {error && <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400 border-b border-gray-200 dark:border-gray-700">{error}</p>}

          {count === 0 ? (
            <p className="px-3 py-6 text-xs text-center text-gray-400 dark:text-gray-500">
              {loading ? 'Buscando menções…' : 'Nenhuma menção esperando sua resposta.'}
            </p>
          ) : (
            <ul className="max-h-[65vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
              {pending.map(m => (
                <li key={m.key} className="group relative">
                  <button
                    onClick={() => { setIsOpen(false); onOpen(m); }}
                    className="w-full text-left px-3 py-2.5 pr-16 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                    title={m.title}
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 shrink-0">#{m.number}</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{normalizeTitleCase(m.title)}</span>
                    </div>
                    <div className="flex items-start gap-2 mt-1.5">
                      {m.mentionedByAvatar
                        ? <img src={m.mentionedByAvatar} alt="" className="w-4 h-4 rounded-full shrink-0 mt-0.5" />
                        : <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0 mt-0.5" />}
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 min-w-0">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{m.mentionedBy}</span>
                        {': '}{m.excerpt || 'mencionou você'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 pl-6 text-[11px] text-gray-400 dark:text-gray-500">
                      <span className="truncate">{m.repo}</span>
                      <span>·</span>
                      <span className="shrink-0">{timeAgo(m.mentionedAt)}</span>
                      {m.count > 1 && <><span>·</span><span className="shrink-0">{m.count} menções</span></>}
                      {m.closed && <><span>·</span><span className="shrink-0">fechado</span></>}
                    </div>
                  </button>
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <a
                      href={m.mentionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Abrir o comentário no GitHub"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => onMarkAnswered(m.key)}
                      className="p-1 rounded text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                      title="Marcar como respondida (ex: outra pessoa já respondeu)"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
