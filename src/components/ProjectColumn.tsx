import React, { useState } from 'react';
import type { ProjectColumn as ProjectColumnType, ProjectCard as ProjectCardType } from '../types';
import { ProjectCard } from './ProjectCard';
import { CardGroup } from './CardGroup';
import { groupCardsByPerson, groupCardsByTag, groupCardsByPriority, groupCardsByCity, getUngroupedCards } from '../utils/filterUtils';
import type { TagGroup } from '../utils/viewTagsMapping';

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
  onDropCard?: (cardId: string, targetStatus: string) => Promise<void>;
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
  onDropCard,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
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

  const hasGroups = groups.length > 0;
  const hasContent = hasGroups || ungroupedCards.length > 0;

  // Renderização para coluna minimizada
  if (isCollapsed) {
    return (
      <div
        className="bg-gray-200 dark:bg-gray-800/50 shrink-0 w-12 border-r border-gray-300 dark:border-gray-700 h-full flex flex-col items-center cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700/50 transition-colors group"
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
      className={`bg-gray-200 dark:bg-gray-800/50 shrink-0 w-[380px] border-r border-gray-300 dark:border-gray-700 h-full flex flex-col transition-colors ${
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
        <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2">
          {column.cards.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {hasContent ? (
          <div className="space-y-2">
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
                  cards={group.cards}
                  onCardClick={onCardClick || (() => {})}
                  cardAnimations={cardAnimations}
                  groupColor={groupColor}
                  priorityNum={priorityNum}
                  compactCardView={compactCardView}
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
