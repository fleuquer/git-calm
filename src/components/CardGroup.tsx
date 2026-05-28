import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Tag, Users, MapPin, XCircle, AlertTriangle, Wrench, Sparkles } from 'lucide-react';
import { ProjectCard } from './ProjectCard';
import type { ProjectCard as ProjectCardType } from '../types';

interface Props {
  groupName: string;
  groupType: 'person' | 'tag' | 'priority' | 'city';
  cards: ProjectCardType[];
  onCardClick: (card: ProjectCardType) => void;
  cardAnimations?: Map<number, string>;
  groupColor?: string; // Cor customizada (hex) para o grupo (usado em prioridades)
  priorityNum?: string; // Número da prioridade (1-4) para usar o ícone correto
  compactCardView?: boolean;
}

export const CardGroup: React.FC<Props> = ({
  groupName,
  groupType,
  cards,
  onCardClick,
  cardAnimations,
  groupColor, // Cor customizada para o grupo
  priorityNum, // Número da prioridade (1-4)
  compactCardView = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false); // Iniciar minimizado

  // Mapa de ícones para prioridades (igual ao ProjectCard)
  const PRIORITY_ICONS: { [key: string]: any } = {
    '1': XCircle,      // Erro
    '2': AlertTriangle, // Problema
    '3': Wrench,       // Adequação
    '4': Sparkles,     // Melhoria
  };

  // Cores e ícones diferentes para cada tipo de grupo
  let bgColor, borderColor, hoverBg, icon, iconColor;

  // Converter hex para rgb para usar com opacidade
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  switch (groupType) {
    case 'person':
      bgColor = 'bg-blue-50 dark:bg-blue-900/20';
      borderColor = 'border-blue-200 dark:border-blue-800';
      hoverBg = 'hover:bg-blue-100 dark:hover:bg-blue-900/30';
      icon = <Users size={18} className="text-blue-600 dark:text-blue-400" />;
      break;
    case 'tag':
      bgColor = 'bg-green-50 dark:bg-green-900/20';
      borderColor = 'border-green-200 dark:border-green-800';
      hoverBg = 'hover:bg-green-100 dark:hover:bg-green-900/30';
      icon = <Tag size={18} className="text-green-600 dark:text-green-400" />;
      break;
    case 'priority':
      // Usar cor customizada se fornecida
      if (groupColor) {
        const rgb = hexToRgb(groupColor);
        if (rgb) {
          bgColor = '';
          borderColor = '';
          hoverBg = '';
          iconColor = groupColor;
        }
      } else {
        bgColor = 'bg-orange-50 dark:bg-orange-900/20';
        borderColor = 'border-orange-200 dark:border-orange-800';
        hoverBg = 'hover:bg-orange-100 dark:hover:bg-orange-900/30';
        iconColor = undefined;
      }
      // Usar ícone específico da prioridade
      const PriorityIcon = priorityNum && PRIORITY_ICONS[priorityNum] ? PRIORITY_ICONS[priorityNum] : XCircle;
      icon = <PriorityIcon size={18} style={iconColor ? { color: iconColor } : {}} className={!iconColor ? "text-orange-600 dark:text-orange-400" : ""} />;
      break;
    case 'city':
      bgColor = 'bg-purple-50 dark:bg-purple-900/20';
      borderColor = 'border-purple-200 dark:border-purple-800';
      hoverBg = 'hover:bg-purple-100 dark:hover:bg-purple-900/30';
      icon = <MapPin size={18} className="text-purple-600 dark:text-purple-400" />;
      break;
  }

  // Cor do badge de contagem
  const badgeColor =
    groupType === 'person' ? 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100' :
    groupType === 'tag' ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100' :
    groupType === 'priority' ? 'bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-100' :
    'bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100';

  // Calcular estilos inline se houver cor customizada
  const customStyle = groupColor ? {
    container: {
      backgroundColor: `${groupColor}10`,
      borderColor: `${groupColor}80`
    },
    header: {
      backgroundColor: `${groupColor}05`
    },
    headerHover: {
      backgroundColor: `${groupColor}20`
    }
  } : null;

  return (
    <div
      className={`mb-3 border-2 ${borderColor || ''} rounded-lg overflow-hidden ${bgColor || ''}`}
      style={customStyle?.container}
    >
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-3 py-2.5 flex items-center justify-between ${hoverBg || ''} transition-colors`}
        style={customStyle?.header}
        onMouseEnter={(e) => customStyle && Object.assign(e.currentTarget.style, customStyle.headerHover)}
        onMouseLeave={(e) => customStyle && Object.assign(e.currentTarget.style, customStyle.header)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown size={18} className="text-gray-700 dark:text-gray-300" />
          ) : (
            <ChevronRight size={18} className="text-gray-700 dark:text-gray-300" />
          )}
          {icon}
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {groupName}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
            {cards.length}
          </span>
        </div>
      </button>

      {/* Group Cards */}
      {isExpanded && (
        <div className="p-2 space-y-2 bg-white dark:bg-gray-900">
          {cards.map(card => (
            <ProjectCard
              key={card.id}
              card={card}
              onCardClick={onCardClick}
              animationClass={cardAnimations?.get(card.number) || ''}
              compactView={compactCardView}
            />
          ))}
        </div>
      )}
    </div>
  );
};
