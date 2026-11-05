import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function getSnapshot() {
  return document.visibilityState !== 'hidden';
}

/**
 * Indica se a aba do app está visível. Usado para pausar as atualizações automáticas
 * (board, notificações, menções) enquanto o app está em segundo plano e economizar
 * requisições à API do GitHub.
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
