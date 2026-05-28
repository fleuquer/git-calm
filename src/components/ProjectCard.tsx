import React from 'react';
import type { ProjectCard as ProjectCardType } from '../types';
import { Clock, AlertCircle, XCircle, AlertTriangle, Wrench, Sparkles, MapPin, Calendar } from 'lucide-react';
import { convertGithubEmojis } from '../utils/emojiConverter';

interface Props {
  card: ProjectCardType;
  activeViewId?: string;
  hiddenLabels?: string[];
  currentUser?: string;
  onAssigneeClick?: (assigneeLogin: string) => void;
  onLabelClick?: (labelName: string) => void;
  activeAssigneeFilter?: string | null;
  activeLabelFilter?: string | null;
  onCardClick?: (card: ProjectCardType) => void;
  animationClass?: string;
  compactView?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  columnStatus?: string;
}

// Mapa de ícones para tipos de issue (formato: "1-Erro", "2-Problema", etc)
const TYPE_ICON_MAP: { [key: string]: { icon: any; color: string; darkColor: string } } = {
  '1': { icon: XCircle, color: '#ef4444', darkColor: '#dc2626' }, // Erro - vermelho mais escuro
  '2': { icon: AlertTriangle, color: '#f97316', darkColor: '#ea580c' }, // Problema - laranja mais escuro
  '3': { icon: Wrench, color: '#3b82f6', darkColor: '#2563eb' }, // Adequação - azul mais escuro
  '4': { icon: Sparkles, color: '#8b5cf6', darkColor: '#7c3aed' }, // Melhoria - roxo mais escuro
};

// Labels que devem ser ocultadas por contexto
const CONTEXT_LABELS: { [key: string]: string[] } = {
  'web': ['web', 'frontend', 'front-end'],
  'qa': ['qa', 'quality', 'teste', 'testes'],
  'desk': ['desk', 'suporte', 'atendimento'],
  'fast': ['fast', 'bi', 'business intelligence'],
  'bi': ['fast', 'bi', 'business intelligence'],
};

// Função para calcular dias desde última atualização
function getDaysSinceUpdate(updatedAt: string): number {
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffTime = Math.abs(now.getTime() - updated.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Função para calcular dias até due date
function getDaysUntilDue(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Função para obter estilo de aging apenas para indicador
function getAgingColor(days: number): string {
  if (days <= 7) return 'text-gray-400';
  if (days <= 14) return 'text-yellow-600 dark:text-yellow-500';
  if (days <= 30) return 'text-orange-600 dark:text-orange-500';
  return 'text-red-600 dark:text-red-500';
}

// Função para formatar data relativa
function formatRelativeDate(date: string): string {
  const days = getDaysSinceUpdate(date);

  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days <= 7) return `${days}d`;
  if (days <= 30) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}sem`;

  const months = Math.floor(days / 30);
  return `${months}m`;
}

// Função para gerar descrição da última interação baseado nos dados disponíveis
function getLastInteractionText(card: ProjectCardType): string {
  const daysSince = getDaysSinceUpdate(card.updatedAt);
  const timeAgo = formatRelativeDate(card.updatedAt);

  // Inferir tipo de interação baseado no que mudou
  if (card.assignees.length === 0) {
    return `Sem responsável • ${timeAgo}`;
  }

  if (card.dueDate) {
    const daysUntil = getDaysUntilDue(card.dueDate);
    if (daysUntil < 0) {
      return `Vencido há ${Math.abs(daysUntil)}d • Atualizado ${timeAgo}`;
    }
  }

  // Mensagens baseadas em tempo desde atualização
  if (daysSince === 0) {
    return card.assignees.length > 0
      ? `Atribuído a ${card.assignees[0].login} • Hoje`
      : 'Atualizado • Hoje';
  }

  if (daysSince === 1) {
    return card.assignees.length > 0
      ? `Responsável: ${card.assignees[0].login} • Ontem`
      : 'Atualizado • Ontem';
  }

  // Para cards mais antigos
  if (daysSince <= 7) {
    return `Última atualização • ${timeAgo}`;
  }

  if (daysSince > 30) {
    return `⚠️ Sem movimento • ${timeAgo}`;
  }

  return `Atualizado • ${timeAgo}`;
}

// Função para verificar se é uma label de tipo (1-Erro, 2-Problema, etc)
function isTypeLabel(labelName: string): boolean {
  return /^[1-4]-/.test(labelName);
}

// Função para verificar se é uma label de cidade (formato: SP-Cidade-Orgao)
function isCityLabel(labelName: string): boolean {
  return /^[A-Z]{2}-/.test(labelName);
}

// Função para verificar se deve ocultar label por contexto ou por seleção do usuário
function shouldHideLabel(labelName: string, activeViewId?: string, hiddenLabels?: string[]): boolean {
  const isAutoHidden = activeViewId && CONTEXT_LABELS[activeViewId.toLowerCase()]?.some(contextLabel =>
    labelName.toLowerCase().includes(contextLabel)
  );

  const isInHiddenList = hiddenLabels?.includes(labelName);

  // Se é auto-oculta
  if (isAutoHidden) {
    // Se está na lista de hidden, significa que o usuário quer FORÇAR A EXIBIÇÃO
    return !isInHiddenList;
  }

  // Se não é auto-oculta, hidden list funciona normalmente (ocultar quando está na lista)
  return !!isInHiddenList;
}export const ProjectCard: React.FC<Props> = ({
  card,
  activeViewId,
  hiddenLabels,
  currentUser,
  onAssigneeClick,
  onLabelClick,
  activeAssigneeFilter,
  activeLabelFilter,
  onCardClick,
  animationClass,
  compactView = false,
  draggable: isDraggable = false,
  columnStatus,
}) => {
  const daysSinceUpdate = getDaysSinceUpdate(card.updatedAt);
  const agingColor = getAgingColor(daysSinceUpdate);
  const isOld = daysSinceUpdate > 7;

  // Verificar se não tem assignees (precisa piscar)
  const hasNoAssignees = card.assignees.length === 0;

  // Calcular status do due date
  let dueDateStatus: 'overdue' | 'soon' | 'normal' | null = null;
  let daysUntilDue = 0;

  if (card.dueDate) {
    daysUntilDue = getDaysUntilDue(card.dueDate);
    if (daysUntilDue < 0) dueDateStatus = 'overdue';
    else if (daysUntilDue <= 3) dueDateStatus = 'soon';
    else dueDateStatus = 'normal';
  }

  // Separar labels por tipo
  const typeLabels = card.labels.filter(l => isTypeLabel(l.name));
  const cityLabels = card.labels.filter(l => isCityLabel(l.name));
  const regularLabels = card.labels.filter(l =>
    !isTypeLabel(l.name) &&
    !isCityLabel(l.name) &&
    !shouldHideLabel(l.name, activeViewId, hiddenLabels)
  );

  // Determinar se precisa de borda de destaque (apenas para tipo)
  let typeBorderStyle = {};
  let typeBorderClass = '';
  if (typeLabels.length > 0) {
    const type = typeLabels[0].name.match(/^([1-4])-/)?.[1];
    if (type && TYPE_ICON_MAP[type]) {
      // Usar classe CSS para alternar entre cores light/dark
      typeBorderClass = `type-border-${type}`;
      typeBorderStyle = { borderLeftWidth: '4px' };
    }
  }

  // Calcular opacidade baseado no aging (sem mudar cor de fundo)
  let opacityValue = 1;
  if (daysSinceUpdate > 60) {
    opacityValue = 0.5;
  } else if (daysSinceUpdate > 30) {
    opacityValue = 0.65;
  } else if (daysSinceUpdate > 14) {
    opacityValue = 0.8;
  }

  // Handler para click no card
  const handleCardClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Se Ctrl (ou Cmd no Mac) estiver pressionado, deixar o comportamento padrão (abrir em nova aba)
    if (e.ctrlKey || e.metaKey) {
      return;
    }

    // Caso contrário, prevenir navegação e abrir modal
    e.preventDefault();
    onCardClick?.(card);
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? (e) => {
        e.dataTransfer.setData('cardId', card.id);
        e.dataTransfer.setData('fromStatus', columnStatus || card.status);
        e.dataTransfer.effectAllowed = 'move';
      } : undefined}
      className={`
        bg-white dark:bg-gray-800 rounded p-2.5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all group cursor-pointer card-type-border card-transition
        ${hasNoAssignees ? 'animate-pulse-card' : ''}
        ${animationClass || ''}
        ${typeBorderClass}
        ${compactView ? 'compact-card-view' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      style={{
        ...typeBorderStyle,
        opacity: opacityValue,
      }}
    >
      <a
        href={card.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        onClick={handleCardClick}
      >
        {/* Header: Número, Tipo e Aging */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              #{card.number}
            </span>

            {/* Ícones de tipo */}
            {typeLabels.map(label => {
              const type = label.name.match(/^([1-4])-/)?.[1];
              if (!type) return null;
              const typeInfo = TYPE_ICON_MAP[type];
              if (!typeInfo) return null;
              const Icon = typeInfo.icon;
              return (
                <div key={label.name} title={convertGithubEmojis(label.name)} className="flex items-center">
                  <Icon
                    size={14}
                    style={{ color: typeInfo.color }}
                  />
                </div>
              );
            })}

            {/* Ícone de cidade */}
            {cityLabels.length > 0 && (
              <div className="flex items-center gap-0.5" title={cityLabels.map(l => l.name).join(', ')}>
                <MapPin size={12} className="text-blue-600 dark:text-blue-400" />
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {cityLabels[0].name.split('-')[1]}
                </span>
              </div>
            )}
          </div>

          {/* Aging indicator (apenas ícone + texto colorido) */}
          {isOld && (
            <div className={`flex items-center gap-0.5 ${agingColor}`} title={`Última atualização: ${formatRelativeDate(card.updatedAt)} atrás`}>
              {daysSinceUpdate > 30 ? (
                <AlertCircle size={12} />
              ) : (
                <Clock size={12} />
              )}
              <span className="text-xs font-medium">{formatRelativeDate(card.updatedAt)}</span>
            </div>
          )}

          {!isOld && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatRelativeDate(card.updatedAt)}
            </span>
          )}
        </div>

        {/* Título + badge de assignees (compacto, alinhados na mesma linha) */}
        <div className={compactView && card.assignees.length > 0 ? 'flex items-start gap-1.5 mb-1.5' : ''}>
          <h4 className={`text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug flex-1 ${compactView && card.assignees.length > 0 ? '' : 'mb-1.5'} line-clamp-3`}>
            {card.title}
          </h4>

          {/* Badge de avatares: inline com o título, some no hover */}
          {compactView && card.assignees.length > 0 && (
            <div className="compact-assignees flex -space-x-1.5 shrink-0 mt-0.5 transition-opacity duration-200">
              {card.assignees.slice(0, 4).map((assignee) => (
                <img
                  key={assignee.login}
                  src={assignee.avatarUrl}
                  alt={assignee.login}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAssigneeClick?.(assignee.login);
                  }}
                  className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                    assignee.login === currentUser
                      ? 'border-blue-500 dark:border-blue-400'
                      : 'border-white dark:border-gray-800'
                  } ${
                    activeAssigneeFilter === assignee.login
                      ? 'ring-2 ring-yellow-400 dark:ring-yellow-500'
                      : ''
                  }`}
                  title={assignee.login}
                />
              ))}
              {card.assignees.length > 4 && (
                <span className="text-xs text-gray-400 dark:text-gray-500 pl-1 self-center">+{card.assignees.length - 4}</span>
              )}
            </div>
          )}
        </div>

        {/* Conteúdo expansível (oculto em modo compacto, visível ao hover) */}
        <div className={compactView ? 'compact-card-expandable' : ''}>
          {/* Labels regulares */}
          {regularLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
            {regularLabels.map((label) => (
              <span
                key={label.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onLabelClick?.(label.name);
                }}
                className={`text-xs px-1.5 py-0.5 rounded font-medium dark:border cursor-pointer hover:scale-105 transition-transform ${
                  activeLabelFilter === label.name
                    ? 'ring-2 ring-yellow-400 dark:ring-yellow-500'
                    : ''
                }`}
                style={{
                  // Tema claro: fundo preenchido com texto branco
                  backgroundColor: document.documentElement.classList.contains('dark')
                    ? `#${label.color}20`
                    : `#${label.color}`,
                  color: document.documentElement.classList.contains('dark')
                    ? `#${label.color}`
                    : '#ffffff',
                  borderColor: document.documentElement.classList.contains('dark')
                    ? `#${label.color}40`
                    : 'transparent',
                  borderWidth: '1px',
                }}
                title={activeLabelFilter === label.name ? `Filtrado por: ${convertGithubEmojis(label.name)} (clique para remover)` : `Clique para filtrar por ${convertGithubEmojis(label.name)}`}
              >
                {convertGithubEmojis(label.name)}
              </span>
            ))}
          </div>
        )}

        {/* Footer: Avatares e Due Date */}
        <div className="flex items-center justify-between gap-2 mt-2">
          {/* Assignees */}
          {card.assignees.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {card.assignees.slice(0, 3).map((assignee) => (
                  <img
                    key={assignee.login}
                    src={assignee.avatarUrl}
                    alt={assignee.login}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAssigneeClick?.(assignee.login);
                    }}
                    className={`w-6 h-6 rounded-full border-2 hover:z-10 transition-transform hover:scale-125 cursor-pointer ${
                      assignee.login === currentUser
                        ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-400 dark:ring-blue-300 ring-offset-1 scale-110 z-10'
                        : 'border-white dark:border-gray-800'
                    } ${
                      activeAssigneeFilter === assignee.login
                        ? 'ring-4 ring-yellow-400 dark:ring-yellow-500 scale-125'
                        : ''
                    }`}
                    title={activeAssigneeFilter === assignee.login ? `Filtrado por: ${assignee.login} (clique para remover)` : `Clique para filtrar por ${assignee.login}`}
                  />
                ))}
              </div>
              {card.assignees.length > 3 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  +{card.assignees.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Due Date */}
          {card.dueDate && (
            <div className={`flex items-center gap-1 text-xs font-medium ${
              dueDateStatus === 'overdue'
                ? 'text-red-600 dark:text-red-400'
                : dueDateStatus === 'soon'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              <Calendar size={12} />
              <span>
                {dueDateStatus === 'overdue'
                  ? `Vencido há ${Math.abs(daysUntilDue)}d`
                  : dueDateStatus === 'soon'
                  ? `${daysUntilDue}d`
                  : new Date(card.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                }
              </span>
            </div>
          )}
        </div>

        {/* Última interação */}
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 italic"
            title={card.lastEventDetails || undefined}
          >
            {card.lastEventLoading ? (
              <>
                <Clock size={10} className="animate-spin" />
                <span>Carregando...</span>
              </>
            ) : card.lastEvent && card.lastEventActor ? (
              <>
                {card.lastEventActorAvatar && (
                  <img
                    src={card.lastEventActorAvatar}
                    alt={card.lastEventActor}
                    className="w-4 h-4 rounded-full"
                    title={card.lastEventActor}
                  />
                )}
                <span>{card.lastEvent}</span>
              </>
            ) : (
              <>
                <Clock size={10} />
                <span>{getLastInteractionText(card)}</span>
              </>
            )}
          </div>
        </div>
        </div>
        {/* Fim do conteúdo expansível */}
      </a>
    </div>
  );
};
