/**
 * Gerenciamento de mapeamento de tags→repos configurado pelo usuário
 * Armazenado no localStorage para persistência
 */

export interface UserRepoMapping {
  tag: string;
  repos: string[];
}

const STORAGE_KEY = 'github-project-tag-repo-mapping';

/**
 * Carrega mapeamento do localStorage
 */
export function loadUserRepoMapping(): UserRepoMapping[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Erro ao carregar mapeamento:', error);
    return [];
  }
}

/**
 * Salva mapeamento no localStorage
 */
export function saveUserRepoMapping(mappings: UserRepoMapping[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.error('Erro ao salvar mapeamento:', error);
  }
}

/**
 * Adiciona ou atualiza um mapeamento de tag
 */
export function updateTagMapping(tag: string, repos: string[]): void {
  const mappings = loadUserRepoMapping();
  const existingIndex = mappings.findIndex(m => m.tag.toLowerCase() === tag.toLowerCase());

  if (existingIndex >= 0) {
    mappings[existingIndex].repos = repos;
  } else {
    mappings.push({ tag, repos });
  }

  saveUserRepoMapping(mappings);
}

/**
 * Remove um mapeamento de tag
 */
export function deleteTagMapping(tag: string): void {
  const mappings = loadUserRepoMapping();
  const filtered = mappings.filter(m => m.tag.toLowerCase() !== tag.toLowerCase());
  saveUserRepoMapping(filtered);
}

/**
 * Obtém repos relacionados com base nas tags (usando mapeamento do usuário)
 */
export function getReposForTags(tags: string[]): string[] {
  const mappings = loadUserRepoMapping();
  const relatedRepos = new Set<string>();

  // Normalizar tags (lowercase)
  const normalizedTags = tags.map(t => t.toLowerCase());

  for (const mapping of mappings) {
    if (normalizedTags.includes(mapping.tag.toLowerCase())) {
      mapping.repos.forEach(repo => relatedRepos.add(repo));
    }
  }

  return Array.from(relatedRepos);
}

/**
 * Filtra lista de repos usando o mapeamento do usuário
 */
export function filterReposByUserMapping(
  allRepos: string[],
  tags: string[]
): string[] {
  const relatedRepos = getReposForTags(tags);

  if (relatedRepos.length === 0) {
    // Sem mapeamento configurado, retornar todos
    return allRepos;
  }

  // Filtrar apenas repos que existem na org
  return relatedRepos.filter(repo => allRepos.includes(repo));
}
