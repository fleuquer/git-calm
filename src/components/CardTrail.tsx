import React, { useEffect } from 'react';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { ProjectCard } from '../types';
import type { IssueLinkRef } from '../utils/issueLinks';
import { normalizeTitleCase } from '../utils/titleCase';

interface Props {
  trail: ProjectCard[];          // Cards anteriores, do mais antigo para o mais recente
  current: ProjectCard;
  onNavigate: (index: number) => void;
  opening?: IssueLinkRef | null; // Link sendo aberto (busca na API em andamento)
}

// Com trilha longa, mostra o primeiro, "…" e os dois últimos
const MAX_VISIBLE = 4;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Trilha de navegação entre cards abertos por links (card 1 → card 2 → card 3).
 * Mostra de onde o usuário veio, permite voltar para qualquer card anterior e
 * responde a Alt+← (como o "voltar" do navegador).
 */
export const CardTrail: React.FC<Props> = ({ trail, current, onNavigate, opening }) => {
  const canGoBack = trail.length > 0;

  useEffect(() => {
    if (!canGoBack) return;
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft' && !isTypingTarget(e.target)) {
        e.preventDefault();
        onNavigate(trail.length - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canGoBack, trail.length, onNavigate]);

  if (!canGoBack && !opening) return null;

  const indexed = trail.map((card, index) => ({ card, index }));
  const visible = indexed.length > MAX_VISIBLE
    ? [indexed[0], null, ...indexed.slice(-2)]
    : indexed;

  const crumbClass = 'max-w-[16rem] truncate px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors';

  return (
    <div className="flex items-center gap-2 px-6 py-1.5 text-xs border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 shrink-0 min-w-0">
      {canGoBack && (
        <>
          <button
            onClick={() => onNavigate(trail.length - 1)}
            title={`Voltar para #${trail[trail.length - 1].number} (Alt+←)`}
            className="flex items-center gap-1 px-2 py-0.5 rounded font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shrink-0"
          >
            <ArrowLeft size={13} />
            Voltar
          </button>
          <span className="w-px h-3.5 bg-gray-300 dark:bg-gray-600 shrink-0" />
        </>
      )}

      <nav className="flex items-center gap-0.5 min-w-0 overflow-hidden" aria-label="Cards visitados">
        {visible.map((item, i) => (
          <React.Fragment key={item ? item.card.id + item.index : `gap-${i}`}>
            {item ? (
              <button onClick={() => onNavigate(item.index)} title={`#${item.card.number} ${item.card.title}`} className={crumbClass}>
                <span className="tabular-nums">#{item.card.number}</span>{' '}
                {normalizeTitleCase(item.card.title)}
              </button>
            ) : (
              <span className="px-1 text-gray-400">…</span>
            )}
            <ChevronRight size={12} className="text-gray-400 shrink-0" />
          </React.Fragment>
        ))}
        <span className="max-w-[20rem] truncate px-1.5 py-0.5 font-medium text-gray-900 dark:text-gray-100" title={current.title}>
          <span className="tabular-nums">#{current.number}</span> {normalizeTitleCase(current.title)}
        </span>
        {opening && (
          <>
            <ChevronRight size={12} className="text-gray-400 shrink-0" />
            <span className="flex items-center gap-1 px-1.5 text-gray-500 dark:text-gray-400 shrink-0">
              <Loader2 size={12} className="animate-spin" />
              Abrindo #{opening.number}…
            </span>
          </>
        )}
      </nav>
    </div>
  );
};
