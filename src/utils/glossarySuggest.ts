/**
 * Sugestões para o glossário da equipe a partir do texto dos cards e das descrições dos
 * repositórios, sem IA. Só aponta o que dá para afirmar pelo próprio texto:
 * - siglas definidas: "DAM (Documento de Arrecadação Municipal)", "Nota Fiscal (NF)", "ISS - Imposto Sobre Serviços"
 * - sigla e expressão com as mesmas iniciais que aparecem pelos cards ("ISSQN" e "imposto sobre serviços de qualquer natureza")
 * - a mesma palavra escrita de jeitos diferentes ("NFS-e", "NFSe", "nfse")
 * A pessoa revisa e escolhe o que entra.
 */
import { parseGlossary } from './glossary';

export interface SuggestSource { text: string; ref: string }

export interface GlossarySuggestion {
  terms: string[];
  reason: 'definida' | 'iniciais' | 'variacao';
  /** Onde apareceu (ex.: "#1234", "repositório arr-web") */
  refs: string[];
  /** Quantas vezes apareceu */
  count: number;
}

const JOIN = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'a', 'o']);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const COMMON_ACRONYMS = new Set(['OK', 'PDF', 'URL', 'API', 'SQL', 'HTML', 'CSS', 'JSON', 'XML', 'HTTP', 'HTTPS', 'ID', 'TI', 'PR', 'QA', 'DEV', 'PROD', 'TODO', 'OBS', 'ATT', 'EX']);

/** Letras da sigla, para comparar com as iniciais ("NFS-e" → "nfse") */
const acronymKey = (a: string) => norm(a).replace(/[^a-z0-9]/g, '');

/** A expressão tem as iniciais da sigla? (com ou sem "de/do/da/e") */
function initialsMatch(acronym: string, phrase: string): boolean {
  const words = phrase.split(/[\s/-]+/).filter(Boolean).map(norm);
  const key = acronymKey(acronym);
  if (words.length < 2 || words.length > key.length + 3) return false;
  const all = words.map(w => w[0]).join('');
  const strict = words.filter(w => !JOIN.has(w)).map(w => w[0]).join('');
  return all === key || strict === key;
}

/** Menor final da expressão cujas iniciais formam a sigla ("Emissão do Documento de Arrecadação Municipal" → "Documento de Arrecadação Municipal") */
function tailMatching(acronym: string, phrase: string): string | null {
  const words = phrase.trim().split(/\s+/);
  for (let i = words.length - 2; i >= 0; i--) {
    const cand = words.slice(i).join(' ');
    if (initialsMatch(acronym, cand)) return cand;
  }
  return null;
}

/** Texto sem código, links e marcação, para não pegar sigla de dentro de SQL ou URL */
function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ');
}

export function suggestGlossary(sources: SuggestSource[], existingGlossary = ''): GlossarySuggestion[] {
  const out = new Map<string, GlossarySuggestion>();
  const add = (terms: string[], reason: GlossarySuggestion['reason'], ref: string) => {
    if (terms.some(t => COMMON_ACRONYMS.has(t.toUpperCase()))) return;
    const uniq = [...new Map(terms.map(t => [norm(t).replace(/\s+/g, ' ').trim(), t.trim()])).values()].filter(Boolean);
    if (uniq.length < 2) return;
    const key = uniq.map(t => norm(t)).sort().join('|');
    const s = out.get(key) ?? { terms: uniq, reason, refs: [], count: 0 };
    s.count++;
    if (!s.refs.includes(ref)) s.refs.push(ref);
    // definição explícita vale mais que as outras evidências
    if (reason === 'definida') s.reason = 'definida';
    out.set(key, s);
  };

  const texts = sources.map(s => ({ ref: s.ref, text: plain(s.text) }));

  // 1. Siglas definidas no texto
  const ACR = '([A-Z][A-Z0-9]{1,7}(?:-[a-zA-Z])?)';
  const PHRASE = '([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{3,80}?)';
  for (const { ref, text } of texts) {
    for (const m of text.matchAll(new RegExp(`\\b${ACR}\\s*\\(\\s*${PHRASE}\\s*\\)`, 'g'))) {
      if (initialsMatch(m[1], m[2])) add([m[1], m[2]], 'definida', ref);
    }
    for (const m of text.matchAll(new RegExp(`${PHRASE}\\s*\\(\\s*${ACR}\\s*\\)`, 'g'))) {
      const tail = tailMatching(m[2], m[1]);
      if (tail) add([m[2], tail], 'definida', ref);
    }
    for (const m of text.matchAll(new RegExp(`\\b${ACR}\\s*[-–:]\\s*${PHRASE}(?=[.,;\\n)]|$)`, 'g'))) {
      const head = m[2].trim().split(/\s+/);
      let found = false;
      for (let n = 2; n <= Math.min(head.length, acronymKey(m[1]).length + 3); n++) {
        const cand = head.slice(0, n).join(' ');
        if (initialsMatch(m[1], cand)) { add([m[1], cand], 'definida', ref); found = true; break; }
      }
      // abreviação pelo começo da palavra: "ARR - Arrecadação"
      const key = acronymKey(m[1]);
      if (!found && key.length >= 3 && norm(head[0]).startsWith(key)) add([m[1], head[0]], 'definida', ref);
    }
  }

  // Repositório "arr-web" com descrição "Arrecadação ...": "arr" é abreviação de "Arrecadação"
  for (const { ref, text } of texts) {
    const repo = ref.match(/^repositório (.+)$/)?.[1];
    if (!repo) continue;
    const prefix = norm(repo.split(/[-_.]/)[0]);
    const first = text.trim().split(/[^A-Za-zÀ-ÿ]+/).find(w => w.length > prefix.length && norm(w).startsWith(prefix));
    if (prefix.length >= 3 && first) add([prefix, first], 'definida', ref);
  }

  // 2. Siglas usadas pelos cards e expressões com as mesmas iniciais (precisa aparecer 2+ vezes)
  const acronyms = new Map<string, number>();
  for (const { text } of texts) {
    for (const m of text.matchAll(/\b[A-Z][A-Z0-9]{2,7}(?:-[a-z])?\b/g)) {
      if (!COMMON_ACRONYMS.has(m[0]) && /[A-Z]{3}/.test(m[0])) acronyms.set(m[0], (acronyms.get(m[0]) ?? 0) + 1);
    }
  }
  const phrases = new Map<string, { text: string; count: number; refs: Set<string> }>();
  for (const { ref, text } of texts) {
    const words = text.split(/[^A-Za-zÀ-ÿ]+/).filter(Boolean);
    for (const [acr, n] of acronyms) {
      if (n < 2) continue;
      const len = acronymKey(acr).length;
      for (let i = 0; i < words.length; i++) {
        for (let k = len; k <= len + 3 && i + k <= words.length; k++) {
          const cand = words.slice(i, i + k);
          if (JOIN.has(norm(cand[0])) || JOIN.has(norm(cand[cand.length - 1]))) continue;
          if (cand.some(w => w.length < 2) || cand.every(w => w === w.toUpperCase())) continue;
          const phrase = cand.join(' ');
          if (!initialsMatch(acr, phrase)) continue;
          const key = `${acr}|${norm(phrase)}`;
          const p = phrases.get(key) ?? { text: phrase, count: 0, refs: new Set<string>() };
          p.count++;
          p.refs.add(ref);
          phrases.set(key, p);
        }
      }
    }
  }
  for (const [key, p] of phrases) {
    // a mesma expressão em pelo menos dois lugares: menos chance de ser coincidência de iniciais
    if (p.count < 2) continue;
    const acr = key.split('|')[0];
    for (const ref of p.refs) add([acr, p.text.toLowerCase()], 'iniciais', ref);
  }

  // 3. Mesma palavra escrita de jeitos diferentes (NFS-e, NFSe, nfse)
  const forms = new Map<string, Map<string, Set<string>>>();
  for (const { ref, text } of texts) {
    for (const m of text.matchAll(/\b[A-Za-zÀ-ÿ0-9]+(?:[-.][A-Za-zÀ-ÿ0-9]+)*\b/g)) {
      const w = m[0];
      if (w.length < 3 || /^\d/.test(w) || /\.(php|js|ts|tsx|sql|json|html|css|xml|py)$/i.test(w)) continue;
      const k = norm(w).replace(/[-.]/g, '');
      if (k.length < 3) continue;
      const m2 = forms.get(k) ?? new Map<string, Set<string>>();
      const refs = m2.get(w) ?? new Set<string>();
      refs.add(ref);
      m2.set(w, refs);
      forms.set(k, m2);
    }
  }
  for (const m2 of forms.values()) {
    // só conta se pelo menos uma forma tem hífen ou ponto e há formas realmente diferentes
    const distinct = [...new Map([...m2.keys()].map(w => [w.toLowerCase(), w])).values()];
    if (distinct.length < 2 || !distinct.some(w => /[-.]/.test(w))) continue;
    for (const refs of m2.values()) for (const ref of refs) add(distinct, 'variacao', ref);
  }

  // Grupos com um termo em comum viram um só ("NFS-e = Nota Fiscal..." + "NFS-e = nfse")
  const order = { definida: 0, iniciais: 1, variacao: 2 };
  const merged: GlossarySuggestion[] = [];
  for (const s of [...out.values()].sort((a, b) => order[a.reason] - order[b.reason])) {
    const keys = new Set(s.terms.map(t => norm(t)));
    const into = merged.find(m => m.terms.some(t => keys.has(norm(t))));
    if (!into) { merged.push({ ...s, terms: [...s.terms], refs: [...s.refs] }); continue; }
    for (const t of s.terms) if (!into.terms.some(x => norm(x) === norm(t))) into.terms.push(t);
    for (const r of s.refs) if (!into.refs.includes(r)) into.refs.push(r);
    into.count += s.count;
  }

  // O que o glossário atual já cobre fica de fora
  const existing = parseGlossary(existingGlossary).map(g => new Set(g.terms.map(t => norm(t))));
  const covered = (s: GlossarySuggestion) => existing.some(set => s.terms.every(t => set.has(norm(t))));

  return merged
    .filter(s => !covered(s))
    .sort((a, b) => order[a.reason] - order[b.reason] || b.count - a.count)
    .slice(0, 60);
}
