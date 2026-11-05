import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GitHubService, type MentionedIssue } from '../services/github';
import { usePageVisible } from './usePageVisible';
import {
  computePendingMentions,
  loadResolvedMentions,
  saveResolvedMentions,
  type PendingMention,
} from '../utils/pendingMentions';

const REFRESH_MS = 5 * 60 * 1000;

/**
 * Menções pendentes de resposta do usuário logado (issue #7). Atualiza a cada 5 minutos
 * enquanto a aba está visível; ao voltar para a aba, atualiza na hora se já passou do intervalo.
 */
export function usePendingMentions(token: string, org: string, login: string | undefined) {
  const [issues, setIssues] = useState<MentionedIssue[]>([]);
  const [resolved, setResolved] = useState<Record<string, string>>(loadResolvedMentions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const lastFetchRef = useRef(0);
  const visible = usePageVisible();

  const refresh = useCallback(async () => {
    if (!token || !org || !login || inFlight.current) return;
    inFlight.current = true;
    lastFetchRef.current = Date.now();
    setLoading(true);
    try {
      const data = await new GitHubService(token).getMentionedIssues(org, login);
      setIssues(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Erro ao buscar menções:', err);
      setError('Não foi possível buscar as menções agora.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [token, org, login]);

  useEffect(() => {
    if (!login || !visible) return;
    const stale = Date.now() - lastFetchRef.current >= REFRESH_MS;
    const first = stale ? setTimeout(refresh, 0) : undefined;
    const interval = setInterval(refresh, REFRESH_MS);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [login, visible, refresh]);

  const pending: PendingMention[] = useMemo(
    () => (login ? computePendingMentions(issues, login, resolved) : []),
    [issues, login, resolved],
  );

  /** Marca o card como respondido agora (novas menções depois disso voltam a ficar pendentes) */
  const markAnswered = useCallback((key: string) => {
    setResolved(prev => {
      const next = { ...prev, [key]: new Date().toISOString() };
      saveResolvedMentions(next);
      return next;
    });
  }, []);

  return { pending, loading, error, lastUpdated, refresh, markAnswered };
}
