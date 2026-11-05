import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Search, GitBranch, GitCommit, GitPullRequest, GitMerge, Loader2, ExternalLink, Copy, Check,
  CircleCheck, CircleDashed, Archive, Info, ArrowLeft,
} from 'lucide-react';
import type { ProjectCard } from '../types';
import {
  searchRefs, getBranchDetail, getCommitDetail, issueNumbersIn, looksLikeSha, MIN_QUERY_LENGTH,
  type RefSearchResult, type BranchHit, type CommitHit, type BranchDetail, type CommitDetail,
  type BaseStatus, type PullRequestInfo, type RefCommit,
} from '../services/refSearch';
import { normalizeTitleCase } from '../utils/titleCase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  org: string;
  /** Texto a buscar ao abrir (ex: vindo da busca do cabeçalho) */
  initialQuery?: string;
  /** Muda a cada abertura, para refazer a busca mesmo com o mesmo texto */
  openKey?: number;
  findCardsByNumber: (num: number) => ProjectCard[];
  onOpenCard: (ref: { number: number; repo?: string; url: string }) => void;
}

type Selected =
  | { kind: 'branch'; hit: BranchHit }
  | { kind: 'commit'; hit: CommitHit };

type Detail =
  | { kind: 'branch'; data: BranchDetail }
  | { kind: 'commit'; data: CommitDetail };

// ── Pequenos utilitários de exibição ────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(m, 1)}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-yellow-200/80 dark:bg-yellow-500/30 text-inherit rounded-[2px]">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
};

const CopyButton: React.FC<{ value: string; title: string }> = ({ value, title }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
      className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title={copied ? 'Copiado!' : title}
    >
      {copied ? <Check size={13} className="text-green-600 dark:text-green-400" /> : <Copy size={13} />}
    </button>
  );
};

const PR_STATE: Record<PullRequestInfo['state'], { label: string; className: string; Icon: typeof GitPullRequest }> = {
  OPEN: { label: 'Aberto', className: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30', Icon: GitPullRequest },
  MERGED: { label: 'Merged', className: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30', Icon: GitMerge },
  CLOSED: { label: 'Fechado', className: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30', Icon: GitPullRequest },
};

const PrChip: React.FC<{ state: PullRequestInfo['state']; number: number }> = ({ state, number }) => {
  const s = PR_STATE[state] ?? PR_STATE.CLOSED;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px] font-medium ${s.className}`}>
      <s.Icon size={10} /> #{number} {s.label}
    </span>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">{children}</p>
);

// ── Blocos do detalhe ───────────────────────────────────────────────────────────────────────
const BasesStatus: React.FC<{ bases: BaseStatus[]; subject: 'branch' | 'commit' }> = ({ bases, subject }) => {
  if (bases.length === 0) return null;
  return (
    <div>
      <SectionTitle>Onde já está</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {bases.map(b => (
          <span
            key={b.name}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border ${
              b.contained
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-400'
            }`}
            title={b.contained
              ? `${b.name} já contém ${subject === 'branch' ? 'todos os commits desta branch' : 'este commit'}`
              : subject === 'branch'
                ? `${b.missing} commit(s) desta branch ainda não estão em ${b.name}`
                : `Este commit ainda não está em ${b.name}`}
          >
            {b.contained ? <CircleCheck size={12} /> : <CircleDashed size={12} />}
            <span className="font-medium">{b.name}</span>
            {b.isDefault && <span className="text-[10px] opacity-70">(principal)</span>}
            {!b.contained && subject === 'branch' && <span className="text-[10px]">faltam {b.missing}</span>}
          </span>
        ))}
      </div>
    </div>
  );
};

const PrList: React.FC<{ prs: PullRequestInfo[]; onSearchBranch?: (name: string) => void }> = ({ prs, onSearchBranch }) => {
  if (prs.length === 0) return null;
  return (
    <div>
      <SectionTitle>Pull requests</SectionTitle>
      <ul className="space-y-1.5">
        {prs.map(pr => (
          <li key={pr.url} className="text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <PrChip state={pr.state} number={pr.number} />
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className="truncate text-gray-800 dark:text-gray-200 hover:underline">{pr.title}</a>
            </div>
            {pr.headRefName && pr.baseRefName && (
              <p className="mt-0.5 pl-1 text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">
                {pr.baseRefName} ←{' '}
                {onSearchBranch ? (
                  <button onClick={() => onSearchBranch(pr.headRefName!)} className="hover:underline text-blue-600 dark:text-blue-400" title="Buscar esta branch">
                    {pr.headRefName}
                  </button>
                ) : pr.headRefName}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const CommitRow: React.FC<{ c: RefCommit }> = ({ c }) => (
  <li className="flex items-start gap-2 py-1.5 text-xs">
    <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline shrink-0 mt-px">{c.shortOid}</a>
    <div className="min-w-0 flex-1">
      <p className="text-gray-800 dark:text-gray-200 truncate" title={c.message}>{c.message}</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">{c.author} · {timeAgo(c.date)}</p>
    </div>
  </li>
);

// ── Componente principal ────────────────────────────────────────────────────────────────────
export const RefSearchModal: React.FC<Props> = ({ isOpen, onClose, token, org, initialQuery, openKey, findCardsByNumber, onOpenCard }) => {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [result, setResult] = useState<RefSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);
  const detailSeq = useRef(0);

  const runSearch = async (text: string) => {
    const q = text.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setError(`Digite pelo menos ${MIN_QUERY_LENGTH} caracteres.`);
      return;
    }
    const seq = ++searchSeq.current;
    setQuery(q);
    setLoading(true);
    setError(null);
    setSelected(null);
    setDetail(null);
    try {
      const res = await searchRefs(token, org, q);
      if (seq !== searchSeq.current) return;
      setResult(res);
      setSearchedQuery(q);
      // Um único resultado: já abre o detalhe
      const only = res.branches.length + res.commits.length === 1;
      if (only) select(res.branches[0] ? { kind: 'branch', hit: res.branches[0] } : { kind: 'commit', hit: res.commits[0] });
    } catch (err) {
      if (seq !== searchSeq.current) return;
      console.error('Erro na busca de branches/commits:', err);
      setError('Não foi possível buscar agora. Verifique a conexão ou tente de novo em instantes.');
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  };

  const select = async (sel: Selected) => {
    const seq = ++detailSeq.current;
    setSelected(sel);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const d: Detail = sel.kind === 'branch'
        ? { kind: 'branch', data: await getBranchDetail(token, org, sel.hit.repo, sel.hit.name) }
        : { kind: 'commit', data: await getCommitDetail(token, org, sel.hit.repo, sel.hit.oid) };
      if (seq === detailSeq.current) setDetail(d);
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
      if (seq === detailSeq.current) setDetailError('Não foi possível carregar os detalhes.');
    } finally {
      if (seq === detailSeq.current) setDetailLoading(false);
    }
  };

  // Ao abrir: busca o texto recebido (ou só foca o campo)
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      const q = initialQuery?.trim();
      if (q && q.length >= MIN_QUERY_LENGTH) runSearch(q);
      else if (q) setQuery(q);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, openKey]);

  // Esc fecha
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Cards ligados ao item selecionado: issues fechadas pelos PRs, "#N" nas mensagens e número no nome da branch
  const linkedCards = useMemo(() => {
    if (!selected) return [];
    const out: { number: number; repo?: string; title: string; url: string; status?: string }[] = [];
    const seen = new Set<string>();
    const push = (c: { number: number; repo?: string; title: string; url: string; status?: string }) => {
      const key = `${c.repo ?? ''}#${c.number}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(c);
    };
    const fromBoard = (n: number) => findCardsByNumber(n).forEach(card =>
      push({ number: card.number, repo: card.repo, title: card.title, url: card.url, status: card.status }));

    for (const pr of detail?.data.prs ?? []) {
      for (const issue of pr.closingIssues) {
        const onBoard = findCardsByNumber(issue.number).find(c => (c.repo ?? '').toLowerCase() === issue.repo.toLowerCase());
        push({ number: issue.number, repo: issue.repo, title: onBoard?.title ?? issue.title, url: issue.url, status: onBoard?.status });
      }
    }
    if (selected.kind === 'branch') {
      issueNumbersIn(selected.hit.name, { bare: true }).forEach(fromBoard);
      if (detail?.kind === 'branch') detail.data.aheadCommits.forEach(c => issueNumbersIn(c.message).forEach(fromBoard));
    } else {
      issueNumbersIn(detail?.kind === 'commit' ? detail.data.fullMessage : selected.hit.message).forEach(fromBoard);
    }
    return out;
  }, [selected, detail, findCardsByNumber]);

  if (!isOpen) return null;

  const total = result ? result.branches.length + result.commits.length : 0;
  const isSelected = (kind: Selected['kind'], repo: string, id: string) =>
    selected?.kind === kind && selected.hit.repo === repo && (kind === 'branch' ? (selected.hit as BranchHit).name : (selected.hit as CommitHit).oid) === id;

  const rowClass = (active: boolean) => `w-full text-left px-3 py-2 rounded-md transition-colors ${
    active ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
  }`;

  const searchBranch = (name: string) => { setQuery(name); runSearch(name); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
        {/* Cabeçalho com o campo de busca */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <GitBranch className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
          <form
            className="flex-1 flex items-center gap-2 min-w-0"
            onSubmit={(e) => { e.preventDefault(); runSearch(query); }}
          >
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Parte do nome da branch, texto do commit ou hash…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 shrink-0"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Buscar'}
            </button>
          </form>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0" title="Fechar (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Corpo: resultados à esquerda, detalhe à direita */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Resultados */}
          <div className={`min-h-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 p-2 ${selected ? 'hidden md:block' : ''}`}>
            {error && <p className="m-2 px-3 py-2 rounded-md text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">{error}</p>}

            {loading && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 size={20} className="animate-spin text-blue-500" />
                Procurando em todos os repositórios da organização…
              </div>
            )}

            {!loading && !result && !error && (
              <div className="px-4 py-10 text-xs text-gray-500 dark:text-gray-400 space-y-2">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Procure em todos os repositórios de {org}:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Branch</strong> por qualquer parte do nome (ex: <code>ajuste-guia</code>, <code>812</code>)</li>
                  <li><strong>Commit</strong> por palavras da mensagem, em qualquer ordem e sem diferenciar acentos (ex: <code>corrige juros</code>)</li>
                  <li><strong>Commit</strong> pelo hash, mesmo abreviado (ex: <code>a1b2c3d</code>)</li>
                </ul>
                <p>Ao selecionar um resultado você vê o repositório, em quais branches base (develop, homolog, master…) ele já está, os commits, PRs e o card ligado.</p>
              </div>
            )}

            {!loading && result && (
              <>
                <p className="px-3 pt-1 pb-2 text-[11px] text-gray-400 dark:text-gray-500">
                  {total === 0 ? 'Nada encontrado' : `${total} resultado(s)`} para “{searchedQuery}” em {result.reposScanned} repositórios
                </p>

                {result.branches.length > 0 && (
                  <div className="mb-3">
                    <p className="px-3 py-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      <GitBranch size={11} /> Branches ({result.branches.length})
                    </p>
                    {result.branches.map(b => (
                      <button key={`${b.repo}:${b.name}`} onClick={() => select({ kind: 'branch', hit: b })} className={rowClass(isSelected('branch', b.repo, b.name))}>
                        <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate" title={b.name}>
                          <Highlight text={b.name} query={searchedQuery} />
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 min-w-0">
                          <span className="font-medium text-gray-600 dark:text-gray-300 truncate">{b.repo}</span>
                          {b.isDefault && <span className="px-1 rounded bg-gray-100 dark:bg-gray-700">principal</span>}
                          {b.archived && <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><Archive size={10} />arquivado</span>}
                          {b.head && <><span>·</span><span className="shrink-0">{timeAgo(b.head.date)}</span><span>·</span><span className="truncate">{b.head.author}</span></>}
                          {b.prs[0] && <span className="ml-auto shrink-0"><PrChip state={b.prs[0].state} number={b.prs[0].number} /></span>}
                        </div>
                      </button>
                    ))}
                    {result.truncatedRepos.length > 0 && (
                      <p className="px-3 pt-1 text-[11px] text-amber-600 dark:text-amber-400">
                        Há mais branches parecidas em {result.truncatedRepos.join(', ')}. Refine o texto para ver todas.
                      </p>
                    )}
                  </div>
                )}

                {result.commits.length > 0 && (
                  <div className="mb-3">
                    <p className="px-3 py-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      <GitCommit size={11} /> Commits ({result.commits.length})
                    </p>
                    {result.commits.map(c => (
                      <button key={`${c.repo}:${c.oid}`} onClick={() => select({ kind: 'commit', hit: c })} className={rowClass(isSelected('commit', c.repo, c.oid))}>
                        <p className="text-sm text-gray-900 dark:text-gray-100 truncate" title={c.message}>
                          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 mr-1.5">{c.shortOid}</span>
                          <Highlight text={c.message} query={c.foundBy === 'message' ? searchedQuery : ''} />
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 min-w-0">
                          <span className="font-medium text-gray-600 dark:text-gray-300 truncate">{c.repo}</span>
                          <span>·</span><span className="truncate">{c.author}</span>
                          <span>·</span><span className="shrink-0">{timeAgo(c.date)}</span>
                          {c.foundBy === 'hash' && <span className="ml-auto shrink-0 px-1 rounded bg-gray-100 dark:bg-gray-700">hash</span>}
                          {c.branch && <span className="ml-auto shrink-0 px-1 rounded bg-gray-100 dark:bg-gray-700 font-mono" title={`Visto em ${c.branch}`}>{c.branch}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {result.commitSearchError && (
                  <p className="mx-3 mb-2 px-3 py-2 rounded-md text-[11px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">{result.commitSearchError}</p>
                )}

                {!looksLikeSha(searchedQuery) && (
                  <p className="mx-3 mt-2 flex gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                    <Info size={12} className="shrink-0 mt-px" />
                    O texto do commit é procurado em toda a branch principal de cada repositório, nos últimos 6 meses das branches base (develop, homolog, staging…) e nos últimos 30 dias das 20 branches mais ativas de cada repositório. Fora disso, busque pelo nome da branch ou pelo hash.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Detalhe */}
          <div className={`min-h-0 overflow-y-auto ${selected ? '' : 'hidden md:block'}`}>
            {!selected ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 p-6 text-center">
                {result && total > 0 ? 'Selecione uma branch ou commit para ver os detalhes.' : ''}
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <button onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                  <ArrowLeft size={13} /> Resultados
                </button>

                {/* Título */}
                <div>
                  <div className="flex items-start gap-2">
                    {selected.kind === 'branch'
                      ? <GitBranch size={18} className="text-gray-400 shrink-0 mt-0.5" />
                      : <GitCommit size={18} className="text-gray-400 shrink-0 mt-0.5" />}
                    <h3 className={`text-base font-semibold text-gray-900 dark:text-gray-100 break-all ${selected.kind === 'branch' ? 'font-mono' : ''}`}>
                      {selected.kind === 'branch' ? selected.hit.name : selected.hit.message}
                    </h3>
                    <CopyButton
                      value={selected.kind === 'branch' ? selected.hit.name : selected.hit.oid}
                      title={selected.kind === 'branch' ? 'Copiar nome da branch' : 'Copiar hash'}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 pl-7 text-xs text-gray-500 dark:text-gray-400">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200">{org}/{selected.hit.repo}</span>
                    {selected.kind === 'commit' && <span className="font-mono">{selected.hit.shortOid}</span>}
                    {selected.kind === 'commit' && <span>{selected.hit.author} · {timeAgo(selected.hit.date)}</span>}
                    {selected.kind === 'branch' && selected.hit.head && <span>último commit {timeAgo(selected.hit.head.date)} por {selected.hit.head.author}</span>}
                    <a
                      href={selected.kind === 'branch'
                        ? `https://github.com/${org}/${selected.hit.repo}/tree/${encodeURI(selected.hit.name)}`
                        : selected.hit.url}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Abrir no GitHub <ExternalLink size={11} />
                    </a>
                  </div>
                </div>

                {detailLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Loader2 size={14} className="animate-spin text-blue-500" /> Carregando detalhes…
                  </div>
                )}
                {detailError && <p className="text-xs text-red-600 dark:text-red-400">{detailError}</p>}

                {/* Cards ligados */}
                {linkedCards.length > 0 && (
                  <div>
                    <SectionTitle>Card relacionado</SectionTitle>
                    <div className="space-y-1">
                      {linkedCards.map(c => (
                        <button
                          key={`${c.repo}#${c.number}`}
                          onClick={() => onOpenCard({ number: c.number, repo: c.repo, url: c.url })}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left text-xs transition-colors"
                        >
                          <span className="tabular-nums text-gray-400 shrink-0">#{c.number}</span>
                          <span className="truncate text-gray-800 dark:text-gray-200">{normalizeTitleCase(c.title)}</span>
                          {c.status && <span className="ml-auto shrink-0 text-[11px] text-gray-500 dark:text-gray-400">{c.status}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {detail?.kind === 'branch' && (
                  <>
                    <BasesStatus bases={detail.data.bases} subject="branch" />
                    <PrList prs={detail.data.prs} />
                    <div>
                      {detail.data.aheadTotal > 0 ? (
                        <>
                          <SectionTitle>
                            Commits da branch que não estão em {detail.data.defaultBranch} ({detail.data.aheadTotal})
                          </SectionTitle>
                          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {detail.data.aheadCommits.map(c => <CommitRow key={c.oid} c={c} />)}
                          </ul>
                          {detail.data.aheadTotal > detail.data.aheadCommits.length && (
                            <p className="text-[11px] text-gray-400 mt-1">Mostrando os {detail.data.aheadCommits.length} mais recentes.</p>
                          )}
                        </>
                      ) : (
                        <>
                          <SectionTitle>Últimos commits da branch</SectionTitle>
                          {detail.data.defaultBranch && !(selected.kind === 'branch' && selected.hit.isDefault) && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Todos já estão em {detail.data.defaultBranch}.</p>
                          )}
                          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {detail.data.history.map(c => <CommitRow key={c.oid} c={c} />)}
                          </ul>
                        </>
                      )}
                    </div>
                  </>
                )}

                {detail?.kind === 'commit' && (
                  <>
                    <BasesStatus bases={detail.data.bases} subject="commit" />
                    <PrList prs={detail.data.prs} onSearchBranch={searchBranch} />
                    <div>
                      <SectionTitle>Mensagem completa</SectionTitle>
                      <pre className="text-xs whitespace-pre-wrap break-words font-mono bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-3 text-gray-800 dark:text-gray-200">{detail.data.fullMessage}</pre>
                      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="text-green-600 dark:text-green-400">+{detail.data.additions}</span>{' '}
                        <span className="text-red-600 dark:text-red-400">−{detail.data.deletions}</span>
                        {detail.data.changedFiles !== null && <> · {detail.data.changedFiles} arquivo(s)</>}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
