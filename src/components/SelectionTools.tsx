import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, Copy, GitBranch, Loader2, Maximize2, Wrench, X } from 'lucide-react';
import { attachDevToolsFrame, callDevTools, detachDevToolsFrame } from '../services/devtoolsBridge';
import { DEVTOOLS_URL } from '../services/devtoolsConfig';
import { suggestTools, type ToolSuggestion } from '../utils/devtoolsDetect';

interface Anchor {
  text: string;
  rect: { top: number; bottom: number; left: number; width: number };
  tools: ToolSuggestion[];
  /** Aberta pelo atalho: mostra também as ferramentas genéricas */
  showAll: boolean;
}

type Result =
  | { state: 'idle' }
  | { state: 'loading'; tool: ToolSuggestion }
  | { state: 'ok'; tool: ToolSuggestion; text: string }
  | { state: 'erro'; tool: ToolSuggestion; message: string };

const AREA = '[data-devtools-tools]';
const WIDTH = 380;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function readSelection(requireArea: boolean): { text: string; rect: DOMRect } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = sel.toString();
  if (!text.trim()) return null;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (requireArea && !el?.closest(AREA)) return null;
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return { text, rect };
}

/**
 * A tela da ferramenta do devTools num modal, sem sair do git-calm. O texto selecionado
 * vai copiado para colar (Ctrl+V) até o devTools aceitar receber o campo preenchido.
 */
function DevToolsToolModal({ toolId, label, copied, onClose }: { toolId: string; label: string; copied: boolean; onClose: () => void }) {
  // Enquanto o modal está aberto, a ponte conversa com ele (uma cópia do devTools por vez)
  const frameRef = useCallback((el: HTMLIFrameElement) => {
    attachDevToolsFrame(el);
    return () => detachDevToolsFrame(el);
  }, []);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // captura: o Esc fecha só o modal, sem fechar o card por baixo
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[460] flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label={`devTools: ${label}`} className="flex flex-col w-[min(1000px,100%)] h-[min(760px,100%)] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm">
          <Wrench size={14} className="text-gray-400" />
          <span className="font-semibold text-gray-800 dark:text-gray-100">{label}</span>
          <span className="text-[10px] text-gray-400">devTools</span>
          {copied && (
            <span className="ml-3 flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
              <ClipboardCheck size={12} />
              Texto selecionado copiado: cole com <kbd className="font-mono">Ctrl+V</kbd>
            </span>
          )}
          <button onClick={onClose} title="Fechar (Esc)" className="ml-auto p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={15} />
          </button>
        </div>
        <div className="relative flex-1 min-h-0 bg-white">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          <iframe
            ref={frameRef}
            src={`${DEVTOOLS_URL}/ferramentas/${toolId}`}
            title={`devTools: ${label}`}
            allow="clipboard-read; clipboard-write"
            onLoad={() => setLoaded(true)}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Caixinha sobre o texto selecionado na descrição ou nos comentários de um card: copiar,
 * buscar branch/commit e as ferramentas do devTools. Quando o formato é reconhecido (JWT,
 * CPF/CNPJ, boleto, Pix, cron, SQL...), já mostra o resultado calculado pelo devTools.
 * Alt+T abre a caixinha com todas as ferramentas para qualquer seleção, mesmo fora do card.
 */
export function SelectionTools({ onRefSearch }: { onRefSearch?: (query: string) => void }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [result, setResult] = useState<Result>({ state: 'idle' });
  const [copied, setCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [modal, setModal] = useState<{ toolId: string; label: string; copied: boolean } | null>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const boxRef = useRef<HTMLDivElement>(null);
  const runSeq = useRef(0);

  const run = useCallback((tool: ToolSuggestion) => {
    const id = ++runSeq.current;
    setCopied(false);
    setResult({ state: 'loading', tool });
    callDevTools(tool.fn, ...tool.args)
      .then(v => { if (runSeq.current === id) setResult({ state: 'ok', tool, text: formatValue(v) }); })
      .catch((e: Error) => { if (runSeq.current === id) setResult({ state: 'erro', tool, message: e.message }); });
  }, []);

  const close = useCallback(() => {
    runSeq.current++;
    setAnchor(null);
    setResult({ state: 'idle' });
  }, []);

  const open = useCallback((showAll: boolean) => {
    const sel = readSelection(!showAll);
    if (!sel || sel.text.trim().length < 2) return false;
    const tools = suggestTools(sel.text);
    const detected = tools.filter(t => t.detected);
    const r = sel.rect;
    setTextCopied(false);
    setAnchor({ text: sel.text.trim(), rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width }, tools, showAll });
    if (detected.length) run(detected[0]);
    else { runSeq.current++; setResult({ state: 'idle' }); }
    return true;
  }, [run]);

  // Seleção com o mouse ou o teclado
  useEffect(() => {
    const onUp = (e: Event) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setTimeout(() => {
        if (!open(false)) {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) close();
        }
      }, 0);
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.shiftKey) onUp(e); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyT') {
        if (open(true)) e.preventDefault();
      } else if (e.key === 'Escape' && boxRef.current) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keyup', onKeyUp);
    // captura: o Esc fecha só a caixinha, sem fechar o card por baixo
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close]);

  // Rolar a tela desloca o texto: fecha
  useEffect(() => {
    if (!anchor) return;
    const onScroll = (e: Event) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [anchor, close]);

  // Posição: acima da seleção; se não couber, abaixo
  useLayoutEffect(() => {
    if (!anchor || !boxRef.current) { setPos(null); return; }
    const h = boxRef.current.offsetHeight;
    const margin = 8;
    const left = Math.min(Math.max(margin, anchor.rect.left + anchor.rect.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - margin);
    let top = anchor.rect.top - h - margin;
    if (top < margin) top = Math.min(anchor.rect.bottom + margin, window.innerHeight - h - margin);
    setPos({ top: Math.max(margin, top), left: Math.max(margin, left) });
  }, [anchor, result]);

  if (modal) return <DevToolsToolModal {...modal} onClose={closeModal} />;
  if (!anchor) return null;

  const visible = anchor.showAll ? anchor.tools : anchor.tools.filter(t => t.detected);
  const current = result.state === 'idle' ? null : result.tool;

  const openInDevTools = () => {
    const tool = current ?? visible[0];
    if (!tool) return;
    const input = typeof tool.args[0] === 'string' ? tool.args[0] : anchor.text;
    const label = tool.label;
    close();
    window.getSelection()?.removeAllRanges();
    setModal({ toolId: tool.toolId, label, copied: false });
    navigator.clipboard.writeText(input)
      .then(() => setModal(m => (m && m.toolId === tool.toolId ? { ...m, copied: true } : m)))
      .catch(() => { /* sem permissão de clipboard */ });
  };

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Ferramentas do devTools"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH }}
      className="fixed z-[450] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl text-xs"
    >
      {/* Ações práticas */}
      <div className="flex items-center gap-1 px-1.5 pt-1.5">
        <button
          onClick={() => {
            navigator.clipboard.writeText(anchor.text).then(() => {
              setTextCopied(true);
              setTimeout(() => setTextCopied(false), 1500);
            }).catch(() => { /* sem permissão */ });
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {textCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          {textCopied ? 'Copiado' : 'Copiar'}
        </button>
        {onRefSearch && (
          <button
            onClick={() => { const q = anchor.text; close(); window.getSelection()?.removeAllRanges(); onRefSearch(q); }}
            title="Procura o texto selecionado nas branches e commits da organização"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <GitBranch size={13} />
            Buscar branch/commit
          </button>
        )}
        <button onClick={close} title="Fechar (Esc)" className="ml-auto p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <X size={13} />
        </button>
      </div>

      {/* Ferramentas do devTools */}
      <div className="flex items-start gap-1.5 px-2.5 pt-1 pb-2">
        <Wrench size={13} className="text-gray-400 shrink-0 mt-1" />
        <div className="flex-1 flex flex-wrap gap-1">
          {visible.map(t => (
            <button
              key={`${t.fn}-${t.label}`}
              onClick={() => run(t)}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                current?.fn === t.fn && current.label === t.label
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
          {!anchor.showAll && (
            <button
              onClick={() => setAnchor(a => (a ? { ...a, showAll: true } : a))}
              title="Mais ferramentas do devTools (Alt+T)"
              className="px-2 py-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {visible.length ? 'Mais…' : 'Ferramentas do devTools…'}
            </button>
          )}
        </div>
      </div>

      {result.state !== 'idle' && (
        <div className="px-2.5 pb-2">
          <div className="relative rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700">
            {result.state === 'loading' && (
              <div className="flex items-center gap-2 px-2.5 py-2 text-gray-500">
                <Loader2 size={13} className="animate-spin" />
                Calculando no devTools…
              </div>
            )}
            {result.state === 'erro' && (
              <p className="px-2.5 py-2 text-red-600 dark:text-red-400">{result.message}</p>
            )}
            {result.state === 'ok' && (
              <>
                <pre className="px-2.5 py-2 pr-8 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-gray-800 dark:text-gray-100">
                  {result.text || '(vazio)'}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.text).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }).catch(() => { /* sem permissão */ });
                  }}
                  title="Copiar resultado"
                  className="absolute top-1.5 right-1.5 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {(current || visible.length > 0) && (
        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400">
          <span>Ferramentas do devTools · <kbd className="font-mono">Esc</kbd> fecha</span>
          <button
            onClick={openInDevTools}
            title="Abre a tela completa da ferramenta, aqui mesmo, com o texto selecionado copiado"
            className="flex items-center gap-1 hover:text-blue-500"
          >
            <Maximize2 size={10} />
            Abrir no devTools
          </button>
        </div>
      )}
    </div>
  );
}
