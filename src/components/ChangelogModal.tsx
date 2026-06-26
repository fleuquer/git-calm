import { X } from "lucide-react";
import { CHANGELOG } from "../version";
import type { Change } from "../version";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function ChangePill({ type }: { type: Change["type"] }) {
  const config = {
    feat: {
      label: "Novo",
      cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    },
    fix: {
      label: "Correção",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    },
    improvement: {
      label: "Melhoria",
      cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    },
  }[type];

  return (
    <span
      className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.cls}`}
    >
      {config.label}
    </span>
  );
}

export function ChangelogModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              O que há de novo
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Histórico de versões
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-mono font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md">
                  v{entry.version}
                </span>
                {entry.label && (
                  <span className="text-sm px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full font-medium">
                    {entry.label}
                  </span>
                )}
                <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto">
                  {entry.date}
                </span>
              </div>

              <ul className="space-y-2">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <ChangePill type={change.type} />
                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {change.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
