/**
 * Eventos ao vivo entre os git-calm abertos da organização (canal privado "eventos:<org>" no
 * Supabase): mensagem nova na conversa de um card, daily conduzida por alguém.
 * Só chega a quem está com o git-calm aberto agora; o que precisa ficar guardado (a conversa)
 * fica na tabela, e o evento só avisa na hora.
 */
import type { RealtimeChannel, RealtimeClient } from '@supabase/realtime-js';
import { acquireRealtime, getSupabaseGrant, releaseRealtime } from './supabase';
import type { ChatMessage } from './cardChat';
import type { DailyEvent } from './daily';

export type OrgEvent =
  | { tipo: 'chat'; msg: ChatMessage }
  | { tipo: 'chat-apagada'; cardKey: string; id: string }
  | DailyEvent;

const listeners = new Set<(e: OrgEvent) => void>();
let channel: RealtimeChannel | null = null;
let ready = false;

export function onOrgEvent(cb: (e: OrgEvent) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Envia para os outros git-calm abertos (não volta para quem enviou) */
export function sendOrgEvent(e: OrgEvent): boolean {
  if (!channel || !ready) return false;
  channel.send({ type: 'broadcast', event: 'evento', payload: e }).catch(() => { /* quem estiver fora vê ao abrir */ });
  return true;
}

export function orgEventsReady(): boolean {
  return ready;
}

/** Liga o canal de eventos da organização; devolve a função que desliga */
export function connectOrgEvents(githubToken: string, org: string, onReady?: (ok: boolean) => void): () => void {
  let closed = false;
  let client: RealtimeClient | null = null;
  let ch: RealtimeChannel | null = null;
  (async () => {
    const g = await getSupabaseGrant(githubToken, org).catch(() => 'desligado' as const);
    if (closed || g === 'desligado') { onReady?.(false); return; }
    client = acquireRealtime(githubToken, org, g);
    ch = client.channel(`eventos:${g.org}`, { config: { private: true, broadcast: { self: false } } });
    ch.on('broadcast', { event: 'evento' }, ({ payload }) => {
      for (const l of listeners) l(payload as OrgEvent);
    });
    ch.subscribe(status => {
      if (closed) return;
      if (status === 'SUBSCRIBED') { channel = ch; ready = true; onReady?.(true); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { ready = false; }
    });
  })();
  return () => {
    closed = true;
    if (channel === ch) { channel = null; ready = false; }
    if (ch && client) client.removeChannel(ch);
    if (client) releaseRealtime(client);
  };
}
