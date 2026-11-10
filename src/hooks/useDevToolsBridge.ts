import { useSyncExternalStore } from 'react';
import { getDevToolsBridgeState, subscribeDevToolsBridge } from '../services/devtoolsBridge';

/** Estado da ponte com o devTools (status e notas). */
export function useDevToolsBridge() {
  return useSyncExternalStore(subscribeDevToolsBridge, getDevToolsBridgeState, getDevToolsBridgeState);
}
