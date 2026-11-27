import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  connectPresence,
  getPresenceEditing,
  getPresenceVisible,
  onPresenceEditingChange,
  onPresenceVisibleChange,
  presenceCardKey,
  type OnlinePerson,
  type PresenceConnection,
  type PresenceMe,
  type PresenceStatus,
  type PresenceWhere,
} from '../services/presence';

/**
 * Simulação para ver a tela sem ninguém mais online: só em desenvolvimento (npm run dev),
 * abrindo o git-calm com ?simular-online no endereço. Nunca entra no site publicado.
 * Com ?simular-online=<repositório>#<número> (ex.: ?simular-online=arr-web%23123), as pessoas
 * simuladas ficam vendo e editando esse card.
 */
const SIMULAR_PARAM = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('simular-online') : null;
const SIMULAR = SIMULAR_PARAM !== null;
const SIMULADOS_DESDE = Date.now();
function simulated(): OnlinePerson[] {
  const [repo, num] = (SIMULAR_PARAM ?? '').split('#');
  const card = Number(num) || 123;
  const cardKey = presenceCardKey(repo || 'repo-simulado', card);
  const p = (login: string, nome: string, extra: Partial<OnlinePerson>, minAtras: number): OnlinePerson => ({
    login, nome, avatar: `https://github.com/identicons/${login}.png`,
    ausente: false, tela: 'quadro', abas: 1, desde: SIMULADOS_DESDE - minAtras * 60_000, ...extra,
  });
  return [
    p('simulado-ana', 'Ana (simulada)', { card, cardKey }, 42),
    p('simulado-bruno', 'Bruno (simulado)', { card, cardKey, editando: 'escrevendo um comentário' }, 8),
    p('simulado-carla', 'Carla (simulada)', { abas: 2, tela: 'dashboard' }, 95),
    p('simulado-diego', 'Diego (simulado)', { ausente: true }, 180),
  ];
}

/** Quem da organização está com o git-calm aberto (ver services/presence.ts) */
export function usePresence(
  githubToken: string,
  org: string,
  me: PresenceMe | null,
  tela: string,
  card?: { number: number; repo?: string },
  daily?: { seguindo?: string; conduzindo?: boolean },
) {
  const visible = useSyncExternalStore(onPresenceVisibleChange, getPresenceVisible);
  const editando = useSyncExternalStore(onPresenceEditingChange, getPresenceEditing);
  const [people, setPeople] = useState<OnlinePerson[]>([]);
  const [status, setStatus] = useState<PresenceStatus>('desligado');
  const conn = useRef<PresenceConnection | null>(null);

  const cardNumber = card?.number;
  const cardKey = card ? presenceCardKey(card.repo, card.number) : undefined;
  // a tela e o card mudam muito: vão por referência, sem reconectar
  const seguindo = daily?.seguindo;
  const conduzindo = daily?.conduzindo;
  const where = useRef<PresenceWhere>({ tela });
  useEffect(() => {
    where.current = { tela, card: cardNumber, cardKey, editando: cardKey ? editando : undefined, seguindo, conduzindo };
    conn.current?.update(where.current);
  }, [tela, cardNumber, cardKey, editando, seguindo, conduzindo]);

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
      where: where.current,
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
