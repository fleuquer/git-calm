import type { ProjectCard } from '../types';

/**
 * Histórico dos últimos cards abertos no modal (issue #6), do mais recente para o mais antigo.
 * Guarda só o mínimo para listar e reabrir o card (sem corpo/comentários), por usuário/navegador.
 */
export interface CardHistoryEntry {
  id: string;
  number: number;
  title: string;
  repo?: string;
  url: string;
  viewedAt: string;
}

const CARD_HISTORY_KEY = 'github_card_history';
export const CARD_HISTORY_MAX = 30;

export function sameIssue(a: { number: number; repo?: string }, b: { number: number; repo?: string }): boolean {
  return a.number === b.number && (a.repo ?? '').toLowerCase() === (b.repo ?? '').toLowerCase();
}

export function loadCardHistory(): CardHistoryEntry[] {
  try {
    const saved = localStorage.getItem(CARD_HISTORY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(history: CardHistoryEntry[]): void {
  try {
    localStorage.setItem(CARD_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage indisponível: histórico fica só em memória nesta sessão
  }
}

/** Registra o card como visualizado agora (move para o topo se já estava na lista). */
export function recordCardView(history: CardHistoryEntry[], card: ProjectCard): CardHistoryEntry[] {
  const entry: CardHistoryEntry = {
    id: card.id,
    number: card.number,
    title: card.title,
    repo: card.repo,
    url: card.url,
    viewedAt: new Date().toISOString(),
  };
  const next = [entry, ...history.filter(h => !sameIssue(h, card))].slice(0, CARD_HISTORY_MAX);
  persist(next);
  return next;
}

export function clearCardHistory(): CardHistoryEntry[] {
  persist([]);
  return [];
}
