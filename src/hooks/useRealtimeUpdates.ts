import { useEffect, useRef, useCallback } from 'react';
import type { ProjectColumn, ProjectCard } from '../types';

export interface CardChange {
  type: 'added' | 'moved' | 'updated' | 'removed';
  card: ProjectCard;
  fromColumn?: string;
  toColumn?: string;
  fromIssueState?: string;
  commentCountDiff?: number;
  changes?: {
    status?: boolean;
    assignees?: boolean;
    labels?: boolean;
    comments?: boolean;
    title?: boolean;
    updatedAt?: boolean;
    issueState?: boolean;
    dueDate?: boolean;
  };
}

interface UseRealtimeUpdatesOptions {
  enabled: boolean;
  token: string;
  org: string;
  projectNumber: number;
  currentColumns: ProjectColumn[];
  onUpdate: (newColumns: ProjectColumn[]) => void;
  onChangesDetected: (changes: CardChange[]) => void;
  onRateLimitHit?: () => void;
  intervalMs?: number;
}

/**
 * Hook para detectar e aplicar atualizações em tempo real dos cards do GitHub
 */
export function useRealtimeUpdates({
  enabled,
  token,
  org,
  projectNumber,
  currentColumns,
  onUpdate,
  onChangesDetected,
  onRateLimitHit,
  intervalMs = 30000, // 30 segundos por padrão
}: UseRealtimeUpdatesOptions) {
  const previousColumnsRef = useRef<ProjectColumn[]>([]);
  const intervalRef = useRef<number | null>(null);
  const isCheckingRef = useRef(false);

  // Refs estáveis para callbacks — evita que o interval seja recriado a cada render
  const onChangesDetectedRef = useRef(onChangesDetected);
  const onUpdateRef = useRef(onUpdate);
  const onRateLimitHitRef = useRef(onRateLimitHit);
  useEffect(() => { onChangesDetectedRef.current = onChangesDetected; });
  useEffect(() => { onUpdateRef.current = onUpdate; });
  useEffect(() => { onRateLimitHitRef.current = onRateLimitHit; });

  /**
   * Cria um mapa de cards por ID para comparação rápida
   */
  const createCardMap = useCallback((columns: ProjectColumn[]) => {
    const map = new Map<number, { card: ProjectCard; column: string }>();
    columns.forEach(column => {
      column.cards.forEach(card => {
        map.set(card.number, { card, column: column.name });
      });
    });
    return map;
  }, []);

  /**
   * Detecta mudanças entre dois estados de colunas
   */
  const detectChanges = useCallback((
    oldColumns: ProjectColumn[],
    newColumns: ProjectColumn[]
  ): CardChange[] => {
    const changes: CardChange[] = [];
    const oldMap = createCardMap(oldColumns);
    const newMap = createCardMap(newColumns);

    // Detectar cards novos e movidos
    newMap.forEach(({ card: newCard, column: newColumn }, cardId) => {
      const oldEntry = oldMap.get(cardId);

      if (!oldEntry) {
        // Card novo
        changes.push({
          type: 'added',
          card: newCard,
          toColumn: newColumn,
        });
      } else {
        const { card: oldCard, column: oldColumn } = oldEntry;

        // Card movido de coluna
        if (oldColumn !== newColumn) {
          changes.push({
            type: 'moved',
            card: newCard,
            fromColumn: oldColumn,
            toColumn: newColumn,
          });
        } else {
          // Verificar se houve atualizações no card
          const cardChanges = {
            status: oldCard.status !== newCard.status,
            assignees: JSON.stringify(oldCard.assignees) !== JSON.stringify(newCard.assignees),
            labels: JSON.stringify(oldCard.labels) !== JSON.stringify(newCard.labels),
            title: oldCard.title !== newCard.title,
            issueState: oldCard.issueState !== newCard.issueState,
            dueDate: (oldCard.dueDate ?? null) !== (newCard.dueDate ?? null),
            comments: (oldCard.totalComments ?? 0) !== (newCard.totalComments ?? 0)
              && (newCard.totalComments ?? 0) > (oldCard.totalComments ?? 0),
            updatedAt: oldCard.updatedAt !== newCard.updatedAt,
          };

          const commentCountDiff = (newCard.totalComments ?? 0) - (oldCard.totalComments ?? 0);
          const fromIssueState = oldCard.issueState;

          // Ignorar se a única mudança for updatedAt (muito ruidoso)
          const meaningfulChanges = { ...cardChanges, updatedAt: false };

          // Se houve alguma mudança significativa, registrar como atualizado
          if (Object.values(meaningfulChanges).some(changed => changed)) {
            changes.push({
              type: 'updated',
              card: newCard,
              toColumn: newColumn,
              fromIssueState,
              commentCountDiff: commentCountDiff > 0 ? commentCountDiff : undefined,
              changes: cardChanges,
            });
          }
        }
      }
    });

    // Detectar cards removidos
    oldMap.forEach(({ card: oldCard, column: oldColumn }, cardId) => {
      if (!newMap.has(cardId)) {
        changes.push({
          type: 'removed',
          card: oldCard,
          fromColumn: oldColumn,
        });
      }
    });

    return changes;
  }, [createCardMap]);

  /**
   * Busca dados atualizados do GitHub
   */
  const checkForUpdates = useCallback(async () => {
    if (isCheckingRef.current || !enabled || !token || !org || !projectNumber) {
      return;
    }

    isCheckingRef.current = true;

    try {
      console.log('🔄 Buscando atualizações do GitHub...');

      const { GitHubService } = await import('../services/github');
      const service = new GitHubService(token);
      const data = await service.getProjectItems(org, projectNumber);

      // Detectar mudanças
      const changes = detectChanges(previousColumnsRef.current, data.columns);

      if (changes.length > 0) {
        console.log('🔄 Atualizações detectadas:', changes);
        onChangesDetectedRef.current(changes);
        onUpdateRef.current(data.columns);
      }

      // Atualizar referência para próxima comparação
      previousColumnsRef.current = data.columns;

    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);

      if (error instanceof Error && error.message.includes('rate limit')) {
        console.warn('⚠️ Rate limit atingido. Polling pausado por 5 minutos.');
        if (onRateLimitHitRef.current) onRateLimitHitRef.current();

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimeout(() => {
          if (enabled && token && org && projectNumber) {
            console.log('🔄 Retomando polling após pausa de rate limit...');
            intervalRef.current = setInterval(() => checkForUpdatesRef.current(), intervalMs);
          }
        }, 300000);
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, [enabled, token, org, projectNumber, detectChanges, intervalMs]);

  // Ref estável para checkForUpdates — evita recriação do interval
  const checkForUpdatesRef = useRef(checkForUpdates);
  useEffect(() => { checkForUpdatesRef.current = checkForUpdates; }, [checkForUpdates]);

  /**
   * Inicializar referência quando colunas mudarem externamente
   */
  useEffect(() => {
    if (currentColumns.length > 0 && previousColumnsRef.current.length === 0) {
      previousColumnsRef.current = currentColumns;
    }
  }, [currentColumns]);

  /**
   * Configurar polling — depende apenas de parâmetros estáveis, não de callbacks
   */
  useEffect(() => {
    if (!enabled || !token || !org || !projectNumber) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    console.log(`⏱️ Polling iniciado (intervalo: ${intervalMs / 1000}s)`);
    intervalRef.current = setInterval(() => checkForUpdatesRef.current(), intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('⏱️ Polling interrompido');
      }
    };
  }, [enabled, token, org, projectNumber, intervalMs]); // sem checkForUpdates nas deps!

  return {
    checkNow: () => checkForUpdatesRef.current(),
    isChecking: isCheckingRef.current,
  };
}
