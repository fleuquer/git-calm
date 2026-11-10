import { useEffect, useRef, useState } from 'react';
import { ChevronUp, ExternalLink } from 'lucide-react';
import { DEVTOOLS_REPO_URL } from '../services/devtoolsConfig';

const TARGETS = [
  { label: 'git-calm', hint: 'board, cards, notificações...', url: 'https://github.com/fleuquer/git-calm/issues/new' },
  { label: 'devTools', hint: 'notas, ferramentas, aba devTools', url: `${DEVTOOLS_REPO_URL}/issues/new` },
];

/** "Reportar bug" do rodapé: escolhe para qual projeto abrir a issue. */
export function ReportBugMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      >
        <ExternalLink size={10} />
        Reportar bug
        <ChevronUp size={10} className={`transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-56 z-50 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
          <p className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wide text-gray-400">Reportar bug ou sugerir no</p>
          {TARGETS.map(t => (
            <a
              key={t.label}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex flex-col px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <span className="text-xs text-gray-700 dark:text-gray-200">{t.label}</span>
              <span className="text-[10px] text-gray-400">{t.hint}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
