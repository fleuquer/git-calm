import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  connectPresence,
  getPresenceVisible,
  onPresenceVisibleChange,
  type OnlinePerson,
  type PresenceConnection,
  type PresenceMe,
  type PresenceStatus,
} from '../services/presence';

/**
 * Simulação para ver a tela sem ninguém mais online: só em desenvolvimento (npm run dev),
 * abrindo o git-calm com ?simular-online no endereço. Nunca entra no site publicado.
 */
const SIMULAR = import.meta.env.DEV && new URLSearchParams(window.location.search).has('simular-online');
const SIMULADOS_DESDE = Date.now();
function simulated(): OnlinePerson[] {
  const p = (login: string, nome: string, extra: Partial<OnlinePerson>, minAtras: number): OnlinePerson => ({
    login, nome, avatar: `https://github.com/identicons/${login}.png`,
    ausente: false, tela: 'quadro', abas: 1, desde: SIMULADOS_DESDE - minAtras * 60_000, ...extra,
  });
  return [
    p('simulado-ana', 'Ana (simulada)', { card: 123 }, 42),
    p('simulado-bruno', 'Bruno (simulado)', { tela: 'dashboard' }, 8),
    p('simulado-carla', 'Carla (simulada)', { abas: 2 }, 95),
    p('simulado-diego', 'Diego (simulado)', { ausente: true }, 180),
  ];
}

/** Quem da organização está com o git-calm aberto (ver services/presence.ts) */
export function usePresence(githubToken: string, org: string, me: PresenceMe | null, tela: string, card?: number) {
  const visible = useSyncExternalStore(onPresenceVisibleChange, getPresenceVisible);
  const [people, setPeople] = useState<OnlinePerson[]>([]);
  const [status, setStatus] = useState<PresenceStatus>('desligado');
  const conn = useRef<PresenceConnection | null>(null);
  // a tela e o card mudam muito: vão por referência, sem reconectar
  const where = useRef({ tela, card });
  useEffect(() => {
    where.current = { tela, card };
    conn.current?.update({ tela, card });
  }, [tela, card]);

  const login = me?.login ?? '';
  const nome = me?.nome ?? '';
  const avatar = me?.avatar ?? '';
  const active = !!(githubToken && org && login && visible);

  useEffect(() => {
    if (!active) return;
    const c = connectPresence({
      githubToken,
      org,
      me: { login, nome, avatar },
      ...where.current,
      onPeople: setPeople,
      onStatus: s => setStatus(s),
    });
    conn.current = c;
    return () => {
      c.close();
      conn.current = null;
      setPeople([]);
      setStatus('desligado');
    };
  }, [active, githubToken, org, login, nome, avatar]);

  if (SIMULAR && active) {
    // só em desenvolvimento: pessoas de mentira junto com as de verdade, para ver a tela
    return { people: [...people, ...simulated()], status: 'online' as PresenceStatus, visible };
  }
  return { people: active ? people : [], status: active ? status : 'desligado' as PresenceStatus, visible };
}
