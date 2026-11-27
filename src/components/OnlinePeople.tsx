import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import type { OnlinePerson, PresenceStatus } from '../services/presence';

const TELA: Record<string, string> = {
  quadro: 'no quadro',
  dashboard: 'no dashboard',
  devtools: 'no devTools',
};

function where(p: OnlinePerson): string {
  if (p.ausente) return 'ausente';
  const tela = TELA[p.tela] ?? '';
  if (p.card && p.editando) return `${p.editando} no #${p.card}`;
  return p.card ? `vendo o card #${p.card}` : tela;
}

function since(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

interface Props {
  people: OnlinePerson[];
  status: PresenceStatus;
  myLogin?: string;
  /** Clique numa pessoa: mostra só os cards dela */
  onPick?: (login: string) => void;
}

/** Canto inferior direito: quem da organização está com o git-calm aberto agora */
export function OnlinePeople({ people, status, myLogin, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  // sem Supabase configurado, ou "Aparecer como online" desligado: nada aparece
  if (status === 'desligado' || status === 'conectando') return null;

  const others = people
    .filter(p => p.login !== myLogin)
    .sort((a, b) => Number(a.ausente) - Number(b.ausente) || a.nome.localeCompare(b.nome));
  const me = people.find(p => p.login === myLogin);
  const ativos = others.filter(p => !p.ausente).length;

  return (
    // canto inferior direito, acima do rodapé (como os chats do Facebook); os avisos do canto ficam por cima
    <div className="fixed z-[45] right-4 bottom-12" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title={status === 'erro'
          ? 'Não foi possível ver quem está online agora (tentando de novo)'
          : others.length ? `${others.length} ${others.length === 1 ? 'pessoa online' : 'pessoas online'}` : 'Ninguém mais online agora'}
        className={`flex items-center gap-2 h-9 pl-2 pr-3 rounded-full border shadow-lg backdrop-blur-sm transition-colors ${
          open
            ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
            : 'bg-white/95 dark:bg-gray-800/95 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        {others.length > 0 ? (
          <span className="flex -space-x-2">
            {others.slice(0, 3).map(p => (
              <img
                key={p.login}
                src={p.avatar}
                alt=""
                className={`w-6 h-6 rounded-full ring-2 ring-white dark:ring-gray-800 ${p.ausente ? 'opacity-50 grayscale' : ''}`}
              />
            ))}
          </span>
        ) : (
          <Users size={15} className="text-gray-400 ml-0.5" />
        )}
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
          <span className={`w-2 h-2 rounded-full ${status === 'erro' ? 'bg-amber-400' : ativos ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          {others.length ? `${others.length} online` : 'Só você'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Online agora
          </p>
          {status === 'erro' && (
            <p className="px-3 pb-1.5 text-xs text-amber-600 dark:text-amber-400">Conexão instável: a lista pode estar desatualizada.</p>
          )}
          {others.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Só você está com o git-calm aberto agora.</p>
          )}
          <ul className="max-h-80 overflow-y-auto">
            {[...others, ...(me ? [me] : [])].map(p => {
              const isMe = p.login === myLogin;
              return (
                <li key={p.login}>
                  <button
                    onClick={() => { if (!isMe && onPick) { onPick(p.login); setOpen(false); } }}
                    disabled={isMe || !onPick}
                    title={isMe ? undefined : `Mostrar só os cards de ${p.nome}`}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left ${isMe ? 'cursor-default' : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'}`}
                  >
                    <span className="relative shrink-0">
                      <img src={p.avatar} alt="" className={`w-7 h-7 rounded-full ${p.ausente ? 'opacity-50 grayscale' : ''}`} />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${p.ausente ? 'bg-gray-300 dark:bg-gray-500' : 'bg-green-500'}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-800 dark:text-gray-100 truncate">
                        {p.nome}{isMe && <span className="text-gray-400"> (você)</span>}
                      </span>
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500 truncate">
                        {[where(p), `aberto ${since(p.desde)}`, p.abas > 1 ? `${p.abas} abas` : ''].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-3 pt-1.5 pb-1 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500">
            Só membros da organização veem esta lista. Para não aparecer: Configurações › Conta.
          </p>
        </div>
      )}
    </div>
  );
}
