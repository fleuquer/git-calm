import React from 'react';
import type { ProjectCard as ProjectCardType } from '../types';
import { Clock, AlertCircle, XCircle, AlertTriangle, Wrench, Sparkles, MapPin, Calendar, UserX } from 'lucide-react';
import { convertGithubEmojis } from '../utils/emojiConverter';
import { getLabelStyle } from '../utils/labelColors';
import { normalizeTitleCase } from '../utils/titleCase';

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
  /** Layout em lista: cards colados, sem arredondamento, avatares quadrados */
  listLayout?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  columnStatus?: string;
}

// Mapa de ícones para tipos de issue (formato: "1-Erro", "2-Problema", etc)
// Cores em index.css (--type-N): mudam com o tema
const TYPE_ICON_MAP: { [key: string]: { icon: any; color: string } } = {
  '1': { icon: XCircle, color: 'var(--type-1)' },       // Erro
  '2': { icon: AlertTriangle, color: 'var(--type-2)' }, // Problema
  '3': { icon: Wrench, color: 'var(--type-3)' },        // Adequação
  '4': { icon: Sparkles, color: 'var(--type-4)' },      // Melhoria
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
    return `Última atualização • ${timeAgo}`;
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
  listLayout = false,
  draggable: isDraggable = false,
  columnStatus,
}) => {
  const daysSinceUpdate = getDaysSinceUpdate(card.updatedAt);
  const agingColor = getAgingColor(daysSinceUpdate);
  const isOld = daysSinceUpdate > 7;

  // Verificar se não tem assignees (recebe destaque visual)
  const hasNoAssignees = card.assignees.length === 0;
  // Avatar vazio tracejado: sinaliza card sem responsável sem animação chamativa
  const unassignedAvatar = (size: string) => (
    <span className={`${size} ${listLayout ? 'rounded' : 'rounded-full'} border border-dashed border-red-400 dark:border-red-500/70 bg-red-50 dark:bg-red-500/10 flex items-center justify-center`}>
      <UserX size={12} className="text-red-500 dark:text-red-400" />
    </span>
  );

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

  // Tipo da issue (1-4): define a cor da tarja
  const typeNum = typeLabels
    .map(l => l.name.match(/^([1-4])-/)?.[1])
    .find(t => t && TYPE_ICON_MAP[t]);

  // Lista: tarja como borda esquerda (com os cards colados vira uma faixa contínua).
  // Cartões: barra fina por dentro do card, que não acompanha a curva do canto arredondado.
  const typeBorderClass = listLayout && typeNum ? `type-border-${typeNum}` : '';
  const typeBorderStyle: React.CSSProperties = listLayout
    ? { borderLeftWidth: '3px', borderLeftStyle: 'solid', ...(typeNum ? {} : { borderLeftColor: 'transparent' }) }
    : {};

  // Títulos em CAIXA ALTA são exibidos como frase normal (o título real fica no tooltip)
  const displayTitle = normalizeTitleCase(card.title);

  // Avatares presos no canto inferior direito, nos dois layouts. O rodapé reserva esse
  // espaço (a última linha tem a altura do avatar), então o título usa a largura toda;
  // no compacto o título é a última linha visível e também reserva.
  const maxAvatars = 3;
  const shownAvatars = hasNoAssignees ? 1 : Math.min(card.assignees.length, maxAvatars);
  // No compacto o card é baixo: avatar menor para não encostar no tempo do canto superior
  const avatarPx = compactView ? 24 : 28;
  const avatarSizeClass = compactView ? 'w-6 h-6' : 'w-7 h-7';
  const avatarStep = listLayout ? avatarPx + 2 : avatarPx - 6; // quadrados lado a lado / redondos sobrepostos
  const avatarSpace = avatarPx + (shownAvatars - 1) * avatarStep + (card.assignees.length > maxAvatars ? 24 : 0) + 10;
  const reserveAvatarSpace = { paddingRight: avatarSpace };
  const avatarPosition = `absolute right-3 ${compactView ? 'bottom-2' : listLayout ? 'bottom-2.5' : 'bottom-3'}`;

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
        relative group cursor-pointer card-type-border card-transition transition-all
        ${listLayout
          ? `border-0 border-b border-gray-200 dark:border-gray-700 px-3 py-2.5 ${hasNoAssignees
              ? 'bg-red-50 dark:bg-red-500/[0.07] hover:bg-red-100/70 dark:hover:bg-red-500/[0.12]'
              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`
          : `bg-white dark:bg-gray-800 rounded-lg p-3 border shadow-sm dark:shadow-none hover:shadow-md ${hasNoAssignees
              ? 'border-dashed border-red-400/80 dark:border-red-500/60'
              : 'border-transparent dark:border-gray-700 dark:hover:border-gray-600'}`}
        ${animationClass || ''}
        ${typeBorderClass}
        ${compactView ? 'compact-card-view' : ''}
        ${listLayout ? 'list-card-view' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      style={{
        ...typeBorderStyle,
        opacity: opacityValue,
      }}
    >
      {/* Tarja do tipo nos cartões: barra fina por dentro, afastada dos cantos */}
      {!listLayout && typeNum && (
        <span
          aria-hidden
          className="absolute left-1 top-2.5 bottom-2.5 w-[3px] rounded-full"
          style={{ background: `var(--type-${typeNum})` }}
        />
      )}
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
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
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
                <MapPin size={12} className="text-gray-400 dark:text-gray-500" />
                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
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

        {/* Título */}
        <div style={compactView ? reserveAvatarSpace : undefined}>
          <h4 className="text-sm font-normal text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug mb-1.5 line-clamp-3" title={displayTitle !== card.title ? card.title : undefined}>
            {displayTitle}
          </h4>
        </div>

        {/* Conteúdo expansível (oculto em modo compacto, visível ao hover) */}
        <div className={compactView ? 'compact-card-expandable' : ''} style={reserveAvatarSpace}>
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
                className={`text-xs px-1.5 py-0.5 ${listLayout ? 'rounded-sm' : 'rounded'} font-medium dark:border cursor-pointer hover:scale-105 transition-transform ${
                  activeLabelFilter === label.name
                    ? 'ring-2 ring-yellow-400 dark:ring-yellow-500'
                    : ''
                }`}
                style={getLabelStyle(label.color)}
                title={activeLabelFilter === label.name ? `Filtrado por: ${convertGithubEmojis(label.name)} (clique para remover)` : `Clique para filtrar por ${convertGithubEmojis(label.name)}`}
              >
                {convertGithubEmojis(label.name)}
              </span>
            ))}
          </div>
        )}

        {/* Alertas: sem responsável e prazo */}
        {(hasNoAssignees || card.dueDate) && (
        <div className="flex items-center gap-3 mt-2">
          {hasNoAssignees && (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Sem responsável</span>
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
        )}

        {/* Última interação (linha com a altura dos avatares, que ficam à direita) */}
        <div className={`mt-1.5 flex items-center ${compactView ? 'min-h-6' : 'min-h-7'}`}>
          <div
            className="flex items-center gap-1.5 min-w-0 text-xs text-gray-500 dark:text-gray-400"
            title={card.lastEventDetails || undefined}
          >
            {card.lastEventLoading ? (
              <>
                <Clock size={10} className="animate-spin shrink-0" />
                <span>Carregando...</span>
              </>
            ) : card.lastEvent && card.lastEventActor ? (
              <>
                {card.lastEventActorAvatar && (
                  <img
                    src={card.lastEventActorAvatar}
                    alt={card.lastEventActor}
                    className="w-4 h-4 rounded-full shrink-0"
                    title={card.lastEventActor}
                  />
                )}
                <span className="truncate">{card.lastEvent}</span>
              </>
            ) : (
              <>
                <Clock size={10} className="shrink-0" />
                <span className="truncate">{getLastInteractionText(card)}</span>
              </>
            )}
          </div>
        </div>
        </div>
        {/* Fim do conteúdo expansível */}

        {/* Responsáveis: canto inferior direito (quadrados na lista, redondos nos cartões) */}
        {card.assignees.length > 0 ? (
          <div className={`${avatarPosition} flex items-center ${listLayout ? 'gap-0.5' : '-space-x-1.5'}`}>
            {card.assignees.slice(0, maxAvatars).map((assignee) => (
              <img
                key={assignee.login}
                src={assignee.avatarUrl}
                alt={assignee.login}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAssigneeClick?.(assignee.login);
                }}
                className={`${avatarSizeClass} object-cover cursor-pointer ${
                  listLayout ? 'rounded' : 'rounded-full ring-2'
                } ${
                  assignee.login === currentUser
                    ? 'ring-2 ring-blue-500 dark:ring-blue-400 relative z-10'
                    : listLayout ? '' : 'ring-white dark:ring-gray-800'
                } ${
                  activeAssigneeFilter === assignee.login
                    ? 'outline-2 outline-offset-1 outline-yellow-400 dark:outline-yellow-500'
                    : ''
                }`}
                title={activeAssigneeFilter === assignee.login ? `Filtrado por: ${assignee.login} (clique para remover)` : `Clique para filtrar por ${assignee.login}`}
              />
            ))}
            {card.assignees.length > maxAvatars && (
              <span className="text-xs text-gray-500 dark:text-gray-400 pl-1.5 tabular-nums">+{card.assignees.length - maxAvatars}</span>
            )}
          </div>
        ) : (
          <span className={avatarPosition} title="Sem responsável">
            {unassignedAvatar(avatarSizeClass)}
          </span>
        )}
      </a>
    </div>
  );
};
