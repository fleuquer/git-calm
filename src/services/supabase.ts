/**
 * Acesso ao Supabase do git-calm: presença, conversa nos cards e daily.
 *
 * A função /api/presenca confere no GitHub que a pessoa é membro da organização e devolve um
 * token do Supabase com a organização e o login dela (vale 1 hora). Daqui saem:
 * - uma conexão de tempo real só, compartilhada pelos canais (presença e eventos);
 * - chamadas à tabela da conversa (REST do Supabase), com o mesmo token.
 * As regras de quem lê e escreve o quê ficam no Supabase (supabase/*.sql).
 */
import { RealtimeClient } from '@supabase/realtime-js';

export interface SupabaseGrant {
  status: 'ok';
  url: string;
  chave: string;
  token: string;
  /** Organização em minúsculas, como vai no token */
  org: string;
  login: string;
  expiraEm: number;
}

let cached: { key: string; grant: SupabaseGrant } | null = null;
let pending: { key: string; promise: Promise<SupabaseGrant | 'desligado'> } | null = null;

async function requestGrant(githubToken: string, org: string): Promise<SupabaseGrant | 'desligado'> {
  const r = await fetch(`/api/presenca?org=${encodeURIComponent(org)}`, {
    headers: { authorization: `Bearer ${githubToken}` },
  });
  // em dev sem a função, ou em outro servidor: os recursos só não aparecem
  if (r.status === 404) return 'desligado';
  const d = await r.json().catch(() => null) as (SupabaseGrant | { status: string; erro?: string }) | null;
  if (!r.ok) throw new Error((d as { erro?: string } | null)?.erro ?? `HTTP ${r.status}`);
  if (d?.status !== 'ok') return 'desligado';
  const g = d as SupabaseGrant;
  // servidor antigo, sem "org" na resposta: vem do nome do canal
  return { ...g, org: g.org ?? (g as unknown as { canal?: string }).canal?.replace(/^presenca:/, '') ?? org.toLowerCase() };
}

/** Token do Supabase para esta organização; pede outro quando falta pouco para vencer */
export async function getSupabaseGrant(githubToken: string, org: string): Promise<SupabaseGrant | 'desligado'> {
  const key = `${githubToken.slice(-8)}|${org.toLowerCase()}`;
  if (cached?.key === key && cached.grant.expiraEm - Date.now() > 5 * 60_000) return cached.grant;
  if (pending?.key === key) return pending.promise;
  const promise = requestGrant(githubToken, org)
    .then(g => { if (g !== 'desligado') cached = { key, grant: g }; return g; })
    .finally(() => { if (pending?.promise === promise) pending = null; });
  pending = { key, promise };
  return promise;
}

// ── Tempo real: uma conexão para todos os canais ────────────────────────────────────────────
let realtime: { key: string; client: RealtimeClient; users: number } | null = null;

/** Conexão de tempo real da organização; devolva com releaseRealtime quando não usar mais */
export function acquireRealtime(githubToken: string, org: string, grant: SupabaseGrant): RealtimeClient {
  const key = `${grant.url}|${grant.org}`;
  if (realtime?.key === key) {
    realtime.users++;
    return realtime.client;
  }
  realtime?.client.disconnect();
  const client = new RealtimeClient(`${grant.url.replace(/^http/, 'ws')}/realtime/v1`, {
    params: { apikey: grant.chave },
    accessToken: async () => {
      const g = await getSupabaseGrant(githubToken, org).catch(() => null);
      return g && g !== 'desligado' ? g.token : null;
    },
  });
  realtime = { key, client, users: 1 };
  return client;
}

export function releaseRealtime(client: RealtimeClient): void {
  if (realtime?.client !== client) return;
  realtime.users--;
  if (realtime.users <= 0) {
    client.disconnect();
    realtime = null;
  }
}

// ── REST (tabela da conversa) ───────────────────────────────────────────────────────────────
export async function supabaseRest<T>(
  githubToken: string,
  org: string,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const g = await getSupabaseGrant(githubToken, org);
  if (g === 'desligado') throw new Error('Supabase não configurado');
  const r = await fetch(`${g.url}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: g.chave,
      authorization: `Bearer ${g.token}`,
      'content-type': 'application/json',
      ...(init.prefer ? { prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => null) as { message?: string; code?: string } | null;
    const err = new Error(d?.message ?? `HTTP ${r.status}`) as Error & { code?: string; status?: number };
    err.code = d?.code;
    err.status = r.status;
    throw err;
  }
  return (r.status === 204 ? undefined : await r.json()) as T;
}
