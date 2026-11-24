import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleDot, CircleSlash, EyeOff, Link2, Loader2, Sparkles } from 'lucide-react';
import { GitHubService, type SearchedIssue } from '../services/github';
import type { ProjectCard } from '../types';
import type { IssueLinkRef } from '../utils/issueLinks';
import { cardMeta, keyTerms, rankSimilar, type Match } from '../utils/similarity';

interface Candidate {
  number: number;
  title: string;
  body: string;
  url: string;
  owner: string;
  repo: string;
  state: 'OPEN' | 'CLOSED';
  stateReason?: string;
  status?: string;
  /** Campos do quadro, cidade, etiquetas e repositório (reforçam a semelhança) */
  meta: string[];
}

interface Props {
  token: string;
  org: string;
  card: ProjectCard;
  /** Cards do quadro (comparados sem precisar buscar) */
  boardCards: ProjectCard[];
  /** Cards já vinculados a este (não sugerir de novo), como "repo#número" */
  linked: Set<string>;
  onOpen?: (ref: IssueLinkRef) => void;
  /** Um vínculo foi criado: recarregar "Cards vinculados" */
  onLinked: () => void;
}

type LinkKind = 'filho' | 'pai' | 'bloqueado-por' | 'bloqueia';
const LINK_OPTIONS: Array<{ kind: LinkKind; label: string }> = [
  { kind: 'filho', label: 'Sub-issue deste card' },
  { kind: 'pai', label: 'Card pai deste card' },
  { kind: 'bloqueado-por', label: 'Bloqueia este card' },
  { kind: 'bloqueia', label: 'É bloqueado por este card' },
];

const IGNORED_KEY = 'gitcalm_related_ignored';
const keyOf = (c: { repo?: string; number: number }) => `${(c.repo ?? '').toLowerCase()}#${c.number}`;

function loadIgnored(cardKey: string): Set<string> {
  try {
    const all = JSON.parse(localStorage.getItem(IGNORED_KEY) ?? '{}');
    return new Set(Array.isArray(all[cardKey]) ? all[cardKey] : []);
  } catch {
    return new Set();
  }
}

function saveIgnored(cardKey: string, set: Set<string>) {
  try {
    const all = JSON.parse(localStorage.getItem(IGNORED_KEY) ?? '{}');
    all[cardKey] = [...set];
    localStorage.setItem(IGNORED_KEY, JSON.stringify(all));
  } catch { /* ignora */ }
}

/**
 * Cards possivelmente relacionados (issue #11, etapa sem IA): compara o título e a descrição com
 * os cards do quadro e com a busca do GitHub na organização (abertos e fechados), mostra os termos
 * em comum e permite vincular (sub-issue, pai, dependência) ou ignorar a sugestão.
 */
export function RelatedSuggestions({ token, org, card, boardCards, linked, onOpen, onLinked }: Props) {
  const cardKey = keyOf(card);
  // quadro de quando o card abriu: a comparação não refaz a cada atualização da tela do card
  const [board] = useState(() => boardCards);
  const [searched, setSearched] = useState<SearchedIssue[] | null>(null);
  const [ignored, setIgnored] = useState(() => loadIgnored(cardKey));
  const [showAll, setShowAll] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [done, setDone] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // Busca no GitHub pelos termos mais característicos do card
  useEffect(() => {
    let alive = true;
    const terms = keyTerms({ title: card.title, body: card.body });
    new GitHubService(token).searchOrgIssues(org, terms)
      .then(r => { if (alive) setSearched(r); })
      .catch(() => { if (alive) setSearched([]); }); // limite da busca ou sem acesso: fica só com o quadro
    return () => { alive = false; };
  }, [token, org, card.title, card.body]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const cardMetaList = cardMeta(card);
  const cardMetaKey = cardMetaList.join('|');
  const matches: Match<Candidate>[] = useMemo(() => {
    if (!searched) return [];
    const byKey = new Map<string, Candidate>();
    for (const c of board) {
      if (!c.repo || !c.title) continue;
      byKey.set(keyOf(c), {
        number: c.number, title: c.title, body: c.body ?? '', url: c.url, owner: org, repo: c.repo,
        state: c.issueState === 'CLOSED' ? 'CLOSED' : 'OPEN', status: c.status, meta: cardMeta(c),
      });
    }
    for (const s of searched) {
      const k = keyOf(s);
      const onBoard = byKey.get(k);
      // card que também está no quadro: descrição completa e campos do quadro
      byKey.set(k, onBoard ? { ...s, body: onBoard.body || s.body, status: onBoard.status, meta: onBoard.meta } : { ...s, meta: cardMeta(s) });
    }
    const skip = (k: string) => k === cardKey || linked.has(k) || ignored.has(k) || done.has(k);
    const candidates = [...byKey.entries()].filter(([k]) => !skip(k)).map(([, c]) => c);
    return rankSimilar({ title: card.title, body: card.body, meta: cardMetaList }, candidates, { limit: 6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cardMetaList muda junto com cardMetaKey
  }, [searched, board, org, cardKey, linked, ignored, done, card.title, card.body, cardMetaKey]);

  const link = async (m: Match<Candidate>, kind: LinkKind) => {
    const k = keyOf(m.item);
    setMenu(null);
    setLinking(k);
    setErro('');
    try {
      await new GitHubService(token).linkIssues(
        kind,
        { owner: org, repo: card.repo ?? '', number: card.number },
        { owner: m.item.owner, repo: m.item.repo, number: m.item.number },
      );
      setDone(prev => new Set(prev).add(k));
      onLinked();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(`Não foi possível vincular #${m.item.number}: ${/parent/i.test(msg) ? 'o card já tem um card pai.' : msg}`);
    } finally {
      setLinking(null);
    }
  };

  const ignore = (m: Match<Candidate>) => {
    const next = new Set(ignored).add(keyOf(m.item));
    setIgnored(next);
    saveIgnored(cardKey, next);
  };

  if (!card.repo) return null;
  if (!searched) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 size={12} className="animate-spin" /> Procurando cards parecidos…
      </div>
    );
  }
  if (!matches.length) return null;

  const visible = showAll ? matches : matches.slice(0, 3);

  return (
    <div>
      <h4
        className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1.5"
        title="Comparação pelas palavras do título e da descrição com os cards do quadro e da organização (abertos e fechados)"
      >
        <Sparkles size={12} /> Possivelmente relacionados
      </h4>
      <div className="space-y-1.5">
        {visible.map(m => {
          const c = m.item;
          const k = keyOf(c);
          const closed = c.state === 'CLOSED';
          const notPlanned = closed && (c.stateReason === 'not_planned' || c.stateReason === 'NOT_PLANNED' || c.stateReason === 'duplicate');
          const Icon = notPlanned ? CircleSlash : closed ? CheckCircle2 : CircleDot;
          const color = notPlanned ? 'text-gray-400' : closed ? 'text-purple-500' : 'text-green-600 dark:text-green-500';
          const strong = m.score >= 0.4;
          return (
            <div key={k} className="group relative rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1.5">
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => {
                  if (!onOpen || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onOpen({ owner: c.owner, repo: c.repo, number: c.number, kind: 'issue', url: c.url });
                }}
                className="flex items-start gap-2 pr-14"
                title={`${c.owner}/${c.repo}#${c.number} ${c.title}`}
              >
                <Icon size={13} className={`${color} shrink-0 mt-0.5`} />
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs line-clamp-2 ${closed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                    <span className="font-mono text-gray-400 mr-1">{c.repo === card.repo ? '' : c.repo}#{c.number}</span>
                    {c.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 mt-0.5">
                    <span
                      className={`px-1.5 py-px rounded text-[10px] ${strong ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                      title={`Semelhança: ${Math.round(m.score * 100)}%`}
                    >
                      {strong ? 'Muito parecido: possível duplicidade' : 'Parecido'}
                    </span>
                    {c.status && <span className="px-1.5 py-px rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300">{c.status}</span>}
                  </span>
                  {m.shared.length > 0 && (
                    <span className="block mt-0.5 text-[10px] text-gray-400 truncate" title={m.shared.join(', ')}>em comum: {m.shared.join(', ')}</span>
                  )}
                  {m.sameFields.length > 0 && (
                    <span className="block text-[10px] text-gray-400 truncate" title={m.sameFields.join(' · ')}>mesmo {m.sameFields.join(' · ')}</span>
                  )}
                </span>
              </a>

              <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
                <button
                  onClick={() => ignore(m)}
                  title="Não é relacionado: não sugerir mais"
                  className="p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <EyeOff size={12} />
                </button>
                <div className="relative" ref={menu === k ? menuRef : undefined}>
                  <button
                    onClick={() => setMenu(menu === k ? null : k)}
                    disabled={!!linking}
                    title="Vincular este card"
                    className="flex items-center gap-0.5 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-40"
                  >
                    {linking === k ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                    <ChevronDown size={10} />
                  </button>
                  {menu === k && (
                    <div className="absolute right-0 top-full mt-1 z-10 w-52 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                      <p className="px-3 py-1 text-[10px] uppercase text-gray-400">#{c.number} é…</p>
                      {LINK_OPTIONS.map(o => (
                        <button
                          key={o.kind}
                          onClick={() => link(m, o.kind)}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {matches.length > 3 && (
        <button onClick={() => setShowAll(v => !v)} className="mt-1.5 text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
          {showAll ? 'Mostrar menos' : `Ver mais ${matches.length - 3}`}
        </button>
      )}
      {erro && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  );
}
