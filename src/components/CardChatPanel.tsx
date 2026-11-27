import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessagesSquare, Send, Trash2 } from 'lucide-react';
import {
  CHAT_RETENTION_DAYS,
  deleteCardMessage,
  listCardMessages,
  postCardMessage,
  type ChatAuthor,
  type ChatMessage,
} from '../services/cardChat';
import { onOrgEvent } from '../services/orgEvents';
import { presenceCardKey, setPresenceEditing } from '../services/presence';
import { useMentionAutocomplete, type MentionUser } from './MentionAutocomplete';

interface Props {
  token: string;
  org: string;
  card: { number: number; repo?: string; title: string };
  me: ChatAuthor;
  mentionUsers: MentionUser[];
  onMentionActivate?: () => void;
  /** Quantas mensagens a conversa tem (para o número na aba) */
  onCount?: (n: number) => void;
}

const time = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/** Texto com as menções em destaque */
function Texto({ texto, me }: { texto: string; me: string }) {
  const parts = texto.split(/(@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/g);
  return (
    <>
      {parts.map((p, i) => p.startsWith('@')
        ? <span key={i} className={`font-semibold ${p.slice(1).toLowerCase() === me.toLowerCase() ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded px-0.5' : 'text-blue-600 dark:text-blue-400'}`}>{p}</span>
        : <span key={i}>{p}</span>)}
    </>
  );
}

function errorText(e: unknown): string {
  const err = e as { code?: string; status?: number; message?: string };
  if (err?.code === '42P01' || err?.code === 'PGRST205' || err?.status === 404) {
    return 'A conversa ainda não foi configurada no Supabase (falta rodar supabase/conversa-e-daily.sql).';
  }
  if (err?.message === 'Supabase não configurado') return 'A conversa precisa do Supabase, que não está configurado neste servidor.';
  return `Não foi possível carregar a conversa: ${err?.message ?? e}`;
}

/**
 * Aba "Conversa" do card: mensagens da equipe sobre o card, guardadas no git-calm por 30 dias e
 * que não vão para o GitHub. Mencionar alguém com @ avisa a pessoa na tela dela.
 */
export function CardChatPanel({ token, org, card, me, mentionUsers, onMentionActivate, onCount }: Props) {
  const cardKey = presenceCardKey(card.repo, card.number);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [erro, setErro] = useState('');
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const users = useMemo(() => mentionUsers.filter(u => u.login.toLowerCase() !== me.login.toLowerCase()), [mentionUsers, me.login]);
  const mention = useMentionAutocomplete({ textareaRef, value: texto, onChange: setTexto, users, onActivate: onMentionActivate, above: true });

  useEffect(() => {
    let alive = true;
    listCardMessages(token, org, card)
      .then(list => { if (alive) { setMessages(list); setErro(''); } })
      .catch(e => { if (alive) { setMessages([]); setErro(errorText(e)); } });
    const off = onOrgEvent(e => {
      if (e.tipo === 'chat' && e.msg.card_key === cardKey) {
        setMessages(prev => (prev && !prev.some(m => m.id === e.msg.id) ? [...prev, e.msg] : prev));
      } else if (e.tipo === 'chat-apagada' && e.cardKey === cardKey) {
        setMessages(prev => prev?.filter(m => m.id !== e.id) ?? prev);
      }
    });
    return () => { alive = false; off(); };
  }, [token, org, cardKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (messages) onCount?.(messages.length); }, [messages, onCount]);

  // sempre na mensagem mais recente
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // quem mais está no card vê que estou escrevendo
  const writing = !!texto.trim();
  useEffect(() => {
    setPresenceEditing('conversa', writing ? 'escrevendo na conversa' : null);
    return () => setPresenceEditing('conversa', null);
  }, [writing]);

  const send = async () => {
    const t = texto.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const msg = await postCardMessage(token, org, card, me, t);
      setMessages(prev => [...(prev ?? []), msg]);
      setTexto('');
      setErro('');
    } catch (e) {
      setErro(errorText(e).replace('carregar', 'enviar'));
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const remove = async (m: ChatMessage) => {
    if (!window.confirm('Apagar esta mensagem da conversa?')) return;
    try {
      await deleteCardMessage(token, org, m);
      setMessages(prev => prev?.filter(x => x.id !== m.id) ?? prev);
    } catch (e) {
      setErro(errorText(e).replace('carregar', 'apagar'));
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages === null && (
          <p className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={13} className="animate-spin" /> Carregando a conversa…</p>
        )}
        {messages?.length === 0 && !erro && (
          <div className="text-center px-4 py-8 text-gray-400 dark:text-gray-500">
            <MessagesSquare size={28} className="mx-auto mb-2 opacity-60" />
            <p className="text-xs">
              Converse com a equipe sobre este card sem comentar no GitHub. Use @ para chamar alguém: a pessoa recebe o aviso na tela.
            </p>
          </div>
        )}
        {messages?.map(m => {
          const mine = m.autor.toLowerCase() === me.login.toLowerCase();
          return (
            <div key={m.id} className="group flex gap-2">
              <img src={m.autor_avatar || `https://github.com/${m.autor}.png?size=48`} alt="" className="w-6 h-6 rounded-full shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{m.autor_nome || m.autor}</span>
                  <span className="text-[10px] text-gray-400 shrink-0" title={new Date(m.criado_em).toLocaleString('pt-BR')}>{time(m.criado_em)}</span>
                  {mine && (
                    <button
                      onClick={() => remove(m)}
                      title="Apagar mensagem"
                      className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                  <Texto texto={m.texto} me={me.login} />
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 p-2 space-y-1.5 bg-white dark:bg-gray-800">
        {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
        <div className="relative flex items-end gap-1.5">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => { setTexto(e.target.value); mention.refresh(); }}
            onClick={mention.refresh}
            onKeyUp={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') mention.refresh(); }}
            onKeyDown={e => {
              if (mention.handleKeyDown(e)) return;
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Escreva para a equipe… (@ para mencionar)"
            className="flex-1 resize-none px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500"
          />
          {mention.popup}
          <button
            onClick={send}
            disabled={!texto.trim() || sending}
            title="Enviar (Enter); Shift+Enter quebra a linha"
            className="shrink-0 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          Fica no git-calm por {CHAT_RETENTION_DAYS} dias e não vai para o GitHub. Só quem é da organização vê.
        </p>
      </div>
    </div>
  );
}
