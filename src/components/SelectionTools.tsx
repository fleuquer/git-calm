import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, Copy, Crop, GitBranch, Loader2, Maximize2, ScanText, Wrench, X } from 'lucide-react';
import { attachDevToolsFrame, callDevTools, detachDevToolsFrame, getDevToolsBridgeState, startDevToolsBridge } from '../services/devtoolsBridge';
import { DEVTOOLS_URL } from '../services/devtoolsConfig';
import { suggestTools, type ToolSuggestion } from '../utils/devtoolsDetect';

interface Anchor {
  text: string;
  rect: { top: number; bottom: number; left: number; width: number };
  tools: ToolSuggestion[];
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

/** Parte da imagem, em frações (0 a 1) da largura e da altura */
interface Region { x: number; y: number; w: number; h: number }

/**
 * Conteúdo da imagem do card em PNG (inteira ou só a parte marcada). As imagens do GitHub
 * não liberam CORS: o download passa pela função /api/imagem do git-calm (api/imagem.ts).
 */
async function loadImagePng(src: string, region?: Region): Promise<Blob> {
  const url = new URL(src, location.href);
  const direct = url.origin === location.origin || url.protocol === 'data:' || url.protocol === 'blob:';
  const resp = await fetch(direct ? url.href : `/api/imagem?url=${encodeURIComponent(url.href)}`).catch(() => null);
  if (!resp) throw new Error('Falha de rede ao baixar a imagem');
  if (!resp.ok) {
    const msg = resp.headers.get('content-type')?.startsWith('text/plain') ? await resp.text().catch(() => '') : '';
    throw new Error(msg || `Não foi possível baixar a imagem (${resp.status})`);
  }
  const blob = await resp.blob();
  if (blob.type === 'image/png' && !region) return blob;
  // a área de transferência só aceita PNG; a parte marcada é recortada aqui
  const bmp = await createImageBitmap(blob);
  const r = region ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(r.x * bmp.width), sy = Math.round(r.y * bmp.height);
  const sw = Math.max(1, Math.round(r.w * bmp.width)), sh = Math.max(1, Math.round(r.h * bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d')?.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  return new Promise((ok, erro) => canvas.toBlob(b => (b ? ok(b) : erro(new Error('Não foi possível converter a imagem'))), 'image/png'));
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

/** Campo de entrada de cada ferramenta na tela do devTools (o padrão é "texto") */
const INPUT_FIELD: Record<string, string> = { jwt: 'token', cron: 'expr', boleto: 'entrada', pix: 'codigo', selectupd: 'sql' };

interface ToolModal {
  toolId: string;
  label: string;
  /** Texto selecionado que vai para a ferramenta */
  text: string;
  /** preparando: pedindo ao devTools para deixar a tela preenchida antes de abrir */
  phase: 'preparando' | 'pronto';
  prefilled: boolean;
  /** Aviso no topo no lugar do texto selecionado (ex.: imagem copiada para colar) */
  notice?: { text: string; tone: 'ok' | 'aviso' | 'erro' };
}

/**
 * A tela da ferramenta do devTools num modal, sem sair do git-calm, já preenchida com o
 * texto selecionado (função preencher da API do devTools). Sem ela, o texto fica à mão
 * no topo do modal para copiar e colar.
 */
function DevToolsToolModal({ toolId, label, text, phase, prefilled, notice, onClose }: ToolModal & { onClose: () => void }) {
  // Enquanto o modal está aberto, a ponte conversa com ele (uma cópia do devTools por vez)
  const frameRef = useCallback((el: HTMLIFrameElement) => {
    attachDevToolsFrame(el);
    return () => detachDevToolsFrame(el);
  }, []);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // captura: o Esc fecha só o modal, sem fechar o card por baixo
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* sem permissão */ });
  };

  return (
    <div className="fixed inset-0 z-[460] flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label={`devTools: ${label}`} className="flex flex-col w-[min(1000px,100%)] h-[min(760px,100%)] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm">
          <Wrench size={14} className="text-gray-400" />
          <span className="font-semibold text-gray-800 dark:text-gray-100">{label}</span>
          <span className="text-[10px] text-gray-400">devTools</span>
          {prefilled && (
            <span className="ml-3 flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
              <Check size={12} />
              Preenchido com o texto selecionado
            </span>
          )}
          <button onClick={onClose} title="Fechar (Esc)" className="ml-auto p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={15} />
          </button>
        </div>
        {notice && (
          <div className={`shrink-0 flex items-center gap-2 px-3 py-1.5 border-b text-xs ${
            notice.tone === 'ok'
              ? 'border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : notice.tone === 'erro'
                ? 'border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
          }`}>
            {notice.tone === 'aviso' ? <Loader2 size={12} className="animate-spin" /> : notice.tone === 'ok' ? <ClipboardCheck size={12} /> : <X size={12} />}
            {notice.text}
          </div>
        )}
        {phase === 'pronto' && !prefilled && !notice && text && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 text-xs">
            <span className="shrink-0 text-amber-700 dark:text-amber-300">Texto selecionado:</span>
            <code className="flex-1 min-w-0 truncate font-mono text-[11px] text-gray-700 dark:text-gray-200" title={text}>{text}</code>
            <button
              onClick={copy}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              {copied ? <ClipboardCheck size={12} /> : <Copy size={12} />}
              {copied ? 'Copiado: cole com Ctrl+V' : 'Copiar'}
            </button>
          </div>
        )}
        <div className="relative flex-1 min-h-0 bg-white">
          {(phase === 'preparando' || !loaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 text-xs">
              <Loader2 size={20} className="animate-spin" />
              {phase === 'preparando' && 'Preenchendo a ferramenta…'}
            </div>
          )}
          {phase === 'pronto' && (
            <iframe
              ref={frameRef}
              // embutido=1: o devTools mostra só a ferramenta, sem o menu (quando ele suportar)
              src={`${DEVTOOLS_URL}/ferramentas/${toolId}?embutido=1`}
              title={`devTools: ${label}`}
              allow="clipboard-read; clipboard-write"
              onLoad={() => setLoaded(true)}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface CropTarget { el: HTMLImageElement; top: number; left: number; width: number; height: number }

/** Sobre a imagem: arraste para marcar a parte com o texto; ao soltar, devolve a região. */
function CropOverlay({ crop, overlayRef, onCancel, onDone }: {
  crop: CropTarget;
  overlayRef: React.Ref<HTMLDivElement>;
  onCancel: () => void;
  onDone: (region: Region) => void;
}) {
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const pt = (e: React.PointerEvent) => ({
    x: Math.min(Math.max(e.clientX - crop.left, 0), crop.width),
    y: Math.min(Math.max(e.clientY - crop.top, 0), crop.height),
  });
  const sel = drag && {
    left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1),
    width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0),
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-label="Marcar parte da imagem"
      style={{ top: crop.top, left: crop.left, width: crop.width, height: crop.height }}
      className="fixed z-[445] cursor-crosshair overflow-hidden rounded select-none touch-none"
      onPointerDown={e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = pt(e);
        setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      }}
      onPointerMove={e => { if (drag) { const p = pt(e); setDrag(d => (d ? { ...d, x1: p.x, y1: p.y } : d)); } }}
      onPointerUp={() => {
        setDrag(null);
        if (!sel || sel.width < 8 || sel.height < 8) return;
        onDone({ x: sel.left / crop.width, y: sel.top / crop.height, w: sel.width / crop.width, h: sel.height / crop.height });
      }}
    >
      {sel ? (
        <div style={{ ...sel, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} className="absolute border-2 border-blue-400 rounded-sm" />
      ) : (
        <div className="absolute inset-0 bg-black/40" />
      )}
      {!drag && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/90 text-white text-xs shadow-lg whitespace-nowrap">
          <Crop size={13} />
          Arraste para marcar a parte com o texto
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={onCancel}
            className="ml-1 px-1.5 rounded bg-white/15 hover:bg-white/25"
          >
            Cancelar (Esc)
          </button>
        </div>
      )}
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
  const [modal, setModal] = useState<ToolModal | null>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const boxRef = useRef<HTMLDivElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  // o mouseup que termina o recorte não deve fechar o que ele acabou de abrir
  const ignoreUpUntil = useRef(0);
  const runSeq = useRef(0);
  // Imagem do card sob o mouse: mostra o botão "Texto da imagem"
  const [hoverImg, setHoverImg] = useState<{ el: HTMLImageElement; top: number; right: number } | null>(null);
  const imgBtnRef = useRef<HTMLDivElement>(null);
  // Marcando a parte da imagem que tem o texto (arrastar sobre a imagem)
  const [crop, setCrop] = useState<CropTarget | null>(null);

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

  /** anywhere: aberta pelo Alt+T, vale para seleção fora do card */
  const open = useCallback((anywhere: boolean) => {
    const sel = readSelection(!anywhere);
    if (!sel || sel.text.trim().length < 2) return false;
    const tools = suggestTools(sel.text);
    // calcula já a primeira reconhecida que o devTools sabe calcular (as só de tela esperam o clique)
    const autoRun = tools.find(t => t.detected && !t.openOnly);
    const r = sel.rect;
    setTextCopied(false);
    setAnchor({ text: sel.text.trim(), rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width }, tools });
    if (autoRun) run(autoRun);
    else { runSeq.current++; setResult({ state: 'idle' }); }
    return true;
  }, [run]);

  // Seleção com o mouse ou o teclado
  useEffect(() => {
    const onUp = (e: Event) => {
      if (boxRef.current?.contains(e.target as Node) || imgBtnRef.current?.contains(e.target as Node)) return;
      if (Date.now() < ignoreUpUntil.current) return;
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
      } else if (e.key === 'Escape' && cropRef.current) {
        e.stopPropagation();
        setCrop(null);
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

  // Passar o mouse numa imagem do card mostra o botão "Texto da imagem"
  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || imgBtnRef.current?.contains(t)) return;
      const img = t instanceof HTMLImageElement && t.closest(AREA) ? t : null;
      const r = img?.getBoundingClientRect();
      if (img && r && r.width >= 80 && r.height >= 40) {
        startDevToolsBridge(); // já deixa o devTools pronto para o clique
        setHoverImg(h => (h?.el === img ? h : { el: img, top: r.top, right: window.innerWidth - r.right }));
      } else {
        setHoverImg(null);
      }
    };
    const hide = () => { setHoverImg(null); setCrop(null); };
    document.addEventListener('mouseover', onOver);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', onOver);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  /**
   * Lê o texto da imagem com o devTools. Com a função lerImagem na API dele, o texto aparece
   * na caixinha; sem ela, a imagem vai copiada e a tela "Texto de imagem" dele abre no modal.
   */
  const readImage = (img: HTMLImageElement, region?: Region) => {
    setHoverImg(null);
    const png = loadImagePng(img.currentSrc || img.src, region);
    const bridge = getDevToolsBridgeState();
    if (bridge.status === 'pronto' && bridge.funcoes.includes('lerImagem')) {
      const r = img.getBoundingClientRect();
      const tool: ToolSuggestion = { fn: 'lerImagem', args: [], label: 'Texto da imagem', toolId: 'ocr', detected: true };
      const id = ++runSeq.current;
      setTextCopied(false);
      setAnchor({ text: '', rect: { top: Math.max(r.top, 60), bottom: r.bottom, left: r.left, width: r.width }, tools: [] });
      setResult({ state: 'loading', tool });
      png
        .then(b => callDevTools('lerImagem', b))
        .then(v => {
          if (runSeq.current !== id) return;
          const text = formatValue(v).trim();
          // o texto lido ganha as mesmas ações de um texto selecionado
          setAnchor(a => (a ? { ...a, text, tools: suggestTools(text) } : a));
          setResult({ state: 'ok', tool, text });
        })
        .catch((e: Error) => { if (runSeq.current === id) setResult({ state: 'erro', tool, message: e.message }); });
      return;
    }

    // Sem lerImagem: copia a imagem (ainda no clique, como o navegador exige) e abre a tela dele
    const copying = typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write
      ? navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      : Promise.reject(new Error('Este navegador não deixa copiar imagens'));
    const setNotice = (notice: ToolModal['notice']) =>
      setModal(m => (m && m.toolId === 'ocr' ? { ...m, notice } : m));
    close();
    setModal({ toolId: 'ocr', label: 'Texto de imagem', text: '', phase: 'pronto', prefilled: false, notice: { text: 'Copiando a imagem…', tone: 'aviso' } });
    copying.then(
      () => setNotice({ text: 'Imagem copiada: clique na área "Imagem" abaixo e cole com Ctrl+V', tone: 'ok' }),
      (e: Error) => setNotice({ text: `Não foi possível copiar a imagem: ${e.message}`, tone: 'erro' }),
    );
  };

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

  const startCrop = (img: HTMLImageElement) => {
    const r = img.getBoundingClientRect();
    setHoverImg(null);
    close();
    setCrop({ el: img, top: r.top, left: r.left, width: r.width, height: r.height });
  };

  const imageButton = hoverImg && !crop && (
    <div
      ref={imgBtnRef}
      onMouseLeave={e => { if (e.relatedTarget !== hoverImg.el) setHoverImg(null); }}
      style={{ top: hoverImg.top + 8, right: hoverImg.right + 8 }}
      className="fixed z-[440] flex items-center rounded-lg bg-gray-900/80 text-white text-xs shadow-lg backdrop-blur-sm overflow-hidden"
    >
      <button
        onClick={() => readImage(hoverImg.el)}
        title="Ler o texto da imagem inteira com o devTools"
        className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-gray-900"
      >
        <ScanText size={13} />
        Texto da imagem
      </button>
      <button
        onClick={() => startCrop(hoverImg.el)}
        title="Marcar só a parte da imagem que tem o texto"
        className="flex items-center gap-1.5 px-2.5 py-1 border-l border-white/20 hover:bg-gray-900"
      >
        <Crop size={13} />
        Só uma parte
      </button>
    </div>
  );

  const cropOverlay = crop && (
    <CropOverlay
      crop={crop}
      overlayRef={cropRef}
      onCancel={() => setCrop(null)}
      onDone={region => {
        const img = crop.el;
        ignoreUpUntil.current = Date.now() + 500;
        setCrop(null);
        readImage(img, region); // ainda no gesto do mouse: o navegador deixa copiar a imagem
      }}
    />
  );

  if (!anchor) return (imageButton || cropOverlay) ? <>{imageButton}{cropOverlay}</> : null;

  // Reconhecidas primeiro, depois as que valem para qualquer texto: todas sempre à vista
  const visible = anchor.tools;
  const current = result.state === 'idle' ? null : result.tool;

  const openInDevTools = (target?: ToolSuggestion) => {
    const tool = target ?? current ?? visible[0];
    if (!tool) return;
    const input = typeof tool.args[0] === 'string' ? tool.args[0] : anchor.text;
    const label = tool.label;
    close();
    window.getSelection()?.removeAllRanges();
    const base = { toolId: tool.toolId, label, text: input };
    // Já se sabe que este devTools não preenche: abre direto, com o texto à mão no topo
    const bridge = getDevToolsBridgeState();
    if (bridge.status === 'pronto' && !bridge.funcoes.includes('preencher')) {
      setModal({ ...base, phase: 'pronto', prefilled: false });
      return;
    }
    setModal({ ...base, phase: 'preparando', prefilled: false });
    const done = (prefilled: boolean) =>
      setModal(m => (m && m.toolId === base.toolId && m.phase === 'preparando' ? { ...m, phase: 'pronto', prefilled } : m));
    // Grava os campos da ferramenta (no devTools) antes de a tela dela abrir no modal
    Promise.race([
      callDevTools('preencher', tool.toolId, { [INPUT_FIELD[tool.toolId] ?? 'texto']: input }),
      new Promise((_, erro) => setTimeout(() => erro(new Error('tempo')), 6000)),
    ]).then(() => done(true), () => done(false));
  };

  return (
    <>
    {imageButton}
    {cropOverlay}
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
              onClick={() => (t.openOnly ? openInDevTools(t) : run(t))}
              title={t.openOnly ? 'Abre a tela da ferramenta no devTools, com o texto selecionado copiado' : undefined}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors ${
                current?.fn === t.fn && current.label === t.label
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : t.detected
                    ? 'border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 font-medium hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t.label}
              {t.openOnly && <Maximize2 size={9} className="opacity-60" />}
            </button>
          ))}
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
            onClick={() => openInDevTools()}
            title="Abre a tela completa da ferramenta, aqui mesmo, com o texto selecionado copiado"
            className="flex items-center gap-1 hover:text-blue-500"
          >
            <Maximize2 size={10} />
            Abrir no devTools
          </button>
        </div>
      )}
    </div>
    </>
  );
}
