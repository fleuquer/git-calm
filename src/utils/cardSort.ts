import type { ProjectCard } from '../types';
import { createPriorityResolver } from './prioritySettings';

// Ordenação puramente visual: nunca altera os dados nem a posição real do card no GitHub.
export type CardSortField = 'none' | 'updatedAt' | 'createdAt' | 'dueDate' | 'number' | 'title' | 'assignee' | 'labels' | 'priority';
export type CardSortDirection = 'asc' | 'desc';

export interface CardSortOption {
  field: CardSortField;
  direction: CardSortDirection;
}

export const DEFAULT_CARD_SORT: CardSortOption = { field: 'none', direction: 'desc' };

export const CARD_SORT_FIELDS: { value: CardSortField; label: string; defaultDirection: CardSortDirection }[] = [
  { value: 'none', label: 'Sem ordenação (padrão)', defaultDirection: 'desc' },
  { value: 'priority', label: 'Prioridade', defaultDirection: 'asc' },
  { value: 'updatedAt', label: 'Última movimentação', defaultDirection: 'desc' },
  { value: 'createdAt', label: 'Data de criação', defaultDirection: 'desc' },
  { value: 'dueDate', label: 'Prazo', defaultDirection: 'asc' },
  { value: 'number', label: 'Número do card', defaultDirection: 'asc' },
  { value: 'title', label: 'Título (A-Z)', defaultDirection: 'asc' },
  { value: 'assignee', label: 'Responsável', defaultDirection: 'asc' },
  { value: 'labels', label: 'Tags', defaultDirection: 'asc' },
];

function timeOrNull(value?: string): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export function sortCards(cards: ProjectCard[], sort: CardSortOption): ProjectCard[] {
  if (!sort || sort.field === 'none') return cards;
  const dir = sort.direction === 'asc' ? 1 : -1;
  const priorityOf = sort.field === 'priority' ? createPriorityResolver() : null;

  return [...cards].sort((a, b) => {
    switch (sort.field) {
      case 'updatedAt':
        return dir * ((timeOrNull(a.updatedAt) ?? 0) - (timeOrNull(b.updatedAt) ?? 0));
      case 'createdAt':
        return dir * ((timeOrNull(a.createdAt) ?? 0) - (timeOrNull(b.createdAt) ?? 0));
      case 'dueDate': {
        const aTime = timeOrNull(a.dueDate);
        const bTime = timeOrNull(b.dueDate);
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1; // sem prazo sempre por último
        if (bTime === null) return -1;
        return dir * (aTime - bTime);
      }
      case 'priority': {
        // asc = mais alta primeiro; sem prioridade sempre por último
        const aRank = priorityOf!(a);
        const bRank = priorityOf!(b);
        if (aRank === null && bRank === null) return 0;
        if (aRank === null) return 1;
        if (bRank === null) return -1;
        return dir * (aRank - bRank);
      }
      case 'number':
        return dir * (a.number - b.number);
      case 'title':
        return dir * a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
      case 'assignee': {
        const aName = a.assignees[0]?.login ?? '';
        const bName = b.assignees[0]?.login ?? '';
        if (!aName && bName) return 1; // sem responsável sempre por último
        if (aName && !bName) return -1;
        return dir * aName.localeCompare(bName, 'pt-BR', { sensitivity: 'base' });
      }
      case 'labels': {
        const aLabel = a.labels[0]?.name ?? '';
        const bLabel = b.labels[0]?.name ?? '';
        if (!aLabel && bLabel) return 1; // sem tags sempre por último
        if (aLabel && !bLabel) return -1;
        return dir * aLabel.localeCompare(bLabel, 'pt-BR', { sensitivity: 'base' });
      }
      default:
        return 0;
    }
  });
}
