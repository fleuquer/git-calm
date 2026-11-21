import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { devToolsNotificationsEnabled, setDevToolsNotificationsEnabled, startDevToolsBridge } from '../services/devtoolsBridge';

/** Configurações › Notificações: exibir as notificações que o devTools manda (tarefas, cards...). */
export function DevToolsNotificationsSetting() {
  const [on, setOn] = useState(devToolsNotificationsEnabled);
  const toggle = () => {
    const v = !on;
    setOn(v);
    setDevToolsNotificationsEnabled(v);
    if (v) startDevToolsBridge();
  };
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">devTools</p>
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Wrench size={15} className={on ? 'text-teal-500' : 'text-gray-400'} />
            Notificações do devTools
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={toggle}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Avisa o que o devTools faz sozinho, como issue nova nas tarefas ou card registrado no histórico; o clique abre a tela
          certa na aba devTools. Usa o popup do sistema quando o navegador permite e, senão, um aviso no canto da tela. Para
          isso, o devTools fica aberto em segundo plano depois que você já usou ele neste navegador.
        </p>
      </div>
    </div>
  );
}
