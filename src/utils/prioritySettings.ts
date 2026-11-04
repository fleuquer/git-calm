import type { ProjectCard, ProjectSingleSelectField } from '../types';

/**
 * Prioridade dos cards, usada na ordenação visual das colunas.
 *
 * O GitHub não tem um conceito padrão de prioridade em issues: cada equipe usa labels com nomes
 * próprios. O que mais se aproxima de um padrão é o campo de seleção única "Priority" que vem nos
 * templates do GitHub Projects (opções P0, P1, P2...). Por isso a prioridade pode vir de duas fontes:
 *
 * 1. Campo do Project (seleção única): a ordem das opções no Project define a prioridade
 *    (primeira opção = mais alta). Por padrão detecta um campo chamado "Priority"/"Prioridade".
 * 2. Labels: lista ordenada definida pelo usuário (mais alta → mais baixa). Sem lista definida,
 *    detecta padrões comuns (P0/P1, "priority: high", "prioridade: alta", "urgente", "1-...").
 *
 * Quando o card tem valor no campo, ele prevalece; senão vale a label.
 */

const PRIORITY_CONFIG_KEY = 'github_priority_config';

export type PriorityFieldMode = 'auto' | 'custom' | 'none';
export type PriorityLabelMode = 'auto' | 'custom' | 'none';

export interface PriorityConfig {
  fieldMode: PriorityFieldMode;
  fieldName: string;
  labelMode: PriorityLabelMode;
  labels: string[]; // Da mais alta para a mais baixa
}

export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  fieldMode: 'auto',
  fieldName: '',
  labelMode: 'auto',
  labels: [],
};

let cachedConfig: PriorityConfig | null = null;
let projectFields: ProjectSingleSelectField[] = [];

export function getPriorityConfig(): PriorityConfig {
  if (cachedConfig) return cachedConfig;
  try {
    const saved = localStorage.getItem(PRIORITY_CONFIG_KEY);
    cachedConfig = saved ? { ...DEFAULT_PRIORITY_CONFIG, ...JSON.parse(saved) } : DEFAULT_PRIORITY_CONFIG;
  } catch {
    cachedConfig = DEFAULT_PRIORITY_CONFIG;
  }
  return cachedConfig!;
}

export function savePriorityConfig(config: PriorityConfig): void {
  cachedConfig = config;
  try {
    localStorage.setItem(PRIORITY_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // localStorage indisponível: mantém só em memória
  }
}

/** Campos de seleção única do Project carregado (atualizado a cada carga do board). */
export function setProjectSingleSelectFields(fields: ProjectSingleSelectField[] | undefined): void {
  projectFields = fields ?? [];
}

export function getProjectSingleSelectFields(): ProjectSingleSelectField[] {
  return projectFields;
}

const AUTO_FIELD_NAME = /^\s*(priority|prioridade|prioridades|prio)\s*$/i;

/** Campo do Project usado como prioridade, conforme a configuração (ou null). */
export function resolvePriorityField(
  config: PriorityConfig = getPriorityConfig(),
  fields: ProjectSingleSelectField[] = projectFields,
): ProjectSingleSelectField | null {
  if (config.fieldMode === 'none') return null;
  if (config.fieldMode === 'custom') return fields.find(f => f.name === config.fieldName) ?? null;
  return fields.find(f => AUTO_FIELD_NAME.test(f.name)) ?? null;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const LEVEL_WORDS: [RegExp, number][] = [
  [/\b(critical|critica|critico|blocker|bloqueante|urgent|urgente|highest|maxima|maximo)\b/, 0],
  [/\b(high|alta|alto)\b/, 1],
  [/\b(medium|media|medio|normal|moderate|moderada)\b/, 2],
  [/\b(low|baixa|baixo)\b/, 3],
  [/\b(lowest|minima|minimo|trivial)\b/, 4],
];

/** Detecção automática de labels de prioridade. Retorna o nível (menor = mais alta) ou null. */
export function autoLabelRank(labelName: string): number | null {
  const name = normalize(labelName);

  // P0, P1, "priority: p2", "prioridade/1"
  const pLevel = name.match(/^(?:(?:priority|prioridade|prio)\s*[:/\-_ ]\s*)?p\s*([0-9])$/)
    ?? name.match(/^(?:priority|prioridade|prio)\s*[:/\-_ ]\s*([0-9])$/);
  if (pLevel) return Number(pLevel[1]);

  // Prefixo numérico: "1-Erro", "2 - Problema"
  const numPrefix = name.match(/^([0-9])\s*-/);
  if (numPrefix) return Number(numPrefix[1]);

  const hasPriorityWord = /\b(priority|prioridade|prio)\b/.test(name);
  for (const [pattern, rank] of LEVEL_WORDS) {
    if (!pattern.test(name)) continue;
    // Palavras como "alta"/"baixa" só contam junto de "prioridade"; "urgente"/"crítico" valem sozinhas
    if (rank === 0 || hasPriorityWord) return rank;
  }
  return null;
}

function labelRank(card: ProjectCard, config: PriorityConfig): number | null {
  if (config.labelMode === 'none') return null;
  let best: number | null = null;
  for (const label of card.labels) {
    const rank = config.labelMode === 'custom'
      ? (() => { const i = config.labels.indexOf(label.name); return i >= 0 ? i : null; })()
      : autoLabelRank(label.name);
    if (rank !== null && (best === null || rank < best)) best = rank;
  }
  return best;
}

/**
 * Cria uma função que devolve o nível de prioridade do card (menor = mais alta; null = sem
 * prioridade). Resolver uma vez por ordenação evita reler a configuração a cada comparação.
 */
export function createPriorityResolver(): (card: ProjectCard) => number | null {
  const config = getPriorityConfig();
  const field = resolvePriorityField(config);
  return (card) => {
    if (field) {
      const value = card.fields?.[field.name];
      const index = value !== undefined ? field.options.indexOf(value) : -1;
      if (index >= 0) return index;
    }
    return labelRank(card, config);
  };
}

/** Labels disponíveis que a detecção automática reconhece, da mais alta para a mais baixa. */
export function detectPriorityLabels(availableLabels: string[]): string[] {
  return availableLabels
    .map(name => ({ name, rank: autoLabelRank(name) }))
    .filter((l): l is { name: string; rank: number } => l.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'pt-BR'))
    .map(l => l.name);
}
