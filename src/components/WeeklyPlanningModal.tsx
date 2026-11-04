import React, { useState, useEffect } from 'react';
import { X, ClipboardList, RefreshCw, Target, Ban, Undo2, Copy, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import type { ProjectCard, ProjectColumn } from '../types';
import { groupCardsByPriority, type PriorityGroup } from '../utils/filterUtils';
import { getBlockedColumns, isBlockedColumn } from '../utils/blockedColumns';
import { getReworkColumns, isReworkColumn } from '../utils/reworkColumns';
import { GitHubService } from '../services/github';
import { CardDetailModal } from './CardDetailModal';

const ACCENT_STYLES: Record<'blocked' | 'rework', { border: string; badge: string }> = {
  blocked: { border: 'border-l-orange-400', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  rework: { border: 'border-l-red-400', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
};

function groupCardsByStatus(cards: ProjectCard[]): Array<[string, ProjectCard[]]> {
  const map = new Map<string, ProjectCard[]>();
  cards.forEach(card => {
    if (!map.has(card.status)) map.set(card.status, []);
    map.get(card.status)!.push(card);
  });
  return Array.from(map.entries());
}

interface LastComment {
  id: number;
  author: string;
  authorAvatar: string;
  body: string;
  date: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  columns: ProjectColumn[]; // já filtrado pela guia ativa
  currentViewName?: string;
  org: string;
  token: string;
}

type SectionKey = 'priority' | 'blocked' | 'rework';

export const WeeklyPlanningModal: React.FC<Props> = ({
  isOpen,
  onClose,
  columns,
  currentViewName,
  org,
  token,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [priorityGroups, setPriorityGroups] = useState<PriorityGroup[]>([]);
  const [blockedCards, setBlockedCards] = useState<ProjectCard[]>([]);
  const [reworkCards, setReworkCards] = useState<ProjectCard[]>([]);
  const [lastComments, setLastComments] = useState<Record<string, LastComment | null>>({});
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    priority: false,
    blocked: false,
    rework: false,
  });
  const [expandedPriorityGroups, setExpandedPriorityGroups] = useState<Record<string, boolean>>({});
  const [expandedPriorityColumns, setExpandedPriorityColumns] = useState<Record<string, boolean>>({});
  const [selectedCard, setSelectedCard] = useState<ProjectCard | null>(null);

  const toggleSection = (key: SectionKey) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePriorityGroup = (name: string) => {
    setExpandedPriorityGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const togglePriorityColumn = (key: string) => {
    setExpandedPriorityColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const blockedConfigured = getBlockedColumns().length > 0;
  const reworkConfigured = getReworkColumns().length > 0;

  const loadPlanningData = async () => {
    setIsLoading(true);
    try {
      const allCards = columns.flatMap(c => c.cards);
      setPriorityGroups(groupCardsByPriority(allCards));

      const blocked = columns.filter(c => isBlockedColumn(c.name)).flatMap(c => c.cards);
      const rework = columns.filter(c => isReworkColumn(c.name)).flatMap(c => c.cards);
      setBlockedCards(blocked);
      setReworkCards(rework);

      const cardsNeedingComment = new Map<string, ProjectCard>();
      [...blocked, ...rework].forEach(card => cardsNeedingComment.set(card.id, card));

      const service = new GitHubService(token);
      const results = await Promise.all(
        Array.from(cardsNeedingComment.values()).map(async (card) => {
          if (!card.repo) return [card.id, null] as const;
          try {
            const comments = await service.getIssueComments(org, card.repo, card.number, 1);
            return [card.id, comments[0] ?? null] as const;
          } catch {
            return [card.id, null] as const;
          }
        })
      );
      setLastComments(Object.fromEntries(results));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setExpandedSections({ priority: false, blocked: false, rework: false });
      setExpandedPriorityGroups({});
      setExpandedPriorityColumns({});
      loadPlanningData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const exportToMarkdown = () => {
    let markdown = `# Planejamento da Semana\n\n`;
    if (currentViewName) {
      markdown += `**Guia:** ${currentViewName}\n\n`;
    }
    markdown += `---\n\n`;

    markdown += `## 🎯 Prioridades da Semana\n\n`;
    if (priorityGroups.length === 0) {
      markdown += `*Nenhum card priorizado no momento.*\n\n`;
    } else {
      priorityGroups.forEach(group => {
        markdown += `**${group.name}** (${group.cards.length})\n`;
        group.cards.forEach(card => {
          markdown += `- [#${card.number} - ${card.title}](${card.url})\n`;
        });
        markdown += `\n`;
      });
    }

    markdown += `## 🚧 Bloqueios/Impedimentos\n\n`;
    if (blockedCards.length === 0) {
      markdown += `*Nenhum bloqueio no momento.*\n\n`;
    } else {
      blockedCards.forEach(card => {
        markdown += `- [#${card.number} - ${card.title}](${card.url})\n`;
        const comment = lastComments[card.id];
        if (comment) {
          markdown += `  > ${comment.body.replace(/\n/g, ' ')} — *${comment.author}*\n`;
        }
      });
      markdown += `\n`;
    }

    markdown += `## 🔁 Retrabalho (reprovados no teste)\n\n`;
    if (reworkCards.length === 0) {
      markdown += `*Nenhum card em retrabalho no momento.*\n\n`;
    } else {
      reworkCards.forEach(card => {
        markdown += `- [#${card.number} - ${card.title}](${card.url})\n`;
        const comment = lastComments[card.id];
        if (comment) {
          markdown += `  > ${comment.body.replace(/\n/g, ' ')} — *${comment.author}*\n`;
        }
      });
      markdown += `\n`;
    }

    navigator.clipboard.writeText(markdown);
    alert('Resumo de planejamento copiado para a área de transferência!');
  };

  if (!isOpen) return null;

  const renderCardWithComment = (card: ProjectCard, accent: 'blocked' | 'rework') => {
    const comment = lastComments[card.id];
    const style = ACCENT_STYLES[accent];
    return (
      <div
        key={card.id}
        className={`p-3 border-l-4 ${style.border} border-y border-r border-gray-200 dark:border-gray-700 rounded-r-lg bg-white dark:bg-gray-800`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <button
            onClick={() => setSelectedCard(card)}
            className="text-sm font-normal text-gray-900 dark:text-white hover:underline text-left"
          >
            <span className="text-blue-600 dark:text-blue-400 font-bold mr-1">#{card.number}</span>
            {card.title}
          </button>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
            {card.status}
          </span>
        </div>
        {card.assignees.length > 0 && (
          <div className="flex -space-x-1.5 mb-2">
            {card.assignees.map(a => (
              <img
                key={a.login}
                src={a.avatarUrl}
                alt={a.login}
                title={a.login}
                className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800"
              />
            ))}
          </div>
        )}
        {comment ? (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
            <img
              src={comment.authorAvatar}
              alt={comment.author}
              title={comment.author}
              className="w-6 h-6 rounded-full shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{comment.author}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {new Date(comment.date).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {comment.body || '(sem texto)'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sem comentários registrados.</p>
        )}
      </div>
    );
  };

  const renderNotConfiguredNotice = (tabLabel: string) => (
    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-300">
        Nenhuma coluna configurada para esta seção ainda. Vá em <strong>Configurações → Mapeamentos → aba "{tabLabel}"</strong> e marque a(s) coluna(s) do seu board correspondentes.
      </p>
    </div>
  );

  const renderSectionHeader = (opts: {
    sectionKey: SectionKey;
    icon: React.ReactNode;
    title: string;
    description: string;
    count: number;
    notConfigured?: boolean;
  }) => {
    const { sectionKey, icon, title, description, count, notConfigured } = opts;
    const isExpanded = expandedSections[sectionKey];
    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-start gap-3 text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-gray-400 mt-1 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-400 mt-1 shrink-0" />
        )}
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
            {notConfigured ? (
              <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full font-medium">
                não configurado
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full font-medium">
                {count}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ClipboardList className="text-blue-600 dark:text-blue-400" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Planejamento da Semana
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Resumo pra reunião de início de semana{currentViewName ? ` — guia ${currentViewName}` : ''}. Clique em cada seção pra expandir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPlanningData}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button
              onClick={exportToMarkdown}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium transition-colors"
            >
              <Copy size={14} />
              Copiar Markdown
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={24} className="animate-spin text-blue-600 dark:text-blue-400 mr-3" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Carregando...</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Prioridades */}
              <div>
                {renderSectionHeader({
                  sectionKey: 'priority',
                  icon: <Target size={18} className="text-purple-500" />,
                  title: 'Prioridades da Semana',
                  description: 'Cards com label de prioridade (Erro, Problema, Adequação, Melhoria), agrupados por coluna e com o responsável — mostra o que está parado sem dono e precisa ser passado pra alguém.',
                  count: priorityGroups.reduce((sum, g) => sum + g.cards.length, 0),
                })}
                {expandedSections.priority && (
                  <div className="px-4 pb-4">
                    {priorityGroups.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic pl-7">Nenhum card priorizado no momento.</p>
                    ) : (
                      <div className="space-y-1 pl-7">
                        {priorityGroups.map(group => {
                          const isGroupExpanded = expandedPriorityGroups[group.name];
                          const statusGroups = groupCardsByStatus(group.cards);
                          return (
                            <div key={group.name}>
                              <button
                                onClick={() => togglePriorityGroup(group.name)}
                                className="w-full flex items-center gap-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left"
                              >
                                {isGroupExpanded ? (
                                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                                ) : (
                                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                                )}
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: group.color }}
                                />
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{group.name}</span>
                                <span className="text-xs text-gray-400">({group.cards.length})</span>
                              </button>
                              {isGroupExpanded && (
                                <div className="pl-6 space-y-0.5 mb-1">
                                  {statusGroups.map(([status, statusCards]) => {
                                    const columnKey = `${group.name}::${status}`;
                                    const isColumnExpanded = expandedPriorityColumns[columnKey];
                                    return (
                                      <div key={status}>
                                        <button
                                          onClick={() => togglePriorityColumn(columnKey)}
                                          className="w-full flex items-center gap-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left"
                                        >
                                          {isColumnExpanded ? (
                                            <ChevronDown size={12} className="text-gray-400 shrink-0" />
                                          ) : (
                                            <ChevronRight size={12} className="text-gray-400 shrink-0" />
                                          )}
                                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                            {status}
                                          </span>
                                          <span className="text-xs text-gray-400">({statusCards.length})</span>
                                        </button>
                                        {isColumnExpanded && (
                                          <div className="pl-5 space-y-1 mb-1">
                                            {statusCards.map(card => (
                                              <button
                                                key={card.id}
                                                onClick={() => setSelectedCard(card)}
                                                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                              >
                                                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                                  <span className="font-bold text-blue-600 dark:text-blue-400 mr-1">#{card.number}</span>
                                                  {card.title}
                                                </span>
                                                {card.assignees.length > 0 ? (
                                                  <div className="flex -space-x-1 shrink-0">
                                                    {card.assignees.map(a => (
                                                      <img
                                                        key={a.login}
                                                        src={a.avatarUrl}
                                                        alt={a.login}
                                                        title={a.login}
                                                        className="w-5 h-5 rounded-full border border-white dark:border-gray-800"
                                                      />
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium shrink-0">
                                                    sem responsável
                                                  </span>
                                                )}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bloqueios */}
              <div>
                {renderSectionHeader({
                  sectionKey: 'blocked',
                  icon: <Ban size={18} className="text-orange-500" />,
                  title: 'Bloqueios/Impedimentos',
                  description: 'Cards parados em colunas marcadas como bloqueio — normalmente precisam de ajuda de outra pessoa/time pra destravar.',
                  count: blockedCards.length,
                  notConfigured: !blockedConfigured,
                })}
                {expandedSections.blocked && (
                  <div className="px-4 pb-4 pl-11">
                    {!blockedConfigured ? (
                      renderNotConfiguredNotice('Bloqueios')
                    ) : blockedCards.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic">Nenhum bloqueio no momento 🎉</p>
                    ) : (
                      <div className="space-y-2">
                        {blockedCards.map(card => renderCardWithComment(card, 'blocked'))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Retrabalho */}
              <div>
                {renderSectionHeader({
                  sectionKey: 'rework',
                  icon: <Undo2 size={18} className="text-red-500" />,
                  title: 'Retrabalho',
                  description: 'Cards que retornaram para uma coluna de retrabalho por não terem passado no teste/revisão — precisam ser corrigidos antes de seguir.',
                  count: reworkCards.length,
                  notConfigured: !reworkConfigured,
                })}
                {expandedSections.rework && (
                  <div className="px-4 pb-4 pl-11">
                    {!reworkConfigured ? (
                      renderNotConfiguredNotice('Retrabalho')
                    ) : reworkCards.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic">Nenhum card em retrabalho no momento.</p>
                    ) : (
                      <div className="space-y-2">
                        {reworkCards.map(card => renderCardWithComment(card, 'rework'))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <CardDetailModal
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        token={token}
        org={org}
      />
    </div>
  );
};
