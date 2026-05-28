import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle, FileText, AlertCircle, MessageSquare, Clipboard, Eye } from 'lucide-react';
import type { CommentTemplate, TemplateField } from '../types/commentTemplates';

// Ícones disponíveis
const AVAILABLE_ICONS = [
  { name: 'CheckCircle', icon: CheckCircle, label: 'Check Circle' },
  { name: 'FileText', icon: FileText, label: 'Documento' },
  { name: 'AlertCircle', icon: AlertCircle, label: 'Alerta' },
  { name: 'MessageSquare', icon: MessageSquare, label: 'Mensagem' },
  { name: 'Clipboard', icon: Clipboard, label: 'Clipboard' },
  { name: 'Eye', icon: Eye, label: 'Visualizar' },
];

// Cores disponíveis
const AVAILABLE_COLORS = [
  { name: 'green', label: 'Verde', classes: 'bg-green-600' },
  { name: 'blue', label: 'Azul', classes: 'bg-blue-600' },
  { name: 'purple', label: 'Roxo', classes: 'bg-purple-600' },
  { name: 'orange', label: 'Laranja', classes: 'bg-orange-600' },
  { name: 'red', label: 'Vermelho', classes: 'bg-red-600' },
  { name: 'pink', label: 'Rosa', classes: 'bg-pink-600' },
  { name: 'indigo', label: 'Índigo', classes: 'bg-indigo-600' },
  { name: 'teal', label: 'Teal', classes: 'bg-teal-600' },
];

// Tipos de campo disponíveis
const FIELD_TYPES: Array<{
  value: 'text' | 'textarea' | 'link-list' | 'task-list' | 'bullet-list' | 'numbered-list' | 'code-block' | 'table';
  label: string;
  description: string;
}> = [
  { value: 'text', label: 'Texto Curto', description: 'Uma linha de texto simples' },
  { value: 'textarea', label: 'Texto Longo', description: 'Múltiplas linhas de texto' },
  { value: 'link-list', label: 'Lista de Links', description: 'Links formatados como lista' },
  { value: 'task-list', label: 'Lista de Tarefas', description: 'Checkbox list - [ ] Item' },
  { value: 'bullet-list', label: 'Lista com Marcadores', description: 'Lista com bullets (•)' },
  { value: 'numbered-list', label: 'Lista Numerada', description: 'Lista com números (1, 2, 3...)' },
  { value: 'code-block', label: 'Bloco de Código', description: 'Código formatado com syntax' },
  { value: 'table', label: 'Tabela', description: 'Tabela markdown (coluna|coluna)' },
];

interface Props {
  template: Partial<CommentTemplate> | null;
  onSave: (template: Partial<CommentTemplate>) => void;
  onCancel: () => void;
}

export const TemplateEditor: React.FC<Props> = ({ template, onSave, onCancel }) => {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [icon, setIcon] = useState(template?.icon || 'MessageSquare');
  const [color, setColor] = useState(template?.color || 'blue');
  const [fields, setFields] = useState<TemplateField[]>(template?.fields || []);
  const [availableViews, setAvailableViews] = useState<string[]>(
    template?.availableViews || []
  );

  // Carregar views do sistema
  const [systemViews, setSystemViews] = useState<Array<{ id: string; name: string }>>([]);

  React.useEffect(() => {
    const loadViews = () => {
      try {
        const savedViews = localStorage.getItem('github_views');
        if (savedViews) {
          const views = JSON.parse(savedViews);
          const mappedViews = views.map((v: any) => ({ id: v.id, name: v.name }));
          console.log('Views carregadas:', mappedViews);
          setSystemViews(mappedViews);
        } else {
          // Fallback: usar views padrão se não houver no localStorage
          console.log('Nenhuma view salva, usando padrões');
          setSystemViews([
            { id: 'overview', name: 'Visão Geral' },
            { id: 'web', name: 'Web' },
            { id: 'qa', name: 'QA' },
            { id: 'desk', name: 'Desk' },
            { id: 'fast-bi', name: 'FAST/BI' },
            { id: 'action-required', name: 'Tomar Ação' },
          ]);
        }
      } catch (error) {
        console.error('Erro ao carregar views:', error);
        // Em caso de erro, usar views padrão
        setSystemViews([
          { id: 'overview', name: 'Visão Geral' },
          { id: 'web', name: 'Web' },
          { id: 'qa', name: 'QA' },
          { id: 'desk', name: 'Desk' },
          { id: 'fast-bi', name: 'FAST/BI' },
          { id: 'action-required', name: 'Tomar Ação' },
        ]);
      }
    };
    loadViews();
  }, []);  const toggleView = (viewId: string) => {
    if (availableViews.includes(viewId)) {
      setAvailableViews(availableViews.filter(v => v !== viewId));
    } else {
      setAvailableViews([...availableViews, viewId]);
    }
  };

  const addField = () => {
    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Por favor, informe um nome para o template');
      return;
    }

    // Validar campos
    const hasEmptyLabels = fields.some(f => !f.label.trim());
    if (hasEmptyLabels) {
      alert('Todos os campos devem ter um label');
      return;
    }

    const newTemplate: Partial<CommentTemplate> = {
      ...(template?.id && { id: template.id }),
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      fields,
      availableViews: availableViews.length > 0 ? availableViews : undefined, // Se vazio, aparece em todas
      isDefault: template?.isDefault || false,
    };

    onSave(newTemplate);
  };

  const getIconComponent = (iconName: string) => {
    const iconData = AVAILABLE_ICONS.find(i => i.name === iconName);
    return iconData?.icon || MessageSquare;
  };

  const getColorClasses = (colorName: string) => {
    const colorData = AVAILABLE_COLORS.find(c => c.name === colorName);
    return colorData?.classes || 'bg-blue-600';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {template?.id ? 'Editar Template' : 'Novo Template'}
          </h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome do Template *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Relatório de Bug"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva para que serve este template..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Ícone e Cor */}
          <div className="grid grid-cols-2 gap-4">
            {/* Ícone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ícone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {AVAILABLE_ICONS.map((iconOption) => {
                  const IconComp = iconOption.icon;
                  return (
                    <button
                      key={iconOption.name}
                      onClick={() => setIcon(iconOption.name)}
                      className={`p-3 rounded-lg transition-colors flex items-center justify-center ${
                        icon === iconOption.name
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      title={iconOption.label}
                    >
                      <IconComp size={20} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cor
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.name}
                    onClick={() => setColor(colorOption.name)}
                    className={`w-full h-10 rounded-lg ${getColorClasses(colorOption.name)} ${
                      color === colorOption.name
                        ? 'ring-2 ring-offset-2 ring-blue-500'
                        : ''
                    }`}
                    title={colorOption.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Views Disponíveis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Disponível nas Views
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Selecione em quais views (web, qa, desk, etc) este template deve aparecer. Se nenhuma for selecionada, aparecerá em todas.
            </p>
            {systemViews.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {systemViews.map((view) => (
                  <label
                    key={view.id}
                    className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={availableViews.includes(view.id)}
                      onChange={() => toggleView(view.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{view.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                Carregando views do sistema...
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Preview:</div>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg text-white ${getColorClasses(color)}`}>
                {React.createElement(getIconComponent(icon), { size: 20 })}
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{name || 'Nome do Template'}</div>
                {description && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">{description}</div>
                )}
              </div>
            </div>
          </div>

          {/* Campos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Campos do Template
              </label>
              <button
                onClick={addField}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
              >
                <Plus size={14} />
                Adicionar Campo
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-sm">Nenhum campo adicionado</p>
                <p className="text-xs mt-1">Clique em "Adicionar Campo" para criar campos personalizados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        {/* Label e Tipo */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => updateField(index, { label: e.target.value })}
                              placeholder="Label do campo"
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          <div>
                            <select
                              value={field.type}
                              onChange={(e) => updateField(index, { type: e.target.value as any })}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              title={FIELD_TYPES.find(t => t.value === field.type)?.description}
                            >
                              {FIELD_TYPES.map((type) => (
                                <option key={type.value} value={type.value} title={type.description}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {FIELD_TYPES.find(t => t.value === field.type)?.description}
                            </div>
                          </div>
                        </div>

                        {/* Placeholder */}
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => updateField(index, { placeholder: e.target.value })}
                          placeholder="Placeholder (opcional)"
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />

                        {/* Required */}
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Campo obrigatório
                        </label>

                        {/* Configurações específicas para listas */}
                        {['task-list', 'bullet-list', 'numbered-list', 'link-list'].includes(field.type) && (
                          <div className="space-y-3 pt-2 border-t border-gray-300 dark:border-gray-600">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={field.allowDynamicItems !== false}
                                onChange={(e) => updateField(index, {
                                  allowDynamicItems: e.target.checked,
                                  predefinedItems: e.target.checked ? undefined : (field.predefinedItems || [''])
                                })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Permitir adicionar/remover itens
                            </label>

                            {field.allowDynamicItems === false && (
                              <div className="space-y-2 pl-6">
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  Itens pré-definidos (o usuário apenas preenche/marca):
                                </div>
                                {(field.predefinedItems || ['']).map((item, itemIdx) => (
                                  <div key={itemIdx} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={item}
                                      onChange={(e) => {
                                        const newItems = [...(field.predefinedItems || [''])];
                                        newItems[itemIdx] = e.target.value;
                                        updateField(index, { predefinedItems: newItems });
                                      }}
                                      placeholder={`Item ${itemIdx + 1}`}
                                      className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    />
                                    {(field.predefinedItems || ['']).length > 1 && (
                                      <button
                                        onClick={() => {
                                          const newItems = (field.predefinedItems || ['']).filter((_, i) => i !== itemIdx);
                                          updateField(index, { predefinedItems: newItems });
                                        }}
                                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded"
                                        title="Remover item"
                                      >
                                        <X size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  onClick={() => {
                                    const newItems = [...(field.predefinedItems || ['']), ''];
                                    updateField(index, { predefinedItems: newItems });
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded transition-colors"
                                >
                                  <Plus size={10} />
                                  Adicionar item
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Botão Remover */}
                      <button
                        onClick={() => removeField(index)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Remover campo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            {template?.id ? 'Salvar Alterações' : 'Criar Template'}
          </button>
        </div>
      </div>
    </div>
  );
};
