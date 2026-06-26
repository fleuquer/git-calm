import type { ProjectColumn, ViewFilter } from '../types';

export function filterColumns(columns: ProjectColumn[], filter: ViewFilter): ProjectColumn[] {
  // Se não há filtros, retorna todas as colunas
  if (!filter.statuses && !filter.excludeStatuses && !filter.labels && !filter.excludeLabels) {
    return applyColumnOrder(columns, filter.columnOrder);
  }

  const filteredColumns = columns
    .map(column => {
      // Verificar se a coluna deve ser incluída baseado no status
      const columnStatusIncluded = shouldIncludeColumnByStatus(column.name, filter);

      // Se a coluna não está incluída por status, pular
      if (!columnStatusIncluded) {
        return null;
      }

      // Filtrar cards dentro da coluna (apenas por labels)
      let filteredCards = column.cards;

      // Filtrar por labels se especificado
      if (filter.labels && filter.labels.length > 0) {
        filteredCards = filteredCards.filter(card => {
          const hasLabel = filter.labels!.some(label =>
            card.labels.some(cardLabel =>
              cardLabel.name.toLowerCase() === label.toLowerCase()
            )
          );
          return hasLabel;
        });
      }

      // Excluir por labels se especificado
      if (filter.excludeLabels && filter.excludeLabels.length > 0) {
        filteredCards = filteredCards.filter(card => {
          const hasExcludedLabel = filter.excludeLabels!.some(label =>
            card.labels.some(cardLabel =>
              cardLabel.name.toLowerCase() === label.toLowerCase()
            )
          );
          return !hasExcludedLabel;
        });
      }

      return {
        ...column,
        cards: filteredCards,
      };
    })
    .filter((column): column is ProjectColumn => column !== null);

  // Aplicar ordem e adicionar colunas vazias se necessário
  return applyColumnOrder(filteredColumns, filter.columnOrder, true);
}

function applyColumnOrder(columns: ProjectColumn[], columnOrder?: string[], addEmptyColumns: boolean = false): ProjectColumn[] {
  if (!columnOrder || columnOrder.length === 0) {
    return columns;
  }

  const orderedColumns: ProjectColumn[] = [];
  const columnMap = new Map(columns.map(col => [col.name, col]));

  // Adicionar colunas na ordem especificada
  columnOrder.forEach(columnName => {
    const column = columnMap.get(columnName);
    if (column) {
      orderedColumns.push(column);
      columnMap.delete(columnName);
    } else if (addEmptyColumns) {
      // Adicionar coluna vazia se ela está na ordem mas não existe
      orderedColumns.push({
        id: columnName,
        name: columnName,
        cards: [],
      });
    }
  });

  // Adicionar colunas restantes que não estão na ordem
  columnMap.forEach(column => {
    orderedColumns.push(column);
  });

  return orderedColumns;
}function shouldIncludeColumnByStatus(columnStatus: string, filter: ViewFilter): boolean {
  const normalizedStatus = columnStatus.toLowerCase().trim();

  // Se tem exclusões de status
  if (filter.excludeStatuses && filter.excludeStatuses.length > 0) {
    const isExcluded = filter.excludeStatuses.some(excludeStatus =>
      normalizedStatus === excludeStatus.toLowerCase().trim()
    );
    if (isExcluded) return false;
  }

  // Se tem inclusões de status
  if (filter.statuses && filter.statuses.length > 0) {
    return filter.statuses.some(includeStatus =>
      normalizedStatus === includeStatus.toLowerCase().trim()
    );
  }

  // Se tem apenas exclusões, incluir o que não foi excluído
  if (filter.excludeStatuses && filter.excludeStatuses.length > 0) {
    return true;
  }

  // Se não tem filtros de status, incluir todas
  return true;
}

export function getTotalCards(columns: ProjectColumn[]): number {
  return columns.reduce((sum, col) => sum + col.cards.length, 0);
}

export interface CardGroup {
  name: string;
  cards: ProjectColumn['cards'];
}

/**
 * Agrupa cards por pessoa (assignee.login)
 * Filtra para mostrar apenas pessoas da lista fornecida (viewPeople)
 * Cards com múltiplos assignees aparecem em múltiplos grupos
 */
export function groupCardsByPerson(cards: ProjectColumn['cards'], viewPeople: string[]): CardGroup[] {
  const groups = new Map<string, ProjectColumn['cards']>();

  // Agrupar cards por assignee (cards podem aparecer em múltiplos grupos)
  cards.forEach(card => {
    if (card.assignees && card.assignees.length > 0) {
      card.assignees.forEach(assignee => {
        // Apenas agrupar se a pessoa está na lista da view
        if (viewPeople.includes(assignee.login)) {
          if (!groups.has(assignee.login)) {
            groups.set(assignee.login, []);
          }
          groups.get(assignee.login)!.push(card);
        }
      });
    }
  });

  // Converter para array (sem filtrar por quantidade mínima)
  return Array.from(groups.entries())
    .map(([name, groupCards]) => ({ name, cards: groupCards }))
    .sort((a, b) => b.cards.length - a.cards.length); // Ordenar por quantidade decrescente
}

/**
 * Agrupa cards por tag
 * Filtra para mostrar apenas tags da lista fornecida (viewTags)
 * Cards com múltiplas tags aparecem em múltiplos grupos
 * Aceita tagGroups para agrupar múltiplas tags sob um nome
 */
export function groupCardsByTag(
  cards: ProjectColumn['cards'],
  viewTags: string[],
  tagGroups: Array<{ name: string; tags: string[] }> = []
): CardGroup[] {
  const groups = new Map<string, ProjectColumn['cards']>();

  // Agrupar cards (cards podem aparecer em múltiplos grupos)
  cards.forEach(card => {
    if (card.labels && card.labels.length > 0) {
      // Verificar grupos nomeados primeiro
      tagGroups.forEach(tagGroup => {
        const hasGroupTag = card.labels.some(label =>
          tagGroup.tags.some(groupTag =>
            label.name.toLowerCase().includes(groupTag.toLowerCase())
          )
        );

        if (hasGroupTag) {
          if (!groups.has(tagGroup.name)) {
            groups.set(tagGroup.name, []);
          }
          groups.get(tagGroup.name)!.push(card);
        }
      });

      // Depois verificar tags individuais que não fazem parte de grupos
      const groupedTagNames = new Set(tagGroups.flatMap(g => g.tags.map(t => t.toLowerCase())));

      card.labels.forEach(label => {
        // Se a tag está na lista de viewTags e não faz parte de um grupo nomeado
        const isRelevant = viewTags.some(viewTag =>
          label.name.toLowerCase().includes(viewTag.toLowerCase())
        );

        const isInNamedGroup = Array.from(groupedTagNames).some(groupTag =>
          label.name.toLowerCase().includes(groupTag)
        );

        if (isRelevant && !isInNamedGroup) {
          if (!groups.has(label.name)) {
            groups.set(label.name, []);
          }
          groups.get(label.name)!.push(card);
        }
      });
    }
  });

  // Converter para array (sem filtrar por quantidade mínima)
  return Array.from(groups.entries())
    .map(([name, groupCards]) => ({ name, cards: groupCards }))
    .sort((a, b) => b.cards.length - a.cards.length); // Ordenar por quantidade decrescente
}

export interface PriorityGroup extends CardGroup {
  color?: string;
  priorityNum?: string;
}

/**
 * Agrupa cards por prioridade (labels que começam com 1-, 2-, 3- ou 4-)
 * Prioridades: Erro, Problema, Adequação, Melhoria
 */
export function groupCardsByPriority(cards: ProjectColumn['cards']): PriorityGroup[] {
  const groups = new Map<string, { cards: ProjectColumn['cards']; color: string; priorityNum: string }>();

  // Mapa de prioridades com cores (mesmas do ProjectCard)
  const priorityInfo: Record<string, { name: string; color: string }> = {
    '1': { name: 'Erro', color: '#ef4444' },
    '2': { name: 'Problema', color: '#f97316' },
    '3': { name: 'Adequação', color: '#3b82f6' },
    '4': { name: 'Melhoria', color: '#8b5cf6' }
  };

  cards.forEach(card => {
    if (card.labels && card.labels.length > 0) {
      const priorityLabel = card.labels.find(label => /^[1-4]-/.test(label.name));

      if (priorityLabel) {
        const priorityNum = priorityLabel.name.charAt(0);
        const info = priorityInfo[priorityNum];

        if (info) {
          if (!groups.has(info.name)) {
            groups.set(info.name, { cards: [], color: info.color, priorityNum });
          }
          groups.get(info.name)!.cards.push(card);
        }
      }
    }
  });

  // Converter para array e ordenar por prioridade (1 primeiro)
  return Array.from(groups.entries())
    .map(([name, data]) => ({
      name,
      cards: data.cards,
      color: data.color,
      priorityNum: data.priorityNum
    }))
    .sort((a, b) => {
      const aNum = parseInt(a.priorityNum || '0');
      const bNum = parseInt(b.priorityNum || '0');
      return aNum - bNum;
    });
}/**
 * Agrupa cards por cidade (labels que começam com sigla de estado: XX-)
 * Extrai apenas o nome da cidade (segunda parte): SP-Jacarei-SAAE -> Jacarei
 */
export function groupCardsByCity(cards: ProjectColumn['cards']): CardGroup[] {
  const groups = new Map<string, ProjectColumn['cards']>();

  cards.forEach(card => {
    if (card.labels && card.labels.length > 0) {
      const cityLabel = card.labels.find(label => /^[A-Z]{2}-/.test(label.name));

      if (cityLabel) {
        // Extrair apenas o nome da cidade (segunda parte após o hífen)
        // Exemplo: SP-Jacarei-SAAE -> Jacarei
        const parts = cityLabel.name.split('-');
        const cityName = parts.length > 1 ? parts[1] : cityLabel.name;

        if (!groups.has(cityName)) {
          groups.set(cityName, []);
        }
        groups.get(cityName)!.push(card);
      }
    }
  });

  // Converter para array e ordenar alfabeticamente
  return Array.from(groups.entries())
    .map(([name, groupCards]) => ({ name, cards: groupCards }))
    .sort((a, b) => a.name.localeCompare(b.name));
}/**
 * Retorna os cards que não fazem parte de nenhum grupo
 * Com o novo sistema, retorna apenas cards sem assignees/tags relevantes
 */
export function getUngroupedCards(
  cards: ProjectColumn['cards'],
  groups: CardGroup[]
): ProjectColumn['cards'] {
  const groupedCardIds = new Set(
    groups.flatMap(group => group.cards.map(card => card.id))
  );

  return cards.filter(card => !groupedCardIds.has(card.id));
}
