import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ExternalLink, Calendar, Clock, User, Plus, Send, Trash2, GitBranch, GitCommit, Link as LinkIcon, ArrowUpDown, ChevronDown, ChevronUp, CheckCircle, FileText, AlertCircle, MessageSquare, Clipboard, Eye, ArrowRight, Maximize2, Minimize2 } from 'lucide-react';
import type { ProjectCard, ProjectColumn } from '../types';
import type { CommentTemplate } from '../types/commentTemplates';
import { GitHubService } from '../services/github';
import { CommentTemplateService } from '../services/commentTemplateService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { convertGithubEmojis } from '../utils/emojiConverter';

interface Props {
  card: ProjectCard | null;
  isOpen: boolean;
  onClose: () => void;
  token: string;
  org: string;
  onUpdate?: () => void;
  currentViewId?: string;
  columns?: ProjectColumn[];
  onMoveCard?: (cardId: string, targetStatus: string) => Promise<void>;
}

interface IssueDetail {
  body: string;
  comments: Array<{
    id: string;
    author: string;
    authorAvatar: string;
    body: string;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    actor: string;
    actorAvatar: string;
    createdAt: string;
    description: string;
    metadata?: Record<string, any>;
  }>;
}

interface BranchInfo {
  name: string;
  repo: string;
  commitsAhead: number;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
}

interface CommitInfo {
  sha: string;
  fullSha: string;
  message: string;
  author: string;
  authorAvatar: string;
  date: string;
  repo: string;
  url: string;
}

interface PullRequestInfo {
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  author: string;
  authorAvatar: string;
}

interface MilestoneInfo {
  title: string;
  description: string | null;
  dueOn: string | null;
  state: string;
  progressPercentage: number;
  url: string;
}

export const CardDetailModal: React.FC<Props> = ({ card, isOpen, onClose, token, org, onUpdate, currentViewId, columns, onMoveCard }) => {
  const [details, setDetails] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'timeline'>('description');
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAssigneeInput, setShowAssigneeInput] = useState(false);
  const [newAssignee, setNewAssignee] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'info' | 'branches' | 'links'>('info');
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [pullRequests, setPullRequests] = useState<PullRequestInfo[]>([]);
  const [milestone, setMilestone] = useState<MilestoneInfo | null>(null);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [commentsOrder, setCommentsOrder] = useState<'newest' | 'oldest'>('newest');
  const [collapsedComments, setCollapsedComments] = useState<Set<string>>(new Set());
  const [commentAuthorFilter, setCommentAuthorFilter] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'comments' | 'activity'>('all');
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [moving, setMoving] = useState(false);
  const moveDropdownRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Participantes unificados: comentadores + atores de eventos
  const uniqueParticipants = useMemo(() => {
    if (!details) return [];
    const seen = new Map<string, { login: string; avatar: string; count: number }>();
    for (const c of details.comments) {
      const e = seen.get(c.author);
      if (e) e.count++; else seen.set(c.author, { login: c.author, avatar: c.authorAvatar, count: 1 });
    }
    for (const ev of details.events) {
      const e = seen.get(ev.actor);
      if (e) e.count++; else seen.set(ev.actor, { login: ev.actor, avatar: ev.actorAvatar, count: 1 });
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count);
  }, [details?.comments, details?.events]);

  type TimelineItem =
    | { kind: 'comment'; id: string; author: string; authorAvatar: string; body: string; createdAt: string }
    | { kind: 'event'; id: string; type: string; actor: string; actorAvatar: string; description: string; createdAt: string; metadata?: Record<string, any> };

  type GroupedEvent = {
    kind: 'grouped-event';
    type: string;
    actor: string;
    actorAvatar: string;
    createdAt: string;
    items: Array<{ id: string; metadata?: Record<string, any> }>;
  };

  type DisplayItem = TimelineItem | GroupedEvent;

  const GROUPABLE_TYPES = new Set(['LabeledEvent', 'UnlabeledEvent', 'AssignedEvent', 'UnassignedEvent']);
  const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

  const timeline = useMemo((): TimelineItem[] => {
    if (!details) return [];
    const comments: TimelineItem[] = details.comments.map(c => ({ kind: 'comment', ...c }));
    const events: TimelineItem[] = details.events.map(e => ({ kind: 'event', ...e }));
    let items = timelineFilter === 'comments' ? comments
      : timelineFilter === 'activity' ? events
      : [...comments, ...events];
    if (commentAuthorFilter) {
      items = items.filter(i =>
        (i.kind === 'comment' && i.author === commentAuthorFilter) ||
        (i.kind === 'event' && i.actor === commentAuthorFilter)
      );
    }
    return items.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return commentsOrder === 'newest' ? -diff : diff;
    });
  }, [details?.comments, details?.events, commentsOrder, timelineFilter, commentAuthorFilter]);

  const groupedTimeline = useMemo((): DisplayItem[] => {
    const result: DisplayItem[] = [];
    const items = timeline as TimelineItem[];
    let i = 0;
    while (i < items.length) {
      const cur = items[i];
      if (
        cur.kind === 'event' &&
        GROUPABLE_TYPES.has(cur.type) &&
        i + 1 < items.length
      ) {
        const group: typeof cur[] = [cur];
        let j = i + 1;
        while (j < items.length) {
          const next = items[j];
          if (
            next.kind === 'event' &&
            next.type === cur.type &&
            next.actor === cur.actor &&
            Math.abs(new Date(next.createdAt).getTime() - new Date(cur.createdAt).getTime()) <= GROUP_WINDOW_MS
          ) {
            group.push(next);
            j++;
          } else {
            break;
          }
        }
        if (group.length > 1) {
          result.push({
            kind: 'grouped-event',
            type: cur.type,
            actor: cur.actor,
            actorAvatar: cur.actorAvatar,
            createdAt: cur.createdAt,
            items: group.map(g => ({ id: g.id, metadata: g.metadata })),
          });
          i = j;
          continue;
        }
      }
      result.push(cur);
      i++;
    }
    return result;
  }, [timeline]);
  const [branchesWarning, setBranchesWarning] = useState<string | null>(null);
  const [showCommentEditor, setShowCommentEditor] = useState(false);
  const [commentEditorExpanded, setCommentEditorExpanded] = useState(false);

  // Fechar dropdown de mover ao clicar fora
  useEffect(() => {
    if (!showMoveDropdown) return;
    const handler = (e: MouseEvent) => {
      if (moveDropdownRef.current && !moveDropdownRef.current.contains(e.target as Node)) {
        setShowMoveDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoveDropdown]);

  const handleMoveToColumn = async (targetStatus: string) => {
    if (!card || !onMoveCard || moving) return;
    setShowMoveDropdown(false);
    setMoving(true);
    try {
      await onMoveCard(card.id, targetStatus);
    } finally {
      setMoving(false);
    }
  };
  const [selectedTemplate, setSelectedTemplate] = useState<CommentTemplate | null>(null);
  const [templateData, setTemplateData] = useState<Record<string, any>>({});
  const [availableTemplates, setAvailableTemplates] = useState<CommentTemplate[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(true); // Controla visibilidade do formulário

  useEffect(() => {
    if (isOpen && card) {
      loadDetails();
      loadBranchesAndCommits();
      loadLinksData();
      loadAvailableTemplates();
      // Resetar estado de comentários
      setCommentsOrder('newest');
      setCollapsedComments(new Set());
      setTimelineFilter('all');
      setCommentAuthorFilter(null);
      // Limpar dados quando fechar
      setDetails(null);
      setActiveTab('description');
      setActiveSidebarTab('info');
      setBranches([]);
      setCommits([]);
      setPullRequests([]);
      setMilestone(null);
      setCommentsOrder('newest');
      setCollapsedComments(new Set());
      setTimelineFilter('all');
      setCommentAuthorFilter(null);
    }
  }, [isOpen, card]);

  const loadAvailableTemplates = () => {
    // Obter templates filtrados pela view atual
    const viewId = currentViewId || 'overview';
    const templates = CommentTemplateService.getAvailableForView(viewId);

    // Ordenar: free-default sempre primeiro, depois os outros
    const sorted = templates.sort((a, b) => {
      if (a.id === 'free-default') return -1;
      if (b.id === 'free-default') return 1;
      return 0;
    });

    setAvailableTemplates(sorted);
  };

  const loadDetails = async () => {
    if (!card || !card.repo) return;

    setLoading(true);
    try {
      const service = new GitHubService(token);
      const data = await service.getIssueDetails(org, card.repo, card.number);
      setDetails(data);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBranchesAndCommits = async () => {
    if (!card || isLoadingBranches) return;

    setIsLoadingBranches(true);
    setBranchesWarning(null);
    try {
      const service = new GitHubService(token);

      // Extrair nomes das labels para passar ao filtro
      const labelNames = card.labels.map(l => l.name);

      // Extrair logins dos assignees para filtrar commits/branches
      const assigneeLogins = card.assignees.map(a => a.login);

      // Busca inteligente: passa título, labels E assignees para otimizar
      const data = await service.searchBranchesAndCommits(
        org,
        card.number,
        card.title,      // Título do card
        labelNames,      // Tags/labels do card
        assigneeLogins,  // Usuários atribuídos ao card
        currentViewId    // View/guia ativa
      );      setBranches(data.branches);
      setCommits(data.commits);
      if (data.warning) {
        setBranchesWarning(data.warning);
      }
    } catch (error) {
      console.error('Erro ao carregar branches e commits:', error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const loadLinksData = async () => {
    if (!card || !card.repo || isLoadingLinks) return;

    setIsLoadingLinks(true);
    try {
      const service = new GitHubService(token);
      const [prs, ms] = await Promise.all([
        service.getRelatedPullRequests(org, card.repo, card.number),
        service.getIssueWithMilestone(org, card.repo, card.number),
      ]);
      setPullRequests(prs);
      setMilestone(ms);
    } catch (error) {
      console.error('Erro ao carregar dados da aba Links:', error);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  if (!isOpen || !card) return null;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysUntilDue = (dueDate: string): number => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Função para obter componente de ícone
  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.FC<{ size?: number; className?: string }>> = {
      CheckCircle,
      FileText,
      AlertCircle,
      MessageSquare,
      Clipboard,
      Eye,
    };
    return icons[iconName] || FileText;
  };

  // Função para obter classes Tailwind de cor
  const getColorClasses = (colorName: string) => {
    const colorMap: Record<string, { bg: string; bgHover: string; border: string }> = {
      green: { bg: 'bg-green-600', bgHover: 'hover:bg-green-700', border: 'border-green-200 dark:border-green-800' },
      blue: { bg: 'bg-blue-600', bgHover: 'hover:bg-blue-700', border: 'border-blue-200 dark:border-blue-800' },
      purple: { bg: 'bg-purple-600', bgHover: 'hover:bg-purple-700', border: 'border-purple-200 dark:border-purple-800' },
      orange: { bg: 'bg-orange-600', bgHover: 'hover:bg-orange-700', border: 'border-orange-200 dark:border-orange-800' },
      red: { bg: 'bg-red-600', bgHover: 'hover:bg-red-700', border: 'border-red-200 dark:border-red-800' },
      pink: { bg: 'bg-pink-600', bgHover: 'hover:bg-pink-700', border: 'border-pink-200 dark:border-pink-800' },
      indigo: { bg: 'bg-indigo-600', bgHover: 'hover:bg-indigo-700', border: 'border-indigo-200 dark:border-indigo-800' },
      teal: { bg: 'bg-teal-600', bgHover: 'hover:bg-teal-700', border: 'border-teal-200 dark:border-teal-800' },
    };
    return colorMap[colorName] || colorMap.blue;
  };

  const generateCompletionTemplate = () => {
    let template = '## Descrição da Alteração\n';
    template += templateData.descricao || 'Descreva aqui as alterações realizadas na demanda...';
    template += '\n\n';

    // Branches (todas detectadas)
    if (branches.length > 0) {
      if (branches.length === 1) {
        template += `## Branch associada\n\`${branches[0].name}\`\n\n`;
      } else {
        template += '## Branches associadas\n';
        branches.forEach(branch => {
          template += `- \`${branch.name}\` (${branch.repo})\n`;
        });
        template += '\n';
      }
    } else {
      template += '## Branch associada\n`issue-' + card.number + '`\n\n';
    }

    // Commits (todos detectados)
    if (commits.length > 0) {
      if (commits.length === 1) {
        template += `## Número do Commit\n${commits[0].sha} (${commits[0].fullSha})\n\n`;
        template += `## Mensagem do Commit\n${commits[0].message}\n\n`;
      } else {
        template += '## Commits relacionados\n';
        commits.forEach(commit => {
          template += `- \`${commit.sha}\` - ${commit.message} (${commit.repo})\n`;
        });
        template += '\n';
      }
    } else {
      template += '## Número do Commit\nabc1234\n\n';
    }

    // Links de teste (múltiplos)
    const linksValidos = (templateData.linksTeste || []).filter((link: string) => link.trim());
    if (linksValidos.length > 0) {
      if (linksValidos.length === 1) {
        template += `## Link para Teste\n[Ambiente de Teste](${linksValidos[0]})\n\n`;
      } else {
        template += '## Links para Teste\n';
        linksValidos.forEach((link: string, idx: number) => {
          template += `- [Ambiente ${idx + 1}](${link})\n`;
        });
        template += '\n';
      }
    }

    // Testes (opcional - só adiciona se houver conteúdo)
    if (templateData.testesRealizados && templateData.testesRealizados.trim()) {
      template += '## Testes a Serem Realizados\n';
      const testes = templateData.testesRealizados.split('\n').filter((t: string) => t.trim());
      testes.forEach((teste: string) => {
        template += `- ${teste.trim()}\n`;
      });
      template += '\n';
    }

    // Informações auxiliares (opcional - só adiciona se houver conteúdo)
    if (templateData.informacoesAuxiliares && templateData.informacoesAuxiliares.trim()) {
      template += '## Informações Auxiliares\n';
      template += templateData.informacoesAuxiliares;
    }

    return template;
  };

  const applyCompletionTemplate = () => {
    const template = generateCompletionTemplate();
    setNewComment(template);
    setShowPreview(false); // Mostra no editor para permitir edição
    setShowTemplateForm(false); // Oculta o formulário após gerar
  };

  const daysUntilDue = card.dueDate ? getDaysUntilDue(card.dueDate) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[85vw] h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Compacto */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 shrink-0">
              #{card.number}
            </span>
            {card.repo && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 shrink-0">
                {card.repo}
              </span>
            )}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {card.title}
            </h2>

            {/* Badge de status simples no header */}
            <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
              card.status === 'Done'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                : card.status === 'In Progress'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
            }`}>
              {card.status}
            </span>
            {card.dueDate && (
              <div className={`flex items-center gap-1 text-xs font-medium shrink-0 ${
                daysUntilDue !== null && daysUntilDue < 0
                  ? 'text-red-600 dark:text-red-400'
                  : daysUntilDue !== null && daysUntilDue <= 3
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                <Calendar size={12} />
                <span>
                  {daysUntilDue !== null && daysUntilDue < 0
                    ? `Vencido há ${Math.abs(daysUntilDue)}d`
                    : daysUntilDue !== null && daysUntilDue <= 3
                    ? `${daysUntilDue}d`
                    : new Date(card.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  }
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Abrir no GitHub"
            >
              <ExternalLink size={16} className="text-gray-600 dark:text-gray-400" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Layout principal */}
        <div className="flex flex-1 overflow-hidden">
          {/* Conteúdo principal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs fixas */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 bg-white dark:bg-gray-800 shrink-0 sticky top-0 z-10">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('description')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'description'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Descrição
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'timeline'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Comentários & Atividade
                  {details && (details.comments.length + details.events.length) > 0 && (
                    <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                      {details.comments.length + details.events.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Conteúdo das tabs - rolável */}
            <div ref={timelineScrollRef} className="flex-1 overflow-y-auto px-6 pb-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Clock className="animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" size={32} />
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Carregando detalhes...</p>
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === 'description' && (
                    <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ background: 'var(--color-comment-body, white)' }}>
                      <div className="px-4 py-4">
                        {details?.body ? (
                          <MarkdownRenderer
                            html={details.body}
                            compact
                            className="text-sm text-gray-700 dark:text-gray-300"
                          />
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 italic">Sem descrição</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'timeline' && (
                    <div className="space-y-4 relative">
                      {/* Botão para escrever comentário */}
                      {!showCommentEditor && timelineFilter !== 'activity' && (
                        <button
                          onClick={() => {
                            setShowCommentEditor(true);
                            timelineScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                            // Sempre seleciona free-default como padrão (primeiro da lista)
                            const freeTemplate = availableTemplates.find(t => t.id === 'free-default') || availableTemplates[0] || null;
                            setSelectedTemplate(freeTemplate);
                          }}
                          className="flex items-center gap-2 w-full mt-4 px-4 py-3 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-sm font-medium"
                        >
                          <Plus size={16} />
                          Escrever um comentário...
                        </button>
                      )}

                      {/* Editor de comentário */}
                      {showCommentEditor && (
                        <div className={commentEditorExpanded
                          ? 'fixed inset-0 z-[300] bg-white dark:bg-gray-800 flex flex-col'
                          : 'sticky top-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-[70vh] flex flex-col'
                        }>
                          {/* Cabeçalho fixo */}
                          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {availableTemplates.map((template) => {
                                const IconComp = getIconComponent(template.icon);
                                const colors = getColorClasses(template.color);
                                const isSelected = selectedTemplate?.id === template.id;

                                return (
                                  <button
                                    key={template.id}
                                    onClick={() => {
                                      setSelectedTemplate(template);
                                      setNewComment('');
                                      // Inicializa templateData com arrays vazios para campos de lista
                                      const initialData: Record<string, any> = {};
                                      if (template.fields) {
                                        template.fields.forEach(field => {
                                          if (['task-list', 'bullet-list', 'numbered-list', 'link-list'].includes(field.type)) {
                                            // Para listas fixas, inicializa com array vazio do tamanho dos itens pré-definidos
                                            if (field.allowDynamicItems === false && field.predefinedItems) {
                                              initialData[field.id] = field.predefinedItems.map(() => '');
                                            } else {
                                              // Para listas dinâmicas, inicializa com array com um item vazio
                                              initialData[field.id] = [''];
                                            }
                                          }
                                        });
                                      }
                                      setTemplateData(initialData);
                                      setShowTemplateForm(true); // Mostra formulário ao trocar de template
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${
                                      isSelected
                                        ? `${colors.bg} ${colors.bgHover} text-white`
                                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                    title={template.name}
                                  >
                                    <IconComp size={18} />
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => setCommentEditorExpanded(v => !v)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title={commentEditorExpanded ? 'Recolher editor' : 'Expandir para tela cheia'}
                            >
                              {commentEditorExpanded
                                ? <Minimize2 size={16} className="text-gray-600 dark:text-gray-400" />
                                : <Maximize2 size={16} className="text-gray-600 dark:text-gray-400" />
                              }
                            </button>
                            <button
                              onClick={() => {
                                setShowCommentEditor(false);
                                setCommentEditorExpanded(false);
                                setNewComment('');
                                setSelectedTemplate(null);
                                setTemplateData({});
                              }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Fechar editor"
                            >
                              <X size={18} className="text-gray-600 dark:text-gray-400" />
                            </button>
                          </div>

                          {/* Conteúdo scrollável */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {/* Formulário de template de Conclusão de Demanda */}
                            {showTemplateForm && selectedTemplate && selectedTemplate.id === 'completion-default' && (
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                              <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                                Preencha os dados da conclusão
                              </h4>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Descrição da Alteração *
                                </label>
                                <textarea
                                  value={templateData.descricao || ''}
                                  onChange={(e) => setTemplateData({...templateData, descricao: e.target.value})}
                                  placeholder="Explique qual foi a alteração realizada..."
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-green-500"
                                  rows={3}
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Links para Teste (opcional)
                                </label>
                                <div className="space-y-2">
                                  {(templateData.linksTeste || ['']).map((link: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <input
                                        type="url"
                                        value={link}
                                        onChange={(e) => {
                                          const newLinks = [...(templateData.linksTeste || [''])];
                                          newLinks[idx] = e.target.value;
                                          setTemplateData({...templateData, linksTeste: newLinks});
                                        }}
                                        placeholder={`http://ambiente-teste-${idx + 1}.com`}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500"
                                      />
                                      {(templateData.linksTeste || ['']).length > 1 && (
                                        <button
                                          onClick={() => {
                                            const newLinks = (templateData.linksTeste || ['']).filter((_: string, i: number) => i !== idx);
                                            setTemplateData({...templateData, linksTeste: newLinks});
                                          }}
                                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition-colors"
                                          title="Remover link"
                                        >
                                          <X size={14} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => {
                                      setTemplateData({...templateData, linksTeste: [...(templateData.linksTeste || ['']), '']});
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                                  >
                                    <Plus size={12} />
                                    Adicionar outro link
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Testes a Serem Realizados (opcional - um por linha)
                                </label>
                                <textarea
                                  value={templateData.testesRealizados || ''}
                                  onChange={(e) => setTemplateData({...templateData, testesRealizados: e.target.value})}
                                  placeholder="Verificar login&#10;Testar recuperação de senha&#10;Validar redirecionamento"
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-green-500"
                                  rows={3}
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Informações Auxiliares (opcional)
                                </label>
                                <textarea
                                  value={templateData.informacoesAuxiliares || ''}
                                  onChange={(e) => setTemplateData({...templateData, informacoesAuxiliares: e.target.value})}
                                  placeholder="Credenciais: user@test.com / 123456&#10;Vídeo: http://link-video.com"
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-green-500"
                                  rows={3}
                                />
                              </div>

                              <div className="flex items-center gap-2 pt-2">
                                <button
                                  onClick={applyCompletionTemplate}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                  <CheckCircle size={14} />
                                  Gerar Template
                                </button>
                                <button
                                  onClick={() => {
                                    setTemplateData({});
                                  }}
                                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium"
                                >
                                  Limpar
                                </button>
                              </div>

                              {/* Informações detectadas */}
                              {(branches.length > 0 || commits.length > 0) && (
                                <div className="text-xs text-green-700 dark:text-green-400 p-2 bg-green-100 dark:bg-green-900/30 rounded space-y-1">
                                  {branches.length > 0 && (
                                    <div>
                                      ✓ <strong>{branches.length}</strong> {branches.length === 1 ? 'branch detectada' : 'branches detectadas'}:
                                      <div className="ml-3 mt-1 space-y-0.5">
                                        {branches.map((branch, idx) => (
                                          <div key={idx}>
                                            • <code className="font-mono text-xs">{branch.name}</code>
                                            {branches.length > 1 && <span className="text-xs"> ({branch.repo})</span>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {commits.length > 0 && (
                                    <div className="mt-2">
                                      ✓ <strong>{commits.length}</strong> {commits.length === 1 ? 'commit detectado' : 'commits detectados'}:
                                      <div className="ml-3 mt-1 space-y-0.5">
                                        {commits.slice(0, 3).map((commit, idx) => (
                                          <div key={idx}>
                                            • <code className="font-mono text-xs">{commit.sha}</code>
                                            {commits.length > 1 && <span className="text-xs"> ({commit.repo})</span>}
                                          </div>
                                        ))}
                                        {commits.length > 3 && (
                                          <div className="text-xs italic">... e mais {commits.length - 3}</div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            )}

                            {/* Formulário genérico para templates customizados com fields */}
                            {showTemplateForm && selectedTemplate && selectedTemplate.id !== 'completion-default' && selectedTemplate.id !== 'free-default' && selectedTemplate.fields && selectedTemplate.fields.length > 0 && (
                            <div className={`p-4 bg-${selectedTemplate.color}-50 dark:bg-${selectedTemplate.color}-900/20 border border-${selectedTemplate.color}-200 dark:border-${selectedTemplate.color}-800 rounded-lg space-y-3`}>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                {selectedTemplate.name}
                              </h4>
                              {selectedTemplate.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                                  {selectedTemplate.description}
                                </p>
                              )}

                              {selectedTemplate.fields.map((field, fieldIdx) => (
                                <div key={`${selectedTemplate.id}-${field.id}-${fieldIdx}`}>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {field.label} {field.required && '*'}
                                  </label>
                                  {/* Campos de lista (task-list, bullet-list, numbered-list, link-list) */}
                                  {['task-list', 'bullet-list', 'numbered-list', 'link-list'].includes(field.type) ? (
                                    field.allowDynamicItems === false && field.predefinedItems ? (
                                      // Lista fixa: renderiza itens pré-definidos
                                      <div className="space-y-2">
                                        {field.type === 'task-list' ? (
                                          // Para task-list: checkboxes
                                          field.predefinedItems.map((item, idx) => (
                                            <label key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded transition-colors">
                                              <input
                                                type="checkbox"
                                                checked={(templateData[field.id] || [])[idx] === item}
                                                onChange={(e) => {
                                                  const newItems = [...(templateData[field.id] || field.predefinedItems || [])];
                                                  newItems[idx] = e.target.checked ? item : '';
                                                  setTemplateData({...templateData, [field.id]: newItems});
                                                }}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              {item}
                                            </label>
                                          ))
                                        ) : (
                                          // Para outros tipos: inputs com labels fixas
                                          field.predefinedItems.map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-2">
                                              <div className="flex-shrink-0 pt-2 text-xs text-gray-500 dark:text-gray-400 w-24">
                                                {item}:
                                              </div>
                                              <input
                                                type="text"
                                                value={(templateData[field.id] || [])[idx] || ''}
                                                onChange={(e) => {
                                                  const newItems = [...(templateData[field.id] || field.predefinedItems?.map(() => '') || [])];
                                                  newItems[idx] = e.target.value;
                                                  setTemplateData({...templateData, [field.id]: newItems});
                                                }}
                                                placeholder={`Preencha ${item.toLowerCase()}`}
                                                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                              />
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    ) : (
                                      // Lista dinâmica: usuário pode adicionar/remover itens
                                      <div className="space-y-2">
                                        {(templateData[field.id] || ['']).map((item: string, idx: number) => (
                                          <div key={idx} className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={item}
                                              onChange={(e) => {
                                                const newItems = [...(templateData[field.id] || [''])];
                                                newItems[idx] = e.target.value;
                                                setTemplateData({...templateData, [field.id]: newItems});
                                              }}
                                              placeholder={field.placeholder || `Item ${idx + 1}`}
                                              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                            />
                                            {(templateData[field.id] || ['']).length > 1 && (
                                              <button
                                                onClick={() => {
                                                  const newItems = (templateData[field.id] || ['']).filter((_: string, i: number) => i !== idx);
                                                  setTemplateData({...templateData, [field.id]: newItems});
                                                }}
                                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition-colors"
                                                title="Remover item"
                                              >
                                                <X size={14} />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        <button
                                          onClick={() => {
                                            setTemplateData({...templateData, [field.id]: [...(templateData[field.id] || ['']), '']});
                                          }}
                                          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                        >
                                          <Plus size={12} />
                                          Adicionar item
                                        </button>
                                      </div>
                                    )
                                  ) : field.type === 'textarea' ? (
                                    <textarea
                                      value={templateData[field.id] || ''}
                                      onChange={(e) => setTemplateData({...templateData, [field.id]: e.target.value})}
                                      placeholder={field.placeholder}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-blue-500"
                                      rows={3}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={templateData[field.id] || ''}
                                      onChange={(e) => setTemplateData({...templateData, [field.id]: e.target.value})}
                                      placeholder={field.placeholder}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    />
                                  )}
                                </div>
                              ))}

                              <div className="flex items-center gap-2 pt-2">
                                <button
                                  onClick={() => {
                                    if (selectedTemplate.generateMarkdown) {
                                      const markdown = selectedTemplate.generateMarkdown(templateData);
                                      setNewComment(markdown);
                                      setShowPreview(false); // Mostra no editor para permitir edição
                                      setShowTemplateForm(false); // Oculta formulário após gerar
                                    }
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                  <CheckCircle size={14} />
                                  Gerar Template
                                </button>
                                <button
                                  onClick={() => setTemplateData({})}
                                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium"
                                >
                                  Limpar
                                </button>
                              </div>
                            </div>
                            )}

                            {/* Editor principal - sempre visível para permitir edição do markdown gerado */}
                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                            {/* Tabs do editor */}
                            <div className="flex border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                              <button
                                onClick={() => setShowPreview(false)}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                  !showPreview
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-b-2 border-blue-500'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                              >
                                Escrever
                              </button>
                              <button
                                onClick={() => setShowPreview(true)}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                  showPreview
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-b-2 border-blue-500'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                              >
                                Preview
                              </button>
                            </div>

                            {/* Conteúdo do editor */}
                            <div className="bg-white dark:bg-gray-800">
                              {!showPreview ? (
                                <textarea
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="Adicionar um comentário... (suporta Markdown)"
                                  className={`w-full px-3 py-2 bg-transparent text-gray-900 dark:text-gray-100 text-sm resize-y focus:outline-none ${commentEditorExpanded ? 'min-h-[60vh]' : 'min-h-[120px]'}`}
                                  rows={5}
                                />
                              ) : (
                                <div className="px-3 py-2 min-h-[120px]">
                                  {newComment ? (
                                    <MarkdownRenderer
                                      html={newComment}
                                      className="text-sm text-gray-700 dark:text-gray-300"
                                    />
                                  ) : (
                                    <p className="text-gray-400 dark:text-gray-500 italic text-sm">
                                      Nada para visualizar
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          </div>

                          {/* Rodapé fixo com ações */}
                          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
                          {/* Dicas e botão de enviar */}
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Dica:</span> Use <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">#123</code> para referenciar issues
                            </p>
                            <button
                              onClick={async () => {
                                if (!newComment.trim() || !card) return;
                                setSubmitting(true);
                                try {
                                  const service = new GitHubService(token);
                                  await service.addComment(org, card.repo!, card.number, newComment);
                                  setNewComment('');
                                  setShowPreview(false);
                                  setShowCommentEditor(false);
                                  setCommentEditorExpanded(false);
                                  await loadDetails();
                                  onUpdate?.();
                                } catch (error) {
                                  console.error('Erro ao adicionar comentário:', error);
                                  alert('Erro ao adicionar comentário');
                                } finally {
                                  setSubmitting(false);
                                }
                              }}
                              disabled={!newComment.trim() || submitting}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                            >
                              <Send size={14} />
                              {submitting ? 'Enviando...' : 'Comentar'}
                            </button>
                          </div>
                          </div>
                        </div>
                      )}

                      {/* Barra de filtros compacta */}
                      <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700/60">
                        {/* Segmented control de tipo */}
                        <div className="flex rounded border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0 text-xs">
                          {(['all', 'comments', 'activity'] as const).map((f, i) => (
                            <button
                              key={f}
                              onClick={() => setTimelineFilter(f)}
                              title={f === 'all' ? 'Tudo' : f === 'comments' ? `Comentários (${details?.comments.length ?? 0})` : `Atividades (${details?.events.length ?? 0})`}
                              className={`px-2 py-1 font-medium transition-colors cursor-pointer ${i > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''} ${
                                timelineFilter === f
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              {f === 'all' ? 'Tudo' : f === 'comments'
                                ? `💬 ${details?.comments.length ?? 0}`
                                : `⚡ ${details?.events.length ?? 0}`}
                            </button>
                          ))}
                        </div>

                        {/* Avatares dos participantes */}
                        {uniqueParticipants.length > 1 && (
                          <div className="flex items-center gap-1 pl-2 border-l border-gray-200 dark:border-gray-700">
                            {uniqueParticipants.map(({ login, avatar }) => {
                              const isActive = commentAuthorFilter === login;
                              return (
                                <button
                                  key={login}
                                  onClick={() => setCommentAuthorFilter(isActive ? null : login)}
                                  className={`flex items-center gap-1 rounded-full transition-all cursor-pointer overflow-hidden max-w-5 hover:max-w-32 ${
                                    isActive
                                      ? 'max-w-32 ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50 dark:bg-blue-900/30 pr-2'
                                      : 'ring-1 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-500 opacity-70 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 hover:pr-2'
                                  }`}
                                  style={{ transition: 'max-width 200ms ease, padding 200ms ease' }}
                                >
                                  <img src={avatar} alt={login} className="w-5 h-5 rounded-full block shrink-0" />
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap overflow-hidden"
                                    style={{ maxWidth: isActive ? '6rem' : undefined }}>
                                    {login}
                                  </span>
                                </button>
                              );
                            })}
                            {commentAuthorFilter && (
                              <button
                                onClick={() => setCommentAuthorFilter(null)}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none ml-0.5 cursor-pointer"
                                title="Limpar filtro"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}

                        {/* Controles direita — ícones apenas */}
                        <div className="ml-auto flex items-center gap-0.5">
                          <button
                            onClick={() => setCommentsOrder(commentsOrder === 'newest' ? 'oldest' : 'newest')}
                            title={commentsOrder === 'newest' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer"
                          >
                            <ArrowUpDown size={13} />
                          </button>
                          {timelineFilter !== 'activity' && details && details.comments.length > 0 && (
                            <button
                              onClick={() => {
                                const commentIds = timeline.filter(i => i.kind === 'comment').map(i => i.id);
                                setCollapsedComments(prev =>
                                  prev.size === 0 ? new Set(commentIds) : new Set()
                                );
                              }}
                              title={collapsedComments.size === 0 ? 'Minimizar comentários' : 'Expandir comentários'}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer"
                            >
                              {collapsedComments.size === 0 ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Linha do tempo unificada — comentários + eventos */}
                      {timeline.length > 0 ? (
                        <div className="relative">
                          {/* Linha vertical */}
                          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700 rounded-full" />

                          <div className="space-y-3">
                          {groupedTimeline.map((item, idx) => {
                            if (item.kind === 'comment') {
                              const isExpanded = !collapsedComments.has(item.id);
                              return (
                                <div key={`c-${item.id}`} className="flex gap-3">
                                  <div className="w-8 shrink-0 flex justify-center pt-0.5 relative z-10">
                                    <img src={item.authorAvatar} alt={item.author} className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-gray-800" />
                                  </div>
                                  <div className="flex-1 min-w-0 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-comment-border)' }}>
                                    <div className="flex items-center justify-between px-3 py-2 border-b" style={{ background: 'var(--color-comment-header)', borderColor: 'var(--color-comment-border)' }}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.author}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">comentou em {formatDate(item.createdAt)}</span>
                                      </div>
                                      <button
                                        onClick={() => setCollapsedComments(prev => { const next = new Set(prev); if (isExpanded) next.add(item.id); else next.delete(item.id); return next; })}
                                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
                                        title={isExpanded ? 'Minimizar' : 'Expandir'}
                                      >
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      </button>
                                    </div>
                                    {isExpanded && (
                                      <div className="px-4 py-3" style={{ background: 'var(--color-comment-body)' }}>
                                        <MarkdownRenderer html={item.body} className="text-sm text-gray-700 dark:text-gray-300" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            } else if (item.kind === 'grouped-event') {
                              const isLabel = item.type === 'LabeledEvent' || item.type === 'UnlabeledEvent';
                              const isAssign = item.type === 'AssignedEvent' || item.type === 'UnassignedEvent';
                              const verb = item.type === 'LabeledEvent' ? 'adicionou labels'
                                : item.type === 'UnlabeledEvent' ? 'removeu labels'
                                : item.type === 'AssignedEvent' ? 'atribuiu para'
                                : 'removeu';
                              return (
                                <div key={`g-${idx}`} className="flex gap-3 items-start rounded-md px-2 py-1 -mx-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                  <div className="w-8 shrink-0 flex justify-center pt-0.5 relative z-10">
                                    <img src={item.actorAvatar} alt={item.actor} className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-gray-800" />
                                  </div>
                                  <div className="flex-1 py-0.5">
                                    <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.actor}</span>
                                      <span className="text-sm text-gray-600 dark:text-gray-400">{verb}</span>
                                      {isLabel && item.items.map(i => {
                                        const label = i.metadata?.label;
                                        if (!label) return null;
                                        const bg = label.color ? `#${label.color}` : '#888';
                                        // calcula luminância para escolher texto preto ou branco
                                        const r = parseInt(label.color?.slice(0,2) || '88', 16);
                                        const g = parseInt(label.color?.slice(2,4) || '88', 16);
                                        const b = parseInt(label.color?.slice(4,6) || '88', 16);
                                        const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
                                        const textColor = lum > 0.5 ? '#000000' : '#ffffff';
                                        return (
                                          <span
                                            key={i.id}
                                            className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                                            style={{ backgroundColor: bg, color: textColor }}
                                          >
                                            {label.name}
                                          </span>
                                        );
                                      })}
                                      {isAssign && item.items.map(i => {
                                        const a = i.metadata?.assignee;
                                        if (!a) return null;
                                        return (
                                          <span key={i.id} className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                                            {a.avatarUrl && <img src={a.avatarUrl} alt={a.login} className="w-4 h-4 rounded-full" />}
                                            {a.login}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 pt-0.5">{formatDate(item.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div key={`e-${item.id}`} className="flex gap-3 items-center rounded-md px-2 py-1 -mx-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                  <div className="w-8 shrink-0 flex justify-center relative z-10">
                                    <img src={item.actorAvatar} alt={item.actor} className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-gray-800" />
                                  </div>
                                  <div className="flex-1 py-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-sm min-w-0">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{item.actor}</span>
                                        <span className="text-gray-600 dark:text-gray-400"> {item.description}</span>
                                      </div>
                                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatDate(item.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <p className="text-gray-500 dark:text-gray-400 italic text-sm">
                            {timelineFilter === 'comments' ? 'Nenhum comentário ainda. Seja o primeiro a comentar!' : timelineFilter === 'activity' ? 'Nenhuma atividade registrada' : 'Nenhum item ainda'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar direita com tabs */}
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Tabs da sidebar */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50 shrink-0">
              <button
                onClick={() => setActiveSidebarTab('info')}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                  activeSidebarTab === 'info'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-b-2 border-blue-500'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <User size={14} className="inline mr-1" />
                Info
              </button>
              <button
                onClick={() => setActiveSidebarTab('branches')}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                  activeSidebarTab === 'branches'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-b-2 border-blue-500'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <GitBranch size={14} className="inline mr-1" />
                Branches
              </button>
              <button
                onClick={() => setActiveSidebarTab('links')}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                  activeSidebarTab === 'links'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-b-2 border-blue-500'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <LinkIcon size={14} className="inline mr-1" />
                Links
              </button>
            </div>

            {/* Conteúdo da sidebar */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeSidebarTab === 'info' && (
                <div className="space-y-6">
                  {/* Metadata */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                      Informações
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock size={12} />
                        <span className="text-xs">Criado {formatDate(card.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock size={12} />
                        <span className="text-xs">Atualizado {formatDate(card.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Assignees */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        Responsáveis
                      </h4>
                      <button
                        onClick={() => setShowAssigneeInput(!showAssigneeInput)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
                        title="Adicionar responsável"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {card.assignees.length > 0 ? (
                      <div className="space-y-2">
                        {card.assignees.map((assignee) => (
                          <div key={assignee.login} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2">
                              <img
                                src={assignee.avatarUrl}
                                alt={assignee.login}
                                className="w-5 h-5 rounded-full"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {assignee.login}
                              </span>
                            </div>
                            <button
                              onClick={async () => {
                                if (!card.repo) return;
                                try {
                                  const service = new GitHubService(token);
                                  await service.removeAssignee(org, card.repo, card.number, assignee.login);
                                  await loadDetails();
                                  onUpdate?.();
                                } catch (error) {
                                  console.error('Erro ao remover responsável:', error);
                                  alert('Erro ao remover responsável');
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                              title="Remover responsável"
                            >
                              <Trash2 size={10} className="text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">Nenhum responsável</p>
                    )}

                    {showAssigneeInput && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={newAssignee}
                          onChange={(e) => setNewAssignee(e.target.value)}
                          placeholder="Username do GitHub"
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newAssignee.trim() && card.repo) {
                              try {
                                const service = new GitHubService(token);
                                await service.addAssignee(org, card.repo, card.number, newAssignee.trim());
                                setNewAssignee('');
                                setShowAssigneeInput(false);
                                await loadDetails();
                                onUpdate?.();
                              } catch (error) {
                                console.error('Erro ao adicionar responsável:', error);
                                alert('Erro ao adicionar responsável. Verifique se o username está correto.');
                              }
                            } else if (e.key === 'Escape') {
                              setNewAssignee('');
                              setShowAssigneeInput(false);
                            }
                          }}
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Enter para adicionar
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Labels */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        Labels
                      </h4>
                      <button
                        onClick={() => setShowLabelInput(!showLabelInput)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
                        title="Adicionar label"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {card.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {card.labels.map((label) => (
                          <div key={label.name} className="group relative">
                            <span
                              className="text-xs px-2 py-0.5 rounded font-medium inline-flex items-center gap-1"
                              style={{
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
                            >
                              {convertGithubEmojis(label.name)}
                              <button
                                onClick={async () => {
                                  if (!card.repo) return;
                                  try {
                                    const service = new GitHubService(token);
                                    await service.removeLabel(org, card.repo, card.number, label.name);
                                    await loadDetails();
                                    onUpdate?.();
                                  } catch (error) {
                                    console.error('Erro ao remover label:', error);
                                    alert('Erro ao remover label');
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 hover:scale-110 transition-all"
                                title="Remover label"
                              >
                                <X size={8} />
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">Sem labels</p>
                    )}

                    {showLabelInput && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder="Nome da label"
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newLabel.trim() && card.repo) {
                              try {
                                const service = new GitHubService(token);
                                await service.addLabel(org, card.repo, card.number, newLabel.trim());
                                setNewLabel('');
                                setShowLabelInput(false);
                                await loadDetails();
                                onUpdate?.();
                              } catch (error) {
                                console.error('Erro ao adicionar label:', error);
                                alert('Erro ao adicionar label. Verifique se a label existe no repositório.');
                              }
                            } else if (e.key === 'Escape') {
                              setNewLabel('');
                              setShowLabelInput(false);
                            }
                          }}
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Enter para adicionar
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Mover para coluna */}
                  {columns && columns.length > 0 && onMoveCard && (
                    <div ref={moveDropdownRef}>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Coluna</h4>
                      <div className="relative">
                        <button
                          onClick={() => setShowMoveDropdown(v => !v)}
                          disabled={moving}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                            moving
                              ? 'opacity-50 cursor-wait border-gray-200 dark:border-gray-700'
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer'
                          } bg-white dark:bg-gray-900`}
                        >
                          <span className={`${
                            card.status === 'Done'
                              ? 'text-green-700 dark:text-green-300'
                              : card.status === 'In Progress'
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {moving ? 'Movendo…' : card.status}
                          </span>
                          <ChevronDown size={12} className="text-gray-400 shrink-0" />
                        </button>
                        {showMoveDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1">
                            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Mover para</p>
                            {columns.filter(c => c.name !== card.status).map(col => (
                              <button
                                key={col.id}
                                onClick={() => handleMoveToColumn(col.name)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                <ArrowRight size={12} className="text-gray-400 shrink-0" />
                                {col.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSidebarTab === 'branches' && (
                <div className="space-y-4">
                  {/* Mensagem de aviso se não houver mapeamento */}
                  {branchesWarning && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                            Configure o Mapeamento
                          </h5>
                          <div className="text-xs text-yellow-700 dark:text-yellow-400 whitespace-pre-line">
                            {branchesWarning}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Repositórios relacionados ── */}
                  {!isLoadingBranches && (branches.length > 0 || commits.length > 0) && (() => {
                    const branchRepos = new Set(branches.map(b => b.repo).filter(Boolean));
                    const allRepos = [...new Set([
                      ...branches.map(b => b.repo),
                      ...commits.map(c => c.repo),
                    ].filter(Boolean))].sort();
                    return (
                      <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          Repositórios relacionados
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {allRepos.map(repo => {
                            const hasBranch = branchRepos.has(repo);
                            return (
                              <a
                                key={repo}
                                href={`https://github.com/${org}/${repo}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium transition-opacity hover:opacity-80 ${
                                  hasBranch
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                                }`}
                              >
                                <GitBranch size={10} className="shrink-0" />
                                {repo}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Branches primeiro */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-2">
                      Branches Ativas
                      <span className="text-xs font-normal text-gray-400 dark:text-gray-500 normal-case">
                        (podem ter sido deletadas após merge)
                      </span>
                    </h4>
                    {isLoadingBranches ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      </div>
                    ) : branches.length > 0 ? (
                      <div className="space-y-2">
                        {branches.map((branch, idx) => (
                          <a
                            key={idx}
                            href={`https://github.com/${org}/${branch.repo}/tree/${branch.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-green-500 transition-colors group"
                          >
                            <GitBranch size={14} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                  {branch.name}
                                </p>
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded font-medium">
                                  {branch.repo}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Último commit: {branch.lastCommit.author}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                {branch.lastCommit.message}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Nenhuma branch ativa com padrão "issue-{card.number}"
                      </p>
                    )}
                  </div>

                  {/* Commits depois */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-2">
                      Commits Relacionados
                      {commits.length > 0 && (
                        <span className="text-xs font-normal text-gray-400 dark:text-gray-500 normal-case">
                          ({commits.length} {commits.length === 1 ? 'commit' : 'commits'})
                        </span>
                      )}
                    </h4>
                    {isLoadingBranches ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      </div>
                    ) : commits.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {commits.map((commit, idx) => (
                            <a
                              key={idx}
                              href={`https://github.com/${org}/${commit.repo}/commit/${commit.fullSha}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors group"
                            >
                              <GitCommit size={14} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="text-xs font-mono text-blue-600 dark:text-blue-400">
                                    {commit.sha}
                                  </code>
                                  <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded font-medium">
                                    {commit.repo}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-900 dark:text-gray-100 mt-1 line-clamp-2">
                                  {commit.message}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {commit.author} • {formatDate(commit.date)}
                                </p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Nenhum commit encontrado
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeSidebarTab === 'links' && (
                <div className="space-y-4">
                  {/* Milestone */}
                  {isLoadingLinks ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : milestone ? (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                        Milestone
                      </h4>
                      <a
                        href={milestone.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {milestone.title}
                          </p>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            milestone.state === 'OPEN'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {milestone.state === 'OPEN' ? 'Aberto' : 'Fechado'}
                          </span>
                        </div>
                        {milestone.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            {milestone.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4">
                          {milestone.progressPercentage !== null && (
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                <span>Progresso</span>
                                <span>{milestone.progressPercentage}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                                  style={{ width: `${milestone.progressPercentage}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {milestone.dueOn && (
                            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                              <Calendar size={12} />
                              <span>{new Date(milestone.dueOn).toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}
                        </div>
                      </a>
                    </div>
                  ) : null}

                  {/* Pull Requests */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                      Pull Requests
                    </h4>
                    {isLoadingLinks ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      </div>
                    ) : pullRequests.length > 0 ? (
                      <div className="space-y-2">
                        {pullRequests.map((pr) => (
                          <a
                            key={pr.number}
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors group"
                          >
                            <GitBranch size={14} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                  #{pr.number}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  pr.state === 'OPEN'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : pr.state === 'MERGED'
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                }`}>
                                  {pr.state === 'OPEN' ? 'Aberto' : pr.state === 'MERGED' ? 'Merged' : 'Fechado'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-900 dark:text-gray-100 truncate mt-1">
                                {pr.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {pr.author} • {formatDate(pr.createdAt)}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Nenhum PR relacionado encontrado
                      </p>
                    )}
                  </div>

                  {/* Repositório Info */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                      Repositório
                    </h4>
                    {branches.length > 0 ? (
                      // Se encontrou branches, mostrar os repos únicos das branches
                      <div className="space-y-2">
                        {Array.from(new Set(branches.map(b => b.repo))).map((repoName) => (
                          <a
                            key={repoName}
                            href={`https://github.com/${org}/${repoName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
                          >
                            <ExternalLink size={14} className="text-gray-600 dark:text-gray-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                {org}/{repoName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Ver no GitHub
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : card.repo ? (
                      // Se não encontrou branches mas o card tem repo, mostrar o repo do card
                      <a
                        href={`https://github.com/${org}/${card.repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
                      >
                        <ExternalLink size={14} className="text-gray-600 dark:text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {org}/{card.repo}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Ver no GitHub
                          </p>
                        </div>
                      </a>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Nenhum repositório identificado
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
