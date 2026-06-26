const STORAGE_KEY = 'psi_release_link_repo';

/** Retorna o repo fixo para os links da mensagem de release, ou '' se não configurado */
export function getReleaseLinkRepo(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveReleaseLinkRepo(repo: string): void {
  try {
    if (repo.trim()) {
      localStorage.setItem(STORAGE_KEY, repo.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // silencioso
  }
}
