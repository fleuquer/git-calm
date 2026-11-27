import { Presentation, X } from 'lucide-react';
import { useState } from 'react';
import type { DailyInfo } from '../hooks/useDaily';
import type { OnlinePerson } from '../services/presence';

interface Props {
  daily: DailyInfo;
  people: OnlinePerson[];
  myLogin?: string;
}

/**
 * Faixa da daily, logo abaixo do cabeçalho: quem conduz vê quantos estão seguindo e encerra;
 * os outros veem quem está conduzindo e escolhem seguir.
 */
export function DailyBanner({ daily, people, myLogin }: Props) {
  // "agora não" vale só para esta daily (outra pessoa conduzindo depois aparece de novo)
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);

  if (daily.leading) {
    const followers = people.filter(p => p.seguindo === myLogin && p.login !== myLogin);
    return (
      <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 bg-indigo-600 text-white text-sm">
        <Presentation size={15} className="shrink-0" />
        <span className="font-medium whitespace-nowrap">Você está conduzindo a daily.</span>
        <span className="hidden xl:inline text-indigo-100 text-xs truncate">Quem seguir vê no git-calm dele a tela, a aba, os filtros e os cards que você abrir.</span>
        <span className="ml-auto shrink-0 flex items-center gap-2">
          {followers.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs whitespace-nowrap" title={followers.map(p => p.nome).join(', ')}>
              <span className="flex -space-x-1.5">
                {followers.slice(0, 5).map(p => <img key={p.login} src={p.avatar} alt="" className="w-5 h-5 rounded-full ring-2 ring-indigo-600" />)}
              </span>
              {followers.length} seguindo
            </span>
          )}
          {followers.length === 0 && <span className="text-xs text-indigo-200 whitespace-nowrap">ninguém seguindo ainda</span>}
          <button onClick={daily.stop} className="whitespace-nowrap px-2.5 py-0.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-medium">
            Encerrar daily
          </button>
        </span>
      </div>
    );
  }

  if (!daily.other) return null;
  const { lider } = daily.other;

  if (daily.following) {
    return (
      <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 bg-indigo-600 text-white text-sm">
        <img src={lider.avatar} alt="" className="w-5 h-5 rounded-full ring-2 ring-white/40" />
        <span className="truncate">
          Seguindo <strong>{lider.nome}</strong> na daily: o seu git-calm acompanha o que {lider.nome.split(' ')[0]} abre.
        </span>
        <button onClick={daily.unfollow} className="ml-auto shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-medium">
          Parar de seguir
        </button>
      </div>
    );
  }

  if (hiddenFor === lider.login) return null;
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-200 dark:border-indigo-500/30 text-sm text-indigo-900 dark:text-indigo-200">
      <img src={lider.avatar} alt="" className="w-5 h-5 rounded-full" />
      <span>
        <strong>{lider.nome}</strong> está conduzindo a daily.
      </span>
      <button onClick={daily.follow} className="px-2.5 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium">
        Seguir
      </button>
      <button onClick={() => setHiddenFor(lider.login)} title="Agora não" className="ml-auto p-0.5 text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-100">
        <X size={14} />
      </button>
    </div>
  );
}
