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
  if (/^\s*(select|insert|update|delete|with|create|alter)\b/i.test(text)) add('formatarSql', [text], 'Formatar SQL', 'sqlfmt');
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

  // Ferramentas só de tela (abrem no modal)
  const screens: ToolSuggestion[] = [];
  const screen = (label: string, toolId: string, detected: boolean) => {
    if (!screens.some(t => t.toolId === toolId)) screens.push({ fn: '', args: [text], label, toolId, detected, openOnly: true });
  };
  if (/^\s*select\b/i.test(text)) screen('SELECT → UPDATE/DELETE', 'selectupd', true);
  if (lines.length >= 2 && lines.every(l => l.includes('\t'))) screen('Gerar DDL', 'ddl', true);
  const looksLog = lines.length >= 2 && /PHP (Fatal|Warning|Notice|Parse|Deprecated)|Stack trace:|Traceback|\bERROR:|\[(error|warn|crit)[^\]]*\]|Exception\b|\.(ERROR|WARNING|CRITICAL):/i.test(text);
  if (looksLog) screen('Leitor de log', 'log', true);
  const personal = !single && /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|[\w.+-]+@[\w-]+\.[\w.]+|\(\d{2}\)\s?\d{4,5}-\d{4}/.test(text);
  if (personal) screen('Extrair do texto', 'extrair', true);
  if (personal || looksLog) screen('Anonimizar (LGPD)', 'anonimizar', true);
  if (/[\u00A0\u200B-\u200D\u2060\uFEFF]/.test(text)) screen('Limpar texto colado', 'limpeza', true);
  if (/^\s*(array\s*\(|Array\s*\(|\[\s*['"][^'"]+['"]\s*=>)|^\s*\{\s*:?\w+\s*=>/i.test(text)) screen('Array → JSON', 'arrayjson', true);
  if (/&([a-z]+|#\d+);/i.test(text)) screen('Entidades HTML', 'entidades', true);

  // Genéricas: valem para qualquer texto
  const generic = (fn: string, args: unknown[], label: string, toolId: string) =>
    found.push({ fn, args, label, toolId, detected: false });
  generic('casos', [text], 'Caixa e nomes', 'caixa');
  generic('semAcento', [text], 'Sem acentos', 'caixa');
  generic('hash', [text], 'Hash', 'hash');
  if (!found.some(f => f.fn === 'base64')) generic('base64', [text, 'encode'], 'Texto → Base64', 'base64');
  if (!single) {
    screen('Anonimizar (LGPD)', 'anonimizar', false);
    screen('Extrair do texto', 'extrair', false);
    screen('Limpar texto colado', 'limpeza', false);
  }
  // reconhecidas primeiro (as que calculam na frente das que só abrem a tela), depois as genéricas
  return [...found.filter(t => t.detected), ...screens.filter(t => t.detected), ...found.filter(t => !t.detected), ...screens.filter(t => !t.detected)];
}
