import { useState } from 'react';
import { X, Plus, Trash2, Edit2, ArrowUp, ArrowDown, Download } from 'lucide-react';
import type { ViewTab } from '../types';

interface ViewManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  views: ViewTab[];
  onSaveViews: (views: ViewTab[]) => void;
  allStatuses: string[];
  allLabels: string[];
  inline?: boolean; // Modo inline para usar dentro de outro painel
}

export function ViewManagerModal({
  isOpen,
  onClose,
  views,
  onSaveViews,
  allStatuses,
  allLabels,
  inline = false
}: ViewManagerModalProps) {
  const [editingViews, setEditingViews] = useState<ViewTab[]>(views);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterInput, setFilterInput] = useState('');
  const [filterParseMsg, setFilterParseMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [formData, setFormData] = useState<Partial<ViewTab>>({
    name: '',
    icon: '📋',
    statuses: [],
    excludeStatuses: [],
    labels: [],
    excludeLabels: [],
    columnOrder: [],
    color: 'blue',
  });

  if (!isOpen) return null;

  const EMOJI_OPTIONS = [
    // Status & Resultado
    '✅', '❌', '⏳', '🔄', '⚠️', '🚫', '🆕', '🔜',
    // Prioridade & Urgência
    '🔥', '⚡', '🎯', '📌', '🚨', '📍', '🏁', '💥',
    // Desenvolvimento & Tecnologia
    '🐛', '💡', '🚀', '🔧', '🛠️', '⚙️', '💻', '🖥️',
    // Documentação & Planejamento
    '📋', '📝', '📄', '📖', '📊', '📈', '📉', '🗂️',
    // Times & Pessoas
    '👥', '👤', '🤝', '💼', '🏢', '👔', '🧑‍💻', '🎓',
    // Releases & Entregas
    '📦', '🏷️', '🚢', '🎁', '📤', '📥', '🏗️', '🧪',
    // Qualidade & Revisão
    '🔍', '✏️', '🏆', '⭐', '💎', '👁️', '🔒', '🛡️',
    // Comunicação & Organização
    '💬', '📢', '🔔', '📁', '📅', '🌐', '🌱', '🎉',
  ];

  const handleCreateOrEdit = () => {
    if (!formData.name?.trim()) return;

    const existingView = editingId ? editingViews.find(v => v.id === editingId) : null;

    const newView: ViewTab = {
      id: editingId || `custom-${Date.now()}`,
      name: formData.name,
      icon: formData.icon || '📋',
      statuses: formData.statuses,
      excludeStatuses: formData.excludeStatuses,
      labels: formData.labels,
      excludeLabels: formData.excludeLabels,
      columnOrder: formData.columnOrder,
      color: formData.color || 'blue',
      isCustom: existingView?.isCustom !== false,
      isDefault: existingView?.isDefault,
    };

    let updatedViews: ViewTab[];
    if (editingId) {
      updatedViews = editingViews.map(v => v.id === editingId ? newView : v);
    } else {
      updatedViews = [...editingViews, newView];
    }

    setEditingViews(updatedViews);
    setIsCreating(false);
    setEditingId(null);
    setFormData({
      name: '',
      icon: '📋',
      statuses: [],
      excludeStatuses: [],
      labels: [],
      excludeLabels: [],
      columnOrder: [],
      color: 'blue',
    });
  };

  const handleEdit = (view: ViewTab) => {
    setFormData({
      name: view.name,
      icon: view.icon,
      statuses: view.statuses || [],
      excludeStatuses: view.excludeStatuses || [],
      labels: view.labels || [],
      excludeLabels: view.excludeLabels || [],
      columnOrder: view.columnOrder || [],
      color: view.color || 'blue',
    });
    setEditingId(view.id);
    setIsCreating(true);
  };

  const handleDelete = (viewId: string) => {
    setEditingViews(editingViews.filter(v => v.id !== viewId));
  };

  const handleSave = () => {
    let viewsToSave = editingViews;

    if (isCreating && editingId && formData.name?.trim()) {
      const existingView = editingViews.find(v => v.id === editingId);

      const updatedView: ViewTab = {
        id: editingId,
        name: formData.name,
        icon: formData.icon || '📋',
        statuses: formData.statuses,
        excludeStatuses: formData.excludeStatuses,
        labels: formData.labels,
        excludeLabels: formData.excludeLabels,
        columnOrder: formData.columnOrder,
        color: formData.color || 'blue',
        isCustom: existingView?.isCustom !== false,
        isDefault: existingView?.isDefault,
      };

      viewsToSave = editingViews.map(v => v.id === editingId ? updatedView : v);
    }

    onSaveViews(viewsToSave);
    onClose();
  };

  const toggleArrayItem = (array: string[] | undefined, item: string): string[] => {
    const arr = array || [];
    if (arr.includes(item)) {
      return arr.filter(i => i !== item);
    }
    return [...arr, item];
  };

  const moveColumnUp = (index: number) => {
    if (index > 0 && formData.columnOrder) {
      const newOrder = [...formData.columnOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setFormData({ ...formData, columnOrder: newOrder });
    }
  };  const moveColumnDown = (index: number) => {
    if (formData.columnOrder && index < formData.columnOrder.length - 1) {
      const newOrder = [...formData.columnOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setFormData({ ...formData, columnOrder: newOrder });
    }
  };

    const removeColumnFromOrder = (columnId: string) => {
    const newOrder = (formData.columnOrder || []).filter(id => id !== columnId);
    setFormData({ ...formData, columnOrder: newOrder });
  };

  const addColumnToOrder = (columnId: string) => {
    if (!formData.columnOrder?.includes(columnId)) {
      const newOrder = [...(formData.columnOrder || []), columnId];
      setFormData({ ...formData, columnOrder: newOrder });
    }
  };

  const parseCSVValues = (str: string): string[] => {
    const result: string[] = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === '"') {
        i++;
        let val = '';
        while (i < str.length && str[i] !== '"') val += str[i++];
        i++;
        if (val.trim()) result.push(val.trim());
      } else {
        let val = '';
        while (i < str.length && str[i] !== ',') val += str[i++];
        if (val.trim()) result.push(val.trim());
      }
      if (i < str.length && str[i] === ',') i++;
    }
    return result;
  };

  const resetForm = () => {
    setIsCreating(false);
    setIsImporting(false);
    setEditingId(null);
    setFilterInput('');
    setFilterParseMsg(null);
    setFormData({
      name: '',
      icon: '📋',
      statuses: [],
      excludeStatuses: [],
      labels: [],
      excludeLabels: [],
      columnOrder: [],
      color: 'blue',
    });
  };

  const handleImportSubmit = () => {
    setFilterParseMsg(null);
    if (!formData.name?.trim()) {
      setFilterParseMsg({ type: 'error', text: 'Nome é obrigatório' });
      return;
    }
    const input = filterInput.trim();
    if (!input) {
      setFilterParseMsg({ type: 'error', text: 'Cole um filtro para importar' });
      return;
    }

    const newStatuses: string[] = [];
    const newLabels: string[] = [];

    const statusMatch = input.match(/status:((?:"[^"]*"|[^\s,"])+(?:,(?:"[^"]*"|[^\s,"])+)*)/);
    if (statusMatch) newStatuses.push(...parseCSVValues(statusMatch[1]));

    const labelMatch = input.match(/label:((?:"[^"]*"|[^\s,"])+(?:,(?:"[^"]*"|[^\s,"])+)*)/);
    if (labelMatch) newLabels.push(...parseCSVValues(labelMatch[1]));

    if (newStatuses.length === 0 && newLabels.length === 0) {
      setFilterParseMsg({ type: 'error', text: 'Nenhum status ou label encontrado. Exemplo: status:"A",B label:LABEL' });
      return;
    }

    const newView: ViewTab = {
      id: `custom-${Date.now()}`,
      name: formData.name,
      icon: formData.icon || '📋',
      statuses: newStatuses.length > 0 ? newStatuses : undefined,
      labels: newLabels.length > 0 ? newLabels : undefined,
      columnOrder: newStatuses.length > 0 ? newStatuses : undefined,
      color: formData.color || 'blue',
      isCustom: true,
    };

    setEditingViews(prev => [...prev, newView]);
    resetForm();
  };

  // Colunas disponíveis para ordenação (baseado nos status selecionados)
  const availableColumnsForOrder = (formData.statuses && formData.statuses.length > 0) ? formData.statuses : allStatuses;
  const orderedColumns = formData.columnOrder || [];
  const unorderedColumns = availableColumnsForOrder.filter(c => !orderedColumns.includes(c));

  // Modo inline (sem backdrop)
  if (inline) {
    return (
      <div className="space-y-4">
        {/* Lista de views */}
        {!isCreating && !isImporting && (
          <div className="space-y-3 mb-6">
            <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Suas Visualizações
            </h4>
            {editingViews.map((view) => (
              <div
                key={view.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{view.icon}</span>
                  <div>
                    <h5 className="font-medium text-gray-800 dark:text-white">
                      {view.name}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {view.statuses && view.statuses.length > 0 && `${view.statuses.length} status`}
                      {view.labels && view.labels.length > 0 && ` • ${view.labels.length} labels`}
                      {view.isDefault && ' • Padrão'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(view)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Editar visualização"
                  >
                    <Edit2 size={18} className="text-blue-600 dark:text-blue-400" />
                  </button>
                  {view.isCustom && (
                    <button
                      onClick={() => handleDelete(view.id)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Deletar visualização"
                    >
                      <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulário de criação/edição */}
        {isCreating ? (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300">
              {editingId ? 'Editar Visualização' : 'Nova Visualização'}
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nome da visualização"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ícone
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 max-h-24 overflow-y-auto">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: emoji })}
                    className={`text-lg p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 ${formData.icon === emoji ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="ou digite um emoji personalizado"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status para incluir
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                {allStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        statuses: toggleArrayItem(formData.statuses, status),
                      })
                    }
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      formData.statuses?.includes(status)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Labels para incluir
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                {allLabels.map((label) => (
                  <button
                    key={label}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        labels: toggleArrayItem(formData.labels, label),
                      })
                    }
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      formData.labels?.includes(label)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ordenação de Colunas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ordem das Colunas (opcional)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Defina a ordem em que as colunas aparecem. Colunas não ordenadas aparecerão no final.
              </p>

              {/* Colunas ordenadas */}
              {orderedColumns.length > 0 && (
                <div className="space-y-2 mb-3">
                  {orderedColumns.map((columnName, index) => (
                    <div
                      key={columnName}
                      className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
                        {index + 1}. {columnName}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveColumnUp(index)}
                          disabled={index === 0}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Mover para cima"
                        >
                          <ArrowUp size={16} className="text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => moveColumnDown(index)}
                          disabled={index === orderedColumns.length - 1}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Mover para baixo"
                        >
                          <ArrowDown size={16} className="text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => removeColumnFromOrder(columnName)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                          title="Remover da ordenação"
                        >
                          <X size={16} className="text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Colunas disponíveis para adicionar */}
              {unorderedColumns.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Clique para adicionar à ordenação:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unorderedColumns.map((columnName) => (
                      <button
                        key={columnName}
                        onClick={() => addColumnToOrder(columnName)}
                        className="px-3 py-1 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        + {columnName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateOrEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingId ? 'Salvar' : 'Criar'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : !isImporting ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { resetForm(); setIsCreating(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Nova Visualização
            </button>
            <button
              onClick={() => { resetForm(); setIsImporting(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Download size={20} />
              Importar Filtro
            </button>
          </div>
        ) : null}

        {/* Formulário de importação */}
        {isImporting && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300">
              Importar via Filtro do GitHub
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filtro do GitHub Projects
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Cole o filtro no formato: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">status:"A",B label:LABEL</code>
              </p>
              <textarea
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                rows={3}
                placeholder={'status:"Status A","Status B",StatusC label:LABEL'}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono resize-none"
              />
              {filterParseMsg && (
                <p className={`text-xs mt-1 ${filterParseMsg.type === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  {filterParseMsg.text}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome da Visualização
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nome da visualização"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ícone
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 max-h-24 overflow-y-auto">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: emoji })}
                    className={`text-lg p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 ${formData.icon === emoji ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="ou digite um emoji personalizado"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleImportSubmit}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Criar Visualização
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Footer inline */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    );
  }

  // Modo modal normal (com backdrop)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Gerenciar Visualizações
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Lista de views */}
          {!isCreating && !isImporting && (
            <div className="space-y-3 mb-6">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Suas Visualizações
              </h3>
              {editingViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{view.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white">
                        {view.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {view.statuses && view.statuses.length > 0 && `${view.statuses.length} status`}
                        {view.labels && view.labels.length > 0 && ` • ${view.labels.length} labels`}
                        {view.isDefault && ' • Padrão'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(view)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Editar visualização"
                    >
                      <Edit2 size={18} className="text-blue-600 dark:text-blue-400" />
                    </button>
                    {view.isCustom && (
                      <button
                        onClick={() => handleDelete(view.id)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Deletar visualização"
                      >
                        <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de criação/edição */}
          {isCreating ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                {editingId ? 'Editar Visualização' : 'Nova Visualização'}
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome da visualização"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ícone
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 max-h-24 overflow-y-auto">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: emoji })}
                      className={`text-lg p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 ${formData.icon === emoji ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : ''}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="ou digite um emoji personalizado"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status para incluir
                </label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                  {allStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          statuses: toggleArrayItem(formData.statuses, status),
                        })
                      }
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.statuses?.includes(status)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Labels para incluir
                </label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                  {allLabels.map((label) => (
                    <button
                      key={label}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          labels: toggleArrayItem(formData.labels, label),
                        })
                      }
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.labels?.includes(label)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ordenação de Colunas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ordem das Colunas (opcional)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Defina a ordem em que as colunas aparecem. Colunas não ordenadas aparecerão no final.
                </p>

                {/* Colunas ordenadas */}
                {orderedColumns.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {orderedColumns.map((columnName, index) => (
                      <div
                        key={columnName}
                        className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                      >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
                          {index + 1}. {columnName}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveColumnUp(index)}
                            disabled={index === 0}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Mover para cima"
                          >
                            <ArrowUp size={16} className="text-blue-600 dark:text-blue-400" />
                          </button>
                          <button
                            onClick={() => moveColumnDown(index)}
                            disabled={index === orderedColumns.length - 1}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Mover para baixo"
                          >
                            <ArrowDown size={16} className="text-blue-600 dark:text-blue-400" />
                          </button>
                          <button
                            onClick={() => removeColumnFromOrder(columnName)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                            title="Remover da ordenação"
                          >
                            <X size={16} className="text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Colunas disponíveis para adicionar */}
                {unorderedColumns.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Clique para adicionar à ordenação:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {unorderedColumns.map((columnName) => (
                        <button
                          key={columnName}
                          onClick={() => addColumnToOrder(columnName)}
                          className="px-3 py-1 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          + {columnName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateOrEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : !isImporting ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { resetForm(); setIsCreating(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                Nova Visualização
              </button>
              <button
                onClick={() => { resetForm(); setIsImporting(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Download size={20} />
                Importar Filtro
              </button>
            </div>
          ) : null}

          {/* Formulário de importação */}
          {isImporting && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Importar via Filtro do GitHub
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filtro do GitHub Projects
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Cole o filtro no formato: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">status:"A",B label:LABEL</code>
                </p>
                <textarea
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  rows={3}
                  placeholder={'status:"Status A","Status B",StatusC label:LABEL'}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono resize-none"
                />
                {filterParseMsg && (
                  <p className={`text-xs mt-1 ${filterParseMsg.type === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    {filterParseMsg.text}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome da Visualização
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome da visualização"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ícone
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 max-h-24 overflow-y-auto">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: emoji })}
                      className={`text-lg p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 ${formData.icon === emoji ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : ''}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="ou digite um emoji personalizado"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleImportSubmit}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Criar Visualização
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
