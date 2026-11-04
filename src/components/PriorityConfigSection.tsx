import React, { useMemo, useState } from 'react';
import { Flag, Tag, ArrowUp, ArrowDown, X, Plus, Sparkles } from 'lucide-react';
import {
  getPriorityConfig,
  savePriorityConfig,
  getProjectSingleSelectFields,
  resolvePriorityField,
  detectPriorityLabels,
  type PriorityConfig,
} from '../utils/prioritySettings';

interface Props {
  availableLabels: string[];
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 italic">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((item, i) => (
        <React.Fragment key={item}>
          {i > 0 && <span className="text-gray-300 dark:text-gray-600 text-xs">›</span>}
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {item}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export const PriorityConfigSection: React.FC<Props> = ({ availableLabels }) => {
  const [config, setConfig] = useState<PriorityConfig>(getPriorityConfig);
  const [labelToAdd, setLabelToAdd] = useState('');
  const fields = getProjectSingleSelectFields();

  const update = (patch: Partial<PriorityConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    savePriorityConfig(next);
  };

  const activeField = resolvePriorityField(config, fields);
  const detectedLabels = useMemo(() => detectPriorityLabels(availableLabels), [availableLabels]);
  const selectableLabels = availableLabels.filter(l => !config.labels.includes(l));

  const fieldSelectValue = config.fieldMode === 'custom' ? `custom:${config.fieldName}` : config.fieldMode;

  const moveLabel = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= config.labels.length) return;
    const labels = [...config.labels];
    [labels[index], labels[target]] = [labels[target], labels[index]];
    update({ labels });
  };

  const addLabel = () => {
    if (!labelToAdd) return;
    update({ labels: [...config.labels, labelToAdd] });
    setLabelToAdd('');
  };

  // Ao passar para "personalizado" sem lista, começa pelas labels detectadas automaticamente
  const setLabelMode = (labelMode: PriorityConfig['labelMode']) => {
    const labels = labelMode === 'custom' && config.labels.length === 0 ? detectedLabels : config.labels;
    update({ labelMode, labels });
  };

  const inputClass = 'px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100';

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Prioridade dos cards</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Usada na opção "Prioridade" da ordenação das colunas. O GitHub não tem uma prioridade padrão nas issues,
          então ela pode vir de um campo do Project (como o "Priority" dos templates do GitHub) ou de labels.
          Quando o card tem valor no campo, ele prevalece sobre as labels. Cards sem prioridade ficam por último.
        </p>
      </div>

      {/* Campo do Project */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Flag size={15} className="text-blue-500" />
          <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Campo do Project</h5>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Campo de seleção única. A ordem das opções no Project define a prioridade: a primeira é a mais alta.
        </p>
        <select
          value={fieldSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith('custom:')) update({ fieldMode: 'custom', fieldName: v.slice(7) });
            else update({ fieldMode: v as PriorityConfig['fieldMode'] });
          }}
          className={`${inputClass} w-full`}
        >
          <option value="auto">Detectar automaticamente (Priority / Prioridade)</option>
          {fields.map(f => (
            <option key={f.name} value={`custom:${f.name}`}>{f.name}</option>
          ))}
          {config.fieldMode === 'custom' && !fields.some(f => f.name === config.fieldName) && (
            <option value={`custom:${config.fieldName}`}>{config.fieldName} (não encontrado no Project)</option>
          )}
          <option value="none">Não usar campo</option>
        </select>
        {config.fieldMode !== 'none' && (
          activeField ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Usando <strong className="text-gray-700 dark:text-gray-300">{activeField.name}</strong>, da mais alta para a mais baixa:
              </p>
              <Chips items={activeField.options} empty="Campo sem opções." />
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              {fields.length === 0
                ? 'Este Project não tem campos de seleção única além de Status.'
                : 'Nenhum campo de prioridade encontrado neste Project. Escolha um campo na lista ou use labels.'}
            </p>
          )
        )}
      </div>

      {/* Labels */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Tag size={15} className="text-blue-500" />
          <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Labels de prioridade</h5>
        </div>
        <div className="flex flex-wrap gap-1 p-0.5 bg-gray-100 dark:bg-gray-700/60 rounded-lg w-fit">
          {([
            ['auto', 'Automático'],
            ['custom', 'Personalizado'],
            ['none', 'Não usar'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setLabelMode(mode)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                config.labelMode === mode
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {config.labelMode === 'auto' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Reconhece padrões comuns: <span className="font-mono">P0</span>, <span className="font-mono">P1</span>…,
              {' '}<span className="font-mono">priority: high</span>, <span className="font-mono">prioridade: alta</span>,
              {' '}<span className="font-mono">urgente</span>, <span className="font-mono">crítico</span> e
              prefixo numérico (<span className="font-mono">1-Erro</span>, <span className="font-mono">2-Problema</span>…).
            </p>
            <div className="flex items-start gap-1.5">
              <Sparkles size={13} className="text-gray-400 mt-0.5 shrink-0" />
              <Chips items={detectedLabels} empty="Nenhuma label reconhecida nos cards carregados." />
            </div>
          </div>
        )}

        {config.labelMode === 'custom' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ordene da mais alta para a mais baixa. Se o card tiver mais de uma, vale a mais alta.
            </p>
            {config.labels.length > 0 && (
              <ol className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                {config.labels.map((label, i) => (
                  <li key={label} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="w-5 text-xs text-gray-400 tabular-nums">{i + 1}.</span>
                    <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{label}</span>
                    {!availableLabels.includes(label) && (
                      <span className="text-[10px] text-gray-400" title="Nenhum card carregado usa esta label">não usada</span>
                    )}
                    <button onClick={() => moveLabel(i, -1)} disabled={i === 0} title="Subir"
                      className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none">
                      <ArrowUp size={13} />
                    </button>
                    <button onClick={() => moveLabel(i, 1)} disabled={i === config.labels.length - 1} title="Descer"
                      className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none">
                      <ArrowDown size={13} />
                    </button>
                    <button onClick={() => update({ labels: config.labels.filter(l => l !== label) })} title="Remover"
                      className="p-1 rounded text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex items-center gap-2">
              <select value={labelToAdd} onChange={(e) => setLabelToAdd(e.target.value)} className={`${inputClass} flex-1 min-w-0`}>
                <option value="">Adicionar label…</option>
                {selectableLabels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <button
                onClick={addLabel}
                disabled={!labelToAdd}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm shrink-0"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
