import React, { useState } from 'react';
import { Filter, X, Eye, EyeOff } from 'lucide-react';

interface Props {
  allLabels: string[];
  hiddenLabels: string[];
  onToggleLabel: (label: string) => void;
  activeViewId?: string;
}

// Labels que são ocultadas automaticamente por contexto
const CONTEXT_LABELS: { [key: string]: string[] } = {
  'web': ['web', 'frontend', 'front-end'],
  'qa': ['qa', 'quality', 'teste', 'testes'],
  'desk': ['desk', 'suporte', 'atendimento'],
  'fast': ['fast', 'bi', 'business intelligence'],
  'bi': ['fast', 'bi', 'business intelligence'],
};

// Função para verificar se label está oculta por contexto
function isContextHidden(labelName: string, activeViewId?: string): boolean {
  if (!activeViewId) return false;

  const viewKey = activeViewId.toLowerCase();
  const contextLabels = CONTEXT_LABELS[viewKey] || [];

  return contextLabels.some(contextLabel =>
    labelName.toLowerCase().includes(contextLabel)
  );
}

export const LabelFilter: React.FC<Props> = ({ allLabels, hiddenLabels, onToggleLabel, activeViewId }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Filtrar labels que não são de tipo nem cidade
  const filterableLabels = allLabels.filter(label => {
    const isType = /^[1-4]-/.test(label);
    const isCity = /^[A-Z]{2}-/.test(label);
    return !isType && !isCity;
  });

  // Ordenar: ocultas primeiro, depois visíveis (ambos alfabeticamente)
  const sortedLabels = filterableLabels.sort((a, b) => {
    const aManuallyHidden = hiddenLabels.includes(a);
    const bManuallyHidden = hiddenLabels.includes(b);
    const aAutoHidden = isContextHidden(a, activeViewId);
    const bAutoHidden = isContextHidden(b, activeViewId);
    const aHidden = aManuallyHidden || aAutoHidden;
    const bHidden = bManuallyHidden || bAutoHidden;

    // Ocultas primeiro
    if (aHidden && !bHidden) return -1;
    if (!aHidden && bHidden) return 1;

    // Dentro do mesmo grupo, ordem alfabética
    return a.localeCompare(b);
  });

  // Contar labels ocultas (manual + contexto)
  const totalHidden = filterableLabels.filter(label =>
    hiddenLabels.includes(label) || isContextHidden(label, activeViewId)
  ).length;

  if (filterableLabels.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          totalHidden > 0
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        title="Filtrar labels"
      >
        <Filter size={14} />
        <span>Labels</span>
        {totalHidden > 0 && (
          <span className="bg-blue-600 dark:bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
            {totalHidden}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-30 w-72 max-h-96 overflow-y-auto">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Visibilidade das Labels
                </span>
                {hiddenLabels.length > 0 && (
                  <button
                    onClick={() => {
                      hiddenLabels.forEach(label => onToggleLabel(label));
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Mostrar Todas
                  </button>
                )}
              </div>
            </div>

            <div className="p-1">
              {sortedLabels.map((label) => {
                const isManuallyHidden = hiddenLabels.includes(label);
                const isAutoHidden = isContextHidden(label, activeViewId);
                const isHidden = isManuallyHidden || isAutoHidden;

                return (
                  <button
                    key={label}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLabel(label);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      isHidden
                        ? 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 text-gray-700 dark:text-gray-300'
                    }`}
                    title={isAutoHidden ? `Oculta automaticamente na view "${activeViewId}" - Clique para forçar exibição` : 'Clique para ocultar/exibir'}
                  >
                    {isHidden ? (
                      <EyeOff size={12} className="shrink-0 text-gray-400" />
                    ) : (
                      <Eye size={12} className="shrink-0 text-green-500" />
                    )}
                    <span className={`flex-1 truncate text-left ${isHidden ? 'line-through' : ''}`}>
                      {label}
                    </span>
                    {isAutoHidden && (
                      <span className="shrink-0 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">
                        auto
                      </span>
                    )}
                    {isManuallyHidden && !isAutoHidden && (
                      <X size={12} className="shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
