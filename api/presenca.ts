/**
 * Função da Vercel: libera a entrada no canal de presença ("quem está online") da organização.
 *
 * A presença roda no Supabase Realtime, num canal privado por organização ("presenca:<org>").
 * O Supabase só deixa entrar quem tem um token assinado com o segredo do projeto e cuja
 * organização bate com a do canal (políticas em supabase/presenca.sql). Esta função confere
 * no GitHub, com o token da própria pessoa, que ela é membro da organização, e só então
 * assina esse token, que vale por 1 hora.
 *
 * Variáveis de ambiente (Vercel › Settings › Environment Variables):
 *   GITCALM_SUPABASE_URL         endereço do projeto (https://xxxx.supabase.co)
 *   GITCALM_SUPABASE_ANON_KEY    chave pública (publishable/anon): pode ir para o navegador
 *   GITCALM_SUPABASE_JWT_SECRET  segredo de assinatura (Legacy JWT Secret): só no servidor
 *
 * O token do GitHub só é usado para conferir a pessoa: não é guardado nem logado.
 */
import { createHmac } from 'node:crypto';
import { bearer, getLogin, isMember, isSameOrigin, json, ORG_RE } from './_github.js';

/** Validade do token do canal; o git-calm pede outro antes de vencer */
const VALIDADE_S = 60 * 60;

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

function assinar(payload: Record<string, unknown>, secret: string): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, { erro: 'Uso permitido só pelo git-calm' });

  const org = (new URL(request.url).searchParams.get('org') ?? '').trim();
  if (!ORG_RE.test(org)) return json(400, { erro: 'Organização inválida' });

  const userToken = bearer(request);
  if (!userToken) return json(401, { erro: 'Token do GitHub ausente' });

  const url = process.env.GITCALM_SUPABASE_URL ?? '';
  const chave = process.env.GITCALM_SUPABASE_ANON_KEY ?? '';
  const secret = process.env.GITCALM_SUPABASE_JWT_SECRET ?? '';
  // Recurso não configurado neste servidor: o git-calm só não mostra quem está online
  if (!/^https:\/\/[\w.-]+$/.test(url) || !chave || !secret) {
    return json(200, { status: 'desligado', motivo: 'este servidor não tem o Supabase configurado (variáveis GITCALM_SUPABASE_*).' });
  }

  const login = await getLogin(userToken);
  if (login === null) return json(401, { erro: 'Token do GitHub inválido' });
  if (login === 'erro') return json(502, { erro: 'Não foi possível falar com o GitHub' });

  const membro = await isMember(userToken, org, login);
  if (membro === 'token-invalido') return json(401, { erro: 'Token do GitHub inválido' });
  if (membro === 'nao') {
    return json(200, { status: 'desligado', motivo: `O GitHub não confirmou que você é membro da ${org}.` });
  }

  const agora = Math.floor(Date.now() / 1000);
  const orgKey = org.toLowerCase();
  const token = assinar(
    { role: 'authenticated', aud: 'authenticated', sub: login, org: orgKey, iat: agora, exp: agora + VALIDADE_S },
    secret,
  );
  return json(200, { status: 'ok', url, chave, token, canal: `presenca:${orgKey}`, login, expiraEm: (agora + VALIDADE_S) * 1000 });
}
