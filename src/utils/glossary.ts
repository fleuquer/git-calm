/**
 * Glossário da equipe: palavras ou expressões que querem dizer a mesma coisa ("DAM = guia =
 * boleto"). A comparação de cards parecidos (issue #11) trata cada grupo como um termo só.
 * Fica no navegador e entra na configuração padrão da organização.
 */
export const GLOSSARY_KEY = 'gitcalm_glossary';

export interface GlossaryGroup {
  /** Primeiro termo da linha: é o que aparece em "em comum" */
  label: string;
  terms: string[];
}

/** Uma linha por grupo, termos separados por "=" (ou ","); linhas com # são comentário */
export function parseGlossary(text: string): GlossaryGroup[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split(/\s*[=,;]\s*/).map(t => t.trim()).filter(Boolean))
    .filter(terms => terms.length >= 2)
    .map(terms => ({ label: terms[0], terms }));
}

let cache: { text: string; groups: GlossaryGroup[] } | null = null;

export function loadGlossaryText(): string {
  try { return localStorage.getItem(GLOSSARY_KEY) ?? ''; } catch { return ''; }
}

export function saveGlossaryText(text: string) {
  try {
    if (text.trim()) localStorage.setItem(GLOSSARY_KEY, text);
    else localStorage.removeItem(GLOSSARY_KEY);
  } catch { /* ignora */ }
  cache = null;
}

export function loadGlossary(): GlossaryGroup[] {
  const text = loadGlossaryText();
  if (cache?.text !== text) cache = { text, groups: parseGlossary(text) };
  return cache.groups;
}
