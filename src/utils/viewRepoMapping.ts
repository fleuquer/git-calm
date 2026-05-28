/**
 * Gerenciamento de mapeamento View (Guia) → Repositórios
 * Permite associar views do projeto com repositórios específicos
 */

export interface ViewRepoMapping {
  viewId: string;
  repos: string[];
}

const STORAGE_KEY = 'github-project-view-repo-mapping';

export function loadViewRepoMapping(): ViewRepoMapping[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Erro ao carregar mapeamento de views:', error);
    return [];
  }
}

export function saveViewRepoMapping(mappings: ViewRepoMapping[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.error('Erro ao salvar mapeamento de views:', error);
  }
}

export function getReposForView(viewId: string): string[] {
  const mappings = loadViewRepoMapping();
  const mapping = mappings.find(m => m.viewId === viewId);
  return mapping?.repos || [];
}
