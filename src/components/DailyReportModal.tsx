import React, { useState, useEffect } from 'react';
import { X, FileText, RefreshCw, Calendar, Clock, User, Activity, MessageSquare, GitCommit, Users, XCircle, AlertTriangle, Wrench, Sparkles, MapPin, Filter } from 'lucide-react';
import type { ProjectCard, ProjectColumn, UserDailyReport } from '../types';
import { getPeopleForView } from '../utils/viewPeopleMapping';
import { GitHubService } from '../services/github';
import { CardDetailModal } from './CardDetailModal';

interface CardActivities {
  card: ProjectCard;
  activities: any[];
  firstAssignment?: string;
  totalTimeInExecution?: string;
  isSynthetic?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  columns: ProjectColumn[];
  currentViewId: string;
  token: string;
  org: string;
}

export const DailyReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  columns,
  currentViewId,
  token,
  org,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reports, setReports] = useState<UserDailyReport[]>([]);
  const [allReportsData, setAllReportsData] = useState<UserDailyReport[]>([]); // Dados originais completos
  const [selectedCard, setSelectedCard] = useState<ProjectCard | null>(null);
  const [selectedDevUsername, setSelectedDevUsername] = useState<string | null>(null);
  const [selectedDetailPanel, setSelectedDetailPanel] = useState<'commits' | 'comments' | null>(null);
  const [includedColumns, setIncludedColumns] = useState<string[]>(() => {
    // Carregar do localStorage
    const saved = localStorage.getItem('dailyReport_includedColumns');
    if (saved) {
      return JSON.parse(saved);
    }
    // Por padrão, todas as colunas estão incluídas
    return columns.map(col => col.name);
  });
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activePreset, setActivePreset] = useState<string>('hoje');
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const applyPreset = (preset: string) => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIso = today.toISOString().split('T')[0];
    const nowTime = `${pad(today.getHours())}:${pad(today.getMinutes())}`;
    setActivePreset(preset);
    switch (preset) {
      case 'hoje':
        setDateFrom(todayIso); setDateTo(todayIso);
        setStartTime('00:00'); setEndTime(nowTime);
        break;
      case 'ontem': {
        const y = new Date(today); y.setDate(y.getDate() - 1);
        const yIso = y.toISOString().split('T')[0];
        setDateFrom(yIso); setDateTo(yIso);
        setStartTime('00:00'); setEndTime('23:59');
        break;
      }
      case 'semana': {
        const mon = new Date(today);
        const diff = today.getDay() === 0 ? -6 : 1 - today.getDay();
        mon.setDate(today.getDate() + diff);
        setDateFrom(mon.toISOString().split('T')[0]); setDateTo(todayIso);
        setStartTime('00:00'); setEndTime(nowTime);
        break;
      }
      case 'mes': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        setDateFrom(first.toISOString().split('T')[0]); setDateTo(todayIso);
        setStartTime('00:00'); setEndTime(nowTime);
        break;
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedCard(null);
      // Não carregar automaticamente - usuário escolhe filtros primeiro
    }
  }, [isOpen]);

  // Salvar includedColumns no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem('dailyReport_includedColumns', JSON.stringify(includedColumns));
    // Filtrar dados localmente quando includedColumns mudar
    if (allReportsData.length > 0) {
      applyFiltersToReports(allReportsData);
    }
  }, [includedColumns, allReportsData]);

  // Função para agrupar atividades por card
  const groupActivitiesByCard = (activities: any[], cards: any[]): CardActivities[] => {
    const cardMap = new Map<number, CardActivities>();

    // Agrupar apenas cards que tiveram atividade no período
    activities.forEach(activity => {
      if (activity.cardNumber) {
        if (!cardMap.has(activity.cardNumber)) {
          const card = cards.find((c: any) => c.number === activity.cardNumber);
          cardMap.set(activity.cardNumber, {
            card: card ?? {
              id: `synthetic-${activity.cardNumber}`,
              number: activity.cardNumber,
              title: activity.cardTitle || `#${activity.cardNumber}`,
              status: 'Histórico',
              assignees: [],
              labels: [],
              createdAt: activity.timestamp,
              updatedAt: activity.timestamp,
              url: activity.cardUrl || '#',
              repo: activity.repo,
            } as any,
            activities: [],
            isSynthetic: !card,
            firstAssignment: undefined,
            totalTimeInExecution: undefined,
          });
        }

        const existing = cardMap.get(activity.cardNumber);
        if (existing) {
          existing.activities.push(activity);

          // Capturar primeira atribuição
          if (activity.type === 'assigned' && !existing.firstAssignment) {
            existing.firstAssignment = activity.timestamp;
          }
        }
      }
    });

    // Adicionar cards em execução mesmo sem atividade no período
    // (para ver em que a pessoa está trabalhando/travada)
    cards.forEach(card => {
      const isInProgress = card.status.toLowerCase().includes('execu') ||
                          card.status.toLowerCase().includes('progress') ||
                          card.status.toLowerCase().includes('desenvolv');

      if (isInProgress && !cardMap.has(card.number)) {
        cardMap.set(card.number, {
          card,
          activities: [],
          firstAssignment: undefined,
          totalTimeInExecution: undefined,
        });
      }
    });

    // Calcular tempo em execução para cards em status de execução
    cardMap.forEach((cardActivities) => {
      const card = cardActivities.card;
      if (card.status.toLowerCase().includes('execu') ||
          card.status.toLowerCase().includes('progress') ||
          card.status.toLowerCase().includes('desenvolv')) {

        // Pegar a data da primeira atividade ou atribuição
        const firstActivity = cardActivities.activities.length > 0
          ? cardActivities.activities[0].timestamp
          : cardActivities.firstAssignment;

        if (firstActivity) {
          const startDate = new Date(firstActivity);
          const now = new Date();
          const diffMs = now.getTime() - startDate.getTime();
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const days = Math.floor(hours / 24);

          if (days > 0) {
            cardActivities.totalTimeInExecution = `${days}d ${hours % 24}h`;
          } else {
            cardActivities.totalTimeInExecution = `${hours}h`;
          }
        }
      }
    });

    // Converter para array e ordenar por número de atividades (mais ativo primeiro)
    return Array.from(cardMap.values())
      .filter(ca => ca.activities.length > 0 || ca.card)
      .sort((a, b) => b.activities.length - a.activities.length);
  };

  // Helper functions para ícones de tipo e cidade
  const TYPE_ICON_MAP: { [key: string]: { icon: any; color: string } } = {
    '1': { icon: XCircle, color: '#ef4444' }, // Erro
    '2': { icon: AlertTriangle, color: '#f97316' }, // Problema
    '3': { icon: Wrench, color: '#3b82f6' }, // Adequação
    '4': { icon: Sparkles, color: '#8b5cf6' }, // Melhoria
  };

  const getTypeIcon = (labelName: string) => {
    const type = labelName.match(/^([1-4])-/)?.[1];
    if (!type) return null;
    const typeInfo = TYPE_ICON_MAP[type];
    if (!typeInfo) return null;
    const Icon = typeInfo.icon;
    return <Icon size={14} style={{ color: typeInfo.color }} title={labelName} />;
  };

  const isCityLabel = (labelName: string) => {
    return /^[A-Z]{2}-/.test(labelName);
  };

  const getCityDisplay = (labelName: string) => {
    const parts = labelName.split('-');
    return parts.length > 1 ? parts[1] : labelName;
  };

  // Função para calcular tempo desde última atualização (aging)
  const getDaysSinceUpdate = (updatedAt: string): number => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffTime = Math.abs(now.getTime() - updated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatRelativeDate = (date: string): string => {
    const days = getDaysSinceUpdate(date);

    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days <= 7) return `${days}d`;
    if (days <= 30) return `${days}d`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}sem`;

    const months = Math.floor(days / 30);
    return `${months}m`;
  };

  const getAgingColor = (days: number): string => {
    if (days <= 7) return 'text-gray-400';
    if (days <= 14) return 'text-yellow-600 dark:text-yellow-500';
    if (days <= 30) return 'text-orange-600 dark:text-orange-500';
    return 'text-red-600 dark:text-red-500';
  };

  // Função para agrupar cards por status
  const groupCardsByStatus = (cardActivities: CardActivities[]) => {
    const grouped = new Map<string, CardActivities[]>();

    cardActivities.forEach(ca => {
      const status = ca.card.status;
      if (!grouped.has(status)) {
        grouped.set(status, []);
      }
      grouped.get(status)!.push(ca);
    });

    return Array.from(grouped.entries()).map(([status, cards]) => ({
      status,
      cards,
      count: cards.length,
    }));
  };

  const loadDailyReports = async () => {
    setIsLoading(true);
    console.log('🔄 Iniciando geração de relatórios...');

    try {
      const service = new GitHubService(token);
      const people = getPeopleForView(currentViewId);

      console.log('👥 Pessoas encontradas:', people);
      console.log('📊 View atual:', currentViewId);

      if (people.length === 0) {
        alert('Nenhuma pessoa mapeada para esta guia. Configure o mapeamento em Configurações → Guia → Pessoas');
        setIsLoading(false);
        return;
      }

      // Criar range de data/hora
      const startDate = new Date(`${dateFrom}T${startTime}:00`);
      const endDate = new Date(`${dateTo}T${endTime}:59`);

      console.log('📅 Período:', { startDate, endDate });

      // Buscar atividades para TODAS as pessoas simultaneamente
      console.log('🚀 Buscando atividades de todas as pessoas em paralelo...');

      const userReportPromises = people.map(async (username) => {
        console.log(`🔍 Buscando atividades de ${username}...`);
        try {
          const result = await service.getDailyActivitiesForUser(
            org,
            username,
            startDate,
            endDate,
            columns,
            currentViewId
          );

          console.log(`✅ Resultado para ${username}:`, result);

          // Processar e agrupar atividades
          const activities = result.activities;
          const cards = result.cards; // NÃO filtrar aqui - guardar tudo

          // Agrupar atividades por card (com todos os cards)
          const cardActivities = groupActivitiesByCard(activities, cards);

          // Encontrar o card principal (mais tempo em execução)
          const executionCards = cards.filter((c: any) =>
            c.status.toLowerCase().includes('execu') ||
            c.status.toLowerCase().includes('progress') ||
            c.status.toLowerCase().includes('desenvolv')
          );

          const mainCard = executionCards.length > 0 ? executionCards[0] : cards[0];

          // Calcular tempo em execução do card principal
          let mainCardTimeInExecution = undefined;
          if (mainCard) {
            const cardGroup = cardActivities.find(ca => ca.card.number === mainCard.number);
            mainCardTimeInExecution = cardGroup?.totalTimeInExecution;
          }

          // Criar sumário
          const summary = {
            totalActivities: activities.length,
            cardsWorked: new Set(activities.map((a: any) => a.cardNumber)).size,
            commentsAdded: activities.filter((a: any) => a.type === 'comment').length,
            commitsMade: activities.filter((a: any) => a.type === 'commit').length,
            statusChanges: activities.filter((a: any) => a.type === 'status_change').length,
            mainCard: mainCard ? {
              number: mainCard.number,
              title: mainCard.title,
              url: mainCard.url,
              status: mainCard.status,
              timeSpent: mainCardTimeInExecution,
            } : undefined,
          };

          return {
            user: username,
            activities,
            cardActivities,
            summary,
          };
        } catch (error) {
          console.error(`❌ Erro ao buscar relatório de ${username}:`, error);
          return {
            user: username,
            activities: [],
            cardActivities: [],
            summary: {
              totalActivities: 0,
              cardsWorked: 0,
              commentsAdded: 0,
              commitsMade: 0,
              statusChanges: 0,
            },
          };
        }
      });

      // Aguardar todas as buscas completarem
      const userReports = await Promise.all(userReportPromises);

      console.log('📊 Total de relatórios gerados:', userReports.length);
      console.log('📋 Relatórios:', userReports);
      setAllReportsData(userReports); // Guardar dados originais completos

      // Aplicar filtros diretamente nos dados recém-carregados (não esperar state atualizar)
      applyFiltersToReports(userReports);
      if (userReports.length > 0) setSelectedDevUsername(prev => prev ?? userReports[0].user);
    } catch (error) {
      console.error('❌ Erro ao carregar relatórios diários:', error);
      alert(`Erro ao gerar relatórios: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Verifique o console para mais detalhes.`);
    } finally {
      setIsLoading(false);
      console.log('✅ Geração de relatórios finalizada');
    }
  };

  // Função para filtrar relatórios localmente (sem chamar API)
  const applyFiltersToReports = (reportsData: UserDailyReport[]) => {
    if (reportsData.length === 0) {
      setReports([]);
      return;
    }

    console.log('🔄 Aplicando filtros localmente...', { includedColumns });

    const filteredReports = reportsData.map(report => {
      // Filtrar cardActivities baseado em includedColumns (mostrar apenas os inclusos)
      const filteredCardActivities = report.cardActivities?.filter(
        ca => includedColumns.includes(ca.card.status) || (ca as any).isSynthetic
      ) || [];

      // Recalcular card principal com cards filtrados
      const filteredCards = filteredCardActivities.map(ca => ca.card);
      const executionCards = filteredCards.filter((c: any) =>
        c.status.toLowerCase().includes('execu') ||
        c.status.toLowerCase().includes('progress') ||
        c.status.toLowerCase().includes('desenvolv')
      );
      const mainCard = executionCards.length > 0 ? executionCards[0] : filteredCards[0];

      let mainCardTimeInExecution = undefined;
      if (mainCard) {
        const cardGroup = filteredCardActivities.find(ca => ca.card.number === mainCard.number);
        mainCardTimeInExecution = cardGroup?.totalTimeInExecution;
      }

      // Recalcular sumário com dados filtrados
      const summary = {
        ...report.summary,
        cardsWorked: filteredCards.length,
        mainCard: mainCard ? {
          number: mainCard.number,
          title: mainCard.title,
          url: mainCard.url,
          status: mainCard.status,
          timeSpent: mainCardTimeInExecution,
        } : undefined,
      };

      return {
        ...report,
        cardActivities: filteredCardActivities,
        summary,
      };
    });

    console.log('✅ Filtros aplicados. Relatórios filtrados:', filteredReports.length);
    setReports(filteredReports);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const exportToMarkdown = () => {
    const periodLabel = dateFrom === dateTo
      ? `${dateFrom} (${startTime}–${endTime})`
      : `${dateFrom} ${startTime} → ${dateTo} ${endTime}`;
    let markdown = `# Relatório de Atividade\n\n`;
    markdown += `**Período:** ${periodLabel}\n\n`;
    markdown += `**Guia:** ${currentViewId}\n\n`;
    markdown += `---\n\n`;

    reports.forEach(report => {
      markdown += `## ${report.user}\n\n`;

      if (report.summary.mainCard) {
        markdown += `**Card Principal (Em Execução):**\n`;
        markdown += `- [#${report.summary.mainCard.number} - ${report.summary.mainCard.title}](${report.summary.mainCard.url})\n`;
        markdown += `- Status: ${report.summary.mainCard.status}\n\n`;
      }

      markdown += `**Resumo:**\n`;
      markdown += `- Total de atividades: ${report.summary.totalActivities}\n`;
      markdown += `- Cards trabalhados: ${report.summary.cardsWorked}\n`;
      markdown += `- Comentários: ${report.summary.commentsAdded}\n`;
      markdown += `- Commits: ${report.summary.commitsMade}\n\n`;

      if (report.activities.length > 0) {
        markdown += `**Atividades Detalhadas:**\n\n`;
        report.activities.forEach(activity => {
          const time = formatTime(activity.timestamp);
          markdown += `- **${time}** - `;

          if (activity.cardNumber) {
            markdown += `[#${activity.cardNumber}](${activity.cardUrl}) - `;
          }

          markdown += `${activity.description}`;

          if (activity.details) {
            markdown += `: ${activity.details}`;
          }

          if (activity.commitSha) {
            markdown += ` (\`${activity.commitSha}\`)`;
          }
          if ((activity as any).branch) {
            markdown += ` [${(activity as any).branch}]`;
          }

          markdown += `\n`;
        });
        markdown += `\n`;
      } else {
        markdown += `*Nenhuma atividade registrada no período.*\n\n`;
      }

      markdown += `---\n\n`;
    });

    // Copiar para clipboard
    navigator.clipboard.writeText(markdown);
    alert('Relatório copiado para a área de transferência!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600 dark:text-blue-400" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Relatório de Atividade
            </h2>
            {selectedCard && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                • #{selectedCard.number} - {selectedCard.title}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-4">
            {/* Presets de período */}
            <div className="flex items-center gap-1">
              {(['hoje', 'ontem', 'semana', 'mes'] as const).map(preset => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activePreset === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {preset === 'hoje' ? 'Hoje' : preset === 'ontem' ? 'Ontem' : preset === 'semana' ? 'Esta semana' : 'Este mês'}
                </button>
              ))}
            </div>

            {/* Range customizado */}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setActivePreset('custom'); }}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setActivePreset('custom'); }}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
              />
              <Clock size={14} className="text-gray-400 ml-1" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); setActivePreset('custom'); }}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
              />
              <span className="text-gray-400 text-xs">–</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); setActivePreset('custom'); }}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
              />
            </div>

            <button
              onClick={loadDailyReports}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>

            <div className="relative">
              <button
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                className="flex items-center gap-2 px-4 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                <Filter size={14} />
                Colunas {includedColumns.length < columns.length && `(${includedColumns.length}/${columns.length})`}
              </button>
              {showColumnFilter && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-[200px]">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Selecionar colunas:</p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {columns.map((col) => (
                      <label key={col.id} className="flex items-center gap-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includedColumns.includes(col.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setIncludedColumns([...includedColumns, col.name]);
                            } else {
                              setIncludedColumns(includedColumns.filter(c => c !== col.name));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{col.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {reports.length > 0 && (
              <button
                onClick={exportToMarkdown}
                className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                <FileText size={14} />
                Copiar Markdown
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" size={32} />
                <p className="text-gray-600 dark:text-gray-400">Gerando relatórios...</p>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-12">
                <FileText size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Clique em "Atualizar" para gerar o relatório
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* LEFT: lista de devs */}
              <div className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                {reports.map((report) => {
                  const palette = ['#3b82f6','#10b981','#8b5cf6','#f97316','#ec4899','#14b8a6','#f43f5e','#6366f1'];
                  const idx = report.user.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % palette.length;
                  const repos = [...new Set(report.activities.filter((a: any) => a.repo).map((a: any) => a.repo as string))];
                  const isSelected = selectedDevUsername === report.user;
                  return (
                    <button
                      key={report.user}
                      onClick={() => setSelectedDevUsername(report.user)}
                      className={`w-full text-left p-4 border-b border-gray-100 dark:border-gray-700 transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-blue-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                          style={{ backgroundColor: palette[idx] }}
                        >
                          {report.user.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{report.user}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className="flex items-center gap-1"><GitCommit size={10} />{report.summary.commitsMade}</span>
                            <span className="flex items-center gap-1"><MessageSquare size={10} />{report.summary.commentsAdded}</span>
                            <span className="flex items-center gap-1"><Activity size={10} />{report.summary.cardsWorked} card{report.summary.cardsWorked !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                      {report.summary.mainCard && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-1.5">
                          🎯 #{report.summary.mainCard.number} {report.summary.mainCard.title}
                        </p>
                      )}
                      {repos.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {repos.slice(0, 2).map(repo => (
                            <span key={repo} className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full truncate max-w-24">
                              {repo}
                            </span>
                          ))}
                          {repos.length > 2 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">+{repos.length - 2}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* MIDDLE: detalhe do dev selecionado */}
              <div className="flex-1 overflow-y-auto min-w-0">
                {(() => {
                  const report = reports.find(r => r.user === selectedDevUsername);
                  if (!report) {
                    return (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 dark:text-gray-500 text-sm">Selecione um desenvolvedor</p>
                      </div>
                    );
                  }
                  const palette = ['#3b82f6','#10b981','#8b5cf6','#f97316','#ec4899','#14b8a6','#f43f5e','#6366f1'];
                  const idx = report.user.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % palette.length;
                  const repos = [...new Set(report.activities.filter((a: any) => a.repo).map((a: any) => a.repo as string))];
                  return (
                    <div className="p-6 max-w-3xl">
                      {/* Header do dev */}
                      <div className="flex items-center gap-4 mb-5">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-lg"
                          style={{ backgroundColor: palette[idx] }}
                        >
                          {report.user.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{report.user}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{report.summary.totalActivities} atividades no período</p>
                        </div>
                        <div className="ml-auto flex gap-2">
                          <button
                            onClick={() => setSelectedDetailPanel(prev => prev === 'commits' ? null : 'commits')}
                            className={`text-center px-3 py-1.5 rounded-lg transition-colors ${
                              selectedDetailPanel === 'commits'
                                ? 'bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-300 dark:ring-blue-700'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{report.summary.commitsMade}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">commits</p>
                          </button>
                          <button
                            onClick={() => setSelectedDetailPanel(prev => prev === 'comments' ? null : 'comments')}
                            className={`text-center px-3 py-1.5 rounded-lg transition-colors ${
                              selectedDetailPanel === 'comments'
                                ? 'bg-green-50 dark:bg-green-950/40 ring-1 ring-green-300 dark:ring-green-700'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">{report.summary.commentsAdded}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">coment.</p>
                          </button>
                          <div className="text-center px-3 py-1.5">
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{report.summary.cardsWorked}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">cards</p>
                          </div>
                        </div>
                      </div>
                      {repos.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-5">
                          {repos.map(repo => (
                            <span key={repo} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                              {repo}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Em Execução */}
                      {report.summary.mainCard && (
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Em Execução</span>
                            <div className="flex-1 h-px bg-blue-200 dark:bg-blue-800/60" />
                          </div>
                          <div
                            className="p-4 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500 border-y border-r border-blue-200 dark:border-blue-800/60 rounded-r-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors mb-5"
                            onClick={() => {
                              const card = report.cardActivities?.find(ca => ca.card.number === report.summary.mainCard?.number)?.card;
                              if (card) setSelectedCard(card);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                  🎯 #{report.summary.mainCard.number}
                                </span>
                                {report.cardActivities?.find(ca => ca.card.number === report.summary.mainCard?.number)?.card.labels
                                  .filter(l => /^[1-4]-/.test(l.name))
                                  .map(label => <div key={label.name}>{getTypeIcon(label.name)}</div>)}
                                {report.cardActivities?.find(ca => ca.card.number === report.summary.mainCard?.number)?.card.labels
                                  .filter(l => isCityLabel(l.name)).slice(0, 1)
                                  .map(label => (
                                    <div key={label.name} className="flex items-center gap-0.5">
                                      <MapPin size={11} className="text-blue-600 dark:text-blue-400" />
                                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{getCityDisplay(label.name)}</span>
                                    </div>
                                  ))}
                              </div>
                              {report.summary.mainCard.timeSpent && (
                                <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold whitespace-nowrap">
                                  🕐 {report.summary.mainCard.timeSpent}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                              {report.summary.mainCard.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{report.summary.mainCard.status}</p>
                          </div>
                        </>
                      )}

                      {/* Outros cards agrupados por status */}
                      {report.cardActivities && (() => {
                        const otherCards = report.cardActivities.filter(
                          ca => ca.card.number !== report.summary.mainCard?.number
                        );
                        const groupedByStatus = groupCardsByStatus(otherCards);

                        return groupedByStatus.length > 0 ? (
                          <div className="space-y-5">
                            {groupedByStatus.map(group => (
                              <div key={group.status}>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    {group.status}
                                  </span>
                                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                  <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{group.count}</span>
                                </div>
                                <div className="space-y-2">
                                  {group.cards.map((cardActivity) => {
                                    const daysSince = getDaysSinceUpdate(cardActivity.card.updatedAt);
                                    const agingColor = getAgingColor(daysSince);
                                    const sl = group.status.toLowerCase();
                                    const leftBorder = sl.includes('execu') || sl.includes('progress') || sl.includes('desenvolv')
                                      ? 'border-l-blue-400'
                                      : sl.includes('revis') || sl.includes('review')
                                      ? 'border-l-amber-400'
                                      : sl.includes('conclu') || sl.includes('done') || sl.includes('fecha')
                                      ? 'border-l-green-400'
                                      : 'border-l-gray-300 dark:border-l-gray-600';
                                    return (
                                      <div
                                        key={cardActivity.card.number}
                                        className={`p-3 border-l-4 ${leftBorder} border-y border-r border-gray-200 dark:border-gray-700 rounded-r-lg bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors`}
                                        onClick={() => setSelectedCard(cardActivity.card)}
                                      >
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">#{cardActivity.card.number}</span>
                                            {cardActivity.card.labels
                                              .filter(l => /^[1-4]-/.test(l.name))
                                              .map(label => <div key={label.name}>{getTypeIcon(label.name)}</div>)}
                                            {cardActivity.card.labels
                                              .filter(l => isCityLabel(l.name))
                                              .slice(0, 1)
                                              .map(label => (
                                                <div key={label.name} className="flex items-center gap-0.5">
                                                  <MapPin size={9} className="text-blue-600 dark:text-blue-400" />
                                                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                                    {getCityDisplay(label.name)}
                                                  </span>
                                                </div>
                                              ))}
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {cardActivity.totalTimeInExecution && (
                                              <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                                                🕐 {cardActivity.totalTimeInExecution}
                                              </span>
                                            )}
                                            <span className={`text-xs font-medium ${agingColor}`}>
                                              {formatRelativeDate(cardActivity.card.updatedAt)}
                                            </span>
                                          </div>
                                        </div>
                                        <p className="text-sm text-gray-900 dark:text-white font-medium mb-1.5">
                                          {cardActivity.card.title}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                          {cardActivity.card.assignees.length > 0 && (
                                            <span className="flex items-center gap-1">
                                              <Users size={10} />
                                              {cardActivity.card.assignees.map((a: any) => a.login).slice(0, 2).join(', ')}
                                              {cardActivity.card.assignees.length > 2 && ` +${cardActivity.card.assignees.length - 2}`}
                                            </span>
                                          )}
                                          {cardActivity.activities.length > 0 && (
                                            <span className="flex items-center gap-1">
                                              <Activity size={10} />
                                              {cardActivity.activities.length} atividade{cardActivity.activities.length !== 1 ? 's' : ''}
                                            </span>
                                          )}
                                        </div>
                                        {cardActivity.activities.filter((a: any) => a.type === 'commit').length > 0 && (
                                          <div className="pt-1.5 border-t border-gray-100 dark:border-gray-700 space-y-1">
                                            {cardActivity.activities
                                              .filter((a: any) => a.type === 'commit')
                                              .slice(0, 3)
                                              .map((commit: any, cidx: number) => (
                                                <div key={cidx} className="flex items-start gap-1.5 min-w-0">
                                                  <GitCommit size={9} className="text-blue-500 mt-0.5 shrink-0" />
                                                  <div className="min-w-0">
                                                    {commit.branch && (
                                                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400 mr-1">{commit.branch}</span>
                                                    )}
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 wrap-break-word">
                                                      {commit.details || commit.description}
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                            {cardActivity.activities.filter((a: any) => a.type === 'commit').length > 3 && (
                                              <p className="text-xs text-gray-400 dark:text-gray-500 pl-4">
                                                +{cardActivity.activities.filter((a: any) => a.type === 'commit').length - 3} commits
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null;
                      })()}

                      {(!report.cardActivities || report.cardActivities.length === 0) && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic py-6 text-center">
                          Nenhuma atividade no período
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* FAR RIGHT: lista de commits ou comentários */}
              {selectedDetailPanel && (() => {
                const report = reports.find(r => r.user === selectedDevUsername);
                if (!report) return null;
                const isCommits = selectedDetailPanel === 'commits';
                const items = report.activities.filter((a: any) => a.type === (isCommits ? 'commit' : 'comment'));
                return (
                  <div className="w-[520px] shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                    {/* Header do painel */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {isCommits
                          ? <GitCommit size={15} className="text-blue-500 shrink-0" />
                          : <MessageSquare size={15} className="text-green-500 shrink-0" />}
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                          {isCommits ? `${items.length} Commits` : `${items.length} Comentários`}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate">— {selectedDevUsername}</span>
                      </div>
                      <button
                        onClick={() => setSelectedDetailPanel(null)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors shrink-0 ml-2"
                      >
                        <X size={14} className="text-gray-500" />
                      </button>
                    </div>
                    {/* Lista */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                      {items.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                          <p className="text-gray-400 dark:text-gray-500 text-sm italic">
                            Nenhum {isCommits ? 'commit' : 'comentário'} no período
                          </p>
                        </div>
                      ) : (
                        items.map((item: any, idx: number) => (
                          <div key={idx} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            {/* Data/hora — esquerda | branch — direita */}
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                                {(() => {
                                  const d = new Date(item.timestamp);
                                  const today = new Date();
                                  const isToday = d.toDateString() === today.toDateString();
                                  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                  return isToday ? time : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + time;
                                })()}
                              </span>
                              {isCommits && item.branch && (
                                <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 truncate text-right">
                                  {item.branch}
                                </span>
                              )}
                              {(!isCommits || !item.branch) && item.cardNumber && (
                                <a
                                  href={item.cardUrl || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                                  onClick={e => e.stopPropagation()}
                                >
                                  #{item.cardNumber}
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                              {item.details || item.description}
                            </p>
                            {item.cardTitle && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{item.cardTitle}</p>
                            )}
                            {isCommits && item.commitSha && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <GitCommit size={9} className="text-gray-400 shrink-0" />
                                <span className="text-xs font-mono text-gray-400">{item.commitSha.slice(0, 7)}</span>
                                {item.commitUrl && (
                                  <a
                                    href={item.commitUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-500 hover:underline ml-0.5"
                                    onClick={e => e.stopPropagation()}
                                  >↗</a>
                                )}
                                {isCommits && item.branch && item.cardNumber && (
                                  <a
                                    href={item.cardUrl || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-400 hover:underline"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    #{item.cardNumber}
                                  </a>
                                )}
                                {item.repo && (
                                  <span className="ml-auto px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full shrink-0">
                                    {item.repo}
                                  </span>
                                )}
                              </div>
                            )}
                            {!isCommits && item.repo && (
                              <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                                {item.repo}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

            </>
          )}
        </div>
      </div>

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        token={token}
        org={org}
        currentViewId={currentViewId}
      />
    </div>
  );
};
