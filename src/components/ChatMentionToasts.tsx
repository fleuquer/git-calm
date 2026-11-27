import { useEffect, useRef, useState } from 'react';
import { AtSign, X } from 'lucide-react';
import {
  getMentionsSeenAt,
  listMyMentions,
  setMentionsSeenAt,
  type ChatMessage,
} from '../services/cardChat';
import { onOrgEvent } from '../services/orgEvents';

interface Props {
  token: string;
  org: string;
  myLogin?: string;
  /** Card aberto agora ("repositório#número"): menção nele não precisa de aviso */
  openCardKey?: string;
  /** O canal de eventos está ligado (Supabase configurado) */
  enabled: boolean;
  onOpen: (msg: ChatMessage) => void;
}

const MAX = 4;

/**
 * Avisos de menção na conversa dos cards: "Ana te mencionou na conversa do #123". Chegam na
 * hora para quem está com o git-calm aberto; quem estava fora vê ao abrir o git-calm.
 */
export function ChatMentionToasts({ token, org, myLogin, openCardKey, enabled, onOpen }: Props) {
  const [items, setItems] = useState<ChatMessage[]>([]);
  const openRef = useRef(openCardKey);
  useEffect(() => { openRef.current = openCardKey; }, [openCardKey]);
  const onOpenRef = useRef(onOpen);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);

  useEffect(() => {
    if (!enabled || !myLogin || !token || !org) return;
    const me = myLogin.toLowerCase();
    let alive = true;
    const push = (list: ChatMessage[]) =>
      setItems(prev => {
        const ids = new Set(prev.map(m => m.id));
        return [...list.filter(m => !ids.has(m.id)), ...prev].slice(0, 20);
      });

    // o que chegou enquanto estava fora
    listMyMentions(token, org, me, getMentionsSeenAt(org, me))
      .then(list => { if (alive) push(list.filter(m => m.autor.toLowerCase() !== me)); })
      .catch(() => { /* sem a tabela ainda: só os avisos ao vivo */ });

    const off = onOrgEvent(e => {
      if (e.tipo !== 'chat' || !e.msg.mencoes.includes(me) || e.msg.autor.toLowerCase() === me) return;
      // já está com o card aberto: vê a mensagem lá
      if (openRef.current === e.msg.card_key) { setMentionsSeenAt(org, me, e.msg.criado_em); return; }
      push([e.msg]);
      if (document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification(`${e.msg.autor_nome || e.msg.autor} te mencionou no #${e.msg.card_numero}`, {
            body: e.msg.texto.slice(0, 140),
            icon: `${window.location.origin}/favicon.svg`,
          });
          n.onclick = () => { window.focus(); onOpenRef.current(e.msg); n.close(); };
        } catch { /* fica só o aviso na tela */ }
      }
    });
    return () => { alive = false; off(); };
  }, [enabled, myLogin, token, org]);

  const dismiss = (m: ChatMessage) => {
    setItems(prev => prev.filter(x => x.id !== m.id));
    if (myLogin) setMentionsSeenAt(org, myLogin, m.criado_em);
  };
  const open = (m: ChatMessage) => {
    // abrir um card resolve as menções dele
    setItems(prev => prev.filter(x => x.card_key !== m.card_key));
    if (myLogin) setMentionsSeenAt(org, myLogin, m.criado_em);
    onOpen(m);
  };
  const dismissAll = () => {
    if (myLogin && items.length) setMentionsSeenAt(org, myLogin, items.reduce((a, m) => (m.criado_em > a ? m.criado_em : a), ''));
    setItems([]);
  };

  if (!items.length) return null;
  const shown = items.slice(0, MAX);

  return (
    <div className="fixed z-[60] right-4 bottom-24 w-[min(340px,calc(100vw-2rem))] space-y-2">
      {shown.map(m => (
        <div key={m.id} role="status" className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-gray-800 shadow-xl p-3">
          <div className="flex items-start gap-2.5">
            <span className="relative shrink-0">
              <img src={m.autor_avatar || `https://github.com/${m.autor}.png?size=48`} alt="" className="w-8 h-8 rounded-full" />
              <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-amber-500 text-white"><AtSign size={9} /></span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <strong className="text-gray-800 dark:text-gray-100">{m.autor_nome || m.autor}</strong> te mencionou na conversa do{' '}
                <strong className="text-gray-800 dark:text-gray-100">#{m.card_numero}</strong>
              </p>
              {m.card_titulo && <p className="text-[11px] text-gray-400 truncate">{m.card_titulo}</p>}
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 line-clamp-3 whitespace-pre-wrap break-words">{m.texto}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => open(m)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium"
                >
                  Abrir e responder
                </button>
                <span className="text-[10px] text-gray-400">
                  {new Date(m.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <button onClick={() => dismiss(m)} title="Dispensar" className="p-0.5 text-gray-300 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
      {items.length > MAX && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-900/85 text-white text-xs">
          <span>e mais {items.length - MAX} {items.length - MAX === 1 ? 'menção' : 'menções'}</span>
          <button onClick={dismissAll} className="underline">Dispensar todas</button>
        </div>
      )}
    </div>
  );
}
