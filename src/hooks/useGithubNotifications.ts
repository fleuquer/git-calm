import { useEffect, useRef, useCallback, useState } from 'react';
import type { ProjectColumn } from '../types';
import { playNotificationSound } from '../utils/notificationSounds';
import { sendSystemNotification } from '../utils/systemNotifications';

export interface GithubNotification {
  id: string;
  unread: boolean;
  reason: string; // 'mention' | 'comment' | 'assign' | 'review_requested' | 'subscribed' | ...
  title: string;
  subjectUrl: string;
  subjectHtmlUrl: string;
  type: string; // 'Issue' | 'PullRequest' | 'Commit' | 'Release' | ...
  repo: string;
  repoFullName: string;
  updatedAt: string;
  issueNumber?: number;
  threadId: string;
  latestCommentUrl?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  popupMentions: boolean;
  popupComments: boolean;
  popupAssignments: boolean;
  intervalMs: number;
  // Sons
  soundEnabled: boolean;
  soundVolume: number;       // 0–1
  soundMentions: boolean;
  soundComments: boolean;
  soundAssignments: boolean;
  systemNotificationsEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  popupMentions: true,
  popupComments: true,
  popupAssignments: false,
  intervalMs: 60000, // 1 minuto
  // Sons (desligado por padrão)
  soundEnabled: false,
  soundVolume: 0.5,
  soundMentions: true,
  soundComments: true,
  soundAssignments: true,
  systemNotificationsEnabled: false,
};

function parseIssueNumber(url: string): number | undefined {
  const match = url.match(/\/(?:issues|pulls)\/(\d+)$/);
  return match ? parseInt(match[1], 10) : undefined;
}

function buildHtmlUrl(apiUrl: string): string {
  return apiUrl
    .replace('https://api.github.com/repos/', 'https://github.com/')
    .replace('/pulls/', '/pull/');
}

interface UseGithubNotificationsOptions {
  token: string;
  enabled: boolean;
  settings: NotificationSettings;
  currentUserLogin?: string;
  columns: ProjectColumn[];
  onNewAlertable: (notifications: GithubNotification[]) => void;
}

export function useGithubNotifications({
  token,
  enabled,
  settings,
  currentUserLogin,
  columns,
  onNewAlertable,
}: UseGithubNotificationsOptions) {
  const [notifications, setNotifications] = useState<GithubNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // IDs que já foram vistos para detectar novas notificações
  const seenIdsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  // Flag para ignorar alertas na primeira carga (evita spam ao abrir o app)
  const isFirstFetchRef = useRef(true);

  const getAssignedIssueNumbers = useCallback(() => {
    if (!currentUserLogin) return new Set<number>();
    const numbers = new Set<number>();
    columns.forEach(col => {
      col.cards.forEach(card => {
        if (card.assignees.some(a => a.login === currentUserLogin)) {
          numbers.add(card.number);
        }
      });
    });
    return numbers;
  }, [currentUserLogin, columns]);

  const fetchNotifications = useCallback(async () => {
    if (isFetchingRef.current || !token || !enabled || !settings.enabled) return;
    isFetchingRef.current = true;
    setIsFetching(true);

    try {
      const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const baseUrl = isDev ? '/github-proxy' : 'https://api.github.com';

      const resp = await fetch(`${baseUrl}/notifications?all=false&per_page=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        setLastError('Token sem permissão para notificações. Certifique-se de que o token tem o escopo "notifications".');
        return;
      }

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data: any[] = await resp.json();
      setLastError(null);

      const parsed: GithubNotification[] = data.map((n: any) => ({
        id: String(n.id),
        threadId: String(n.id),
        unread: n.unread,
        reason: n.reason,
        title: n.subject.title,
        subjectUrl: n.subject.url || '',
        subjectHtmlUrl: n.subject.url ? buildHtmlUrl(n.subject.url) : '',
        type: n.subject.type || 'Issue',
        repo: n.repository.name,
        repoFullName: n.repository.full_name,
        updatedAt: n.updated_at,
        issueNumber: n.subject.url ? parseIssueNumber(n.subject.url) : undefined,
        latestCommentUrl: n.subject.latest_comment_url || undefined,
      }));

      const unread = parsed.filter(n => n.unread);
      setUnreadCount(unread.length);
      setNotifications(parsed);

      // Na primeira carga, apenas registrar os IDs sem disparar alertas
      if (isFirstFetchRef.current) {
        unread.forEach(n => seenIdsRef.current.add(n.id));
        isFirstFetchRef.current = false;
        return;
      }

      // Detectar notificações novas (não vistas antes)
      const assignedNumbers = getAssignedIssueNumbers();
      const newAlertable = unread.filter(n => {
        if (seenIdsRef.current.has(n.id)) return false;

        const isMention = n.reason === 'mention' || n.reason === 'team_mention';
        const isComment = n.reason === 'comment';
        const isAssign = n.reason === 'assign';

        if (isMention && settings.popupMentions) return true;
        if (isComment && settings.popupComments) {
          // Alertar apenas para comentários em cards que o usuário está atribuído
          if (n.issueNumber && assignedNumbers.has(n.issueNumber)) return true;
        }
        if (isAssign && settings.popupAssignments) return true;

        return false;
      });

      // Marcar todas as não-lidas como vistas
      unread.forEach(n => seenIdsRef.current.add(n.id));

      if (newAlertable.length > 0) {
        onNewAlertable(newAlertable);

        // Notificação do sistema operacional
        if (settings.systemNotificationsEnabled) {
          const first = newAlertable[0];
          const reasonLabel =
            first.reason === 'mention' || first.reason === 'team_mention' ? 'Menção' :
            first.reason === 'comment' ? 'Comentário' :
            first.reason === 'assign' ? 'Atribuição' : 'Notificação';
          const body = newAlertable.length === 1
            ? `${reasonLabel} em ${first.repo}`
            : `${newAlertable.length} novas notificações no GitHub`;
          sendSystemNotification('Git Calm', body);
        }

        // Tocar som de notificação (prioridade: menção > comentário > atribuição)
        if (settings.soundEnabled) {
          const hasMention = newAlertable.some(n => n.reason === 'mention' || n.reason === 'team_mention');
          const hasComment = newAlertable.some(n => n.reason === 'comment');
          const hasAssign  = newAlertable.some(n => n.reason === 'assign');
          if (hasMention && settings.soundMentions) {
            playNotificationSound('mention', settings.soundVolume);
          } else if (hasComment && settings.soundComments) {
            playNotificationSound('comment', settings.soundVolume);
          } else if (hasAssign && settings.soundAssignments) {
            playNotificationSound('assign', settings.soundVolume);
          }
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar notificações GitHub:', err);
      setLastError(err.message || 'Erro ao buscar notificações');
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  }, [token, enabled, settings, getAssignedIssueNumbers, onNewAlertable]);

  const markAsRead = useCallback(async (threadId: string) => {
    if (!token) return;
    try {
      const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const baseUrl = isDev ? '/github-proxy' : 'https://api.github.com';
      await fetch(`${baseUrl}/notifications/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      setNotifications(prev => prev.map(n => n.id === threadId ? { ...n, unread: false } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err);
    }
  }, [token]);

  const markAllAsRead = useCallback(async () => {
    if (!token) return;
    try {
      const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const baseUrl = isDev ? '/github-proxy' : 'https://api.github.com';
      await fetch(`${baseUrl}/notifications`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ last_read_at: new Date().toISOString() }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
    }
  }, [token]);

  // Iniciar/parar polling
  useEffect(() => {
    if (!enabled || !token || !settings.enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    fetchNotifications();
    intervalRef.current = window.setInterval(fetchNotifications, settings.intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, token, settings.enabled, settings.intervalMs, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isFetching,
    lastError,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
