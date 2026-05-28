/**
 * Gerenciamento de grupos fictícios de repositórios para release
 *
 * Permite agrupar múltiplos repositórios que são versionados juntos
 * sob um nome customizado (ex: meu-modulo-front + meu-modulo-api → meu-modulo)
 */

export interface RepoGroup {
  id: string;
  name: string;    // Nome do grupo (ex: "meu-modulo")
  repos: string[]; // Repositórios reais que compõem o grupo
}

const STORAGE_KEY = 'psi_repo_groups';

export function loadRepoGroups(): RepoGroup[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Erro ao carregar grupos de repositórios:', error);
    return [];
  }
}

export function saveRepoGroups(groups: RepoGroup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error('Erro ao salvar grupos de repositórios:', error);
  }
}

/** Retorna o grupo ao qual um repositório pertence, ou null se não pertencer a nenhum */
export function findGroupForRepo(repo: string, groups: RepoGroup[]): RepoGroup | null {
  return groups.find(g => g.repos.includes(repo)) || null;
}
