import { useEffect, useState } from 'react';
import { loadPreference, savePreference } from '../utils/preferenceStorage';

/**
 * Filtros e escolhas de tela lembrados ao recarregar (dão a sensação de "o sistema lembra de mim").
 * Seguem a opção "Salvar preferências entre sessões" e são apagados ao sair, para quem entrar
 * depois no mesmo navegador não herdar os filtros de outra pessoa.
 */
export const FILTER_PREFERENCE_PREFIX = 'github_filtro_';

export function clearFilterPreferences(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(FILTER_PREFERENCE_PREFIX)) localStorage.removeItem(key);
  }
}

/** useState lembrado entre sessões (chave sem o prefixo, ex.: "etiqueta") */
export function usePreferenceState<T>(name: string, fallback: T) {
  const key = FILTER_PREFERENCE_PREFIX + name;
  const state = useState<T>(() => loadPreference<T>(key, fallback));
  useEffect(() => { savePreference(key, state[0]); }, [key, state[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** Conjunto lembrado entre sessões (guardado como lista) */
export function usePreferenceSet(name: string) {
  const key = FILTER_PREFERENCE_PREFIX + name;
  const state = useState<Set<string>>(() => {
    const saved = loadPreference<unknown>(key, []);
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  });
  useEffect(() => { savePreference(key, [...state[0]]); }, [key, state[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
