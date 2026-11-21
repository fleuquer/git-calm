import { useSyncExternalStore } from 'react';
import type { ProjectCard } from '../types';
import { sameIssue } from './cardHistory';

/**
 * Cards fixados pela pessoa (barra lateral "Fixados"). Pessoal, por navegador: fica fora do
 * padrão da organização. Guarda só o necessário para listar e reabrir o card.
 */
export interface PinnedCard {
  id: string;
  number: number;
  title: string;
  repo?: string;
  url: string;
  pinnedAt: string;
}

const KEY = 'gitcalm_pinned_cards';
const COLLAPSED_KEY = 'gitcalm_pinned_collapsed';

function load(): PinnedCard[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(p => p && typeof p.number === 'number' && typeof p.url === 'string') : [];
  } catch {
    return [];
  }
}

let pins: PinnedCard[] = load();
const listeners = new Set<() => void>();

function save(next: PinnedCard[]) {
  pins = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* só em memória */ }
  listeners.forEach(l => l());
}

// outra aba do navegador fixou ou desafixou
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    pins = load();
    listeners.forEach(l => l());
  });
}

export function usePinnedCards(): PinnedCard[] {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => pins,
    () => pins,
  );
}

export function isPinned(card: { number: number; repo?: string }): boolean {
  return pins.some(p => sameIssue(p, card));
}

export function togglePin(card: ProjectCard) {
  if (isPinned(card)) unpin(card);
  else save([...pins, { id: card.id, number: card.number, title: card.title, repo: card.repo, url: card.url, pinnedAt: new Date().toISOString() }]);
}

export function unpin(card: { number: number; repo?: string }) {
  save(pins.filter(p => !sameIssue(p, card)));
}

/** Card aberto de novo: atualiza o título guardado, se mudou no GitHub */
export function refreshPinned(card: ProjectCard) {
  const i = pins.findIndex(p => sameIssue(p, card));
  if (i === -1 || (pins[i].title === card.title && pins[i].url === card.url)) return;
  const next = [...pins];
  next[i] = { ...next[i], title: card.title, url: card.url };
  save(next);
}

export function loadPinnedCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

export function savePinnedCollapsed(v: boolean) {
  try { localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0'); } catch { /* ignora */ }
}
