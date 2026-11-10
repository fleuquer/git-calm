import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Info } from 'lucide-react';

/**
 * Área "devTools": projeto independente (kanban pessoal de cards), exibido
 * dentro do git-calm via iframe. O app continua sendo do autor — aqui só
 * mostramos, sem alterar nada dele. Não há barra própria: o devTools já tem
 * o seu menu; as ações daqui ficam numa pílula flutuante sobre ele.
 */
import { DEVTOOLS_URL } from '../services/devtoolsConfig';
import { attachDevToolsFrame, detachDevToolsFrame } from '../services/devtoolsBridge';

interface DevToolsViewProps {
  hidden?: boolean;
}

export function DevToolsView({ hidden }: DevToolsViewProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const loading = loadedKey !== reloadKey;

  // A ponte passa a conversar com esta cópia (notas, ferramentas e token) enquanto ela estiver na tela
  const frameRef = useCallback((el: HTMLIFrameElement) => {
    attachDevToolsFrame(el);
    return () => detachDevToolsFrame(el);
  }, []);

  return (
    <div className={`relative flex-1 min-h-0 ${hidden ? 'hidden' : ''}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <RefreshCw className="animate-spin text-blue-600 dark:text-blue-400" size={28} />
        </div>
      )}
      <iframe
        ref={frameRef}
        key={reloadKey}
        src={`${DEVTOOLS_URL}/`}
        title="devTools"
        onLoad={() => setLoadedKey(reloadKey)}
        allow="clipboard-read; clipboard-write"
        className="w-full h-full border-0 bg-white"
      />
      <DevToolsActions onReload={() => setReloadKey(k => k + 1)} />
    </div>
  );
}

const iconButton = 'p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors';

/** Ações da área devTools, numa pílula flutuante no canto inferior direito. */
function DevToolsActions({ onReload }: { onReload: () => void }) {
  const [showInfo, setShowInfo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowInfo(false);
    };
    // Clique dentro do iframe não chega aqui; o blur da janela cobre esse caso
    const onBlur = () => setShowInfo(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('blur', onBlur);
    };
  }, [showInfo]);

  return (
    <div
      ref={ref}
      className={`absolute bottom-3 right-3 z-10 flex items-center gap-0.5 p-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-md transition-opacity ${
        showInfo ? 'opacity-100' : 'opacity-60 hover:opacity-100'
      }`}
    >
      <button
        onClick={() => setShowInfo(v => !v)}
        title="Sobre o devTools"
        className={`${iconButton} ${showInfo ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
      >
        <Info size={15} />
      </button>
      <button onClick={onReload} title="Recarregar o devTools" className={iconButton}>
        <RefreshCw size={15} />
      </button>
      <a
        href={DEVTOOLS_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir o devTools em nova aba"
        className={iconButton}
      >
        <ExternalLink size={15} />
      </a>

      {showInfo && (
        <div className="absolute right-0 bottom-full mb-2 w-80 z-50 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-3 text-xs text-gray-600 dark:text-gray-300 space-y-2">
          <p className="font-semibold text-gray-800 dark:text-gray-100">devTools · projeto independente</p>
          <p>
            Kanban pessoal de cards, notas e ferramentas, mantido pelo seu autor e exibido aqui dentro do git-calm.
          </p>
          <p>
            O token do GitHub configurado no git-calm é compartilhado com ele automaticamente.
          </p>
          <p>
            O navegador guarda os demais dados dele (cards, notas) separados quando aberto aqui dentro: o que você
            salvar aqui não aparece ao abrir o site direto, e vice-versa. Para levar dados de um lado para o outro,
            use o backup (exportar/importar) do próprio devTools.
          </p>
        </div>
      )}
    </div>
  );
}
