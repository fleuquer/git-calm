// Mecanismo genérico para preferências de UI que o usuário pode optar por não persistir.
// O próprio toggle (chave abaixo) é sempre salvo — ele controla a si mesmo.
const SAVE_PREFERENCES_KEY = 'github_save_ui_preferences';

export function getSavePreferencesEnabled(): boolean {
  const saved = localStorage.getItem(SAVE_PREFERENCES_KEY);
  return saved === null ? true : saved === 'true';
}

export function setSavePreferencesEnabled(enabled: boolean): void {
  localStorage.setItem(SAVE_PREFERENCES_KEY, String(enabled));
}

// Só lê do localStorage se o usuário optou por salvar preferências; caso contrário retorna o fallback.
export function loadPreference<T>(key: string, fallback: T): T {
  if (!getSavePreferencesEnabled()) return fallback;
  const saved = localStorage.getItem(key);
  if (saved === null) return fallback;
  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

// Só grava no localStorage se o usuário optou por salvar preferências.
export function savePreference<T>(key: string, value: T): void {
  if (!getSavePreferencesEnabled()) return;
  localStorage.setItem(key, JSON.stringify(value));
}
