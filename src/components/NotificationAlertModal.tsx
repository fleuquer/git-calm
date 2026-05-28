import React, { useEffect, useRef } from 'react';
import { X, AtSign, MessageCircle, UserCheck, Bell, ExternalLink } from 'lucide-react';
import type { GithubNotification } from '../hooks/useGithubNotifications';

export interface AlertItem {
  id: string;
  notification: GithubNotification;
  dismissAt: number;
}

interface Props {
  alerts: AlertItem[];
  onDismiss: (id: string) => void;
  onOpen: (notification: GithubNotification) => void;
}

const AUTO_DISMISS_MS = 15000;
const PROGRESS_INTERVAL = 50; // ms

function getAlertIcon(reason: string) {
  switch (reason) {
    case 'mention':
    case 'team_mention':
      return <AtSign size={18} className="text-purple-500" />;
    case 'comment':
      return <MessageCircle size={18} className="text-blue-500" />;
    case 'assign':
      return <UserCheck size={18} className="text-green-500" />;
    default:
      return <Bell size={18} className="text-gray-400" />;
  }
}

function getAlertTitle(reason: string): string {
  switch (reason) {
    case 'mention': return 'Você foi mencionado';
    case 'team_mention': return 'Seu time foi mencionado';
    case 'comment': return 'Novo comentário';
    case 'assign': return 'Você foi atribuído';
    case 'review_requested': return 'Revisão solicitada';
    default: return 'Nova notificação';
  }
}

function getAlertColorClass(reason: string): string {
  switch (reason) {
    case 'mention':
    case 'team_mention':
      return 'border-l-purple-500';
    case 'comment':
      return 'border-l-blue-500';
    case 'assign':
      return 'border-l-green-500';
    default:
      return 'border-l-gray-400';
  }
}

function getProgressColor(reason: string): string {
  switch (reason) {
    case 'mention':
    case 'team_mention':
      return 'bg-purple-500';
    case 'comment':
      return 'bg-blue-500';
    case 'assign':
      return 'bg-green-500';
    default:
      return 'bg-gray-400';
  }
}

// Componente de um único alerta com barra de progresso
const AlertCard: React.FC<{
  alert: AlertItem;
  onDismiss: () => void;
  onOpen: () => void;
}> = ({ alert, onDismiss, onOpen }) => {
  const [progress, setProgress] = React.useState(100);
  const startTimeRef = useRef(Date.now());
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        animFrameRef.current = window.setTimeout(tick, PROGRESS_INTERVAL);
      }
    };
    animFrameRef.current = window.setTimeout(tick, PROGRESS_INTERVAL);
    return () => {
      if (animFrameRef.current) clearTimeout(animFrameRef.current);
    };
  }, []);

  const { notification } = alert;

  return (
    <div
      className={`relative w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 border-l-4 ${getAlertColorClass(notification.reason)} overflow-hidden animate-slide-in-right`}
    >
      {/* Barra de progresso */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-gray-100 dark:bg-gray-700 w-full">
        <div
          className={`h-full transition-none ${getProgressColor(notification.reason)}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-3 pr-8">
        {/* Cabeçalho */}
        <div className="flex items-center gap-2 mb-1.5">
          {getAlertIcon(notification.reason)}
          <span className="text-xs font-semibold text-gray-800 dark:text-white">
            {getAlertTitle(notification.reason)}
          </span>
        </div>

        {/* Título do card/issue */}
        <p className="text-xs text-gray-700 dark:text-gray-200 leading-snug line-clamp-2 mb-1">
          {notification.title}
        </p>

        {/* Repo */}
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2.5">
          {notification.repoFullName}
        </p>

        {/* Ações */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { onOpen(); onDismiss(); }}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
          >
            Ver
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded transition-colors"
          >
            Dispensar
          </button>
          {notification.subjectHtmlUrl && (
            <a
              href={notification.subjectHtmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Abrir no GitHub"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Botão fechar */}
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
};

export const NotificationAlertModal: React.FC<Props> = ({
  alerts,
  onDismiss,
  onOpen,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-200">
      {alerts.slice(0, 3).map(alert => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onDismiss={() => onDismiss(alert.id)}
          onOpen={() => {
            onOpen(alert.notification);
            onDismiss(alert.id);
          }}
        />
      ))}
    </div>
  );
};
