import { useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Info } from 'lucide-react';

/**
 * Área "devTools": projeto independente (kanban pessoal de cards), exibido
 * dentro do git-calm via iframe. O app continua sendo do autor — aqui só
 * mostramos, sem alterar nada dele. Não há barra própria: o devTools já tem
 * o seu menu; as ações daqui ficam numa pílula flutuante sobre ele.
 */
export const DEVTOOLS_URL = 'https://dev-tools-cards.vercel.app';
const DEVTOOLS_ORIGIN = new URL(DEVTOOLS_URL).origin;

/**
 * Protocolo de integração (postMessage entre o git-calm e o iframe do devTools):
 *  - devTools → git-calm: { type: 'devtools:ready' } quando estiver pronto para receber dados
 *  - git-calm → devTools: { type: 'gitcalm:token', version: 1, token } em resposta,
 *    e de novo sempre que o token mudar
 * Os dois lados conferem a origem da mensagem; o token só é enviado para DEVTOOLS_ORIGIN.
 */
const MSG_READY = 'devtools:ready';
const MSG_TOKEN = 'gitcalm:token';

interface DevToolsViewProps {
  hidden?: boolean;
  /** Token do GitHub já configurado no git-calm, compartilhado com o devTools */
  token: string;
}

export function DevToolsView({ hidden, token }: DevToolsViewProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const loading = loadedKey !== reloadKey;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const tokenRef = useRef(token);

  const sendToken = () => {
    frameRef.current?.contentWindow?.postMessage(
      { type: MSG_TOKEN, version: 1, token: tokenRef.current },
      DEVTOOLS_ORIGIN,
    );
  };

  // Responde ao "pronto" do devTools com o token
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== DEVTOOLS_ORIGIN) return;
      if (e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type !== MSG_READY) return;
      readyRef.current = true;
      sendToken();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Token trocado no git-calm: repassa se o devTools já estiver pronto
  useEffect(() => {
    tokenRef.current = token;
    if (readyRef.current) sendToken();
  }, [token]);

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
      <DevToolsActions onReload={() => { readyRef.current = false; setReloadKey(k => k + 1); }} />
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
