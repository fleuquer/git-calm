import React, { useEffect, useState } from 'react';
import { X, GitBranch, Plus, Edit, Trash2 } from 'lucide-react';
import type { CardChange } from '../hooks/useRealtimeUpdates';
import { playNotificationSound } from '../utils/notificationSounds';

interface ActivityNotification {
  id: string;
  change: CardChange;
  timestamp: Date;
}

interface Props {
  changes: CardChange[];
  onDismiss?: (id: string) => void;
  autoHideMs?: number;
  soundEnabled?: boolean;
  soundVolume?: number;
  soundActivity?: boolean;
}

export const ActivityNotifications: React.FC<Props> = ({
  changes,
  onDismiss,
  autoHideMs = 5000,
  soundEnabled = false,
  soundVolume = 0.5,
  soundActivity = true,
}) => {
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);

  // Adicionar novas notificações quando mudanças chegarem
  useEffect(() => {
    if (changes.length > 0) {
      const newNotifications = changes.map(change => ({
        id: `${change.type}-${change.card.number}-${Date.now()}`,
        change,
        timestamp: new Date(),
      }));

      setNotifications(prev => [...newNotifications, ...prev].slice(0, 5)); // Manter apenas 5

      // Tocar som para a mudança mais recente
      if (soundEnabled && soundActivity) {
        const firstType = changes[0]?.type;
        switch (firstType) {
          case 'added':   playNotificationSound('activity_added',   soundVolume); break;
          case 'moved':   playNotificationSound('activity_moved',   soundVolume); break;
          case 'updated': playNotificationSound('activity_updated', soundVolume); break;
          case 'removed': playNotificationSound('activity_removed', soundVolume); break;
        }
      }
    }
  }, [changes, soundEnabled, soundVolume, soundActivity]);

  // Auto-hide após timeout
  useEffect(() => {
    if (autoHideMs <= 0) return;

    const timers = notifications.map(notification =>
      setTimeout(() => {
        handleDismiss(notification.id);
      }, autoHideMs)
    );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, autoHideMs]);

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    onDismiss?.(id);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus size={16} className="text-green-600 dark:text-green-400" />;
      case 'moved':
        return <GitBranch size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'updated':
        return <Edit size={16} className="text-yellow-600 dark:text-yellow-400" />;
      case 'removed':
        return <Trash2 size={16} className="text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  const getNotificationMessage = (change: CardChange) => {
    const cardTitle = change.card.title.length > 40
      ? `${change.card.title.substring(0, 40)}...`
      : change.card.title;

    switch (change.type) {
      case 'added':
        return (
          <>
            <span className="font-medium">Card adicionado</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {cardTitle} → {change.toColumn}
            </span>
          </>
        );
      case 'moved':
        return (
          <>
            <span className="font-medium">Card movido</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {cardTitle}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {change.fromColumn} → {change.toColumn}
            </span>
          </>
        );
      case 'updated':
        const changeTypes: string[] = [];
        if (change.changes?.assignees) changeTypes.push('responsáveis');
        if (change.changes?.labels) changeTypes.push('labels');
        if (change.changes?.status) changeTypes.push('status');
        if (change.changes?.title) changeTypes.push('título');

        return (
          <>
            <span className="font-medium">Card atualizado</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {cardTitle}
            </span>
            {changeTypes.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-500">
                Mudanças: {changeTypes.join(', ')}
              </span>
            )}
          </>
        );
      case 'removed':
        return (
          <>
            <span className="font-medium">Card removido</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {cardTitle}
            </span>
          </>
        );
      default:
        return null;
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 pr-10 animate-slide-in-right relative"
        >
          <button
            onClick={() => handleDismiss(notification.id)}
            className="absolute top-2 right-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label="Fechar notificação"
          >
            <X size={14} className="text-gray-500 dark:text-gray-400" />
          </button>

          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {getNotificationIcon(notification.change.type)}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              {getNotificationMessage(notification.change)}
            </div>
          </div>

          {/* Barra de progresso do auto-hide */}
          {autoHideMs > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-b-lg overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 animate-shrink-width"
                style={{ animationDuration: `${autoHideMs}ms` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
