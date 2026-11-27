import { useSyncExternalStore } from 'react';
import { Users } from 'lucide-react';
import { getPresenceVisible, onPresenceVisibleChange, setPresenceVisible } from '../services/presence';

/** Configurações › Conta: aparecer (ou não) na lista de quem está online */
export function PresenceSetting() {
  const on = useSyncExternalStore(onPresenceVisibleChange, getPresenceVisible);
  return (
    <div className="col-span-full bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 space-y-1.5">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Users size={16} className={on ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} />
          Aparecer como online
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => setPresenceVisible(!on)}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Quem é da organização vê que você está com o git-calm aberto, em que tela e, se houver, qual card está aberto.
        Desligado, você não aparece e também não vê quem está online. Vale para este navegador.
      </p>
    </div>
  );
}
