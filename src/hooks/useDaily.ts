import { useCallback, useEffect, useRef, useState } from 'react';
import { onOrgEvent, sendOrgEvent } from '../services/orgEvents';
import { DAILY_HEARTBEAT_MS, DAILY_TIMEOUT_MS, type DailyState } from '../services/daily';
import type { PresenceMe } from '../services/presence';

interface Options {
  /** Canal de eventos ligado */
  enabled: boolean;
  me: PresenceMe | null;
  /** Onde estou agora (tela, aba, filtros, card) */
  current: DailyState;
  /** Leva o meu git-calm para onde está quem conduz */
  apply: (s: DailyState) => void;
}

export interface DailyInfo {
  /** Eu estou conduzindo */
  leading: boolean;
  /** Daily de outra pessoa acontecendo agora */
  other: { lider: PresenceMe; estado: DailyState } | null;
  following: boolean;
  start: () => void;
  stop: () => void;
  follow: () => void;
  unfollow: () => void;
}

/**
 * Modo daily (ver services/daily.ts): conduzir, ou seguir quem conduz. Ao parar de seguir, o
 * git-calm volta para onde estava antes.
 */
export function useDaily({ enabled, me, current, apply }: Options): DailyInfo {
  const [leading, setLeading] = useState(false);
  const [other, setOther] = useState<{ lider: PresenceMe; estado: DailyState; at: number } | null>(null);
  const [following, setFollowing] = useState(false);
  const before = useRef<DailyState | null>(null);

  // sempre a versão mais nova, para os eventos que chegam
  const applyRef = useRef(apply);
  const currentRef = useRef(current);
  const meRef = useRef(me);
  const followingRef = useRef(following);
  const leadingRef = useRef(leading);
  useEffect(() => {
    applyRef.current = apply;
    currentRef.current = current;
    meRef.current = me;
    followingRef.current = following;
    leadingRef.current = leading;
  });

  const sendState = useCallback(() => {
    if (meRef.current) sendOrgEvent({ tipo: 'daily', acao: 'estado', lider: meRef.current, estado: currentRef.current });
  }, []);

  const restore = useCallback(() => {
    if (before.current) applyRef.current(before.current);
    before.current = null;
  }, []);

  // eventos da daily
  useEffect(() => {
    if (!enabled) return;
    return onOrgEvent(e => {
      if (e.tipo !== 'daily' || !meRef.current || e.lider.login === meRef.current.login) return;
      if (e.acao === 'estado') {
        setOther({ lider: e.lider, estado: e.estado, at: Date.now() });
        if (followingRef.current) applyRef.current(e.estado);
      } else if (e.acao === 'fim') {
        setOther(prev => (prev?.lider.login === e.lider.login ? null : prev));
        if (followingRef.current) { setFollowing(false); restore(); }
      } else if (e.acao === 'pedir' && leadingRef.current) {
        sendState();
      }
    });
  }, [enabled, sendState, restore]);

  // quem conduz: anuncia cada mudança e, de tempos em tempos, para quem chega atrasado
  const stateJson = JSON.stringify(current);
  useEffect(() => {
    if (leading && enabled) sendState();
  }, [leading, enabled, stateJson, sendState]);
  useEffect(() => {
    if (!leading || !enabled) return;
    const t = setInterval(sendState, DAILY_HEARTBEAT_MS);
    const bye = () => { if (meRef.current) sendOrgEvent({ tipo: 'daily', acao: 'fim', lider: meRef.current }); };
    window.addEventListener('pagehide', bye);
    return () => { clearInterval(t); window.removeEventListener('pagehide', bye); };
  }, [leading, enabled, sendState]);

  // quem conduz sumiu (fechou o git-calm sem encerrar): a daily acabou
  useEffect(() => {
    if (!other) return;
    const t = setInterval(() => {
      if (Date.now() - other.at > DAILY_TIMEOUT_MS) {
        setOther(null);
        if (followingRef.current) { setFollowing(false); restore(); }
      }
    }, 5_000);
    return () => clearInterval(t);
  }, [other, restore]);

  const start = () => {
    if (following) { setFollowing(false); before.current = null; }
    setLeading(true);
  };
  const stop = () => {
    setLeading(false);
    if (me) sendOrgEvent({ tipo: 'daily', acao: 'fim', lider: me });
  };
  const follow = () => {
    if (!other || !me) return;
    before.current = currentRef.current;
    setFollowing(true);
    apply(other.estado);
    sendOrgEvent({ tipo: 'daily', acao: 'pedir', lider: me });
  };
  const unfollow = () => {
    setFollowing(false);
    restore();
  };

  return {
    leading,
    other: other ? { lider: other.lider, estado: other.estado } : null,
    following,
    start,
    stop,
    follow,
    unfollow,
  };
}
