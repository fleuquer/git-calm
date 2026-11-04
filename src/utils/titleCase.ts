/**
 * Normaliza títulos escritos em CAIXA ALTA para exibição ("gritando" → frase normal),
 * sem alterar o título real da issue.
 *
 * O título é dividido nos separadores (" - ", " – ", ": ") e cada trecho é tratado à parte:
 * - só é convertido o trecho quase todo em maiúsculas, com 2+ palavras e 8+ letras
 *   (trechos curtos como "CONTAS", "GPROWEB", "ISS ON" costumam ser o módulo e ficam como estão);
 * - no trecho convertido, siglas conhecidas, palavras sem vogal (CNPJ, NF) e palavras
 *   com número continuam em maiúsculas.
 */

// Siglas comuns nos títulos dos projetos (módulos, documentos, órgãos)
const ACRONYMS = new Set([
  'API', 'ARR', 'AUDESP', 'BI', 'CEP', 'CND', 'CNPJ', 'CPF', 'CSV', 'CTN', 'DAM', 'DARF',
  'DCTFWEB', 'DTE', 'EGOV', 'ERP', 'ESOCIAL', 'FGTS', 'GCC', 'GEI', 'GPRO', 'GPROWEB', 'GSR',
  'IBGE', 'ICMS', 'ID', 'INSS', 'IPTU', 'IPVA', 'ISS', 'ISSONLINE', 'ISSQN', 'ISSW', 'ITBI',
  'LDO', 'LOA', 'NF', 'NFE', 'NFS', 'NFSE', 'NFTS', 'OS', 'PDF', 'PEC', 'PIX', 'PM', 'PNCP',
  'PPA', 'QR', 'REINF', 'RH', 'RPS', 'SEFAZ', 'SIAFIC', 'SIAP', 'SICONFI', 'SIS', 'SMS', 'SP',
  'SQL', 'SUP', 'TCE', 'TCESP', 'TI', 'UF', 'URL', 'WEB', 'XML',
]);

const SEPARATOR = /(\s*[-–—]\s+|\s+[-–—]\s*|:\s+)/;
const LETTER = /\p{L}/gu;
const VOWEL = /[AEIOUYÁÉÍÓÚÂÊÔÃÕÀÜ]/i;

function isShouting(segment: string): boolean {
  const letters = segment.match(LETTER) ?? [];
  if (letters.length < 8) return false;
  const words = segment.split(/\s+/).filter(w => /\p{L}/u.test(w));
  if (words.length < 2) return false;
  const upper = letters.filter(ch => ch !== ch.toLocaleLowerCase('pt-BR')).length;
  return upper / letters.length >= 0.8;
}

function keepUppercase(word: string): boolean {
  const core = word.replace(/[^\p{L}\p{N}]/gu, '').toLocaleUpperCase('pt-BR');
  if (!core) return false;
  return ACRONYMS.has(core) || /\d/.test(core) || (core.length >= 2 && !VOWEL.test(core));
}

function toSentenceCase(segment: string): string {
  const lowered = segment
    .split(/(\s+)/)
    .map(token => (keepUppercase(token) ? token : token.toLocaleLowerCase('pt-BR')))
    .join('');
  // Primeira letra do trecho em maiúscula
  return lowered.replace(/\p{L}/u, ch => ch.toLocaleUpperCase('pt-BR'));
}

export function normalizeTitleCase(title: string): string {
  return title
    .split(SEPARATOR)
    .map((part, i) => (i % 2 === 0 && isShouting(part) ? toSentenceCase(part) : part))
    .join('');
}
