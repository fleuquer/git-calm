import { loadGlossary } from './glossary';

/**
 * Semelhança entre cards por texto (issue #11, etapa sem IA): termos importantes do título e da
 * descrição, com peso maior para o que é raro entre os cards comparados (TF-IDF) e para o título.
 * Tudo roda no navegador; nada sai do git-calm além da busca do próprio GitHub.
 */

// palavras que não dizem do que o card trata (gramática e títulos comuns de template)
const STOP = new Set(`
a o as os um uma uns umas de do da dos das no na nos nas em ao aos à às por pelo pela pelos pelas para pra pro com sem
sob sobre entre ate apos antes depois e ou mas nem que se nao sim ja so mais menos muito muita muitos muitas pouco
este esta estes estas esse essa esses essas isto isso aquele aquela aqueles aquelas aqui ali la lo le lhe lhes
eu tu ele ela nos vos eles elas meu minha meus minhas seu sua seus suas nosso nossa dele dela deles delas
ser estar ter haver fazer foi era sao sera seria esta estao estava tem tinha ha havia faz fez pode podem deve devem
quando onde como qual quais quem cujo porque pois entao assim tambem ainda apenas cada todo toda todos todas outro outra
outros outras mesmo mesma tal tais algum alguma alguns algumas nenhum nenhuma qualquer vez vezes caso forma
favor gentileza obrigado obrigada att bom dia tarde noite ola prezado prezados segue seguem conforme abaixo acima anexo
descricao problema solucao alteracao trabalho executado esperado resultado atual passos reproduzir ambiente observacao
observacoes informacoes demanda solicitacao solicitado solicita card issue github link print imagem image anexado
ajuste ajustar ajustes corrigir correcao correcoes alterar alteracoes verificar verificacao melhoria melhorias melhorar
implementar implementacao criar criacao incluir inclusao adicionar permitir necessario necessidade possivel referente
the and for with from this that are was were have has not but you your
`.split(/\s+/).filter(Boolean));

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Singular aproximado, para "guias"/"guia" e "emissões"/"emissão" baterem */
function stem(w: string): string {
  if (w.length <= 4) return w;
  if (w.endsWith('oes') || w.endsWith('aes')) return w.slice(0, -3) + 'ao';
  if (w.endsWith('ais')) return w.slice(0, -3) + 'al';
  if (w.endsWith('eis')) return w.slice(0, -3) + 'el';
  if (w.endsWith('ns')) return w.slice(0, -2) + 'm';
  if (w.endsWith('es') && /[rsz]es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/** Texto do card sem código, links, imagens e marcação */
function clean(md: string): string {
  return md
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

/** Grupos do glossário já normalizados, com a expressão regular de cada termo (aceita plural) */
function glossaryPatterns(): Array<{ token: string; res: RegExp[] }> {
  return loadGlossary().map((g, i) => ({
    token: `zglos${i}q`,
    res: g.terms
      .map(t => normalize(t).replace(/[^a-z0-9]+/g, ' ').trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(t => new RegExp(`(^|[^a-z0-9])${t.split(' ').join('[^a-z0-9]+')}(?:e?s)?(?=[^a-z0-9]|$)`, 'g')),
  }));
}

/** Palavras do texto; expressões do glossário viram um termo só ("g:N") */
export function tokenize(text: string): string[] {
  let norm = normalize(clean(text));
  for (const g of glossaryPatterns()) for (const re of g.res) norm = norm.replace(re, `$1 ${g.token} `);
  return norm
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w))
    .map(w => (/^zglos\d+q$/.test(w) ? `g:${w.slice(5, -1)}` : stem(w)))
    .filter(w => !STOP.has(w));
}

/**
 * Nomes técnicos citados no card (tabela sis_pessoa, arquivo gera_pdf.php, rota
 * /administrativo/processos, classe GeraPdf): dois cards que citam o mesmo nome provavelmente
 * mexem na mesma coisa. Lidos também de dentro de blocos de código.
 */
export function identifiers(text: string): string[] {
  const t = text.replace(/https?:\/\/\S+/g, ' ');
  const out: string[] = [];
  const add = (re: RegExp) => { for (const m of t.matchAll(re)) out.push(m[0].toLowerCase().replace(/^\/+|\/+$/g, '')); };
  add(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi); // snake_case: tabelas, colunas, funções
  add(/\b[\w-]+\.(?:php|js|ts|tsx|jsx|py|rb|java|cs|sql|vue|html|twig|blade|css|scss|xml|json|yml|yaml)\b/gi); // arquivos
  add(/(?:\/[a-z0-9_-]+){2,}\/?/gi); // rotas e caminhos
  add(/\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/g); // CamelCase: classes, telas
  return out.filter(x => x.length >= 5);
}

/** Campos que dizem do que o card trata (prioridade, sprint etc. ficam de fora) */
const SKIP_FIELD = /priorid|status|estimat|sprint|itera|tamanho|size|esfor|pontos|prazo/i;

/**
 * Campos do card para reforçar a semelhança: campos do quadro (Sistema, Área...), cidade,
 * etiquetas (menos as de tipo, como "1-Erro") e repositório.
 */
export function cardMeta(c: { repo?: string; fields?: Record<string, string>; labels?: Array<{ name: string }> }): string[] {
  const meta: string[] = [];
  for (const [k, v] of Object.entries(c.fields ?? {})) if (v && !SKIP_FIELD.test(k)) meta.push(`${k}: ${v}`);
  for (const l of c.labels ?? []) {
    if (/^[1-4]-/.test(l.name)) continue;
    meta.push(/^[A-Z]{2}-/.test(l.name) ? `Cidade: ${l.name.slice(3)}` : `Etiqueta: ${l.name}`);
  }
  if (c.repo) meta.push(`Repositório: ${c.repo}`);
  return meta;
}

/**
 * Card a comparar. meta: campos do quadro e do GitHub ("Sistema: Arrecadação", "Repositório:
 * tiflux"), que reforçam a semelhança mas sozinhos não fazem dois cards parecidos.
 */
export interface Doc { title: string; body?: string; meta?: string[] }

/** Frequência dos termos do card, com o título valendo o triplo */
function termFreq(d: Doc): Map<string, number> {
  const tf = new Map<string, number>();
  const inc = (k: string, n: number) => tf.set(k, (tf.get(k) ?? 0) + n);
  // descrição longa não deve dominar: só o começo dela
  const body = (d.body ?? '').slice(0, 4000);
  for (const w of tokenize(d.title)) inc(w, 3);
  for (const w of tokenize(body)) inc(w, 1);
  // nome técnico pesa bastante, mas repetir muito não multiplica
  const ids = new Map<string, number>();
  for (const id of identifiers(`${d.title}\n${body}`)) ids.set(id, Math.min((ids.get(id) ?? 0) + 3, 9));
  ids.forEach((n, id) => inc(`i:${id}`, n));
  for (const m of d.meta ?? []) if (m.trim()) inc(`m:${m.trim()}`, 2);
  return tf;
}

/** Palavra original mais comum para cada termo (para mostrar "guia" e não "gui") */
function displayWords(docs: Doc[]): Map<string, string> {
  const seen = new Map<string, Map<string, number>>();
  for (const d of docs) {
    // palavra como foi escrita (com acento), agrupada pelo termo normalizado
    for (const raw of clean(`${d.title} ${(d.body ?? '').slice(0, 4000)}`).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (raw.length < 3) continue;
      const t = stem(normalize(raw));
      const m = seen.get(t) ?? new Map<string, number>();
      m.set(raw, (m.get(raw) ?? 0) + 1);
      seen.set(t, m);
    }
  }
  const out = new Map<string, string>();
  seen.forEach((m, t) => out.set(t, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]));
  return out;
}

function display(t: string, words: Map<string, string>): string {
  if (t.startsWith('g:')) return loadGlossary()[Number(t.slice(2))]?.label ?? t;
  if (t.startsWith('i:') || t.startsWith('m:')) return t.slice(2);
  return words.get(t) ?? t;
}

export interface Match<T> {
  item: T;
  /** 0 a 1 */
  score: number;
  /** Termos e nomes técnicos em comum que mais pesaram, para explicar a sugestão */
  shared: string[];
  /** Campos iguais ("Sistema: Arrecadação") */
  sameFields: string[];
}

/**
 * Ordena os candidatos pela semelhança com o card (cosseno de TF-IDF). O IDF é calculado sobre
 * o próprio conjunto comparado, então termo que aparece em quase todo card pesa pouco.
 */
export function rankSimilar<T extends Doc>(target: Doc, candidates: T[], opts: { min?: number; limit?: number } = {}): Match<T>[] {
  const { min = 0.12, limit = 5 } = opts;
  const docs = [target, ...candidates];
  const tfs = docs.map(termFreq);
  const df = new Map<string, number>();
  for (const tf of tfs) for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const idf = (t: string) => Math.log(1 + n / (df.get(t) ?? 1));
  const vec = (tf: Map<string, number>) => {
    const v = new Map<string, number>();
    let norm = 0;
    // nome técnico em comum (mesma tabela, arquivo, rota) vale mais que palavra comum
    tf.forEach((f, t) => { const w = (1 + Math.log(f)) * idf(t) * (t.startsWith('i:') ? 2 : 1); v.set(t, w); norm += w * w; });
    return { v, norm: Math.sqrt(norm) || 1 };
  };
  const tv = vec(tfs[0]);
  const words = displayWords(docs);

  return candidates
    .map((item, i) => {
      const cv = vec(tfs[i + 1]);
      let dot = 0;
      const contrib: Array<[string, number]> = [];
      tv.v.forEach((w, t) => {
        const o = cv.v.get(t);
        if (o) { dot += w * o; contrib.push([t, w * o]); }
      });
      contrib.sort((a, b) => b[1] - a[1]);
      const textual = contrib.filter(([t]) => !t.startsWith('m:'));
      return {
        item,
        score: dot / (tv.norm * cv.norm),
        shared: textual.slice(0, 4).map(([t]) => display(t, words)),
        sameFields: contrib.filter(([t]) => t.startsWith('m:')).map(([t]) => display(t, words)),
        nText: textual.length,
        nAll: contrib.length,
        strongId: textual.some(([t]) => t.startsWith('i:')),
      };
    })
    // pelo menos dois pontos em comum, e ao menos um no texto (mesmo sistema sozinho não basta);
    // um nome técnico em comum já vale como texto
    .filter(m => m.score >= min && m.nAll >= 2 && (m.nText >= 2 || (m.nText >= 1 && (m.strongId || m.sameFields.length > 0))))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, score, shared, sameFields }) => ({ item, score, shared, sameFields }));
}

/** Termos mais característicos do card, para buscar parecidos no GitHub */
export function keyTerms(target: Doc, limit = 5): string[] {
  const tf = termFreq({ title: target.title, body: target.body });
  const words = displayWords([target]);
  return [...tf.entries()]
    // nome técnico primeiro: é o que mais acha card da mesma tela/tabela
    .sort((a, b) => Number(b[0].startsWith('i:')) - Number(a[0].startsWith('i:')) || b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([t]) => display(t, words));
}
