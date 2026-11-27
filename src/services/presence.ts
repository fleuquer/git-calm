/**
 * Presença: quem da organização está com o git-calm aberto agora.
 *
 * Cada git-calm aberto entra no canal privado da organização no Supabase Realtime
 * ("presenca:<org>") e anuncia quem é e em que tela está. A entrada é liberada pela função
 * /api/presenca, que confere no GitHub que a pessoa é membro da organização. Nada fica
 * guardado: ao fechar o git-calm, a pessoa some do canal sozinha.
 *
 * Quem desliga "Aparecer como online" não entra no canal: não aparece e também não vê.
 */
import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';

export interface PresenceMe {
  login: string;
  nome: string;
  avatar: string;
}

/** O que cada aba aberta anuncia */
interface PresenceMeta extends PresenceMe {
  /** Aba em segundo plano */
  ausente: boolean;
  /** Ex.: "quadro", "dashboard", "devtools" */
  tela: string;
  /** Card aberto, se houver */
  card?: number;
  /** Card aberto como "repositório#número" (números se repetem entre repositórios) */
  cardKey?: string;
  /** O que está editando no card aberto (ex.: "escrevendo um comentário") */
  editando?: string;
  /** Quando abriu o git-calm (ms) */
  desde: number;
}

export interface OnlinePerson extends PresenceMe {
  ausente: boolean;
  tela: string;
  card?: number;
  cardKey?: string;
  editando?: string;
  desde: number;
  /** Quantas abas a pessoa tem abertas */
  abas: number;
}

export type PresenceStatus = 'desligado' | 'conectando' | 'online' | 'erro';

// ── Aparecer como online (preferência deste navegador) ──────────────────────
const VISIBLE_KEY = 'gitcalm_presenca_visivel';
const VISIBLE_EVENT = 'gitcalm:presenca-visivel';

export function getPresenceVisible(): boolean {
  try { return localStorage.getItem(VISIBLE_KEY) !== 'false'; } catch { return true; }
}

export function setPresenceVisible(on: boolean): void {
  try { localStorage.setItem(VISIBLE_KEY, String(on)); } catch { /* sem armazenamento: vale até recarregar */ }
  window.dispatchEvent(new Event(VISIBLE_EVENT));
}

export function onPresenceVisibleChange(cb: () => void): () => void {
  window.addEventListener(VISIBLE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(VISIBLE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

// ── O que estou editando (comentário, etapas...) ─────────────────────────────
// Cada lugar que edita avisa por uma chave própria; vale o primeiro que estiver editando.
const editing = new Map<string, string>();
const editingListeners = new Set<() => void>();
let editingSnapshot: string | undefined;

export function setPresenceEditing(source: string, label: string | null): void {
  if (label) editing.set(source, label); else editing.delete(source);
  const next = editing.values().next().value as string | undefined;
  if (next === editingSnapshot) return;
  editingSnapshot = next;
  editingListeners.forEach(l => l());
}

export function getPresenceEditing(): string | undefined {
  return editingSnapshot;
}

export function onPresenceEditingChange(cb: () => void): () => void {
  editingListeners.add(cb);
  return () => { editingListeners.delete(cb); };
}

// ── Conexão ─────────────────────────────────────────────────────────────────
interface Grant { status: 'ok'; url: string; chave: string; token: string; canal: string; expiraEm: number }

async function requestGrant(githubToken: string, org: string): Promise<Grant | 'desligado'> {
  const r = await fetch(`/api/presenca?org=${encodeURIComponent(org)}`, {
    headers: { authorization: `Bearer ${githubToken}` },
  });
  // em dev sem a função, ou em outro servidor: o recurso só não aparece
  if (r.status === 404) return 'desligado';
  const d = await r.json().catch(() => null) as (Grant | { status: string; erro?: string }) | null;
  if (!r.ok) throw new Error((d as { erro?: string } | null)?.erro ?? `HTTP ${r.status}`);
  return d?.status === 'ok' ? (d as Grant) : 'desligado';
}

/** Junta as abas de cada pessoa numa linha só */
function toPeople(state: Record<string, PresenceMeta[]>): OnlinePerson[] {
  const people: OnlinePerson[] = [];
  for (const metas of Object.values(state)) {
    if (!metas.length) continue;
    // a aba ativa mais recente diz onde a pessoa está
    const ativas = metas.filter(m => !m.ausente);
    const ref = (ativas.length ? ativas : metas).reduce((a, b) => (b.desde > a.desde ? b : a));
    people.push({
      login: ref.login,
      nome: ref.nome,
      avatar: ref.avatar,
      ausente: ativas.length === 0,
      tela: ref.tela,
      card: ref.card,
      cardKey: ref.cardKey,
      // editando em qualquer aba conta
      editando: metas.find(m => m.editando && m.cardKey === ref.cardKey)?.editando,
      desde: Math.min(...metas.map(m => m.desde)),
      abas: metas.length,
    });
  }
  return people;
}

/** Onde a pessoa está: tela, card aberto e o que está editando nele */
export interface PresenceWhere {
  tela: string;
  card?: number;
  cardKey?: string;
  editando?: string;
}

/** "repositório#número", para achar o mesmo card entre pessoas */
export const presenceCardKey = (repo: string | undefined, number: number) => `${(repo ?? '').toLowerCase()}#${number}`;

export interface PresenceConnection {
  /** Atualiza a tela, o card ou a edição anunciados */
  update(info: PresenceWhere): void;
  close(): void;
}

export function connectPresence(opts: {
  githubToken: string;
  org: string;
  me: PresenceMe;
  where: PresenceWhere;
  onPeople: (people: OnlinePerson[]) => void;
  onStatus: (status: PresenceStatus, detail?: string) => void;
}): PresenceConnection {
  let closed = false;
  let client: RealtimeClient | null = null;
  let channel: RealtimeChannel | null = null;
  let grant: Grant | null = null;
  const meta: PresenceMeta = {
    ...opts.me,
    ausente: document.visibilityState === 'hidden',
    ...opts.where,
    desde: Date.now(),
  };

  const track = () => {
    if (channel && !closed) channel.track({ ...meta }).catch(() => { /* reenvia ao reconectar */ });
  };

  const onVisibility = () => {
    meta.ausente = document.visibilityState === 'hidden';
    track();
  };

  /** Token do canal: pede outro quando falta pouco para vencer */
  const accessToken = async (): Promise<string | null> => {
    if (grant && grant.expiraEm - Date.now() > 5 * 60_000) return grant.token;
    const g = await requestGrant(opts.githubToken, opts.org).catch(() => null);
    if (g && g !== 'desligado') grant = g;
    return grant?.token ?? null;
  };

  (async () => {
    opts.onStatus('conectando');
    let g: Grant | 'desligado';
    try {
      g = await requestGrant(opts.githubToken, opts.org);
    } catch (e) {
      if (!closed) opts.onStatus('erro', e instanceof Error ? e.message : String(e));
      return;
    }
    if (closed) return;
    if (g === 'desligado') { opts.onStatus('desligado'); return; }
    grant = g;

    client = new RealtimeClient(`${g.url.replace(/^http/, 'ws')}/realtime/v1`, {
      params: { apikey: g.chave },
      accessToken,
    });
    channel = client.channel(g.canal, { config: { private: true, presence: { key: opts.me.login } } });
    channel.on('presence', { event: 'sync' }, () => {
      if (!closed && channel) opts.onPeople(toPeople(channel.presenceState<PresenceMeta>()));
    });
    channel.subscribe((status, err) => {
      if (closed) return;
      if (status === 'SUBSCRIBED') {
        opts.onStatus('online');
        track();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // a biblioteca tenta entrar de novo sozinha
        opts.onStatus('erro', err?.message);
      }
    });
    document.addEventListener('visibilitychange', onVisibility);
  })();

  return {
    update(info) {
      if (meta.tela === info.tela && meta.card === info.card && meta.cardKey === info.cardKey && meta.editando === info.editando) return;
      Object.assign(meta, { tela: info.tela, card: info.card, cardKey: info.cardKey, editando: info.editando });
      track();
    },
    close() {
      closed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (channel) channel.unsubscribe();
      client?.disconnect();
    },
  };
}
