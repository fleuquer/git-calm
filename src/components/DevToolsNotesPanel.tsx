import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, NotebookPen, Pin, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useDevToolsBridge } from '../hooks/useDevToolsBridge';
import { attachDevToolsFrame, detachDevToolsFrame, refreshDevToolsBridge, startDevToolsBridge, type DevToolsNote } from '../services/devtoolsBridge';
import { DEVTOOLS_URL } from '../services/devtoolsConfig';

interface DevToolsNotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** A aba devTools está na tela: criar/editar notas por ela, sem abrir outra cópia */
  devToolsTabOpen?: boolean;
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function noteText(note: DevToolsNote) {
  return note.blocos.map(b => `${b.label ?? ''} ${b.conteudo}`).join(' ');
}

/**
 * Título para mostrar: como no devTools, uma nota sem título aparece pelo rótulo do
 * primeiro bloco (ou, sem rótulo, pela primeira linha do conteúdo).
 */
function noteTitle(note: DevToolsNote) {
  if (note.titulo.trim()) return note.titulo.trim();
  const label = note.blocos.find(b => b.label?.trim())?.label?.trim();
  if (label) return label;
  const firstLine = note.blocos.find(b => b.conteudo.trim())?.conteudo.trim().split('\n')[0];
  return firstLine || 'Sem título';
}

function formatDate(value: DevToolsNote['atualizado']) {
  if (value === undefined || value === '') return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => { /* sem permissão de clipboard */ });
      }}
      title="Copiar"
      className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
}

/**
 * Painel flutuante com as notas do devTools, para consultar (ou criar, na tela do
 * próprio devTools) sem sair do card. Atalho: Alt+N.
 */
export function DevToolsNotesPanel({ isOpen, onClose, devToolsTabOpen }: DevToolsNotesPanelProps) {
  const bridge = useDevToolsBridge();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingRequested, setEditing] = useState(false);
  // Com a aba devTools na tela, a edição é feita nela (uma cópia do devTools por vez)
  const editing = editingRequested && !devToolsTabOpen;
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    startDevToolsBridge();
    if (!editing) setTimeout(() => searchRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const notes = useMemo(() => {
    const q = normalize(query.trim());
    const words = q ? q.split(/\s+/) : [];
    return bridge.notas
      .filter(n => {
        if (!words.length) return true;
        const hay = normalize(`${n.titulo} ${noteText(n)}`);
        return words.every(w => hay.includes(w));
      })
      .sort((a, b) => {
        if (!!a.fixada !== !!b.fixada) return a.fixada ? -1 : 1;
        return new Date(b.atualizado ?? 0).getTime() - new Date(a.atualizado ?? 0).getTime();
      });
  }, [bridge.notas, query]);

  const selected = selectedId ? bridge.notas.find(n => n.id === selectedId) ?? null : null;

  const closeEditor = () => setEditing(false);

  // Enquanto a tela de notas dele está no painel, a ponte conversa com ela: a lista se atualiza na hora
  const editorRef = useCallback((el: HTMLIFrameElement) => {
    attachDevToolsFrame(el);
    return () => detachDevToolsFrame(el);
  }, []);

  if (!isOpen) return null;

  const statusDot = {
    parado: 'bg-gray-400',
    conectando: 'bg-amber-400 animate-pulse',
    pronto: 'bg-green-500',
    indisponivel: 'bg-red-500',
  }[bridge.status];
  const statusLabel = {
    parado: 'Desconectado',
    conectando: 'Conectando ao devTools…',
    pronto: `Conectado ao devTools${bridge.versao ? ` ${bridge.versao}` : ''}`,
    indisponivel: 'O devTools não respondeu',
  }[bridge.status];

  return (
    <div
      role="dialog"
      aria-label="Notas do devTools"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          if (selected) setSelectedId(null);
          else onClose();
        }
      }}
      className={`fixed z-[400] right-3 top-16 bottom-10 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl ${
        editing ? 'w-[min(720px,calc(100vw-1.5rem))]' : 'w-[min(380px,calc(100vw-1.5rem))]'
      }`}
    >
      {/* Cabeçalho */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        {(selected || editing) && (
          <button
            onClick={() => (editing ? closeEditor() : setSelectedId(null))}
            title="Voltar para a lista"
            className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft size={15} />
          </button>
        )}
        <NotebookPen size={15} className="text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notas</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400" title={statusLabel}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          devTools
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {!editing && (
            <>
              <button
                onClick={refreshDevToolsBridge}
                title="Recarregar notas"
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <RefreshCw size={14} className={bridge.status === 'conectando' ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setEditing(true)}
                disabled={devToolsTabOpen}
                title={devToolsTabOpen ? 'Você já está na aba devTools: crie ou edite pela tela Notas dele' : 'Criar ou editar notas no devTools'}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Plus size={13} />
                Nova
              </button>
            </>
          )}
          <button
            onClick={() => (editing ? closeEditor() : onClose())}
            title={editing ? 'Voltar para a lista' : 'Fechar (Alt+N)'}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {editing ? (
        <iframe
          ref={editorRef}
          src={`${DEVTOOLS_URL}/notas`}
          title="Notas do devTools"
          allow="clipboard-read; clipboard-write"
          className="flex-1 min-h-0 w-full border-0 rounded-b-xl bg-white"
        />
      ) : selected ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">
              {noteTitle(selected)}
            </h3>
            {selected.fixada && <Pin size={13} className="mt-0.5 text-amber-500 shrink-0" />}
          </div>
          {selected.blocos.length === 0 && (
            <p className="text-xs text-gray-400">Nota vazia (blocos secretos não são compartilhados).</p>
          )}
          {selected.blocos.map((b, i) => (
            <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 dark:border-gray-700/60">
                <span className="flex-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                  {b.label || `Bloco ${i + 1}`}
                </span>
                <CopyButton text={b.conteudo} />
              </div>
              <pre className="px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words font-mono max-h-80 overflow-y-auto">
                {b.conteudo}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="shrink-0 px-3 py-2">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60">
              <Search size={13} className="text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && notes.length > 0) setSelectedId(notes[0].id);
                }}
                placeholder="Buscar nas notas…"
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
            {notes.map(n => {
              const preview = n.blocos.find(b => b.conteudo.trim())?.conteudo.trim() ?? '';
              return (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60"
                >
                  <div className="flex items-center gap-1.5">
                    {n.fixada && <Pin size={11} className="text-amber-500 shrink-0" />}
                    <span className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate">{noteTitle(n)}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatDate(n.atualizado)}</span>
                  </div>
                  {preview && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 break-words">{preview}</p>
                  )}
                </button>
              );
            })}

            {notes.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400 space-y-2">
                {bridge.status === 'conectando' && bridge.notas.length === 0 ? (
                  <p>Carregando notas do devTools…</p>
                ) : bridge.status === 'indisponivel' && bridge.notas.length === 0 ? (
                  <>
                    <p>Não foi possível falar com o devTools.</p>
                    <button onClick={refreshDevToolsBridge} className="text-blue-600 dark:text-blue-400 hover:underline">
                      Tentar de novo
                    </button>
                  </>
                ) : query ? (
                  <p>Nenhuma nota com “{query}”.</p>
                ) : (
                  <>
                    <p>Nenhuma nota ainda.</p>
                    {devToolsTabOpen ? (
                      <p>Crie pela tela Notas do devTools, ao lado.</p>
                    ) : (
                      <button onClick={() => setEditing(true)} className="text-blue-600 dark:text-blue-400 hover:underline">
                        Criar a primeira no devTools
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 px-3 py-1.5 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 flex items-center justify-between">
            <span>{statusLabel}{bridge.notasDoCache && bridge.notas.length > 0 ? ' · mostrando cópia salva' : ''}</span>
            <span><kbd className="font-mono">Alt+N</kbd> abre/fecha</span>
          </div>
        </>
      )}
    </div>
  );
}
