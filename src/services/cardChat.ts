/**
 * Conversa nos cards: mensagens da equipe presas a um card, guardadas no Supabase por 30 dias
 * e que não vão para o GitHub. Quem é mencionado com @ recebe o aviso na tela.
 */
import { supabaseRest } from './supabase';
import { sendOrgEvent } from './orgEvents';
import { presenceCardKey } from './presence';

export interface ChatMessage {
  id: string;
  org: string;
  card_key: string;
  card_numero: number;
  card_repo: string;
  card_titulo: string;
  autor: string;
  autor_nome: string;
  autor_avatar: string;
  texto: string;
  mencoes: string[];
  criado_em: string;
}

export interface ChatCard { number: number; repo?: string; title: string }
export interface ChatAuthor { login: string; nome: string; avatar: string }

const TABLE = 'gitcalm_card_chat';
export const CHAT_RETENTION_DAYS = 30;

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** Logins mencionados com @ (sem repetir, sem a própria pessoa) */
export function parseMentions(texto: string, me?: string): string[] {
  const out = new Set<string>();
  for (const m of texto.matchAll(/(^|[^\w`])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/g)) out.add(m[2].toLowerCase());
  if (me) out.delete(me.toLowerCase());
  return [...out];
}

export function listCardMessages(githubToken: string, org: string, card: { number: number; repo?: string }): Promise<ChatMessage[]> {
  const key = encodeURIComponent(presenceCardKey(card.repo, card.number));
  return supabaseRest<ChatMessage[]>(
    githubToken,
    org,
    `${TABLE}?card_key=eq.${key}&criado_em=gte.${encodeURIComponent(since(CHAT_RETENTION_DAYS))}&order=criado_em.asc&limit=500`,
  );
}

export async function postCardMessage(
  githubToken: string,
  org: string,
  card: ChatCard,
  autor: ChatAuthor,
  texto: string,
): Promise<ChatMessage> {
  const [msg] = await supabaseRest<ChatMessage[]>(githubToken, org, TABLE, {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      org: org.toLowerCase(),
      card_key: presenceCardKey(card.repo, card.number),
      card_numero: card.number,
      card_repo: card.repo ?? '',
      card_titulo: card.title,
      autor: autor.login,
      autor_nome: autor.nome,
      autor_avatar: autor.avatar,
      texto,
      mencoes: parseMentions(texto, autor.login),
    },
  });
  sendOrgEvent({ tipo: 'chat', msg });
  return msg;
}

export async function deleteCardMessage(githubToken: string, org: string, msg: ChatMessage): Promise<void> {
  await supabaseRest(githubToken, org, `${TABLE}?id=eq.${msg.id}`, { method: 'DELETE' });
  sendOrgEvent({ tipo: 'chat-apagada', cardKey: msg.card_key, id: msg.id });
}

/** Menções a mim depois de um momento (para avisar do que chegou enquanto estava fora) */
export function listMyMentions(githubToken: string, org: string, login: string, after: string): Promise<ChatMessage[]> {
  return supabaseRest<ChatMessage[]>(
    githubToken,
    org,
    `${TABLE}?mencoes=cs.${encodeURIComponent(`{${login.toLowerCase()}}`)}&criado_em=gt.${encodeURIComponent(after)}&order=criado_em.desc&limit=20`,
  );
}

// ── Menções já vistas (por navegador) ───────────────────────────────────────────────────────
const seenKey = (org: string, login: string) => `gitcalm_conversa_mencoes_vistas:${org.toLowerCase()}:${login.toLowerCase()}`;

/** Até quando as menções já foram vistas; na primeira vez, os últimos 7 dias contam como novos */
export function getMentionsSeenAt(org: string, login: string): string {
  try { return localStorage.getItem(seenKey(org, login)) ?? since(7); } catch { return since(7); }
}

export function setMentionsSeenAt(org: string, login: string, iso: string): void {
  try {
    const prev = localStorage.getItem(seenKey(org, login));
    if (!prev || prev < iso) localStorage.setItem(seenKey(org, login), iso);
  } catch { /* sem armazenamento: avisa de novo na próxima vez */ }
}

// ── Abrir o card direto na conversa (ex.: ao clicar no aviso de menção) ─────────────────────
let chatTabRequest: string | null = null;

export function requestChatTab(cardKey: string): void {
  chatTabRequest = cardKey;
}

/** O card que está abrindo pediu para começar na conversa? (vale uma vez) */
export function consumeChatTabRequest(cardKey: string): boolean {
  if (chatTabRequest !== cardKey) return false;
  chatTabRequest = null;
  return true;
}
