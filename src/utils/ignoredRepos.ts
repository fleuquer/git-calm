/**
 * Gerenciamento de repositórios ignorados
 * Lista de repos que não devem ser considerados na busca inteligente
 */

const STORAGE_KEY = 'github-project-ignored-repos';

export function loadIgnoredRepos(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Erro ao carregar repositórios ignorados:', error);
    return [];
  }
}

export function saveIgnoredRepos(repos: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
  } catch (error) {
    console.error('Erro ao salvar repositórios ignorados:', error);
  }
}

export function isRepoIgnored(repo: string): boolean {
  const ignored = loadIgnoredRepos();
  return ignored.includes(repo);
}

export function addIgnoredRepo(repo: string): void {
  const ignored = loadIgnoredRepos();
  if (!ignored.includes(repo)) {
    ignored.push(repo);
    saveIgnoredRepos(ignored);
  }
}

export function removeIgnoredRepo(repo: string): void {
  const ignored = loadIgnoredRepos();
  const filtered = ignored.filter(r => r !== repo);
  saveIgnoredRepos(filtered);
}
