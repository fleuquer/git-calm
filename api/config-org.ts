/**
 * Função da Vercel: entrega a configuração padrão de uma organização.
 *
 * As configurações padrão ficam num repositório PRIVADO (ex.: fleuquer/git-calm-presets),
 * um arquivo por organização: orgs/<org>.json. Esta função lê o arquivo com um token só de
 * leitura guardado nas variáveis de ambiente da Vercel, e só entrega para quem prova, com o
 * próprio token do GitHub, que é membro da organização. O código do git-calm não conhece
 * nenhuma organização: sem arquivo para a organização, a resposta é "nenhuma".
 *
 * Variáveis de ambiente (Vercel › Settings › Environment Variables):
 *   GITCALM_PRESETS_REPO   dono/repositório das configurações (ex.: fleuquer/git-calm-presets)
 *   GITCALM_PRESETS_TOKEN  token fine-grained só de leitura (Contents: Read) desse repositório
 *
 * O token do usuário só é usado para conferir a organização no GitHub: não é guardado nem logado.
 */
import { bearer, gh, isMember, isSameOrigin, json, ORG_RE } from './_github.js';

export async function GET(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, { erro: 'Uso permitido só pelo git-calm' });

  const org = (new URL(request.url).searchParams.get('org') ?? '').trim();
  if (!ORG_RE.test(org)) return json(400, { erro: 'Organização inválida' });

  const userToken = bearer(request);
  if (!userToken) return json(401, { erro: 'Token do GitHub ausente' });

  const repo = process.env.GITCALM_PRESETS_REPO ?? '';
  const presetsToken = process.env.GITCALM_PRESETS_TOKEN ?? '';
  // Recurso não configurado neste servidor: o app segue como se não houvesse padrão
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !presetsToken) {
    return json(200, {
      status: 'nenhuma',
      motivo: 'este servidor não tem o repositório de padrões configurado (variáveis GITCALM_PRESETS_REPO e GITCALM_PRESETS_TOKEN). Em desenvolvimento, coloque as duas no arquivo .env.local e reinicie o npm run dev.',
    });
  }

  const membro = await isMember(userToken, org);
  if (membro === 'token-invalido') return json(401, { erro: 'Token do GitHub inválido' });
  // Quem não é da organização não fica sabendo se existe padrão: só o motivo de não receber
  if (membro === 'nao') {
    return json(200, {
      status: 'nenhuma',
      motivo: `O GitHub não confirmou que você é membro da ${org}. O token precisa da permissão read:org (e, se a organização usa SSO, estar autorizado para ela).`,
    });
  }

  // Daqui em diante é membro: pode ver o motivo exato quando algo da publicação está errado.
  // origem: onde o padrão fica, para quem tem permissão de escrita lá publicar pelo git-calm
  // (a gravação usa o token da própria pessoa; quem não tem acesso ao repositório não consegue)
  const caminho = `orgs/${org.toLowerCase()}.json`;
  const origem = { repo, caminho };
  const arq = await gh(`/repos/${repo}/contents/${caminho}`, presetsToken);
  if (!arq) return json(502, { erro: 'Não foi possível ler as configurações padrão' });
  if (arq.status === 401) {
    return json(200, { status: 'nenhuma', motivo: 'O token do servidor (GITCALM_PRESETS_TOKEN) é inválido ou venceu.', origem });
  }
  if (arq.status === 404) {
    // arquivo que não existe ou repositório que o token do servidor não enxerga?
    const r = await gh(`/repos/${repo}`, presetsToken);
    const motivo = r?.ok
      ? `Ainda não há o arquivo ${caminho} em ${repo}.`
      : `O token do servidor (GITCALM_PRESETS_TOKEN) não acessa o repositório ${repo}: confira o nome em GITCALM_PRESETS_REPO e se o token inclui esse repositório com Contents: Read.`;
    return json(200, { status: 'nenhuma', motivo, origem, semArquivo: !!r?.ok });
  }
  if (!arq.ok) return json(502, { erro: `Configurações padrão indisponíveis (GitHub ${arq.status})` });

  const d = (await arq.json().catch(() => null)) as { content?: string; sha?: string } | null;
  try {
    const config = JSON.parse(Buffer.from(d?.content ?? '', 'base64').toString('utf-8'));
    // sha do arquivo: muda a cada commit, serve para avisar que há versão nova
    return json(200, { status: 'ok', versao: d?.sha ?? '', config, origem });
  } catch {
    return json(502, { erro: 'O arquivo de configuração padrão não é um JSON válido' });
  }
}
