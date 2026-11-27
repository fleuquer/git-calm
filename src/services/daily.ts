/**
 * Modo daily: alguém conduz e os outros seguem. Quem conduz anuncia, pelo canal de eventos da
 * organização, onde está (tela, aba, filtros, card aberto); quem segue reproduz no próprio
 * git-calm. Nada fica guardado: a daily acaba quando quem conduz encerra ou fecha o git-calm.
 */
import type { PresenceMe } from './presence';

export interface DailyState {
  tela: 'board' | 'dashboard' | 'devtools';
  viewId: string;
  pessoa: string | null;
  etiqueta: string | null;
  agrupamento: string;
  /** Card aberto por quem conduz */
  card: { number: number; repo?: string; url: string } | null;
}

export type DailyEvent =
  | { tipo: 'daily'; acao: 'estado'; lider: PresenceMe; estado: DailyState }
  | { tipo: 'daily'; acao: 'fim'; lider: PresenceMe }
  /** Quem acabou de começar a seguir pede o estado atual */
  | { tipo: 'daily'; acao: 'pedir'; lider: PresenceMe };

/** Quem conduz reenvia o estado de tempos em tempos (para quem chega atrasado) */
export const DAILY_HEARTBEAT_MS = 15_000;
/** Sem notícia de quem conduz por esse tempo: a daily acabou */
export const DAILY_TIMEOUT_MS = 50_000;
