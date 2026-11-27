/**
 * Ajudantes das funções da Vercel que falam com o GitHub. Arquivos de api/ que começam com "_"
 * não viram rota na Vercel: este só é importado pelas funções.
 */
const GH = 'https://api.github.com';

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}

export function gh(path: string, token: string, accept = 'application/vnd.github+json') {
  return fetch(`${GH}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept, 'user-agent': 'git-calm', 'x-github-api-version': '2022-11-28' },
  }).catch(() => null);
}

/** Organização válida no GitHub (letras, números e hífen) */
export const ORG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** Só o próprio git-calm chama as funções (o navegador marca a origem da chamada) */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin';
}

export function bearer(request: Request): string {
  return (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
}

/** Login do dono do token (null: token inválido) */
export async function getLogin(token: string): Promise<string | null | 'erro'> {
  const u = await gh('/user', token);
  if (!u) return 'erro';
  if (u.status === 401) return null;
  const d = u.ok ? ((await u.json().catch(() => null)) as { login?: string } | null) : null;
  return d?.login ?? 'erro';
}

/** O dono do token é membro (ativo) da organização? */
export async function isMember(token: string, org: string, login?: string): Promise<'sim' | 'nao' | 'token-invalido'> {
  // Exige read:org (pedido pelo git-calm); funciona também para quem tem a participação privada
  const m = await gh(`/user/memberships/orgs/${org}`, token);
  if (m?.status === 401) return 'token-invalido';
  if (m?.ok) {
    const d = (await m.json().catch(() => null)) as { state?: string } | null;
    return d?.state === 'active' ? 'sim' : 'nao';
  }
  // Sem read:org (ex.: token fine-grained): membro vê a lista de membros da organização
  const who = login ?? (await getLogin(token));
  if (who === null) return 'token-invalido';
  if (!who || who === 'erro') return 'nao';
  const r = await gh(`/orgs/${org}/members/${who}`, token);
  return r?.status === 204 ? 'sim' : 'nao';
}
