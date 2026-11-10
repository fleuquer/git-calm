/**
 * Função da Vercel: baixa uma imagem de card do GitHub para o git-calm.
 *
 * As imagens dos cards (private-user-images.githubusercontent.com etc.) não liberam CORS,
 * então o navegador mostra a imagem mas não deixa o git-calm ler o conteúdo dela, que é o
 * que a leitura de texto (OCR) do devTools precisa. Esta função busca a imagem no servidor e
 * devolve para o próprio git-calm.
 *
 * Proteções: só endereços https de imagem do GitHub (não é um proxy aberto), sem seguir
 * redirecionamentos, só conteúdo image/* (sem SVG), até 15 MB, e só chamadas feitas pelo
 * próprio git-calm (Sec-Fetch-Site). Nada é guardado.
 */
const HOSTS = new Set([
  'private-user-images.githubusercontent.com',
  'user-images.githubusercontent.com',
  'raw.githubusercontent.com',
  'camo.githubusercontent.com',
  'avatars.githubusercontent.com',
]);
const MAX_BYTES = 15 * 1024 * 1024;

function erro(status: number, mensagem: string) {
  return new Response(mensagem, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(request: Request): Promise<Response> {
  // Navegadores informam de onde veio o pedido: só o próprio git-calm pode usar
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return erro(403, 'Uso permitido só pelo git-calm');

  let url: URL;
  try {
    url = new URL(new URL(request.url).searchParams.get('url') ?? '');
  } catch {
    return erro(400, 'Endereço da imagem inválido');
  }
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname)) return erro(400, 'Só imagens do GitHub');

  const resp = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'git-calm' } }).catch(() => null);
  if (!resp) return erro(502, 'Não foi possível baixar a imagem');
  if (!resp.ok) {
    // links de imagem de repositório privado valem só 5 minutos
    if (resp.status === 403 || resp.status === 404) return erro(410, 'O link da imagem expirou: feche e abra o card de novo');
    return erro(502, `O GitHub respondeu ${resp.status} para a imagem`);
  }

  const tipo = resp.headers.get('content-type') ?? '';
  if (!tipo.startsWith('image/') || tipo.includes('svg')) return erro(415, 'O endereço não é uma imagem');
  if (Number(resp.headers.get('content-length') ?? 0) > MAX_BYTES) return erro(413, 'Imagem grande demais');
  const dados = await resp.arrayBuffer();
  if (dados.byteLength > MAX_BYTES) return erro(413, 'Imagem grande demais');

  return new Response(dados, {
    headers: {
      'content-type': tipo,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}
