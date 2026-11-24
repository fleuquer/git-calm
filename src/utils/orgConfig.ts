import { createOctokit } from '../services/github';

/**
 * Configuração padrão da organização: a parte "da equipe" das configurações (abas,
 * mapeamentos, templates...), publicada por alguém da organização e aplicada para quem
 * entra pela primeira vez. Fica num repositório privado e é entregue pela função
 * /api/config-org só para membros da organização (ver api/config-org.ts).
 *
 * O que é pessoal (tema, fonte, notificações, menções, histórico de atividades e de
 * retrabalho, colunas recolhidas, dashboard...) nunca entra, e o token também não.
 */

/** Configurações da equipe: entram no padrão da organização */
export const TEAM_KEYS = [
  'github_views',
  'github_compact_card_view',
  'github_list_layout',
  'psi_repo_groups',
  'github-project-view-tags-mapping',
  'github-project-view-people-mapping',
  'github-project-ignored-repos',
  'github-project-view-repo-mapping',
  'github-project-tag-repo-mapping',
  'github-project-comment-templates',
  'github-project-comment-templates-appearance',
  'github_priority_config',
  'github_rework_columns',
  'github_blocked_columns',
  'psi_release_link_repo',
  'gitcalm_glossary',
] as const;

/** Nomes para mostrar na tela */
export const TEAM_KEY_LABELS: Record<(typeof TEAM_KEYS)[number], string> = {
  github_views: 'Abas (views)',
  github_compact_card_view: 'Visão compacta dos cards',
  github_list_layout: 'Modo lista',
  psi_repo_groups: 'Grupos de repositórios',
  'github-project-view-tags-mapping': 'Tags por aba',
  'github-project-view-people-mapping': 'Pessoas por aba',
  'github-project-ignored-repos': 'Repositórios ignorados',
  'github-project-view-repo-mapping': 'Repositórios por aba',
  'github-project-tag-repo-mapping': 'Tag → repositório',
  'github-project-comment-templates': 'Templates de comentário',
  'github-project-comment-templates-appearance': 'Aparência dos templates',
  github_priority_config: 'Prioridade dos cards',
  github_rework_columns: 'Colunas de retrabalho',
  github_blocked_columns: 'Colunas bloqueadas',
  psi_release_link_repo: 'Repositório dos links de release',
  gitcalm_glossary: 'Glossário da equipe',
};

const APP = 'git-calm';
const KIND = 'config-organizacao';
/** Versão (sha do arquivo) da configuração da organização já aplicada neste navegador */
const appliedKey = (org: string) => `gitcalm_org_config_aplicada:${org.toLowerCase()}`;
/** Aviso a mostrar depois do recarregamento que aplicou o padrão */
export const ORG_CONFIG_NOTICE_KEY = 'gitcalm_org_config_aviso';

export interface OrgConfigFile {
  _meta: { app: string; tipo: string; org: string; projectNumber?: number; geradoEm: string };
  [key: string]: unknown;
}

/** Onde o padrão da organização fica (repositório privado de padrões e caminho do arquivo) */
export interface OrgConfigOrigin { repo: string; caminho: string }

export type OrgConfigResult =
  | { status: 'ok'; versao: string; config: OrgConfigFile; origem?: OrgConfigOrigin }
  | { status: 'nenhuma'; motivo?: string; origem?: OrgConfigOrigin; semArquivo?: boolean }
  | { status: 'erro'; message: string };

/** Busca a configuração padrão da organização (só membros recebem). */
export async function fetchOrgConfig(token: string, org: string): Promise<OrgConfigResult> {
  if (!token.trim() || !org.trim()) return { status: 'nenhuma' };
  const resp = await fetch(`/api/config-org?org=${encodeURIComponent(org.trim())}`, {
    headers: { authorization: `Bearer ${token.trim()}` },
  }).catch(() => null);
  // Sem a função (ex.: hospedado fora da Vercel): segue como se não houvesse padrão
  if (!resp || resp.status === 404 || !resp.headers.get('content-type')?.includes('application/json')) {
    return { status: 'nenhuma' };
  }
  const data = (await resp.json().catch(() => null)) as {
    status?: string; versao?: string; config?: OrgConfigFile; erro?: string; motivo?: string; origem?: OrgConfigOrigin; semArquivo?: boolean;
  } | null;
  if (!resp.ok) return { status: 'erro', message: data?.erro ?? `Erro ${resp.status} ao buscar a configuração da organização` };
  const origem = data?.origem && /^[\w.-]+\/[\w.-]+$/.test(data.origem.repo) ? data.origem : undefined;
  if (data?.status === 'ok' && data.config && typeof data.config === 'object') {
    return { status: 'ok', versao: data.versao ?? '', config: data.config, origem };
  }
  return { status: 'nenhuma', motivo: data?.motivo, origem, semArquivo: data?.semArquivo };
}

/** A pessoa pode gravar no repositório de padrões? (só quem tem escrita lá publica) */
export async function canPublishOrgConfig(token: string, origem: OrgConfigOrigin): Promise<boolean> {
  try {
    const { data } = await createOctokit(token).request('GET /repos/{owner}/{repo}', {
      owner: origem.repo.split('/')[0],
      repo: origem.repo.split('/')[1],
    });
    return !!(data as { permissions?: { push?: boolean } }).permissions?.push;
  } catch {
    return false;
  }
}

/**
 * Publica a configuração da equipe deste navegador como padrão da organização, gravando o
 * arquivo no repositório de padrões com o token da própria pessoa. Devolve a versão nova.
 * versaoAtual: sha do arquivo que a pessoa viu (o GitHub recusa se alguém mudou nesse meio tempo).
 */
export async function publishOrgConfig(
  token: string, org: string, origem: OrgConfigOrigin, projectNumber: number | undefined, versaoAtual?: string,
): Promise<string> {
  const json = JSON.stringify(buildOrgConfigFile(org, projectNumber), null, 2) + '\n';
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  const [owner, repo] = origem.repo.split('/');
  // caminho com "/" literal (a biblioteca codificaria a barra como %2F)
  const path = origem.caminho.split('/').map(encodeURIComponent).join('/');
  const { data } = await createOctokit(token).request(`PUT /repos/{owner}/{repo}/contents/${path}`, {
    owner,
    repo,
    message: `git-calm: configuração padrão da ${org}`,
    content: btoa(bin),
    ...(versaoAtual ? { sha: versaoAtual } : {}),
  });
  const nova = (data as { content?: { sha?: string } }).content?.sha ?? '';
  // quem publicou já está com essa versão: não precisa do aviso de "configuração atualizada"
  if (nova) localStorage.setItem(appliedKey(org), nova);
  return nova;
}

/** Este navegador já tem alguma configuração da equipe feita à mão? */
export function hasLocalTeamConfig(): boolean {
  return TEAM_KEYS.some(k => localStorage.getItem(k) !== null);
}

/** Versão do padrão da organização já aplicada aqui ('' se nunca aplicou) */
export function appliedOrgConfigVersion(org: string): string {
  return localStorage.getItem(appliedKey(org)) ?? '';
}

/** Versão do padrão que a pessoa recusou no aviso ("Agora não"): não pergunta de novo por ela */
const declinedKey = (org: string) => `gitcalm_org_config_recusada:${org.toLowerCase()}`;

export function declinedOrgConfigVersion(org: string): string {
  return localStorage.getItem(declinedKey(org)) ?? '';
}

export function declineOrgConfig(org: string, versao: string) {
  localStorage.setItem(declinedKey(org), versao);
}

/** Grava a parte da equipe do padrão (sobrescreve só essas configurações). Pede recarregar. */
export function applyOrgConfig(org: string, versao: string, config: OrgConfigFile): number {
  let n = 0;
  for (const key of TEAM_KEYS) {
    if (!(key in config)) continue;
    const value = config[key];
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    n++;
  }
  localStorage.setItem(appliedKey(org), versao);
  return n;
}

/**
 * Aviso mostrado depois de aplicar o padrão. Se o padrão liga a visão compacta ou o layout em
 * lista, avisa que os cards estão assim e onde mudar (é escolha de cada um).
 */
export function orgConfigAppliedMessage(org: string, count: number, config: OrgConfigFile): string {
  const on = (k: string) => config[k] === true || config[k] === 'true';
  const modes = [on('github_compact_card_view') && 'na visão compacta', on('github_list_layout') && 'no layout em lista'].filter(Boolean);
  let msg = `Configuração padrão da ${org} aplicada (${count} ${count === 1 ? 'item' : 'itens'}).`;
  if (modes.length) msg += ` Os cards estão ${modes.join(' e ')}: dá para mudar no menu Opções, no cabeçalho.`;
  return msg;
}

/** Arquivo da configuração da equipe (a partir do que está configurado neste navegador). */
export function buildOrgConfigFile(org: string, projectNumber?: number): OrgConfigFile {
  const file: OrgConfigFile = {
    _meta: { app: APP, tipo: KIND, org, ...(projectNumber ? { projectNumber } : {}), geradoEm: new Date().toISOString() },
  };
  for (const key of TEAM_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try { file[key] = JSON.parse(raw); } catch { file[key] = raw; }
  }
  return file;
}

/** Baixa o arquivo orgs/<org>.json para ser colocado no repositório de configurações padrão. */
export function downloadOrgConfigFile(org: string, projectNumber?: number) {
  const json = JSON.stringify(buildOrgConfigFile(org, projectNumber), null, 2);
  const url = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${org.toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
