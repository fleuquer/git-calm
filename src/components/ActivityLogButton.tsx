import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  History, GitBranch, Plus, Edit, Trash2, Check, Trash, X,
  CircleX, CircleDot, GitMerge, Calendar, MessageSquare, Settings2,
  UserCheck, Tag, Type, ArrowRightLeft,
} from 'lucide-react';
import type { CardChange } from '../hooks/useRealtimeUpdates';
import type { ProjectCard } from '../types';

const STORAGE_KEY = 'activity_log';
const MAX_ITEMS = 100;

export interface ActivityLogItem {
  id: string;
  change: CardChange;
  timestamp: string; // ISO
  read: boolean;
}

export interface ActivityMonitorSettings {
  trackAdded: boolean;
  trackMoved: boolean;
  trackRemoved: boolean;
  trackAssignees: boolean;
  trackLabels: boolean;
  trackTitle: boolean;
  trackIssueState: boolean;
  trackDueDate: boolean;
  trackComments: boolean;
}

export const DEFAULT_ACTIVITY_SETTINGS: ActivityMonitorSettings = {
  trackAdded: true,
  trackMoved: true,
  trackRemoved: true,
  trackAssignees: true,
  trackLabels: false,
  trackTitle: false,
  trackIssueState: true,
  trackDueDate: true,
  trackComments: false,
};

interface Props {
  onOpenCard: (card: ProjectCard) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getChangeIcon(change: CardChange) {
  // Ícones específicos para sub-tipos de 'updated'
  if (change.type === 'updated') {
    const c = change.changes;
    if (c?.issueState) {
      const s = change.card.issueState;
      if (s === 'MERGED') return <GitMerge size={13} className="text-purple-500" />;
      if (s === 'CLOSED') return <CircleX size={13} className="text-red-500" />;
      return <CircleDot size={13} className="text-green-500" />;
    }
    if (c?.comments)  return <MessageSquare size={13} className="text-blue-500" />;
    if (c?.dueDate)   return <Calendar size={13} className="text-orange-500" />;
    if (c?.assignees) return <UserCheck size={13} className="text-teal-500" />;
    if (c?.labels)    return <Tag size={13} className="text-pink-500" />;
    if (c?.title)     return <Type size={13} className="text-yellow-500" />;
    return <Edit size={13} className="text-yellow-500" />;
  }
  switch (change.type) {
    case 'added':   return <Plus size={13} className="text-green-500" />;
    case 'moved':   return <ArrowRightLeft size={13} className="text-blue-500" />;
    case 'removed': return <Trash2 size={13} className="text-red-500" />;
    default:        return <Edit size={13} className="text-gray-400" />;
  }
}

function getChangeLabel(change: CardChange): { title: string; detail: string } {
  const cardTitle = change.card.title.length > 45
    ? change.card.title.slice(0, 45) + '…'
    : change.card.title;

  switch (change.type) {
    case 'added':
      return { title: 'Card adicionado', detail: `"${cardTitle}" → ${change.toColumn}` };
    case 'moved':
      return { title: 'Card movido', detail: `"${cardTitle}": ${change.fromColumn} → ${change.toColumn}` };
    case 'removed':
      return { title: 'Card removido', detail: `"${cardTitle}" (era: ${change.fromColumn})` };
    case 'updated': {
      const c = change.changes;

      if (c?.issueState) {
        const s = change.card.issueState;
        const stateLabel = s === 'MERGED' ? 'PR mergeado'
          : s === 'CLOSED' ? 'Issue/PR fechado'
          : 'Issue/PR reaberto';
        const from = change.fromIssueState
          ? ` (era: ${change.fromIssueState === 'OPEN' ? 'aberto' : change.fromIssueState === 'CLOSED' ? 'fechado' : change.fromIssueState})`
          : '';
        return { title: stateLabel, detail: `"${cardTitle}"${from}` };
      }

      if (c?.comments && change.commentCountDiff) {
        const n = change.commentCountDiff;
        return {
          title: `${n} novo${n > 1 ? 's' : ''} comentário${n > 1 ? 's' : ''}`,
          detail: `"${cardTitle}"`,
        };
      }

      if (c?.dueDate) {
        const d = change.card.dueDate;
        return {
          title: d ? 'Prazo definido/alterado' : 'Prazo removido',
          detail: d ? `"${cardTitle}" → ${new Date(d).toLocaleDateString('pt-BR')}` : `"${cardTitle}"`,
        };
      }

      const parts: string[] = [];
      if (c?.assignees) parts.push('responsáveis');
      if (c?.labels)    parts.push('labels');
      if (c?.title)     parts.push('título');
      if (c?.status)    parts.push('status');
      return {
        title: 'Card atualizado',
        detail: parts.length ? `"${cardTitle}" (${parts.join(', ')})` : `"${cardTitle}"`,
      };
    }
    default:
      return { title: 'Atualização', detail: change.card.title };
  }
}

// Hook interno para gerenciar o log persistido
export function useActivityLog() {
  const [items, setItems] = useState<ActivityLogItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback((next: ActivityLogItem[]) => {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
  }, []);

  const addChanges = useCallback((changes: CardChange[]) => {
    if (changes.length === 0) return;
    const now = new Date().toISOString();
    const newItems: ActivityLogItem[] = changes.map(change => ({
      id: `${change.type}-${change.card.number}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      change,
      timestamp: now,
      read: false,
    }));
    setItems(prev => {
      const next = [...newItems, ...prev].slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    persist(items.map(i => ({ ...i, read: true })));
  }, [items, persist]);

  const markRead = useCallback((id: string) => {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, read: true } : i);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  const unreadCount = items.filter(i => !i.read).length;

  return { items, unreadCount, addChanges, markAllRead, markRead, clearAll };
}

// Componente do botão com dropdown
interface ButtonProps extends Props {
  items: ActivityLogItem[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
  settings: ActivityMonitorSettings;
  onSettingsChange: (s: ActivityMonitorSettings) => void;
}

export const ActivityLogButton: React.FC<ButtonProps> = ({
  items,
  unreadCount,
  onOpenCard,
  onMarkAllRead,
  onMarkRead,
  onClearAll,
  settings,
  onSettingsChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleItemClick = (item: ActivityLogItem) => {
    onMarkRead(item.id);
    if (item.change.type !== 'removed') {
      onOpenCard(item.change.card);
    }
    setIsOpen(false);
  };

  const displayCount = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

  // Agrupar por data
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const grouped: { label: string; items: ActivityLogItem[] }[] = [];
  const buckets: Record<string, ActivityLogItem[]> = {};
  items.forEach(item => {
    const d = new Date(item.timestamp).toDateString();
    const label = d === today ? 'Hoje' : d === yesterday ? 'Ontem' : new Date(item.timestamp).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(item);
  });
  Object.entries(buckets).forEach(([label, its]) => grouped.push({ label, items: its }));

  return (
    <div ref={dropdownRef} className="relative">
      {/* Botão */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`relative flex items-center justify-center w-8 h-8 rounded-md transition-all ${
          isOpen
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title="Histórico de atividades do board"
      >
        <History size={15} className={unreadCount > 0 ? 'text-amber-500 dark:text-amber-400' : ''} />
        {displayCount && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-100 flex flex-col max-h-130">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-2">
              <History size={14} className="text-amber-500 dark:text-amber-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-white">Atividades do board</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full">
                  {unreadCount} novas
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(v => !v)}
                className={`p-1 rounded transition-colors ${
                  showSettings
                    ? 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400'
                }`}
                title="Configurar monitoramento"
              >
                <Settings2 size={13} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  title="Marcar todas como lidas"
                >
                  <Check size={13} />
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Limpar histórico"
                >
                  <Trash size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Painel de settings */}
          {showSettings && (
            <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 shrink-0">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">O que monitorar</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {([
                  ['trackAdded',     'Card adicionado'],
                  ['trackMoved',     'Card movido'],
                  ['trackRemoved',   'Card removido'],
                  ['trackAssignees', 'Responsáveis'],
                  ['trackLabels',    'Labels'],
                  ['trackTitle',     'Título'],
                  ['trackIssueState','Estado (aberto/fechado)'],
                  ['trackDueDate',   'Prazo'],
                  ['trackComments',  'Comentários novos'],
                ] as [keyof ActivityMonitorSettings, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={e => onSettingsChange({ ...settings, [key]: e.target.checked })}
                      className="w-3 h-3 rounded accent-amber-500"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                <History size={28} className="mb-2 opacity-40" />
                <p className="text-sm">Nenhuma atividade registrada</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-gray-600">As atualizações do board aparecerão aqui</p>
              </div>
            ) : (
              grouped.map(({ label, items: groupItems }) => (
                <div key={label}>
                  <div className="px-3 pt-2 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {label}
                    </p>
                  </div>
                  {groupItems.map(item => {
                    const { title, detail } = getChangeLabel(item.change);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`group flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60 ${
                          !item.read ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
                        }`}
                      >
                        {/* Ponto de não lida */}
                        <div className="shrink-0 mt-1.5">
                          {!item.read
                            ? <div className="w-2 h-2 rounded-full bg-amber-400" />
                            : <div className="w-2 h-2" />
                          }
                        </div>

                        {/* Ícone do tipo */}
                        <div className="shrink-0 mt-0.5">
                          {getChangeIcon(item.change)}
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug ${
                            !item.read
                              ? 'font-medium text-gray-900 dark:text-gray-100'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {title}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug truncate" title={detail}>
                            {detail}
                          </p>
                        </div>

                        {/* Tempo */}
                        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {timeAgo(item.timestamp)}
                        </span>

                        {/* Fechar item */}
                        <button
                          onClick={e => { e.stopPropagation(); onMarkRead(item.id); }}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                          title="Marcar como lida"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="shrink-0 px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500 text-center">
              {items.length} atividade{items.length !== 1 ? 's' : ''} registrada{items.length !== 1 ? 's' : ''} · últimas {MAX_ITEMS} mantidas
            </div>
          )}
        </div>
      )}
    </div>
  );
};
