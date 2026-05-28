import React, { useState } from 'react';
import { X, Filter, Eye, EyeOff, Search } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Agrupamento
  groupBy: 'none' | 'person' | 'tag' | 'priority' | 'city';
  onGroupByChange: (groupBy: 'none' | 'person' | 'tag' | 'priority' | 'city') => void;
  // Filtros de labels
  hiddenLabels: string[];
  onToggleLabel: (label: string) => void;
  allLabels: string[];
  activeViewId: string;
  viewHiddenLabels: string[]; // Labels ocultas pela view por padrão
  forceVisibleLabels: string[]; // Labels da view que o usuário forçou a exibir
}

export const FilterPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  groupBy,
  onGroupByChange,
  hiddenLabels,
  onToggleLabel,
  allLabels,
  activeViewId,
  viewHiddenLabels,
  forceVisibleLabels,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Filtrar labels que não são de tipo nem cidade
  const filterableLabels = allLabels.filter(label => {
    const isType = /^[1-4]-/.test(label);
    const isCity = /^[A-Z]{2}-/.test(label);
    return !isType && !isCity;
  });

  // Filtrar por termo de busca
  const filteredLabels = filterableLabels.filter(label =>
    label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ordenar: ocultas primeiro, depois visíveis (ambos alfabeticamente)
  const sortedLabels = filteredLabels.sort((a, b) => {
    const aManuallyHidden = hiddenLabels.includes(a);
    const bManuallyHidden = hiddenLabels.includes(b);
    const aViewHidden = viewHiddenLabels.includes(a);
    const bViewHidden = viewHiddenLabels.includes(b);
    const aForcedVisible = forceVisibleLabels.includes(a);
    const bForcedVisible = forceVisibleLabels.includes(b);

    // Label está OCULTA se manualmente oculta OU (view oculta E não foi forçada a exibir)
    const aHidden = aManuallyHidden || (aViewHidden && !aForcedVisible);
    const bHidden = bManuallyHidden || (bViewHidden && !bForcedVisible);

    // Ocultas primeiro
    if (aHidden && !bHidden) return -1;
    if (!aHidden && bHidden) return 1;

    // Dentro do mesmo grupo, ordem alfabética
    return a.localeCompare(b);
  });

  // Contar labels ocultas (manual + view - forçadas a exibir)
  const totalHidden = filterableLabels.filter(label => {
    const manuallyHidden = hiddenLabels.includes(label);
    const viewHidden = viewHiddenLabels.includes(label);
    const forcedVisible = forceVisibleLabels.includes(label);
    // Oculta se está manualmente oculta OU se está na view e não foi forçada a exibir
    return manuallyHidden || (viewHidden && !forcedVisible);
  }).length;

  const visibleCount = filterableLabels.length - totalHidden;  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-end p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-700 dark:text-gray-300" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Filtros</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Agrupamento */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Agrupamento
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onGroupByChange('none')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  groupBy === 'none'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Nenhum
              </button>
              <button
                onClick={() => onGroupByChange('person')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  groupBy === 'person'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Pessoa
              </button>
              <button
                onClick={() => onGroupByChange('tag')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  groupBy === 'tag'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Tag
              </button>
              <button
                onClick={() => onGroupByChange('priority')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  groupBy === 'priority'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Prioridade
              </button>
              <button
                onClick={() => onGroupByChange('city')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  groupBy === 'city'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Cidade
              </button>
            </div>
          </div>

          {/* Filtro de Labels */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Labels Visíveis
              </h3>
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

            {/* Busca */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar labels..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Lista de Labels */}
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {sortedLabels.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {searchTerm ? 'Nenhuma label encontrada' : 'Nenhuma label disponível'}
                </p>
              ) : (
                sortedLabels.map((label) => {
                  const isManuallyHidden = hiddenLabels.includes(label);
                  const isViewHidden = viewHiddenLabels.includes(label);
                  const isForcedVisible = forceVisibleLabels.includes(label);

                  // Label está OCULTA se:
                  // - Foi manualmente oculta pelo usuário OU
                  // - Está oculta pela view E não foi forçada a exibir
                  const isHidden = isManuallyHidden || (isViewHidden && !isForcedVisible);

                  // Label tem badge "auto" se está oculta pela view mas não foi manualmente alterada
                  const isAutoHidden = isViewHidden && !isForcedVisible && !isManuallyHidden;

                  return (
                    <button
                      key={label}
                      onClick={() => onToggleLabel(label)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isHidden
                          ? 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                          : 'bg-green-50 dark:bg-green-900/20 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                      }`}
                      title={isAutoHidden ? `Oculta automaticamente na view "${activeViewId}" - Clique para forçar exibição` : 'Clique para ocultar/exibir'}
                    >
                      {isHidden ? (
                        <EyeOff size={16} className="shrink-0 text-gray-400" />
                      ) : (
                        <Eye size={16} className="shrink-0 text-green-600 dark:text-green-400" />
                      )}
                      <span className={`flex-1 truncate text-left ${isHidden ? 'line-through' : ''}`}>
                        {label}
                      </span>
                      {isAutoHidden && (
                        <span className="shrink-0 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">
                          auto
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <div className="space-y-1">
                <div><strong>{visibleCount}</strong> de <strong>{filterableLabels.length}</strong> labels visíveis</div>
                {groupBy !== 'none' && (
                  <div className="text-blue-600 dark:text-blue-400">
                    Agrupamento: <strong>
                      {groupBy === 'person' ? 'Pessoa' :
                       groupBy === 'tag' ? 'Tag' :
                       groupBy === 'priority' ? 'Prioridade' :
                       'Cidade'}
                    </strong>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors font-medium text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
