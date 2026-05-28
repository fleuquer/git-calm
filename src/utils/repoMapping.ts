import { getReposForTags } from './userRepoMapping';
import { getReposForView } from './viewRepoMapping';

/**
 * Mapeamento de tags/palavras-chave para repositórios
 *
 * Este arquivo permite configurar quais repositórios devem ser buscados
 * com base nas tags e palavras do título dos cards.
 *
 * Exemplo:
 * - Card com tag "App-Portal" ou título contendo "PORTAL"
 *   → busca em: minha-app-front, minha-app-api, etc.
 */

export interface RepoMappingRule {
  keywords: string[]; // Tags ou palavras-chave (case-insensitive)
  repos: string[];    // Lista de repositórios relacionados
}

/**
 * Regras de mapeamento
 * Configure aqui as relações entre palavras-chave (tags/títulos) e repositórios da sua organização.
 *
 * Exemplo:
 * {
 *   keywords: ['frontend', 'app-web'],
 *   repos: ['my-frontend-repo', 'my-ui-library']
 * }
 */
export const REPO_MAPPING_RULES: RepoMappingRule[] = [
  // Adicione suas regras aqui
];

/**
 * Extrai palavras-chave relevantes de um texto
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  // Converter para lowercase e remover caracteres especiais
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

  // Extrair palavras (mínimo 3 caracteres)
  const words = normalized.match(/\b\w{3,}\b/g) || [];

  return words;
}

/**
 * Encontra repositórios relacionados com base em título e tags
 */
export function findRelatedRepos(title: string, tags: string[]): string[] {
  const relatedRepos = new Set<string>();

  // Extrair keywords do título
  const titleKeywords = extractKeywords(title);

  // Normalizar tags (lowercase, sem acentos)
  const normalizedTags = tags.map(tag =>
    tag
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );

  // Combinar todas as keywords para busca
  const allKeywords = [...titleKeywords, ...normalizedTags];

  // Aplicar regras de mapeamento
  for (const rule of REPO_MAPPING_RULES) {
    for (const keyword of rule.keywords) {
      // Verificar se alguma keyword bate com a regra
      if (allKeywords.some(k => k.includes(keyword) || keyword.includes(k))) {
        rule.repos.forEach(repo => relatedRepos.add(repo));
        break; // Já encontrou match nesta regra
      }
    }
  }

  return Array.from(relatedRepos);
}

/**
 * Filtra uma lista de repositórios com base nas regras de prioridade
 * Prioridade:
 * 1) Mapeamento Tag → Repos (configurado pelo usuário)
 * 2) Mapeamento View → Repos (configurado pelo usuário)
 * 3) Retorna vazio (força configuração de mapeamento)
 */
export function filterReposByRules(
  allRepos: string[],
  tags: string[],
  currentViewId?: string
): string[] {
  // 1. PRIORIDADE MÁXIMA: Mapeamento de Tags configurado pelo usuário
  const userMappedRepos = getReposForTags(tags);
  if (userMappedRepos.length > 0) {
    console.log(`   👤 Usando mapeamento Tag→Repo: ${userMappedRepos.length} repos`);
    // Filtrar apenas repos que existem na org
    const filtered = userMappedRepos.filter(repo => allRepos.includes(repo));
    if (filtered.length > 0) {
      return filtered;
    }
  }

  // 2. PRIORIDADE MÉDIA: Mapeamento de View configurado pelo usuário
  if (currentViewId) {
    const viewMappedRepos = getReposForView(currentViewId);
    if (viewMappedRepos.length > 0) {
      console.log(`   📂 Usando mapeamento View→Repo: ${viewMappedRepos.length} repos`);
      // Filtrar apenas repos que existem na org
      const filtered = viewMappedRepos.filter(repo => allRepos.includes(repo));
      if (filtered.length > 0) {
        return filtered;
      }
    }
  }

  // 3. SEM MAPEAMENTO: Retornar vazio para forçar configuração
  console.log(`   ⚠️ Nenhum mapeamento configurado - configure em Configurações`);
  return [];
}

/**
 * Determina o repositório baseado nas branches
 * Extrai o nome do repo da URL da branch (ex: org/repo/branch)
 */
export function getRepoFromBranches(branches: string[]): string | null {
  if (!branches || branches.length === 0) {
    return null;
  }

  // Usar a primeira branch para determinar o repo
  const firstBranch = branches[0];

  // Tentar extrair repo de padrões comuns:
  // - repo/branch-name
  // - repo-branch-name
  // - apenas branch-name (assumir repo mais comum)

  // Padrão 1: Se tem "/" assume que é "repo/branch"
  if (firstBranch.includes('/')) {
    const parts = firstBranch.split('/');
    if (parts.length >= 2) {
      return parts[0];
    }
  }

  // Padrão 2: Tentar identificar por prefixo conhecido
  const knownPrefixes = [
    'mobile',
    'api',
    'front',
    'backend'
  ];

  for (const prefix of knownPrefixes) {
    if (firstBranch.toLowerCase().startsWith(prefix)) {
      return prefix;
    }
  }

  // Se não conseguiu identificar, retornar null
  return null;
}
