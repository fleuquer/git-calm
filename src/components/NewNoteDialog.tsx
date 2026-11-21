import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, NotebookPen, X } from 'lucide-react';
import { callDevTools, getDevToolsBridgeState, startDevToolsBridge } from '../services/devtoolsBridge';
import { onNewNoteRequest, type NoteDraft } from '../services/noteDraft';

interface Props {
  /** Card aberto agora: dá para incluir o link dele na nota feita a partir de um trecho */
  currentCard?: { number: number; title: string; url: string } | null;
  /**
   * O devTools ainda não cria notas pelo git-calm: o conteúdo vai copiado e o painel de notas
   * abre no editor dele, com título e conteúdo à mão para colar
   */
  onFallback: (draft: { titulo: string; conteudo: string }) => void;
}

/** Janela "Nova nota no devTools": título e conteúdo, já preenchidos com o que veio do card ou da seleção. */
export function NewNoteDialog({ currentCard, onFallback }: Props) {
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [withLink, setWithLink] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [salva, setSalva] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => onNewNoteRequest(d => {
    startDevToolsBridge(); // já deixa o devTools pronto para salvar
    setDraft(d);
    setTitulo(d.titulo);
    setConteudo(d.conteudo);
    setWithLink(true);
    setErro('');
    setSalva(false);
    setSaving(false);
    setTimeout(() => titleRef.current?.focus(), 0);
  }), []);

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setDraft(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [draft]);

  if (!draft) return null;

  const linkCard = draft.daSelecao && currentCard ? currentCard : null;

  const save = async () => {
    const t = titulo.trim();
    if (!t) { setErro('Dê um título para a nota.'); titleRef.current?.focus(); return; }
    const blocos = [{ label: draft.rotulo ?? '', conteudo }];
    if (linkCard && withLink) blocos.push({ label: `Card #${linkCard.number}`, conteudo: `${linkCard.title}\n${linkCard.url}` });

    const bridge = getDevToolsBridgeState();
    if (bridge.status === 'pronto' && !bridge.funcoes.includes('criarNota')) {
      // ainda não dá para criar pelo git-calm: editor de notas do devTools com o conteúdo à mão
      const texto = blocos.map(b => (b.label ? `${b.label}\n${b.conteudo}` : b.conteudo)).join('\n\n');
      navigator.clipboard.writeText(texto).catch(() => { /* sem permissão */ });
      setDraft(null);
      onFallback({ titulo: t, conteudo: texto });
      return;
    }
    setSaving(true);
    setErro('');
    try {
      await callDevTools('criarNota', { titulo: t, blocos });
      setSalva(true);
      setTimeout(() => setDraft(null), 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/desconhecida/i.test(msg)) {
        const texto = blocos.map(b => (b.label ? `${b.label}\n${b.conteudo}` : b.conteudo)).join('\n\n');
        navigator.clipboard.writeText(texto).catch(() => { /* sem permissão */ });
        setDraft(null);
        onFallback({ titulo: t, conteudo: texto });
      } else {
        setErro(`Não foi possível salvar no devTools: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[470] flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setDraft(null); }}>
      <div role="dialog" aria-label="Nova nota no devTools" className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <NotebookPen size={16} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Nova nota no devTools</h2>
          <button onClick={() => setDraft(null)} title="Cancelar (Esc)" className="ml-auto p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={15} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            ref={titleRef}
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            placeholder="Título da nota"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500"
          />
          <textarea
            value={conteudo}
            onChange={e => setConteudo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }}
            rows={8}
            placeholder="Conteúdo"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-mono text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500 resize-y"
          />
          {linkCard && (
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={withLink} onChange={e => setWithLink(e.target.checked)} />
              Incluir o link do card #{linkCard.number}
            </label>
          )}
          {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-[11px] text-gray-400"><kbd className="font-mono">Ctrl+Enter</kbd> salva</span>
          <div className="flex gap-2">
            <button onClick={() => setDraft(null)} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving || salva}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-70"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : salva ? <Check size={14} /> : <NotebookPen size={14} />}
              {salva ? 'Nota salva' : 'Salvar no devTools'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
