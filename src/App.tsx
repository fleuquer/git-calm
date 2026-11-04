import { useState, useEffect, useRef, useCallback } from 'react';
import { LoginForm } from './components/LoginForm';
import { ProjectColumn } from './components/ProjectColumn';
import { ViewTabs } from './components/ViewTabs';
import { CardDetailModal } from './components/CardDetailModal';
import { SettingsPanel } from './components/SettingsPanel';
import { FilterPanel } from './components/FilterPanel';
import { ActivityNotifications } from './components/ActivityNotifications';
import { ActivityLogButton, useActivityLog, DEFAULT_ACTIVITY_SETTINGS } from './components/ActivityLogButton';
import type { ActivityMonitorSettings } from './components/ActivityLogButton';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { ReleaseModal } from './components/ReleaseModal';
import { DailyReportModal } from './components/DailyReportModal';
import { WeeklyPlanningModal } from './components/WeeklyPlanningModal';
import { DashboardModal } from './components/DashboardModal';
import { ChangelogModal } from './components/ChangelogModal';
import { CURRENT_VERSION, VERSION_STORAGE_KEY } from './version';
import { NotificationBell } from './components/NotificationBell';
import { NotificationAlertModal, type AlertItem } from './components/NotificationAlertModal';
import { NotificationDetailModal } from './components/NotificationDetailModal';
import { GitHubService } from './services/github';
import type { ProjectColumn as ProjectColumnType, ViewTab, ProjectCard } from './types';
import { RefreshCw, GitBranch, Settings as SettingsIcon, Filter, Package, FileText, SlidersHorizontal, Layers, Check, BarChart2, ExternalLink, ClipboardList, Rows3 } from 'lucide-react';
import { CardSearchBar } from './components/CardSearchBar';
import { DEFAULT_VIEWS } from './utils/defaultViews';
import { getPeopleForView } from './utils/viewPeopleMapping';
import { getTagsForView, getTagGroupsForView } from './utils/viewTagsMapping';
import { filterColumns, getTotalCards } from './utils/filterUtils';
import { getTheme, applyTheme, resolveThemeId } from './themes';
import { applyFontSettings } from './utils/fontSettings';
import { useRealtimeUpdates, type CardChange } from './hooks/useRealtimeUpdates';
import { useGithubNotifications, type GithubNotification, DEFAULT_NOTIFICATION_SETTINGS } from './hooks/useGithubNotifications';
import { DEFAULT_CARD_SORT, type CardSortOption } from './utils/cardSort';
import { setProjectSingleSelectFields } from './utils/prioritySettings';
import type { IssueLinkRef } from './utils/issueLinks';
import { loadCardHistory, recordCardView, clearCardHistory, sameIssue, type CardHistoryEntry } from './utils/cardHistory';
import { CardHistoryButton } from './components/CardHistoryButton';
import { getReworkColumns } from './utils/reworkColumns';
import { recordReworkVisit } from './utils/reworkTracking';
import {
  getSavePreferencesEnabled,
  setSavePreferencesEnabled as persistSavePreferencesEnabled,
  loadPreference,
  savePreference,
} from './utils/preferenceStorage';

function App() {
  // Inicializar tema do localStorage ANTES de qualquer renderização
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    // Temas antigos (removidos) são migrados para o equivalente atual
    const themeId = resolveThemeId(localStorage.getItem('github_theme'));
    applyTheme(getTheme(themeId));

    // Aplicar configurações de tipografia
    applyFontSettings();

    return themeId;
  });
  const [token, setToken] = useState<string>('');
  const [org, setOrg] = useState<string>('');
  const [projectNumber, setProjectNumber] = useState<number>(0);
  const [columns, setColumns] = useState<ProjectColumnType[]>([]);
  const [archivedCards, setArchivedCards] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  // Estados para visualizações
  const [views, setViews] = useState<ViewTab[]>(DEFAULT_VIEWS);
  const [activeViewId, setActiveViewId] = useState<string>('overview');
  const [allStatuses, setAllStatuses] = useState<string[]>([]);
  const [allLabels, setAllLabels] = useState<string[]>([]);

  // Estado para labels ocultas
  const [hiddenLabels, setHiddenLabels] = useState<string[]>([]);

  // Estado para labels forçadas a exibir (sobrescreve hiddenLabels da view)
  const [forceVisibleLabels, setForceVisibleLabels] = useState<string[]>(() => {
    const saved = localStorage.getItem('github_force_visible_labels');
    return saved ? JSON.parse(saved) : [];
  });

  // Estados para filtros clicáveis
  const [activeAssigneeFilter, setActiveAssigneeFilter] = useState<string | null>(null);
  const [activeLabelFilter, setActiveLabelFilter] = useState<string | null>(null);

  // Estado para modal de detalhes do card
  const [selectedCard, setSelectedCard] = useState<ProjectCard | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  // Trilha de navegação entre cards por links (card 1 → link → card 2...): permite voltar
  const [cardTrail, setCardTrail] = useState<ProjectCard[]>([]);
  const [openingIssueLink, setOpeningIssueLink] = useState<IssueLinkRef | null>(null);
  // Histórico de cards visualizados (issue #6)
  const [cardHistory, setCardHistory] = useState<CardHistoryEntry[]>(loadCardHistory);

  // Exibe um card no modal e registra no histórico de visualizados
  const showCard = (card: ProjectCard) => {
    setSelectedCard(card);
    setIsCardModalOpen(true);
    setCardHistory(prev => recordCardView(prev, card));
  };

  // Cache do campo de status (lazy-fetched na primeira movimentação)
  const [statusFieldInfo, setStatusFieldInfo] = useState<{
    projectId: string;
    fieldId: string;
    options: Array<{ id: string; name: string }>;
  } | null>(null);

  // Estado para painéis centralizados
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState(false);
  const [isWeeklyPlanningModalOpen, setIsWeeklyPlanningModalOpen] = useState(false);
  const [mainView, setMainView] = useState<'board' | 'dashboard'>('board');

  // Estado para menu de opções do header
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Estado para agrupamento de cards
  const [groupBy, setGroupBy] = useState<'none' | 'person' | 'tag' | 'priority' | 'city'>('none');

  // Estado para colunas minimizadas
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('github_collapsed_columns');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Estado para visão compacta dos cards
  const [compactCardView, setCompactCardView] = useState<boolean>(() => {
    const saved = localStorage.getItem('github_compact_card_view');
    return saved ? JSON.parse(saved) : false;
  });

  // Layout em lista: cards colados, sem arredondamento (alternativa aos cartões)
  const [listLayout, setListLayout] = useState<boolean>(() => {
    const saved = localStorage.getItem('github_list_layout');
    return saved ? JSON.parse(saved) : false;
  });

  // Estado para ordenação visual dos cards dentro de cada coluna (não altera dados reais)
  const [savePreferencesEnabled, setSavePreferencesEnabledState] = useState<boolean>(() => getSavePreferencesEnabled());
  const [columnSortOptions, setColumnSortOptions] = useState<Record<string, CardSortOption>>(() =>
    loadPreference('github_column_sort_options', {} as Record<string, CardSortOption>)
  );

  const handleSavePreferencesToggle = (enabled: boolean) => {
    setSavePreferencesEnabledState(enabled);
    persistSavePreferencesEnabled(enabled);
  };

  const handleColumnSortChange = (columnId: string, option: CardSortOption) => {
    setColumnSortOptions((prev) => {
      const next = { ...prev, [columnId]: option };
      savePreference('github_column_sort_options', next);
      return next;
    });
  };

  // Estados para atualizações em tempo real
  const [recentChanges, setRecentChanges] = useState<CardChange[]>([]);
  const { items: activityLog, unreadCount: unreadActivityCount, addChanges: addActivityChanges, markAllRead: markAllActivityRead, markRead: markActivityRead, clearAll: clearActivityLog } = useActivityLog();
  const [cardAnimations, setCardAnimations] = useState<Map<number, string>>(new Map());
  const [realtimeEnabled, setRealtimeEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('realtime_enabled');
    return saved ? JSON.parse(saved) : true; // Habilitado por padrão
  });
  const [activitySettings, setActivitySettings] = useState<ActivityMonitorSettings>(() => {
    try {
      const saved = localStorage.getItem('activity_monitor_settings');
      return saved ? { ...DEFAULT_ACTIVITY_SETTINGS, ...JSON.parse(saved) } : DEFAULT_ACTIVITY_SETTINGS;
    } catch { return DEFAULT_ACTIVITY_SETTINGS; }
  });

  // Estado para notificações GitHub
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem('notification_settings');
    return saved ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(saved) } : DEFAULT_NOTIFICATION_SETTINGS;
  });
  const [alertQueue, setAlertQueue] = useState<AlertItem[]>([]);
  const [notifModalQueue, setNotifModalQueue] = useState<GithubNotification[]>([]);

  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [hasNewVersion, setHasNewVersion] = useState(() => {
    const lastSeen = localStorage.getItem(VERSION_STORAGE_KEY);
    return lastSeen !== CURRENT_VERSION;
  });

  const handleVersionClick = () => {
    setIsChangelogOpen(true);
    if (hasNewVersion) {
      setHasNewVersion(false);
      localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_VERSION);
    }
  };

  // Notificações que abrem o modal grande (menções e comentários)
  const MODAL_REASONS = new Set(['mention', 'team_mention', 'comment']);

  const handleNewAlertable = useCallback((notifications: GithubNotification[]) => {
    const forModal = notifications.filter(n => MODAL_REASONS.has(n.reason));
    const forToast = notifications.filter(n => !MODAL_REASONS.has(n.reason));

    if (forModal.length > 0) {
      setNotifModalQueue(prev => [...prev, ...forModal]);
    }

    if (forToast.length > 0) {
      const newAlerts: AlertItem[] = forToast.map(n => ({
        id: `alert-${n.id}-${Date.now()}`,
        notification: n,
        dismissAt: Date.now() + 15000,
      }));
      setAlertQueue(prev => [...prev, ...newAlerts].slice(0, 5));
      newAlerts.forEach(alert => {
        setTimeout(() => {
          setAlertQueue(prev => prev.filter(a => a.id !== alert.id));
        }, 15000);
      });
    }
  }, []);

  const handleNotificationSettings = (newSettings: typeof notificationSettings) => {
    setNotificationSettings(newSettings);
    localStorage.setItem('notification_settings', JSON.stringify(newSettings));
  };

  const handleActivitySettings = (newSettings: ActivityMonitorSettings) => {
    setActivitySettings(newSettings);
    try { localStorage.setItem('activity_monitor_settings', JSON.stringify(newSettings)); } catch { /* quota */ }
  };

  const { notifications, unreadCount, isFetching: isNotifFetching, lastError: notifError, fetchNotifications, markAsRead, markAllAsRead } =
    useGithubNotifications({
      token,
      enabled: !!token,
      settings: notificationSettings,
      currentUserLogin: user?.login,
      columns,
      onNewAlertable: handleNewAlertable,
    });

  // Abre uma notificação como card no sistema.
  // 1. Busca nos dados locais (colunas + arquivados)
  // 2. Fallback: busca na API do GitHub e constrói um ProjectCard temporário
  // 3. Último recurso: abre no GitHub
  const handleOpenNotification = useCallback(async (notification: GithubNotification) => {
    // Busca local
    if (notification.issueNumber) {
      const allCards = [
        ...columns.flatMap(col => col.cards),
        ...archivedCards,
      ];
      const found = allCards.find(c => Number(c.number) === Number(notification.issueNumber));
      if (found) {
        setCardTrail([]);
        showCard(found);
        return;
      }
    }

    // Busca na API do GitHub
    const apiUrl = notification.subjectUrl;
    if (apiUrl && token) {
      try {
        const resp = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        });
        if (resp.ok) {
          const data = await resp.json();
          const card: ProjectCard = {
            id: String(data.id),
            number: data.number,
            title: data.title,
            body: data.body || '',
            status: 'No Status',
            assignees: (data.assignees ?? []).map((a: any) => ({ login: a.login, avatarUrl: a.avatar_url })),
            labels: (data.labels ?? []).map((l: any) => ({ name: l.name, color: l.color })),
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            url: data.html_url,
            issueState: (data.state as string)?.toUpperCase(),
            repo: notification.repo,
          };
          setCardTrail([]);
          showCard(card);
          return;
        }
      } catch (err) {
        console.error('Erro ao buscar card da notificação:', err);
      }
    }

    // Último recurso
    if (notification.subjectHtmlUrl) {
      window.open(notification.subjectHtmlUrl, '_blank', 'noopener,noreferrer');
    }
  }, [columns, archivedCards, token]);

  // Alias para o antigo handleAlertOpen (usado no NotificationDetailModal e toasts)
  const handleAlertOpen = handleOpenNotification;

  useEffect(() => {
    // Carregar dados salvos
    const savedToken = localStorage.getItem('github_token');
    const savedOrg = localStorage.getItem('github_org');
    const savedProject = localStorage.getItem('github_project');
    const savedViews = localStorage.getItem('github_views');
    const savedActiveView = localStorage.getItem('github_active_view');
    const savedHiddenLabels = localStorage.getItem('github_hidden_labels');

    // Migração: limpar views antigas que tinham hiddenLabels embutidas
    if (savedViews) {
      try {
        const parsedViews = JSON.parse(savedViews);
        const hasOldFormat = parsedViews.some((v: ViewTab) => v.hiddenLabels && v.hiddenLabels.length > 0);
        if (hasOldFormat) {
          console.log('🔄 Migrando formato antigo de views... Labels ocultas foram movidas para configuração separada.');
          const cleanedViews = parsedViews.map((v: ViewTab) => {
            const { hiddenLabels, ...rest } = v;
            return rest;
          });
          localStorage.setItem('github_views', JSON.stringify(cleanedViews));
          setViews(cleanedViews);
        } else {
          setViews(parsedViews);
        }
      } catch (e) {
        console.error('Erro ao carregar visualizações salvas', e);
      }
    }

    if (savedToken && savedOrg && savedProject) {
      setToken(savedToken);
      setOrg(savedOrg);
      setProjectNumber(parseInt(savedProject, 10));
    }

    if (savedActiveView) {
      setActiveViewId(savedActiveView);
    }

    if (savedHiddenLabels) {
      try {
        const parsedHiddenLabels = JSON.parse(savedHiddenLabels);
        setHiddenLabels(parsedHiddenLabels);
      } catch (e) {
        console.error('Erro ao carregar labels ocultas', e);
      }
    }
  }, []);


  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (token && org && projectNumber) {
      loadProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, org, projectNumber]);

  // Extrair status e labels únicos das colunas
  useEffect(() => {
    const statuses = new Set<string>();
    const labels = new Set<string>();

    columns.forEach(column => {
      statuses.add(column.name);
      column.cards.forEach(card => {
        card.labels.forEach(label => labels.add(label.name));
      });
    });

    setAllStatuses(Array.from(statuses).sort());
    setAllLabels(Array.from(labels).sort());
  }, [columns]);

  // Estado para rastrear quando cada card teve evento carregado
  const [cardEventsLoadedAt, setCardEventsLoadedAt] = useState<Map<number, number>>(new Map());

  // Filtrar mudanças de acordo com as configurações de monitoramento
  const filterActivityChanges = (changes: CardChange[], s: ActivityMonitorSettings): CardChange[] => {
    return changes.map(change => {
      if (change.type === 'added'   && !s.trackAdded)   return null;
      if (change.type === 'moved'   && !s.trackMoved)   return null;
      if (change.type === 'removed' && !s.trackRemoved) return null;
      if (change.type === 'updated') {
        const filteredChanges = {
          status:     change.changes?.status,
          updatedAt:  undefined as undefined,
          assignees:  change.changes?.assignees && s.trackAssignees  ? true : undefined,
          labels:     change.changes?.labels    && s.trackLabels     ? true : undefined,
          title:      change.changes?.title     && s.trackTitle      ? true : undefined,
          issueState: change.changes?.issueState && s.trackIssueState ? true : undefined,
          dueDate:    change.changes?.dueDate   && s.trackDueDate    ? true : undefined,
          comments:   change.changes?.comments  && s.trackComments   ? true : undefined,
        };
        const hasAny = Object.values(filteredChanges).some(Boolean);
        if (!hasAny) return null;
        return { ...change, changes: filteredChanges };
      }
      return change;
    }).filter((c): c is CardChange => c !== null);
  };

  // Callback para lidar com mudanças detectadas
  const handleChangesDetected = (changes: CardChange[]) => {
    console.log('📬 Mudanças recebidas:', changes);

    const filtered = filterActivityChanges(changes, activitySettings);
    if (filtered.length === 0) return;

    // Registrar visitas a colunas de retrabalho (rastreamento local, só a partir de agora)
    const reworkColumns = getReworkColumns();
    if (reworkColumns.length > 0) {
      const now = new Date().toISOString();
      filtered.forEach(change => {
        if (change.type === 'moved' && change.toColumn && reworkColumns.includes(change.toColumn)) {
          recordReworkVisit(change.card.number, change.toColumn, now);
        }
      });
    }

    // Atualizar notificações (toast rápido)
    setRecentChanges(filtered);

    // Acumular no histórico persistente
    addActivityChanges(filtered);

    // Aplicar animações aos cards afetados
    const newAnimations = new Map<number, string>();
    filtered.forEach(change => {
      switch (change.type) {
        case 'added':
          newAnimations.set(change.card.number, 'animate-card-enter');
          break;
        case 'moved':
          newAnimations.set(change.card.number, 'animate-card-move');
          break;
        case 'updated':
          newAnimations.set(change.card.number, 'animate-card-update');
          break;
        case 'removed':
          newAnimations.set(change.card.number, 'animate-card-exit');
          break;
      }
    });

    setCardAnimations(newAnimations);

    // Limpar animações após execução
    setTimeout(() => {
      setCardAnimations(new Map());
    }, 1000);
  };

  // Callback para atualizar colunas
  const handleColumnsUpdate = (newColumns: ProjectColumnType[]) => {
    setColumns(newColumns);
  };

  const handleToggleColumnCollapse = (columnId: string) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) {
        newSet.delete(columnId);
      } else {
        newSet.add(columnId);
      }
      // Salvar no localStorage
      localStorage.setItem('github_collapsed_columns', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  // Hook de polling para atualizações em tempo real
  const { checkNow, isChecking } = useRealtimeUpdates({
    enabled: realtimeEnabled && !!token && !!org && !!projectNumber,
    token,
    org,
    projectNumber,
    currentColumns: columns,
    onUpdate: handleColumnsUpdate,
    onChangesDetected: handleChangesDetected,
    onRateLimitHit: () => {
      setError('⚠️ Limite de requisições do GitHub atingido. Polling pausado por 5 minutos.');
      setTimeout(() => setError(''), 10000); // Limpar erro após 10 segundos
    },
    intervalMs: 180000, // 3 minutos (otimizado para evitar rate limit)
  });

  const handleLogin = async (newToken: string, newOrg: string, newProjectNumber: number) => {
    setLoading(true);
    setError('');

    try {
      const service = new GitHubService(newToken);
      const userData = await service.verifyToken();

      setUser(userData);
      setToken(newToken);
      setOrg(newOrg);
      setProjectNumber(newProjectNumber);

      // Salvar no localStorage
      localStorage.setItem('github_token', newToken);
      localStorage.setItem('github_org', newOrg);
      localStorage.setItem('github_project', newProjectNumber.toString());
    } catch (err) {
      setError('Erro ao autenticar. Verifique seu token e permissões.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProject = async () => {
    setLoading(true);
    setError('');

    try {
      const service = new GitHubService(token);

      if (!user) {
        const userData = await service.verifyToken();
        setUser(userData);
      }

      const data = await service.getProjectItems(org, projectNumber);
      setProjectSingleSelectFields(data.singleSelectFields);
      setColumns(data.columns);
      setArchivedCards(data.archivedCards ?? []);

      // Buscar eventos apenas para os cards da view ativa (em background)
      loadCardEventsForView(service, org, data.columns, activeViewId);
    } catch (err: any) {
      // Tratamento especial para rate limit
      if (err.message && err.message.includes('rate limit')) {
        setError('⚠️ Limite de requisições do GitHub atingido. Aguarde alguns minutos antes de atualizar novamente. O modo "Ao Vivo" foi ajustado para 60 segundos para reduzir requisições.');
      } else {
        setError(err.message || 'Erro ao carregar projeto. Verifique as configurações.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar eventos apenas para cards específicos (lista de números)
  const loadCardEvents = async (service: GitHubService, org: string, columns: any[], cardNumbers: number[]) => {
    // Filtrar cards que não foram carregados recentemente (últimos 15 minutos)
    const now = Date.now();
    const CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

    const cardsNeedingUpdate = cardNumbers.filter(cardNum => {
      const lastLoaded = cardEventsLoadedAt.get(cardNum);
      return !lastLoaded || (now - lastLoaded) > CACHE_DURATION;
    });

    const allCards = columns.flatMap(col => col.cards);
    const cardsToProcess = allCards.filter(c => c.repo && cardsNeedingUpdate.includes(c.number));

    if (cardsToProcess.length === 0) {
      console.log('📭 Todos os cards já possuem eventos carregados recentemente');
      return;
    }

    console.log(`🔄 Carregando eventos para ${cardsToProcess.length} cards (${cardNumbers.length - cardsNeedingUpdate.length} já em cache)...`);

    // Marcar os cards específicos como "carregando"
    setColumns(prevColumns => {
      return prevColumns.map(col => ({
        ...col,
        cards: col.cards.map(c =>
          cardNumbers.includes(c.number) ? { ...c, lastEventLoading: true } : c
        )
      }));
    });

    // Processar em lotes de 20 em paralelo
    const batchSize = 20;
    let processedCount = 0;

    for (let i = 0; i < cardsToProcess.length; i += batchSize) {
      const batch = cardsToProcess.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (card) => {
          try {
            const lastEventData = await service.getIssueLastEvent(org, card.repo, card.number);
            processedCount++;

            // Registrar quando o evento foi carregado
            setCardEventsLoadedAt(prev => new Map(prev).set(card.number, Date.now()));

            // Atualizar o estado para refletir a mudança
            setColumns(prevColumns => {
              return prevColumns.map(col => ({
                ...col,
                cards: col.cards.map(c =>
                  c.number === card.number
                    ? {
                        ...c,
                        lastEvent: lastEventData?.text || undefined,
                        lastEventDetails: lastEventData?.details || undefined,
                        lastEventActor: lastEventData?.actor || undefined,
                        lastEventActorAvatar: lastEventData?.actorAvatar || undefined,
                        lastEventLoading: false
                      }
                    : c
                )
              }));
            });
          } catch (error) {
            console.error(`❌ Erro ao carregar evento do card ${card.number}:`, error);
            // Marcar como não carregando mesmo em caso de erro
            setColumns(prevColumns => {
              return prevColumns.map(col => ({
                ...col,
                cards: col.cards.map(c =>
                  c.number === card.number
                    ? { ...c, lastEventLoading: false }
                    : c
                )
              }));
            });
          }
        })
      );
    }

    console.log(`✅ Eventos carregados para ${processedCount} cards`);
  };

  // Carregar eventos apenas para cards da view ativa
  const loadCardEventsForView = async (service: GitHubService, org: string, columns: any[], viewId: string) => {
    // Filtrar colunas pela view ativa
    const currentView = views.find(v => v.id === viewId) || views[0];
    const viewColumns = filterColumns(columns, currentView);

    // Obter todos os cards da view
    const viewCards = viewColumns.flatMap(col => col.cards).filter(c => c.repo);
    const cardNumbers = viewCards.map(c => c.number);

    console.log(`📊 View "${currentView.name}": ${cardNumbers.length} cards encontrados`);

    if (cardNumbers.length > 0) {
      await loadCardEvents(service, org, columns, cardNumbers);
    }
  };  const handleLogout = () => {
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_org');
    localStorage.removeItem('github_project');
    setToken('');
    setOrg('');
    setProjectNumber(0);
    setColumns([]);
    setUser(null);
    setIsSettingsPanelOpen(false);
  };

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    localStorage.setItem('github_theme', themeId);
    applyTheme(getTheme(themeId));
  };

  const handleSaveViews = (newViews: ViewTab[]) => {
    setViews(newViews);
    localStorage.setItem('github_views', JSON.stringify(newViews));
  };

  const handleViewChange = (viewId: string) => {
    setActiveViewId(viewId);
    localStorage.setItem('github_active_view', viewId);

    // Carregar eventos dos cards da nova view ativa
    if (token && org && columns.length > 0) {
      const service = new GitHubService(token);
      loadCardEventsForView(service, org, columns, viewId);
    }
  };

  const handleToggleLabel = (label: string) => {
    const viewHiddenLabelsConfig: Record<string, string[]> = JSON.parse(
      localStorage.getItem('view_hidden_labels') || '{}'
    );
    const currentViewHiddenLabels = viewHiddenLabelsConfig[activeViewId] || [];
    const isViewHidden = currentViewHiddenLabels.includes(label);

    if (isViewHidden) {
      // Label oculta pela view: toggle force visible
      const newForceVisible = forceVisibleLabels.includes(label)
        ? forceVisibleLabels.filter(l => l !== label)
        : [...forceVisibleLabels, label];
      setForceVisibleLabels(newForceVisible);
      localStorage.setItem('github_force_visible_labels', JSON.stringify(newForceVisible));
    } else {
      // Label normal: toggle hidden
      const newHiddenLabels = hiddenLabels.includes(label)
        ? hiddenLabels.filter(l => l !== label)
        : [...hiddenLabels, label];
      setHiddenLabels(newHiddenLabels);
      localStorage.setItem('github_hidden_labels', JSON.stringify(newHiddenLabels));
    }
  };  // Toggle filtro de assignee (clicável)
  const handleToggleAssigneeFilter = (assigneeLogin: string) => {
    if (activeAssigneeFilter === assigneeLogin) {
      setActiveAssigneeFilter(null);
      setActiveLabelFilter(null); // Limpar filtro de label também
    } else {
      setActiveAssigneeFilter(assigneeLogin);
      setActiveLabelFilter(null); // Limpar filtro de label
    }
  };

  // Toggle filtro de label (clicável)
  const handleToggleLabelFilter = (labelName: string) => {
    if (activeLabelFilter === labelName) {
      setActiveLabelFilter(null);
      setActiveAssigneeFilter(null); // Limpar filtro de assignee também
    } else {
      setActiveLabelFilter(labelName);
      setActiveAssigneeFilter(null); // Limpar filtro de assignee
    }
  };

  // Handler para abrir modal do card
  const handleCardClick = (card: ProjectCard) => {
    setCardTrail([]);
    showCard(card);
  };

  // Abre um card a partir de um link dentro de outro: o card atual entra na trilha
  const openLinkedCard = (card: ProjectCard) => {
    if (selectedCard) setCardTrail(prev => [...prev, selectedCard]);
    showCard(card);
  };

  // Volta para um card da trilha (índice), descartando os que vieram depois dele.
  // Usa a versão mais recente do card no board, se ele ainda estiver carregado.
  const handleNavigateTrail = (index: number) => {
    const target = cardTrail[index];
    if (!target) return;
    const fresh = [...columns.flatMap(col => col.cards), ...archivedCards].find(c => c.id === target.id);
    setCardTrail(prev => prev.slice(0, index));
    showCard(fresh ?? target);
  };

  // Link para outra issue dentro de um card (issue #5): abre o card no app em vez de ir ao GitHub.
  // Procura no board (e nos arquivados); se não estiver lá, busca a issue na API; se nada der
  // certo (ex: PR fora do board, sem acesso), abre o link no GitHub como antes.
  const handleOpenIssueLink = async (ref: IssueLinkRef) => {
    const isTarget = (c: ProjectCard) => sameIssue(c, ref);

    if (selectedCard && isTarget(selectedCard)) return; // link para o próprio card

    // Se o card já está na trilha, volta até ele em vez de empilhar de novo (evita ciclos 1 → 2 → 1 → 2)
    const trailIndex = cardTrail.findIndex(isTarget);
    if (trailIndex >= 0) {
      handleNavigateTrail(trailIndex);
      return;
    }

    const known = findCardOnBoard(ref);
    if (known) {
      openLinkedCard(known);
      return;
    }

    if (ref.kind === 'issue') {
      setOpeningIssueLink(ref);
      try {
        const fetched = await new GitHubService(token).getIssueAsCard(org, ref.repo, ref.number);
        if (fetched) {
          openLinkedCard(fetched);
          return;
        }
      } finally {
        setOpeningIssueLink(null);
      }
    }
    window.open(ref.url, '_blank', 'noopener,noreferrer');
  };

  const findCardOnBoard = (ref: { number: number; repo?: string }) =>
    [...columns.flatMap(col => col.cards), ...archivedCards].find(c => sameIssue(c, ref));

  // Reabre um card do histórico: usa a versão do board; se não estiver lá, busca na API
  const handleOpenFromHistory = async (entry: CardHistoryEntry) => {
    const known = findCardOnBoard(entry);
    if (known) {
      handleCardClick(known);
      return;
    }
    if (entry.repo) {
      const fetched = await new GitHubService(token).getIssueAsCard(org, entry.repo, entry.number);
      if (fetched) {
        handleCardClick(fetched);
        return;
      }
    }
    window.open(entry.url, '_blank', 'noopener,noreferrer');
  };

  // Alt+← com nenhum card aberto reabre o último visualizado (como o "voltar" do navegador).
  // Com um card aberto, o Alt+← é tratado pela trilha de navegação do próprio modal.
  const reopenLastCardRef = useRef<() => void>(() => {});
  useEffect(() => {
    reopenLastCardRef.current = () => {
      if (!isCardModalOpen && cardHistory.length > 0) handleOpenFromHistory(cardHistory[0]);
    };
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.key !== 'ArrowLeft') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      e.preventDefault(); // evita o "voltar" do navegador, que sairia do app
      reopenLastCardRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Mover card para outra coluna (atualiza status no GitHub Projects)
  const handleMoveCard = async (cardId: string, targetStatus: string) => {
    let info = statusFieldInfo;
    if (!info) {
      const service = new GitHubService(token);
      info = await service.getProjectStatusField(org, projectNumber);
      setStatusFieldInfo(info);
    }
    const option = info.options.find(o => o.name === targetStatus);
    if (!option) return;

    // Atualiza otimisticamente (move o card sem recarregar tudo)
    setColumns(prev => {
      const card = prev.flatMap(c => c.cards).find(c => c.id === cardId);
      if (!card) return prev;
      return prev.map(col => {
        if (col.name === card.status) return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
        if (col.name === targetStatus)  return { ...col, cards: [...col.cards, { ...card, status: targetStatus }] };
        return col;
      });
    });
    // Atualiza o card aberto no modal
    setSelectedCard(prev => prev?.id === cardId ? { ...prev, status: targetStatus } : prev);

    const service = new GitHubService(token);
    await service.updateProjectItemStatus(info.projectId, cardId, info.fieldId, option.id);
  };

  // Busca de card arquivado diretamente na API do GitHub
  const handleGitHubSearch = async (issueNumber: number): Promise<ProjectCard | null> => {
    const token = localStorage.getItem('github_token') || '';
    if (!token || !org) return null;
    const service = new GitHubService(token);
    return service.searchIssueByNumber(org, issueNumber);
  };

  // Filtrar colunas baseado na visualização ativa
  const activeView = views.find(v => v.id === activeViewId) || views[0];
  let filteredColumns = filterColumns(columns, activeView);

  // Carregar hiddenLabels configuradas para a view atual do localStorage
  const viewHiddenLabelsConfig: Record<string, string[]> = JSON.parse(
    localStorage.getItem('view_hidden_labels') || '{}'
  );
  const currentViewHiddenLabels = viewHiddenLabelsConfig[activeViewId] || [];

  // Combinar: (viewHiddenLabels + hiddenLabels) - forceVisibleLabels
  const allHiddenLabels = [...new Set([...currentViewHiddenLabels, ...hiddenLabels])];
  const combinedHiddenLabels = allHiddenLabels.filter(label => !forceVisibleLabels.includes(label));

  // Aplicar filtros clicáveis (assignee ou label)
  if (activeAssigneeFilter || activeLabelFilter) {
    filteredColumns = filteredColumns.map(column => ({
      ...column,
      cards: column.cards.filter(card => {
        if (activeAssigneeFilter) {
          return card.assignees.some(a => a.login === activeAssigneeFilter);
        }
        if (activeLabelFilter) {
          return card.labels.some(l => l.name === activeLabelFilter);
        }
        return true;
      })
    }));
    // Não remover colunas vazias - mantém estrutura do board
  }

  const totalCards = getTotalCards(filteredColumns);

  if (!token || !org || !projectNumber) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors shrink-0">
        <div className="max-w-full mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="text-gray-600 dark:text-gray-400" size={20} />
              <div>
                <h1 className="text-sm font-semibold text-gray-800 dark:text-white">
                  {org} / Projects #{projectNumber}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {totalCards} cards
                  {(activeAssigneeFilter || activeLabelFilter) && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium">
                      Filtro ativo: {activeAssigneeFilter || activeLabelFilter}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Board / Dashboard */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setMainView('board')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mainView === 'board'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <Layers size={13} />
                  Board
                </button>
                <button
                  onClick={() => setMainView('dashboard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mainView === 'dashboard'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <BarChart2 size={13} />
                  Dados
                </button>
              </div>

              <CardSearchBar
                columns={columns}
                archivedCards={archivedCards}
                onCardSelect={handleCardClick}
                onGitHubSearch={handleGitHubSearch}
              />

              {/* Sino de notificações */}
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                isFetching={isNotifFetching}
                lastError={notifError}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onRefresh={fetchNotifications}
                onOpenNotification={handleOpenNotification}
                allCards={[...columns.flatMap(col => col.cards), ...archivedCards]}
                token={token}
              />

              {/* Histórico de atividades do board */}
              <ActivityLogButton
                items={activityLog}
                unreadCount={unreadActivityCount}
                onOpenCard={handleCardClick}
                onMarkAllRead={markAllActivityRead}
                onMarkRead={markActivityRead}
                onClearAll={clearActivityLog}
              />

              {/* Cards visualizados recentemente */}
              <CardHistoryButton
                history={cardHistory}
                onOpen={handleOpenFromHistory}
                onClear={() => setCardHistory(clearCardHistory())}
                findOnBoard={findCardOnBoard}
              />

              <ThemeSwitcher selectedTheme={selectedTheme} onThemeChange={handleThemeChange} />

              {/* Menu de opções */}
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setIsMenuOpen(v => !v)}
                  className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                    isMenuOpen
                      ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Opções"
                >
                  <SlidersHorizontal size={15} />
                </button>
                {/* Badge quando há filtros ativos */}
                {(hiddenLabels.length > 0 || groupBy !== 'none') && (
                  <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 bg-blue-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none">
                    {(hiddenLabels.length > 0 ? 1 : 0) + (groupBy !== 'none' ? 1 : 0)}
                  </span>
                )}

                {isMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1 overflow-hidden">

                    {/* Seção: Visualização */}
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Visualização</p>
                    </div>

                    <button
                      onClick={() => { setIsFilterPanelOpen(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Filter size={14} className="text-gray-400 shrink-0" />
                      <span>Filtros</span>
                      {(hiddenLabels.length > 0 || groupBy !== 'none') && (
                        <span className="ml-auto px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-bold">
                          {(hiddenLabels.length > 0 ? 1 : 0) + (groupBy !== 'none' ? 1 : 0)}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        const newValue = !compactCardView;
                        setCompactCardView(newValue);
                        localStorage.setItem('github_compact_card_view', JSON.stringify(newValue));
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Layers size={14} className="text-gray-400 shrink-0" />
                      <span>Visão compacta</span>
                      {compactCardView && <Check size={12} className="ml-auto text-blue-500" />}
                    </button>

                    <button
                      onClick={() => {
                        const newValue = !listLayout;
                        setListLayout(newValue);
                        localStorage.setItem('github_list_layout', JSON.stringify(newValue));
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Rows3 size={14} className="text-gray-400 shrink-0" />
                      <span>Layout em lista</span>
                      {listLayout && <Check size={12} className="ml-auto text-blue-500" />}
                    </button>

                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                    {/* Seção: Atualização */}
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Atualização</p>
                    </div>

                    <button
                      onClick={() => {
                        const newValue = !realtimeEnabled;
                        setRealtimeEnabled(newValue);
                        localStorage.setItem('realtime_enabled', JSON.stringify(newValue));
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        realtimeEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`} />
                      <span>{realtimeEnabled ? 'Ao Vivo (ativo)' : 'Manual'}</span>
                      {realtimeEnabled && <Check size={12} className="ml-auto text-green-500" />}
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        realtimeEnabled ? checkNow() : loadProject();
                      }}
                      disabled={realtimeEnabled ? isChecking : loading}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw size={14} className={`text-gray-400 shrink-0 ${
                        (realtimeEnabled ? isChecking : loading) ? 'animate-spin' : ''
                      }`} />
                      <span>Atualizar agora</span>
                    </button>

                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                    {/* Seção: Ferramentas */}
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Ferramentas</p>
                    </div>

                    <button
                      onClick={() => { setIsDailyReportModalOpen(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      <span>Relatório Diário</span>
                    </button>

                    <button
                      onClick={() => { setIsWeeklyPlanningModalOpen(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ClipboardList size={14} className="text-gray-400 shrink-0" />
                      <span>Planejamento Semanal</span>
                    </button>

                    <button
                      onClick={() => { setIsReleaseModalOpen(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Package size={14} className="text-gray-400 shrink-0" />
                      <span>Gerar Release</span>
                    </button>

                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                    <button
                      onClick={() => { setIsSettingsPanelOpen(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <SettingsIcon size={14} className="text-gray-400 shrink-0" />
                      <span>Configurações</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* View Tabs — só no Board */}
        {mainView === 'board' && (
          <div className="shrink-0">
            <ViewTabs
              views={views}
              activeViewId={activeViewId}
              onViewChange={handleViewChange}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-md mx-4 mt-3 text-sm shrink-0">
            {error}
          </div>
        )}

        {loading && columns.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" size={32} />
              <p className="text-gray-600 dark:text-gray-400 text-sm">Carregando projeto...</p>
            </div>
          </div>
        ) : mainView === 'dashboard' ? (
          <DashboardModal columns={columns} views={views} />
        ) : (
          <div className="flex-1 overflow-auto">
            <div className={`flex h-full ${listLayout ? 'gap-2 p-2' : 'gap-0'}`}>
              {filteredColumns.map((column) => (
                <ProjectColumn
                  key={column.id}
                  column={column}
                  activeViewId={activeViewId}
                  hiddenLabels={combinedHiddenLabels}
                  currentUser={user?.login}
                  onAssigneeClick={handleToggleAssigneeFilter}
                  onLabelClick={handleToggleLabelFilter}
                  activeAssigneeFilter={activeAssigneeFilter}
                  activeLabelFilter={activeLabelFilter}
                  onCardClick={handleCardClick}
                  groupBy={groupBy}
                  viewPeople={getPeopleForView(activeViewId)}
                  viewTags={getTagsForView(activeViewId)}
                  viewTagGroups={getTagGroupsForView(activeViewId)}
                  cardAnimations={cardAnimations}
                  isCollapsed={collapsedColumns.has(column.id)}
                  onToggleCollapse={() => handleToggleColumnCollapse(column.id)}
                  compactCardView={compactCardView}
                  listLayout={listLayout}
                  onDropCard={handleMoveCard}
                  sortOption={columnSortOptions[column.id] ?? DEFAULT_CARD_SORT}
                  onSortChange={(option) => handleColumnSortChange(column.id, option)}
                />
              ))}
            </div>
          </div>
        )}

        {!loading && filteredColumns.length === 0 && !error && (
          <div className="flex items-center justify-center flex-1">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Nenhum card encontrado para este filtro.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <img src="/favicon.svg" alt="git-calm" className="w-4 h-4" />
            <span className="text-xs font-mono font-bold" style={{ color: '#2dd4bf' }}>Git</span>
            <span className="text-xs font-mono font-light text-gray-400 dark:text-gray-500" style={{ marginLeft: '-4px' }}>calm</span>
          </div>
          <span className="text-gray-300 dark:text-gray-700 text-xs select-none">·</span>
          <a
            href="https://github.com/fleuquer/git-calm/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            <ExternalLink size={10} />
            Reportar bug
          </a>
        </div>
        <button
          onClick={handleVersionClick}
          className="flex items-center gap-1.5 text-xs font-mono text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          v{CURRENT_VERSION}
          {hasNewVersion && (
            <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-semibold animate-pulse">
              Novidades
            </span>
          )}
        </button>
      </footer>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onClose={() => setIsSettingsPanelOpen(false)}
        token={token}
        org={org}
        projectNumber={projectNumber}
        onLogout={handleLogout}
        selectedTheme={selectedTheme}
        onThemeChange={handleThemeChange}
        views={views}
        onSaveViews={handleSaveViews}
        allStatuses={allStatuses}
        allLabels={allLabels}
        availableTags={allLabels}
        notificationSettings={notificationSettings}
        onNotificationSettingsChange={handleNotificationSettings}
        activitySettings={activitySettings}
        onActivitySettingsChange={handleActivitySettings}
        savePreferencesEnabled={savePreferencesEnabled}
        onSavePreferencesEnabledChange={handleSavePreferencesToggle}
      />

      {/* Filter Panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        hiddenLabels={hiddenLabels}
        onToggleLabel={handleToggleLabel}
        allLabels={allLabels}
        activeViewId={activeViewId}
        viewHiddenLabels={currentViewHiddenLabels}
        forceVisibleLabels={forceVisibleLabels}
      />

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setSelectedCard(null);
          setCardTrail([]);
        }}
        token={token}
        org={org}
        onUpdate={loadProject}
        currentViewId={activeViewId}
        columns={columns}
        onMoveCard={handleMoveCard}
        onOpenIssueLink={handleOpenIssueLink}
        trail={cardTrail}
        onNavigateTrail={handleNavigateTrail}
        openingIssueLink={openingIssueLink}
      />

      {/* Daily Report Modal */}
      <DailyReportModal
        isOpen={isDailyReportModalOpen}
        onClose={() => setIsDailyReportModalOpen(false)}
        columns={columns}
        currentViewId={activeViewId}
        token={token}
        org={org}
      />

      {/* Weekly Planning Modal */}
      <WeeklyPlanningModal
        isOpen={isWeeklyPlanningModalOpen}
        onClose={() => setIsWeeklyPlanningModalOpen(false)}
        columns={filteredColumns}
        currentViewName={activeView?.name}
        token={token}
        org={org}
      />

      {/* Release Modal */}
      <ReleaseModal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        columns={filteredColumns}
        currentViewId={activeViewId}
        currentViewName={activeView?.name}
        token={token}
        org={org}
        projectNumber={projectNumber}
        onCardsUpdated={loadProject}
      />

      {/* Activity Notifications */}
      <ActivityNotifications
        changes={recentChanges}
        onDismiss={() => setRecentChanges([])}
        autoHideMs={5000}
        settings={activitySettings}
      />

      {/* MSN-style notification alerts (para atribuições e outros) */}
      <NotificationAlertModal
        alerts={alertQueue}
        onDismiss={id => setAlertQueue(prev => prev.filter(a => a.id !== id))}
        onOpen={handleAlertOpen}
      />

      {/* Modal de notificações detalhado (menções e comentários) */}
      <NotificationDetailModal
        queue={notifModalQueue}
        token={token}
        onDismiss={id => setNotifModalQueue(prev => prev.filter(n => n.id !== id))}
        onDismissAll={() => setNotifModalQueue([])}
        onOpenCard={handleAlertOpen}
      />

      {/* Changelog Modal */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
    </div>
  );
}

export default App;
