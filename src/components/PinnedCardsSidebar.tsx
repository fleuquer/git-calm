import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Pin, PinOff } from 'lucide-react';
import { loadPinnedCollapsed, savePinnedCollapsed, unpin, usePinnedCards, type PinnedCard } from '../utils/pinnedCards';

interface Props {
  onOpen: (card: PinnedCard) => void;
  /** Card aberto agora, para destacar na lista */
  current?: { number: number; repo?: string } | null;
}

/**
 * Barra flutuante com os cards fixados, no canto inferior esquerdo. Recolhe para uma aba na borda
 * (o estado fica salvo); recolhida, passar o mouse na aba mostra a barra por cima até o
 * mouse sair. Só aparece quando há card fixado.
 */
export function PinnedCardsSidebar({ onOpen, current }: Props) {
  const pins = usePinnedCards();
  const [collapsed, setCollapsed] = useState(loadPinnedCollapsed);
  // Recolhida e com o mouse em cima: mostra a barra só enquanto o mouse estiver nela
  const [peek, setPeek] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!pins.length) return null;

  const setC = (v: boolean) => { clearTimeout(timer.current); setPeek(false); setCollapsed(v); savePinnedCollapsed(v); };
  const peekIn = (delay: number) => { clearTimeout(timer.current); timer.current = setTimeout(() => setPeek(true), delay); };
  const peekOut = (delay: number) => { clearTimeout(timer.current); timer.current = setTimeout(() => setPeek(false), delay); };
  const isCurrent = (p: PinnedCard) =>
    !!current && current.number === p.number && (current.repo ?? '').toLowerCase() === (p.repo ?? '').toLowerCase();

  if (collapsed && !peek) {
    return (
      <button
        onClick={() => setC(false)}
        onMouseEnter={() => peekIn(150)}
        onMouseLeave={() => clearTimeout(timer.current)}
        title="Passe o mouse para ver os cards fixados; clique para deixar a barra aberta"
        className="fixed z-[55] left-0 bottom-12 flex flex-col items-center gap-1.5 px-1.5 py-3 rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 shadow-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 backdrop-blur-sm"
      >
        <Pin size={14} className="text-amber-500" />
        <span className="text-[11px] font-semibold">{pins.length}</span>
        <span className="text-[10px] [writing-mode:vertical-rl] rotate-180 tracking-wide">Fixados</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Cards fixados"
      // canto inferior esquerdo, acima do rodapé: aberta de vez, espiando e a aba ficam no mesmo
      // lugar (a barra cresce para cima, por cima da aba)
      onMouseEnter={peek ? () => clearTimeout(timer.current) : undefined}
      onMouseLeave={peek ? () => peekOut(300) : undefined}
      className="fixed z-[55] left-2 bottom-12 w-64 max-h-[calc(100vh-10rem)] flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 shadow-xl backdrop-blur-sm"
    >
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <Pin size={14} className="text-amber-500" />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Fixados</span>
        <span className="text-xs text-gray-400">{pins.length}</span>
        {peek ? (
          <button
            onClick={() => setC(false)}
            title="Deixar a barra aberta"
            className="ml-auto px-1.5 py-0.5 rounded text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Manter aberta
          </button>
        ) : (
          <button
            onClick={() => setC(true)}
            title="Esconder (fica uma aba na borda; passar o mouse mostra de novo)"
            className="ml-auto p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <ChevronLeft size={15} />
          </button>
        )}
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto py-1">
        {pins.map(p => (
          <li key={`${p.repo ?? ''}#${p.number}`} className="group relative">
            <button
              onClick={() => onOpen(p)}
              title={`${p.repo ? `${p.repo} ` : ''}#${p.number} ${p.title}`}
              className={`w-full text-left pl-3 pr-8 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 ${isCurrent(p) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
            >
              <span className="block text-xs text-gray-800 dark:text-gray-100 line-clamp-2">
                <span className="font-mono text-gray-400 mr-1">#{p.number}</span>
                {p.title}
              </span>
              {p.repo && <span className="block text-[10px] text-gray-400 truncate">{p.repo}</span>}
            </button>
            <button
              onClick={() => unpin(p)}
              title="Desafixar"
              className="absolute right-1.5 top-1.5 p-1 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <PinOff size={12} />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
