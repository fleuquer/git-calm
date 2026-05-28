import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, MessageCircle, AtSign, UserCheck, GitPullRequest, AlertCircle, RefreshCw, Settings2, ExternalLink, ListChecks, Square, CheckSquare, ArrowUpNarrowWide, ArrowDownNarrowWide, Volume2, VolumeX, Play } from 'lucide-react';
import type { GithubNotification, NotificationSettings } from '../hooks/useGithubNotifications';
import { playNotificationSound } from '../utils/notificationSounds';
import type { ProjectCard } from '../types';

interface Props {
  notifications: GithubNotification[];
  unreadCount: number;
  isFetching: boolean;
  lastError: string | null;
  settings: NotificationSettings;
  onMarkAsRead: (threadId: string) => void;
  onMarkAllAsRead: () => void;
  onRefresh: () => void;
  onSettingsChange: (settings: NotificationSettings) => void;
  onOpenNotification: (notification: GithubNotification) => void;
  // Cards disponíveis apenas para exibir status/issueState na lista
  allCards: ProjectCard[];
  token?: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getReasonLabel(reason: string): string {
  switch (reason) {
    case 'mention': return 'Menção';
    case 'team_mention': return 'Menção no time';
    case 'comment': return 'Comentário';
    case 'assign': return 'Atribuição';
    case 'review_requested': return 'Revisão solicitada';
    case 'author': return 'Autor';
    case 'subscribed': return 'Inscrito';
    case 'state_change': return 'Estado alterado';
    default: return reason;
  }
}

function ReasonIcon({ reason, size = 12 }: { reason: string; size?: number }) {
  switch (reason) {
    case 'mention':
    case 'team_mention':
      return <AtSign size={size} className="text-purple-500" />;
    case 'comment':
      return <MessageCircle size={size} className="text-blue-500" />;
    case 'assign':
      return <UserCheck size={size} className="text-green-500" />;
    case 'review_requested':
      return <GitPullRequest size={size} className="text-orange-500" />;
    default:
      return <Bell size={size} className="text-gray-400" />;
  }
}

export const NotificationBell: React.FC<Props> = ({
  notifications,
  unreadCount,
  isFetching,
  lastError,
  settings,
  onMarkAsRead,
  onMarkAllAsRead,
  onRefresh,
  onSettingsChange,
  onOpenNotification,
  allCards,
  token,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Cache: notification.id -> issueState (para notifs sem card local)
  const [issueStateCache, setIssueStateCache] = useState<Record<string, string>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Busca o issueState via API para notificações sem card local
  useEffect(() => {
    if (!isOpen || !token) return;

    const orphans = notifications.filter(n => {
      if (!n.subjectUrl) return false;
      if (issueStateCache[n.id]) return false; // já em cache
      if (fetchingRef.current.has(n.id)) return false; // já buscando
      // só precisa buscar se não tem card local
      const hasLocal = n.issueNumber != null &&
        allCards.some(c => Number(c.number) === Number(n.issueNumber));
      return !hasLocal;
    });

    if (orphans.length === 0) return;

    orphans.forEach(n => {
      fetchingRef.current.add(n.id);
      fetch(n.subjectUrl!, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.state) return;
          let state: string;
          if (data.state === 'open') {
            state = 'OPEN';
          } else if (data.merged === true || data.pull_request?.merged_at) {
            state = 'MERGED';
          } else {
            state = 'CLOSED';
          }
          setIssueStateCache(prev => ({ ...prev, [n.id]: state }));
        })
        .catch(() => { /* silencioso */ })
        .finally(() => fetchingRef.current.delete(n.id));
    });
  }, [isOpen, notifications, token, allCards, issueStateCache]);

  const exitSelectionMode = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllUnread = useCallback(() => {
    const unreadIds = notifications.filter(n => n.unread).map(n => n.id);
    setSelectedIds(new Set(unreadIds));
  }, [notifications]);

  const markSelectedAsRead = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => onMarkAsRead(id)));
    exitSelectionMode();
  }, [selectedIds, onMarkAsRead, exitSelectionMode]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
        exitSelectionMode();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exitSelectionMode]);

  const handleNotificationClick = useCallback((notification: GithubNotification) => {
    if (isSelecting) {
      toggleSelect(notification.id);
      return;
    }
    onMarkAsRead(notification.threadId);
    onOpenNotification(notification);
    setIsOpen(false);
  }, [onMarkAsRead, onOpenNotification, isSelecting, toggleSelect]);

  const displayCount = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

  const sortedNotifications = [...notifications].sort((a, b) => {
    const diff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    return sortOrder === 'newest' ? diff : -diff;
  });
  const unreadList = sortedNotifications.filter(n => n.unread);
  const readList = sortedNotifications.filter(n => !n.unread);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Botão do sino */}
      <button
        onClick={() => { setIsOpen(v => !v); setShowSettings(false); }}
        className={`relative flex items-center justify-center w-8 h-8 rounded-md transition-all ${
          isOpen
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title="Notificações"
      >
        {isFetching ? (
          <RefreshCw size={15} className="animate-spin" />
        ) : (
          <Bell size={15} className={unreadCount > 0 ? 'text-blue-500 dark:text-blue-400' : ''} />
        )}
        {/* Badge de contagem */}
        {displayCount && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-100 flex flex-col max-h-130">
          {/* Header do dropdown */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-white">Notificações</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-full">
                  {unreadCount} não lidas
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Botão de ordenação */}
              {notifications.length > 0 && (
                <button
                  onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                  className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title={sortOrder === 'newest' ? 'Mais recentes primeiro (clique para inverter)' : 'Mais antigas primeiro (clique para inverter)'}
                >
                  {sortOrder === 'newest'
                    ? <ArrowDownNarrowWide size={13} />
                    : <ArrowUpNarrowWide size={13} />}
                </button>
              )}
              {/* Botão modo seleção */}
              {notifications.length > 0 && (
                <button
                  onClick={() => { setIsSelecting(v => !v); setSelectedIds(new Set()); setShowSettings(false); }}
                  className={`p-1 rounded transition-colors ${
                    isSelecting
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                  title={isSelecting ? 'Cancelar seleção' : 'Selecionar notificações'}
                >
                  <ListChecks size={13} />
                </button>
              )}
              <button
                onClick={() => { setShowSettings(v => !v); setIsSelecting(false); setSelectedIds(new Set()); }}
                className={`p-1 rounded transition-colors ${
                  showSettings
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="Configurações de notificações"
              >
                <Settings2 size={13} />
              </button>
              <button
                onClick={onRefresh}
                className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Atualizar"
              >
                <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              </button>
              {unreadCount > 0 && !isSelecting && (
                <button
                  onClick={onMarkAllAsRead}
                  className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Painel de configurações */}
          {showSettings && (
            <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                Alertas em tela (estilo MSN)
              </p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => onSettingsChange({ ...settings, enabled: !settings.enabled })}
                    className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                      settings.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                      settings.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </div>
                  <span className="text-xs text-gray-700 dark:text-gray-300">Notificações ativas</span>
                </label>

                {settings.enabled && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer ml-1">
                      <div
                        onClick={() => onSettingsChange({ ...settings, popupMentions: !settings.popupMentions })}
                        className={`relative w-7 h-3.5 rounded-full transition-colors cursor-pointer ${
                          settings.popupMentions ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${
                          settings.popupMentions ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`} />
                      </div>
                      <AtSign size={11} className="text-purple-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Popup para menções</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer ml-1">
                      <div
                        onClick={() => onSettingsChange({ ...settings, popupComments: !settings.popupComments })}
                        className={`relative w-7 h-3.5 rounded-full transition-colors cursor-pointer ${
                          settings.popupComments ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${
                          settings.popupComments ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`} />
                      </div>
                      <MessageCircle size={11} className="text-blue-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Popup p/ comentários (cards seus)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer ml-1">
                      <div
                        onClick={() => onSettingsChange({ ...settings, popupAssignments: !settings.popupAssignments })}
                        className={`relative w-7 h-3.5 rounded-full transition-colors cursor-pointer ${
                          settings.popupAssignments ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${
                          settings.popupAssignments ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`} />
                      </div>
                      <UserCheck size={11} className="text-green-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Popup para atribuições</span>
                    </label>
                  </>
                )}
              </div>

              {/* ── Sons ── */}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-3 mb-2">
                Sons
              </p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => onSettingsChange({ ...settings, soundEnabled: !settings.soundEnabled })}
                    className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                      settings.soundEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                      settings.soundEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </div>
                  {settings.soundEnabled
                    ? <Volume2 size={13} className="text-blue-500" />
                    : <VolumeX size={13} className="text-gray-400" />}
                  <span className="text-xs text-gray-700 dark:text-gray-300">Sons ativos</span>
                </label>

                {settings.soundEnabled && (
                  <>
                    {/* Volume */}
                    <div className="flex items-center gap-2 ml-1">
                      <Volume2 size={10} className="text-gray-400 shrink-0" />
                      <input
                        type="range"
                        min="0" max="100"
                        value={Math.round((settings.soundVolume ?? 0.5) * 100)}
                        onChange={e => onSettingsChange({ ...settings, soundVolume: parseInt(e.target.value) / 100 })}
                        className="flex-1 h-1 accent-blue-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-gray-500 w-7 text-right">{Math.round((settings.soundVolume ?? 0.5) * 100)}%</span>
                    </div>

                    {/* Por tipo */}
                    {([
                      { key: 'soundMentions',    label: 'Menções',           sound: 'mention'          as const, color: 'bg-purple-500', icon: <AtSign size={11} className="text-purple-500" /> },
                      { key: 'soundComments',    label: 'Comentários',       sound: 'comment'          as const, color: 'bg-blue-500',   icon: <MessageCircle size={11} className="text-blue-500" /> },
                      { key: 'soundAssignments', label: 'Atribuições',       sound: 'assign'           as const, color: 'bg-green-500',  icon: <UserCheck size={11} className="text-green-500" /> },
                      { key: 'soundActivity',    label: 'Atividades (cards)', sound: 'activity_moved'   as const, color: 'bg-yellow-500', icon: <Bell size={11} className="text-yellow-500" /> },
                    ] as const).map(({ key, label, sound, color, icon }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer ml-1">
                        <div
                          onClick={() => onSettingsChange({ ...settings, [key]: !settings[key] })}
                          className={`relative w-7 h-3.5 rounded-full transition-colors cursor-pointer ${
                            settings[key] ? color : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${
                            settings[key] ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`} />
                        </div>
                        {icon}
                        <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{label}</span>
                        <button
                          onClick={() => playNotificationSound(sound, settings.soundVolume ?? 0.5)}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                          title="Testar som"
                        >
                          <Play size={9} />
                        </button>
                      </label>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Erro */}
          {lastError && (
            <div className="mx-3 mt-2 px-2.5 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5 shrink-0">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{lastError}</span>
            </div>
          )}

          {/* Lista de notificações */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                <Bell size={28} className="mb-2 opacity-40" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <>
                {/* Não lidas */}
                {unreadList.length > 0 && (
                  <>
                    <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Não lidas
                      </p>
                      {isSelecting && (
                        <button
                          onClick={selectAllUnread}
                          className="text-[10px] text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                        >
                          Selecionar todas
                        </button>
                      )}
                    </div>
                    {unreadList.map(notification => {
                      const card = notification.issueNumber != null
                        ? allCards.find(c => Number(c.number) === Number(notification.issueNumber))
                        : undefined;
                      const resolvedState = card?.issueState ?? issueStateCache[notification.id];
                      return (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          cardStatus={card?.status}
                          issueState={resolvedState}
                          isSelecting={isSelecting}
                          isSelected={selectedIds.has(notification.id)}
                          onClick={() => handleNotificationClick(notification)}
                          onMarkRead={() => onMarkAsRead(notification.threadId)}
                        />
                      );
                    })}
                  </>
                )}

                {/* Lidas */}
                {readList.length > 0 && (
                  <>
                    <div className="px-3 pt-2 pb-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Lidas
                      </p>
                    </div>
                    {readList.map(notification => {
                      const card = notification.issueNumber != null
                        ? allCards.find(c => Number(c.number) === Number(notification.issueNumber))
                        : undefined;
                      const resolvedState = card?.issueState ?? issueStateCache[notification.id];
                      return (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          cardStatus={card?.status}
                          issueState={resolvedState}
                          isSelecting={isSelecting}
                          isSelected={selectedIds.has(notification.id)}
                          onClick={() => handleNotificationClick(notification)}
                          onMarkRead={() => onMarkAsRead(notification.threadId)}
                        />
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>

          {/* Barra de ação de seleção múltipla */}
          {isSelecting && (
            <div className="shrink-0 border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-900/40">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selecionada${selectedIds.size > 1 ? 's' : ''}`
                  : 'Nenhuma selecionada'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={exitSelectionMode}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={markSelectedAsRead}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
                >
                  <Check size={11} />
                  Marcar como lidas
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Item individual da lista
function NotificationItem({
  notification,
  cardStatus,
  issueState,
  isSelecting,
  isSelected,
  onClick,
  onMarkRead,
}: {
  notification: GithubNotification;
  cardStatus?: string;
  issueState?: string;
  isSelecting: boolean;
  isSelected: boolean;
  onClick: () => void;
  onMarkRead: () => void;
}) {
  return (
    <div
      className={`group flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60 ${
        isSelected
          ? 'bg-blue-100/60 dark:bg-blue-900/25'
          : notification.unread
          ? 'bg-blue-50/50 dark:bg-blue-900/10'
          : ''
      }`}
      onClick={onClick}
    >
      {/* Checkbox em modo seleção / ponto azul normal */}
      <div className="shrink-0 mt-1" onClick={e => { if (isSelecting) { e.stopPropagation(); onClick(); } }}>
        {isSelecting ? (
          isSelected
            ? <CheckSquare size={14} className="text-blue-500" />
            : <Square size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400" />
        ) : (
          notification.unread
            ? <div className="w-2 h-2 rounded-full bg-blue-500 mt-0.5" />
            : <div className="w-2 h-2 mt-0.5" />
        )}
      </div>

      {/* Ícone do motivo */}
      <div className="shrink-0 mt-0.5">
        <ReasonIcon reason={notification.reason} size={13} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug truncate ${
          notification.unread
            ? 'font-medium text-gray-900 dark:text-gray-100'
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {notification.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
            {notification.repo}
          </span>
          {cardStatus && (
            <>
              <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
              <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0 max-w-22.5 truncate" title={cardStatus}>
                {cardStatus}
              </span>
            </>
          )}
          {issueState && (
            <>
              <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                issueState === 'OPEN'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : issueState === 'CLOSED'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : issueState === 'MERGED'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {issueState === 'OPEN' ? 'Aberto' : issueState === 'CLOSED' ? 'Fechado' : issueState === 'MERGED' ? 'Mesclado' : issueState}
              </span>
            </>
          )}
          <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
          <span className={`text-[10px] px-1 py-0.5 rounded ${getReasonColor(notification.reason)}`}>
            {getReasonLabel(notification.reason)}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto shrink-0">
            {timeAgo(notification.updatedAt)}
          </span>
        </div>
      </div>

      {/* Ações — escondidas em modo seleção */}
      {!isSelecting && (
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {notification.unread && (
            <button
              onClick={onMarkRead}
              className="p-0.5 rounded text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              title="Marcar como lida"
            >
              <Check size={11} />
            </button>
          )}
          {notification.subjectHtmlUrl && (
            <a
              href={notification.subjectHtmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-0.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Abrir no GitHub"
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function getReasonColor(reason: string): string {
  switch (reason) {
    case 'mention':
    case 'team_mention':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
    case 'comment':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
    case 'assign':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    case 'review_requested':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
}
