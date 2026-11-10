import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface Shortcut {
  /** Cada item é uma alternativa; dentro dele, teclas separadas por "+" */
  keys: string[];
  label: string;
  hint?: string;
}

/** Mapa dos atalhos do git-calm. Ao criar um atalho novo, registre-o aqui. */
const GROUPS: Array<{ title: string; items: Shortcut[] }> = [
  {
    title: 'Geral',
    items: [
      { keys: ['/', 'Ctrl+K'], label: 'Buscar card por número ou título' },
      { keys: ['Alt+B'], label: 'Buscar branch ou commit na organização' },
      { keys: ['Alt+N'], label: 'Notas do devTools', hint: 'funciona até digitando ou com um card aberto' },
      { keys: ['Alt+←'], label: 'Reabrir o último card visto' },
      { keys: ['?'], label: 'Este mapa de atalhos' },
      { keys: ['Esc'], label: 'Fechar a janela ou o painel aberto' },
    ],
  },
  {
    title: 'No card',
    items: [
      { keys: ['Alt+←'], label: 'Voltar para o card anterior da trilha' },
      { keys: ['Ctrl+B'], label: 'Negrito no comentário' },
      { keys: ['Ctrl+I'], label: 'Itálico no comentário' },
      { keys: ['@'], label: 'Mencionar alguém no comentário', hint: '↑ ↓ para escolher, Enter ou Tab para inserir' },
      { keys: ['Ctrl+clique'], label: 'Abrir o card do quadro no GitHub, em nova aba' },
    ],
  },
  {
    title: 'Texto selecionado',
    items: [
      { keys: ['Selecionar'], label: 'Copiar, buscar branch/commit e ferramentas do devTools', hint: 'na descrição e nos comentários do card' },
      { keys: ['Alt+T'], label: 'A mesma caixinha, para texto selecionado em qualquer lugar' },
    ],
  },
];

function Keys({ combo }: { combo: string }) {
  const parts = combo === '+' ? ['+'] : combo.split('+');
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((k, i) => (
        <kbd
          key={i}
          className="min-w-[1.4rem] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-[11px] font-sans text-gray-600 dark:text-gray-300 text-center leading-4"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label="Atalhos de teclado" className="w-full max-w-lg max-h-full overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="sticky top-0 flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <Keyboard size={16} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Atalhos de teclado</h2>
          <button onClick={onClose} title="Fechar (Esc)" className="ml-auto p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={15} />
          </button>
        </div>
        <div className="px-4 py-3 space-y-4">
          {GROUPS.map(g => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.title}</h3>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {g.items.map(item => (
                  <li key={item.label} className="flex items-center gap-3 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-200">{item.label}</p>
                      {item.hint && <p className="text-[11px] text-gray-400">{item.hint}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.keys.map((k, i) => (
                        <span key={k} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-[10px] text-gray-400">ou</span>}
                          <Keys combo={k} />
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
