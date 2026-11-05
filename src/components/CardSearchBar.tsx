import { useState, useRef, useEffect, useImperativeHandle } from 'react';
import { Search, X, Hash, Archive, Loader2, GitBranch } from 'lucide-react';
import type { ProjectCard, ProjectColumn } from '../types';
import type { CardHistoryEntry } from '../utils/cardHistory';
import { CardHistoryList } from './CardHistoryList';

interface SearchResult {
  card: ProjectCard;
  archived: boolean;
}

export interface CardSearchBarHandle {
  open: () => void;
}

interface Props {
  /** Permite abrir a busca de fora (atalho de teclado) */
  handleRef?: React.Ref<CardSearchBarHandle>;
  columns: ProjectColumn[];
  archivedCards?: ProjectCard[];
  onCardSelect: (card: ProjectCard) => void;
  onGitHubSearch?: (issueNumber: number) => Promise<ProjectCard | null>;
  // Cards vistos recentemente, exibidos enquanto nada foi digitado
  history?: CardHistoryEntry[];
  onOpenHistory?: (entry: CardHistoryEntry) => void;
  onClearHistory?: () => void;
  findOnBoard?: (entry: CardHistoryEntry) => ProjectCard | undefined;
  // Abre a busca de branches/commits com o texto digitado
  onRefSearch?: (query: string) => void;
}

export function CardSearchBar({
  columns, archivedCards = [], onCardSelect, onGitHubSearch,
  history, onOpenHistory, onClearHistory, findOnBoard, onRefSearch, handleRef,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fechar com Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openSearch = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useImperativeHandle(handleRef, () => ({ open: openSearch }));

  const closeSearch = () => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setNotFound(false);
    setSearching(false);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    const activeCards = columns.flatMap(col => col.cards);
    const trimmed = value.trim().toLowerCase();
    const isNumber = /^\d+$/.test(trimmed);

    let filteredActive: ProjectCard[];
    let filteredArchived: ProjectCard[];

    if (isNumber) {
      const exactA = activeCards.filter(c => String(c.number) === trimmed);
      const prefixA = activeCards.filter(c => String(c.number).startsWith(trimmed) && String(c.number) !== trimmed);
      filteredActive = [...exactA, ...prefixA];

      const exactArc = archivedCards.filter(c => String(c.number) === trimmed);
      const prefixArc = archivedCards.filter(c => String(c.number).startsWith(trimmed) && String(c.number) !== trimmed);
      filteredArchived = [...exactArc, ...prefixArc];
    } else {
      filteredActive = activeCards.filter(c => c.title.toLowerCase().includes(trimmed));
      filteredArchived = archivedCards.filter(c => c.title.toLowerCase().includes(trimmed));
    }

    const combined: SearchResult[] = [
      ...filteredActive.map(card => ({ card, archived: false })),
      ...filteredArchived.map(card => ({ card, archived: true })),
    ];

    setResults(combined.slice(0, 10));
    setNotFound(false);
  };

  const handleGitHubSearch = async () => {
    const num = parseInt(query.trim(), 10);
    if (!onGitHubSearch || isNaN(num)) return;
    setSearching(true);
    try {
      const card = await onGitHubSearch(num);
      if (card) {
        setResults([{ card, archived: true }]);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (card: ProjectCard) => {
    onCardSelect(card);
    closeSearch();
  };

  const openRefSearch = () => {
    if (!onRefSearch) return;
    onRefSearch(query.trim());
    closeSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results.length === 1) {
      handleSelect(results[0].card);
    } else if (e.key === 'Enter' && results.length === 0 && query.trim().length >= 3 && !/^\d+$/.test(query.trim())) {
      // Nenhum card com esse texto: procura em branches e commits
      openRefSearch();
    }
  };

  const refSearchButton = onRefSearch && query.trim().length >= 3 ? (
    <button
      onClick={openRefSearch}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left border-t border-gray-100 dark:border-gray-700"
    >
      <GitBranch size={12} className="shrink-0" />
      <span className="truncate">Procurar “{query.trim()}” em branches e commits</span>
    </button>
  ) : null;

  return (
    <div ref={containerRef} className="relative">
      {!isOpen ? (
        <button
          onClick={openSearch}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-xs font-medium"
          title="Buscar card por número ou título (e ver os vistos recentemente) — atalho: / ou Ctrl+K"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Buscar</span>
          <kbd className="hidden lg:inline px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px] font-sans text-gray-400 dark:text-gray-500 leading-4">/</kbd>
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-2.5 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nº ou título do card, branch, commit..."
              className="pl-8 pr-3 py-1.5 w-52 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
          <button
            onClick={closeSearch}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Fechar busca"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Vistos recentemente (antes de digitar) */}
      {isOpen && !query.trim() && history && onOpenHistory && (
        <div className="absolute right-0 top-full mt-1 w-[26rem] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <CardHistoryList
            history={history}
            onOpen={(entry) => { closeSearch(); onOpenHistory(entry); }}
            onClear={() => { onClearHistory?.(); inputRef.current?.focus(); }}
            findOnBoard={findOnBoard ?? (() => undefined)}
          />
        </div>
      )}

      {/* Dropdown de resultados */}
      {isOpen && results.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {results.map(({ card, archived }) => (
            <button
              key={card.id}
              onClick={() => handleSelect(card)}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <Hash size={12} className="text-gray-400" />
                <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {card.number}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  {card.title}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                  {archived ? (
                    <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                      <Archive size={10} />
                      Arquivado
                    </span>
                  ) : (
                    <span>{card.status}</span>
                  )}
                  {card.repo && <span className="text-gray-400">· {card.repo}</span>}
                </p>
              </div>
            </button>
          ))}
          {refSearchButton}
        </div>
      )}

      {/* Sem resultados */}
      {isOpen && query.trim() && results.length === 0 && !searching && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 px-4 py-3">
          {notFound ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Card <span className="font-medium">#{query}</span> não encontrado no GitHub
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Nenhum card ativo encontrado para &ldquo;<span className="font-medium">{query}</span>&rdquo;
              </p>
              {onGitHubSearch && /^\d+$/.test(query.trim()) && (
                <button
                  onClick={handleGitHubSearch}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors font-medium"
                >
                  <Archive size={12} />
                  Procurar #{query} no GitHub (pode estar arquivado)
                </button>
              )}
            </div>
          )}
          {refSearchButton && <div className="-mx-4 -mb-3 mt-2">{refSearchButton}</div>}
        </div>
      )}

      {/* Buscando no GitHub */}
      {isOpen && searching && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 px-4 py-3 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin text-blue-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Buscando no GitHub...</span>
        </div>
      )}
    </div>
  );
}
