/**
 * Ponte com o devTools (projeto independente, https://dev-tools-cards.vercel.app).
 *
 * Conversa com uma cópia do devTools: a que estiver na tela (aba devTools ou tela de
 * notas do painel) ou, sem nenhuma, um iframe invisível que funciona como "serviço".
 * A lógica e os dados continuam sendo do devTools; o git-calm só pergunta e mostra. Protocolo
 * (postMessage, definido pelo devTools):
 *  - devTools → git-calm: { tipo: 'devtools:pronto', versao, funcoes }
 *  - git-calm → devTools: { tipo: 'devtools:assinar' } → passa a receber as notas
 *  - devTools → git-calm: { tipo: 'devtools:notas', notas } (de novo a cada mudança)
 *  - git-calm → devTools: { tipo: 'devtools:chamar', id, fn, args }
 *  - devTools → git-calm: { tipo: 'devtools:resposta', id, ok, valor | erro }
 * Mensagens só são aceitas da origem do devTools e da cópia ativa.
 * O token do GitHub vai junto: { tipo: 'gitcalm:token', token } a cada 'devtools:pronto'.
 */
import { DEVTOOLS_URL, DEVTOOLS_ORIGIN } from './devtoolsConfig';

export interface DevToolsNoteBlock {
  label?: string;
  conteudo: string;
}

export interface DevToolsNote {
  id: string;
  titulo: string;
  atualizado?: string | number;
  fixada?: boolean;
  blocos: DevToolsNoteBlock[];
}

export type BridgeStatus = 'parado' | 'conectando' | 'pronto' | 'indisponivel';

export interface BridgeState {
  status: BridgeStatus;
  notas: DevToolsNote[];
  /** As notas vieram do cache local (ainda não confirmadas pelo devTools) */
  notasDoCache: boolean;
  versao?: string;
  funcoes: string[];
}

const CACHE_KEY = 'gitcalm:devtools:notas';
const READY_TIMEOUT_MS = 20000;
const CALL_TIMEOUT_MS = 15000;

function loadCache(): DevToolsNote[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeNotes(raw: unknown): DevToolsNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
    .map(n => ({
      id: String(n.id ?? ''),
      titulo: typeof n.titulo === 'string' ? n.titulo : '',
      atualizado: typeof n.atualizado === 'string' || typeof n.atualizado === 'number' ? n.atualizado : undefined,
      fixada: !!n.fixada,
      blocos: Array.isArray(n.blocos)
        ? n.blocos
            .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
            .map(b => ({
              label: typeof b.label === 'string' ? b.label : undefined,
              conteudo: typeof b.conteudo === 'string' ? b.conteudo : '',
            }))
        : [],
    }));
}

let state: BridgeState = { status: 'parado', notas: loadCache(), notasDoCache: true, funcoes: [] };
const listeners = new Set<() => void>();
let started = false;
/** Painel de notas ou ferramentas já precisaram da ponte nesta sessão */
let wanted = false;
/** iframe invisível da própria ponte (usado quando nenhuma cópia do devTools está na tela) */
let hosted: HTMLIFrameElement | null = null;
/**
 * Cópias do devTools que estão na tela (aba devTools, tela de notas do painel, modal de
 * ferramenta). A ponte conversa com a última que apareceu.
 */
let externals: HTMLIFrameElement[] = [];
/** Cópias que já disseram "pronto" (para voltar a elas sem esperar de novo) */
const readyInfo = new WeakMap<HTMLIFrameElement, { versao?: string; funcoes: string[] }>();
let token = '';
let readyTimer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const pending = new Map<number, { ok: (v: unknown) => void; erro: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let readyWaiters: Array<() => void> = [];

/** Notificação que o devTools pede para o git-calm exibir (o navegador bloqueia a dele no iframe) */
export interface DevToolsNotification { titulo: string; corpo: string; rota: string }
const notificationListeners = new Set<(n: DevToolsNotification) => void>();
/** Tela do devTools para abrir assim que a aba devTools ficar pronta (clique numa notificação) */
let pendingRoute = '';
const NOTIFY_KEY = 'gitcalm:devtools:notificacoes';
/** Já usou algo do devTools neste navegador (aba, notas, ferramentas): mantém a ponte ligada */
const USED_KEY = 'gitcalm:devtools:usado';

/** Exibir as notificações do devTools? (ligado por padrão) */
export function devToolsNotificationsEnabled(): boolean {
  try { return localStorage.getItem(NOTIFY_KEY) !== '0'; } catch { return true; }
}

export function setDevToolsNotificationsEnabled(on: boolean) {
  try { localStorage.setItem(NOTIFY_KEY, on ? '1' : '0'); } catch { /* ignora */ }
  if (state.status === 'pronto') sendNotifySetting();
}

/** Já usou o devTools aqui? Aí vale manter a ponte ligada para receber as notificações dele. */
export function devToolsWasUsed(): boolean {
  try { return localStorage.getItem(USED_KEY) === '1'; } catch { return false; }
}

function markUsed() {
  try { localStorage.setItem(USED_KEY, '1'); } catch { /* ignora */ }
}

export function onDevToolsNotification(listener: (n: DevToolsNotification) => void) {
  notificationListeners.add(listener);
  return () => { notificationListeners.delete(listener); };
}

/** Abre uma tela do devTools (ex.: '/tarefas') na aba devTools, assim que ela estiver pronta. */
export function openDevToolsRoute(rota: string) {
  if (!rota.startsWith('/')) return;
  pendingRoute = rota;
  flushRoute();
}

function flushRoute() {
  // só na cópia que está na tela (aba devTools), não na invisível
  if (!pendingRoute || !externals.length || state.status !== 'pronto') return;
  post({ type: 'gitcalm:abrir', tipo: 'gitcalm:abrir', rota: pendingRoute });
  pendingRoute = '';
}

function sendNotifySetting() {
  post({ type: 'gitcalm:notificacoes', tipo: 'gitcalm:notificacoes', ativo: devToolsNotificationsEnabled() });
}

function setState(patch: Partial<BridgeState>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

function activeFrame() {
  return externals[externals.length - 1] ?? hosted;
}

function post(message: unknown) {
  activeFrame()?.contentWindow?.postMessage(message, DEVTOOLS_ORIGIN);
}

function sendToken() {
  // 'type'/'version' mantidos por compatibilidade com a 1ª proposta
  post({ tipo: 'gitcalm:token', type: 'gitcalm:token', version: 1, token });
}

function rejectPending(reason: string) {
  pending.forEach(p => { clearTimeout(p.timer); p.erro(new Error(reason)); });
  pending.clear();
}

function onMessage(e: MessageEvent) {
  if (e.origin !== DEVTOOLS_ORIGIN) return;
  // notificação pode vir de qualquer cópia do devTools que o git-calm abriu
  const ours = [hosted, ...externals].some(f => f && e.source === f.contentWindow);
  if (ours && e.data?.tipo === 'devtools:notificar') {
    const d = e.data;
    const n = { titulo: String(d.titulo ?? 'devTools'), corpo: String(d.corpo ?? ''), rota: typeof d.rota === 'string' ? d.rota : '' };
    notificationListeners.forEach(l => l(n));
    return;
  }
  const frame = activeFrame();
  if (!frame || e.source !== frame.contentWindow) return;
  const d = e.data;
  if (!d || typeof d !== 'object') return;

  if (d.tipo === 'devtools:pronto' || d.type === 'devtools:ready') {
    const info = {
      versao: typeof d.versao === 'string' ? d.versao : state.versao,
      funcoes: Array.isArray(d.funcoes) ? d.funcoes.filter((f: unknown) => typeof f === 'string') : state.funcoes,
    };
    readyInfo.set(frame, info);
    markReady(info);
    if (token) sendToken();
    sendNotifySetting();
    flushRoute();
  } else if (d.tipo === 'devtools:notas') {
    const notas = sanitizeNotes(d.notas);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(notas)); } catch { /* cota cheia: segue só em memória */ }
    setState({ notas, notasDoCache: false });
  } else if (d.tipo === 'devtools:resposta') {
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    clearTimeout(p.timer);
    if (d.ok) p.ok(d.valor);
    else p.erro(new Error(typeof d.erro === 'string' ? d.erro : 'Erro no devTools'));
  }
}

function markReady(info: { versao?: string; funcoes: string[] }) {
  clearTimeout(readyTimer);
  setState({ status: 'pronto', ...info });
  readyWaiters.forEach(w => w());
  readyWaiters = [];
}

/** Volta a conversar com uma cópia da tela que já estava aberta por baixo. */
function reactivate(frame: HTMLIFrameElement) {
  rejectPending('A conexão com o devTools mudou');
  const info = readyInfo.get(frame);
  if (!info) { connect(frame); return; }
  markReady(info);
  post({ tipo: 'devtools:assinar' });
  flushRoute();
}

/** Passa a conversar com `frame`: assina as notas quando ele carregar. */
function connect(frame: HTMLIFrameElement) {
  clearTimeout(readyTimer);
  rejectPending('A conexão com o devTools mudou');
  setState({ status: 'conectando' });
  frame.addEventListener('load', () => {
    if (activeFrame() === frame) post({ tipo: 'devtools:assinar' });
  });
  readyTimer = setTimeout(() => {
    if (state.status === 'conectando') setState({ status: 'indisponivel' });
  }, READY_TIMEOUT_MS);
}

function removeHosted() {
  hosted?.remove();
  hosted = null;
}

function mountHosted() {
  removeHosted();
  const el = document.createElement('iframe');
  el.src = `${DEVTOOLS_URL}/`;
  el.title = 'devTools (serviço)';
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  el.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none;';
  hosted = el;
  connect(el);
  document.body.appendChild(el);
}

function ensureListening() {
  if (started) return;
  started = true;
  window.addEventListener('message', onMessage);
}

/** Inicia a ponte (idempotente). */
export function startDevToolsBridge() {
  ensureListening();
  wanted = true;
  markUsed();
  if (!externals.length && !hosted) mountHosted();
}

/** Busca as notas de novo (recarrega a cópia invisível, se for ela a ativa). */
export function refreshDevToolsBridge() {
  ensureListening();
  wanted = true;
  if (externals.length) post({ tipo: 'devtools:assinar' });
  else mountHosted();
}

/**
 * Uma cópia do devTools apareceu na tela (aba devTools ou tela de notas do painel).
 *
 * Regra: só uma cópia do devTools viva por vez. O devTools grava todos os dados de uma
 * vez a cada mudança; com duas cópias abertas, a que estava com dados antigos na memória
 * sobrescreve o que a outra salvou (ex.: notas criadas no painel sumiam). Por isso a
 * cópia invisível sai e a ponte passa a conversar com a que está na tela.
 */
export function attachDevToolsFrame(frame: HTMLIFrameElement) {
  ensureListening();
  markUsed();
  if (externals.includes(frame)) return;
  removeHosted();
  externals.push(frame);
  connect(frame);
}

/**
 * A cópia da tela saiu: volta para a anterior que ainda está na tela ou, se não houver,
 * para a cópia invisível (lida do zero, com os dados atuais).
 */
export function detachDevToolsFrame(frame: HTMLIFrameElement) {
  const idx = externals.indexOf(frame);
  if (idx === -1) return;
  const wasActive = idx === externals.length - 1;
  externals.splice(idx, 1);
  if (!wasActive) return;
  if (externals.length) reactivate(externals[externals.length - 1]);
  else if (wanted) mountHosted();
  else {
    clearTimeout(readyTimer);
    setState({ status: 'parado' });
  }
}

/** Token do GitHub do git-calm, compartilhado com o devTools quando ele fica pronto. */
export function setDevToolsToken(value: string) {
  const changed = value !== token;
  token = value;
  if (changed && token && state.status === 'pronto') sendToken();
}

/** Encerra a ponte (logout) e apaga o cache local das notas. */
export function stopDevToolsBridge() {
  window.removeEventListener('message', onMessage);
  started = false;
  wanted = false;
  clearTimeout(readyTimer);
  removeHosted();
  externals = [];
  token = '';
  rejectPending('Conexão com o devTools encerrada');
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignora */ }
  setState({ status: 'parado', notas: [], notasDoCache: true, funcoes: [], versao: undefined });
}

function whenReady(): Promise<void> {
  if (state.status === 'pronto') return Promise.resolve();
  startDevToolsBridge();
  return new Promise((ok, erro) => {
    const t = setTimeout(() => erro(new Error('O devTools não respondeu')), READY_TIMEOUT_MS);
    readyWaiters.push(() => { clearTimeout(t); ok(); });
  });
}

/** Chama uma função exposta pelo devTools (ex.: callDevTools('lerJwt', token)). */
export async function callDevTools<T = unknown>(fn: string, ...args: unknown[]): Promise<T> {
  await whenReady();
  const target = activeFrame()?.contentWindow;
  if (!target) throw new Error('devTools indisponível');
  const id = ++seq;
  return new Promise<T>((ok, erro) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      erro(new Error('O devTools não respondeu a tempo'));
    }, CALL_TIMEOUT_MS);
    pending.set(id, { ok: v => ok(v as T), erro, timer });
    target.postMessage({ tipo: 'devtools:chamar', id, fn, args }, DEVTOOLS_ORIGIN);
  });
}

export function subscribeDevToolsBridge(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getDevToolsBridgeState() {
  return state;
}
