import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { ProjectColumn as ProjectColumnType, ProjectCard as ProjectCardType } from '../types';
import { ProjectCard } from './ProjectCard';
import { CardGroup } from './CardGroup';
import { groupCardsByPerson, groupCardsByTag, groupCardsByPriority, groupCardsByCity, getUngroupedCards } from '../utils/filterUtils';
import type { TagGroup } from '../utils/viewTagsMapping';
import { sortCards, CARD_SORT_FIELDS, DEFAULT_CARD_SORT, type CardSortOption } from '../utils/cardSort';

interface Props {
  column: ProjectColumnType;
  activeViewId?: string;
  hiddenLabels?: string[];
  currentUser?: string;
  onAssigneeClick?: (assigneeLogin: string) => void;
  onLabelClick?: (labelName: string) => void;
  activeAssigneeFilter?: string | null;
  activeLabelFilter?: string | null;
  onCardClick?: (card: ProjectCardType) => void;
  groupBy?: 'none' | 'person' | 'tag' | 'priority' | 'city';
  viewPeople?: string[];
  viewTags?: string[];
  viewTagGroups?: TagGroup[];
  cardAnimations?: Map<number, string>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  compactCardView?: boolean;
  listLayout?: boolean;
  onDropCard?: (cardId: string, targetStatus: string) => Promise<void>;
  sortOption?: CardSortOption;
  onSortChange?: (option: CardSortOption) => void;
}

export const ProjectColumn: React.FC<Props> = ({
  column,
  activeViewId,
  hiddenLabels,
  currentUser,
  onAssigneeClick,
  onLabelClick,
  activeAssigneeFilter,
  activeLabelFilter,
  onCardClick,
  groupBy = 'none',
  viewPeople = [],
  viewTags = [],
  viewTagGroups = [],
  cardAnimations,
  isCollapsed = false,
  onToggleCollapse,
  compactCardView = false,
  listLayout = false,
  onDropCard,
  sortOption = DEFAULT_CARD_SORT,
  onSortChange,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  // Cartões: colunas coladas, separadas por uma linha, com cards soltos dentro.
  // Lista: cada coluna é um painel com moldura própria (o board dá o espaço entre
  // eles) e os cards ficam colados nas bordas, para a tarja nunca encostar na coluna vizinha.
  const columnFrame = listLayout ? 'border rounded-md overflow-hidden' : 'border-r';
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSortMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortMenuOpen]);

  // Determinar grupos e cards não agrupados
  let groups: ReturnType<typeof groupCardsByPerson> = [];
  let ungroupedCards = column.cards;
  let groupType: 'person' | 'tag' | 'priority' | 'city' = 'tag';

  if (groupBy === 'person' && viewPeople.length > 0) {
    groups = groupCardsByPerson(column.cards, viewPeople);
    ungroupedCards = getUngroupedCards(column.cards, groups);
    groupType = 'person';
  } else if (groupBy === 'tag' && (viewTags.length > 0 || viewTagGroups.length > 0)) {
    groups = groupCardsByTag(column.cards, viewTags, viewTagGroups);
    ungroupedCards = getUngroupedCards(column.cards, groups);
    groupType = 'tag';
  } else if (groupBy === 'priority') {
    groups = groupCardsByPriority(column.cards);
    ungroupedCards = getUngroupedCards(column.cards, groups);
    groupType = 'priority';
  } else if (groupBy === 'city') {
    groups = groupCardsByCity(column.cards);
    ungroupedCards = getUngroupedCards(column.cards, groups);
    groupType = 'city';
  }

  ungroupedCards = sortCards(ungroupedCards, sortOption);

  const hasGroups = groups.length > 0;
  const hasContent = hasGroups || ungroupedCards.length > 0;

  // Renderização para coluna minimizada
  if (isCollapsed) {
    return (
      <div
        className={`bg-gray-100 dark:bg-gray-800/50 shrink-0 w-12 border-gray-200 dark:border-gray-700 h-full flex flex-col items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors group ${columnFrame}`}
        onClick={onToggleCollapse}
        title={`${column.name} (${column.cards.length})`}
      >
        <div className="flex-1 flex items-center justify-center py-4">
          <div className="flex flex-col items-center gap-3">
            {/* Contador no topo */}
            <span className="bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-1 rounded-full group-hover:bg-gray-400 dark:group-hover:bg-gray-600 transition-colors">
              {column.cards.length}
            </span>
            {/* Título vertical */}
            <div className="writing-mode-vertical text-gray-800 dark:text-gray-100 font-semibold text-sm whitespace-nowrap" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              {column.name}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Renderização normal (expandida)
  return (
    <div
      className={`bg-gray-100 dark:bg-gray-800/50 shrink-0 w-[380px] border-gray-200 dark:border-gray-700 h-full flex flex-col transition-colors ${columnFrame} ${
        isDragOver ? 'ring-2 ring-inset ring-blue-400 dark:ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      onDragOver={onDropCard ? (e) => { e.preventDefault(); setIsDragOver(true); } : undefined}
      onDragLeave={onDropCard ? () => setIsDragOver(false) : undefined}
      onDrop={onDropCard ? (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const cardId = e.dataTransfer.getData('cardId');
        const fromStatus = e.dataTransfer.getData('fromStatus');
        if (cardId && fromStatus !== column.name) {
          onDropCard(cardId, column.name);
        }
      } : undefined}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={onToggleCollapse}
        title="Clique para minimizar"
      >
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{column.name}</h3>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className={`bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-0.5 tabular-nums ${listLayout ? 'rounded-sm' : 'rounded-full'}`}>
            {column.cards.length}
          </span>
          {onSortChange && (
            <div className="relative" ref={sortMenuRef} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsSortMenuOpen((v) => !v)}
                title="Ordenar cards (apenas visual, não altera os cards no GitHub)"
                className={`p-1 rounded transition-colors ${
                  sortOption.field !== 'none'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <ArrowUpDown size={13} />
              </button>
              {isSortMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                  {CARD_SORT_FIELDS.map((opt) => {
                    const isActive = sortOption.field === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          onSortChange({
                            field: opt.value,
                            direction: isActive ? (sortOption.direction === 'asc' ? 'desc' : 'asc') : opt.defaultDirection,
                          });
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors ${
                          isActive ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isActive && opt.value !== 'none' && (
                          sortOption.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${listLayout ? '' : 'p-2'}`}>
        {hasContent ? (
          <div className={listLayout ? '' : 'space-y-2'}>
            {/* Renderizar grupos */}
            {groups.map((group) => {
              // Para grupos de prioridade, passar a cor customizada e o número
              const groupColor = groupType === 'priority' && 'color' in group ? (group.color as string) : undefined;
              const priorityNum = groupType === 'priority' && 'priorityNum' in group ? (group.priorityNum as string) : undefined;

              return (
                <CardGroup
                  key={group.name}
                  groupName={group.name}
                  groupType={groupType}
                  cards={sortCards(group.cards, sortOption)}
                  onCardClick={onCardClick || (() => {})}
                  cardAnimations={cardAnimations}
                  groupColor={groupColor}
                  priorityNum={priorityNum}
                  compactCardView={compactCardView}
                  listLayout={listLayout}
                />
              );
            })}            {/* Renderizar cards não agrupados */}
            {ungroupedCards.map((card) => (
              <ProjectCard
                key={card.id}
                card={card}
                activeViewId={activeViewId}
                hiddenLabels={hiddenLabels}
                currentUser={currentUser}
                onAssigneeClick={onAssigneeClick}
                onLabelClick={onLabelClick}
                activeAssigneeFilter={activeAssigneeFilter}
                activeLabelFilter={activeLabelFilter}
                onCardClick={onCardClick}
                animationClass={cardAnimations?.get(card.number) || ''}
                compactView={compactCardView}
                listLayout={listLayout}
                draggable={!!onDropCard}
                onDragStart={onDropCard ? () => {} : undefined}
                columnStatus={column.name}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-xs">
            Vazio
          </div>
        )}
      </div>
    </div>
  );
};
