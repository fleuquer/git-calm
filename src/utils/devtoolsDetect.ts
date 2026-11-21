/**
 * Reconhece o formato de um texto selecionado e sugere qual ferramenta do devTools
 * usar. Aqui só se identifica o tipo; o cálculo é sempre feito pelo devTools
 * (callDevTools), para não replicar as ferramentas dele.
 */
export interface ToolSuggestion {
  /** Função exposta pelo devTools */
  fn: string;
  args: unknown[];
  label: string;
  /** Id da ferramenta na tela do devTools (/ferramentas/:id), para "Abrir no devTools" */
  toolId: string;
  /** Reconhecida pelo formato (já calcula ao selecionar e vem primeiro) ou genérica (vale para qualquer texto) */
  detected: boolean;
  /**
   * Ferramenta que o devTools ainda não expõe para cálculo: só abre a tela dela no modal,
   * com o texto copiado
   */
  openOnly?: boolean;
  /**
   * A função manda o texto para um serviço de fora (tradução, ortografia, consulta de CNPJ):
   * nunca calcula sozinha, só no clique, e o chip avisa para onde o texto vai
   */
  external?: string;
}

const digits = (s: string) => s.replace(/\D/g, '');

export function suggestTools(raw: string): ToolSuggestion[] {
  const text = raw.trim();
  if (!text || text.length > 20000) return [];
  const single = !/\s/.test(text);
  const found: ToolSuggestion[] = [];
  const add = (fn: string, args: unknown[], label: string, toolId: string) =>
    found.push({ fn, args, label, toolId, detected: true });

  // JWT e Pix também quando vêm no meio de um trecho maior (ex.: "token eyJ... no tenant 12")
  const jwt = text.match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*/)?.[0] ?? (single && /^eyJ[\w-]+\.[\w-]+\.[\w-]*$/.test(text) ? text : null);
  if (jwt) add('lerJwt', [jwt], 'JWT', 'jwt');

  const pix = text.match(/000201\S{30,}/)?.[0];
  if (pix) add('lerPix', [pix], 'Pix', 'pix');

  const d = digits(text);
  const docLike = /^[\d.\-/\s]+$/.test(text) || /^[A-Z\d]{2}\.?[A-Z\d]{3}\.?[A-Z\d]{3}\/?[A-Z\d]{4}-?\d{2}$/i.test(text);
  if (docLike && (d.length === 11 || d.length === 14 || /[A-Z]/i.test(text))) {
    add('validar', [text], 'Validar documento', 'validador');
  }
  if (/^[\d.\s]+$/.test(text) && [44, 47, 48].includes(d.length)) add('lerBoleto', [text], 'Boleto / guia', 'boleto');

  // Cron: uma linha, 5 ou 6 campos, cada um com números/curingas ou nome curto (MON, JAN-MAR)
  const cronParts = text.split(/ +/);
  if (!/\n|\t/.test(text) && cronParts.length >= 5 && cronParts.length <= 6 && /[*\d]/.test(text)
    && cronParts.every(p => /^[\d*/,\-?LW#]+$/i.test(p) || /^[A-Z]{3}([-,][A-Z]{3})*$/i.test(p))) {
    add('cron', [text], 'Cron', 'cron');
  }
  const sql = /^\s*(select|insert|update|delete|with|create|alter|drop|truncate|begin)\b/i.test(text);
  // script que altera dados: revisar vem antes de formatar (UPDATE/DELETE sem WHERE, sem BEGIN/COMMIT...)
  if (sql && /\b(update|delete|insert|drop|truncate|alter)\b/i.test(text)) add('revisarSql', [text], 'Revisar script', 'revisor');
  if (sql) add('formatarSql', [text], 'Formatar SQL', 'sqlfmt');
  // Grid colado do banco/planilha (colunas separadas por tab)
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length >= 2 && lines.every(l => l.includes('\t'))) add('tabela', [text, 'markdown'], 'Grid → tabela', 'grade');
  if (/^<[\s\S]*>$/.test(text) && !/^<[^>]*>$/.test(text)) add('formatarXml', [text], 'Formatar XML', 'formatador');

  // Base64: exige "cara" de Base64 (padding ou mistura de maiúsculas, minúsculas e dígitos),
  // para não pegar palavras comuns de 8 ou 12 letras
  const b64Shape = /=$/.test(text) || (/[A-Z]/.test(text) && /[a-z]/.test(text) && /\d/.test(text));
  if (single && text.length >= 12 && text.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(text) && b64Shape && !found.length) {
    add('base64', [text, 'decode'], 'Base64 → texto', 'base64');
  }
  if (/Ã[\u0080-¿]|Ã[§£©¡ª³µº¢]/.test(text)) add('corrigirEncoding', [text], 'Corrigir acentuação', 'encoding');

  // Data sozinha (21/11/2026, 2026-11-21, 21-11-2026 10:30): todos os formatos
  if (/^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})([ T]\d{1,2}:\d{2}(:\d{2})?)?$/.test(text)) add('formatarData', [text], 'Formatos da data', 'formatodata');

  const looksLog = lines.length >= 2 && /PHP (Fatal|Warning|Notice|Parse|Deprecated)|Stack trace:|Traceback|\bERROR:|\[(error|warn|crit)[^\]]*\]|Exception\b|\.(ERROR|WARNING|CRITICAL):/i.test(text);
  // Dados pessoais no meio de um texto: extrair cada tipo encontrado e anonimizar (antes de colar na issue)
  const kinds: Array<[string, RegExp, string]> = [
    ['cpf', /\d{3}\.\d{3}\.\d{3}-\d{2}/, 'CPFs'],
    ['cnpj', /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, 'CNPJs'],
    ['email', /[\w.+-]+@[\w-]+\.[\w.]+/, 'e-mails'],
    ['telefone', /\(\d{2}\)\s?\d{4,5}-\d{4}/, 'telefones'],
  ];
  const personal = single ? [] : kinds.filter(([, re]) => re.test(text));
  if (personal.length || looksLog) add('anonimizar', [text], 'Anonimizar (LGPD)', 'anonimizar');
  for (const [tipo, , nome] of personal) add('extrair', [text, tipo], `Extrair ${nome}`, 'extrair');
  if (/[\u00A0\u200B-\u200D\u2060\uFEFF]/.test(text)) add('limparTexto', [text], 'Limpar texto colado', 'limpeza');
  if (/&([a-z]+|#\d+);/i.test(text)) add('entidades', [text, 'decodificar'], 'Entidades HTML → texto', 'entidades');
  // Lista (um item por linha, itens curtos e com repetição): tirar repetidos e contar
  const items = lines.map(l => l.trim());
  if (items.length >= 3 && items.every(l => l.length <= 80 && !l.includes('\t')) && new Set(items).size < items.length) {
    add('unicos', [text], 'Tirar repetidos', 'listas');
    add('contarValores', [text], 'Contar repetidos', 'listas');
  }

  // Ferramentas só de tela (abrem no modal)
  const screens: ToolSuggestion[] = [];
  const screen = (label: string, toolId: string, detected: boolean) => {
    if (!screens.some(t => t.toolId === toolId)) screens.push({ fn: '', args: [text], label, toolId, detected, openOnly: true });
  };
  if (/^\s*select\b/i.test(text)) screen('SELECT → UPDATE/DELETE', 'selectupd', true);
  if (lines.length >= 2 && lines.every(l => l.includes('\t'))) screen('Gerar DDL', 'ddl', true);
  if (looksLog) screen('Leitor de log', 'log', true);
  if (/^\s*(array\s*\(|Array\s*\(|\[\s*['"][^'"]+['"]\s*=>)|^\s*\{\s*:?\w+\s*=>/i.test(text)) screen('Array → JSON', 'arrayjson', true);

  // Genéricas: valem para qualquer texto
  const generic = (fn: string, args: unknown[], label: string, toolId: string) =>
    found.push({ fn, args, label, toolId, detected: false });
  generic('casos', [text], 'Caixa e nomes', 'caixa');
  generic('semAcento', [text], 'Sem acentos', 'caixa');
  generic('hash', [text], 'Hash', 'hash');
  if (!found.some(f => f.fn === 'base64')) generic('base64', [text, 'encode'], 'Texto → Base64', 'base64');
  if (!single) {
    if (!found.some(f => f.fn === 'anonimizar')) generic('anonimizar', [text], 'Anonimizar (LGPD)', 'anonimizar');
    if (!found.some(f => f.fn === 'limparTexto')) generic('limparTexto', [text], 'Limpar texto colado', 'limpeza');
    screen('Extrair do texto', 'extrair', false);
  }
  // Serviços de fora: só no clique, com aviso de para onde o texto vai
  // texto corrido (não SQL, log, lista, grid, XML ou código de uma palavra só)
  const prose = !single && !sql && !looksLog && !lines.some(l => l.includes('\t')) && !/^\s*[<{[]/.test(text)
    && !(items.length >= 3 && items.every(l => l.split(/\s+/).length <= 3));
  if (prose && /[a-zà-ú]{3,}/i.test(text) && text.length <= 5000) {
    const pt = /[ãõçáéíóúâêô]|\b(que|não|para|com|uma|os|as|de|do|da|em|é)\b/i.test(text);
    found.push({ fn: 'traduzir', args: [text, pt ? 'en' : 'pt'], label: pt ? 'Traduzir → inglês' : 'Traduzir → português', toolId: 'tradutor', detected: false, external: 'MyMemory (ou o tradutor do próprio Chrome)' });
    found.push({ fn: 'corrigirOrtografia', args: [text], label: 'Corrigir ortografia', toolId: 'ortografia', detected: false, external: 'LanguageTool' });
  }
  const cnpj = found.find(f => f.fn === 'validar') && digits(text).length === 14 ? text : null;
  if (cnpj) found.push({ fn: 'consultarCnpj', args: [cnpj], label: 'Consultar CNPJ', toolId: 'cnpj', detected: true, external: 'OpenCNPJ' });
  // reconhecidas primeiro (as que calculam na frente das que só abrem a tela), depois as genéricas
  return [...found.filter(t => t.detected), ...screens.filter(t => t.detected), ...found.filter(t => !t.detected), ...screens.filter(t => !t.detected)];
}
