import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, CheckCircle, FileText, AlertCircle, MessageSquare, Clipboard, Eye, Pencil } from 'lucide-react';
import type { CommentTemplate } from '../types/commentTemplates';
import { CommentTemplateService } from '../services/commentTemplateService';
import { TemplateEditor } from './TemplateEditor';

// Ícones disponíveis para seleção
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
  { name: 'green', label: 'Verde', classes: 'bg-green-600 hover:bg-green-700' },
  { name: 'blue', label: 'Azul', classes: 'bg-blue-600 hover:bg-blue-700' },
  { name: 'purple', label: 'Roxo', classes: 'bg-purple-600 hover:bg-purple-700' },
  { name: 'orange', label: 'Laranja', classes: 'bg-orange-600 hover:bg-orange-700' },
  { name: 'red', label: 'Vermelho', classes: 'bg-red-600 hover:bg-red-700' },
  { name: 'pink', label: 'Rosa', classes: 'bg-pink-600 hover:bg-pink-700' },
  { name: 'indigo', label: 'Índigo', classes: 'bg-indigo-600 hover:bg-indigo-700' },
  { name: 'teal', label: 'Teal', classes: 'bg-teal-600 hover:bg-teal-700' },
];

interface Props {
  onClose: () => void;
}

export const TemplateManager: React.FC<Props> = () => {
  const [templates, setTemplates] = useState<CommentTemplate[]>([]);
  const [editingAppearance, setEditingAppearance] = useState<{ id: string; icon: string; color: string } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<CommentTemplate | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    const allTemplates = CommentTemplateService.getAll();

    // Aplicar customizações de aparência nos templates padrão
    const templatesWithAppearance = allTemplates.map(template => {
      const appearance = CommentTemplateService.getAppearance(template.id);
      if (appearance) {
        return { ...template, icon: appearance.icon, color: appearance.color };
      }
      return template;
    });

    setTemplates(templatesWithAppearance);
  };

  const handleSaveAppearance = () => {
    if (!editingAppearance) return;

    const success = CommentTemplateService.updateAppearance(
      editingAppearance.id,
      editingAppearance.icon,
      editingAppearance.color
    );

    if (success) {
      setEditingAppearance(null);
      loadTemplates();
    }
  };

  const handleSaveTemplate = (templateData: Partial<CommentTemplate>) => {
    if (templateData.id) {
      // Atualizar template existente
      const success = CommentTemplateService.update(templateData.id, templateData);
      if (success) {
        setEditingTemplate(null);
        loadTemplates();
      }
    } else {
      // Criar novo template
      const success = CommentTemplateService.save(templateData as CommentTemplate);
      if (success) {
        setCreatingTemplate(false);
        loadTemplates();
      }
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja deletar este template?')) {
      const success = CommentTemplateService.delete(id);
      if (success) {
        loadTemplates();
      }
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconData = AVAILABLE_ICONS.find(i => i.name === iconName);
    return iconData?.icon || CheckCircle;
  };

  const getColorClasses = (colorName: string) => {
    const color = AVAILABLE_COLORS.find(c => c.name === colorName);
    return color?.classes || 'bg-gray-600 hover:bg-gray-700';
  };

  return (
    <div className="space-y-4">
      {/* Editor de Template */}
      {(creatingTemplate || editingTemplate) && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => {
            setCreatingTemplate(false);
            setEditingTemplate(null);
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Templates de Comentários
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Crie e personalize templates para padronizar seus comentários
          </p>
        </div>
        <button
          onClick={() => setCreatingTemplate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Novo Template
        </button>
      </div>

      {/* Lista de templates */}
      <div className="space-y-3">
        {templates.map((template) => {
          const Icon = getIconComponent(template.icon);
          const isEditing = editingAppearance?.id === template.id;

          return (
            <div
              key={template.id}
              className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {/* Ícone e cor */}
                  {isEditing ? (
                    <div className="space-y-2">
                      {/* Seletor de ícone */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Ícone:</label>
                        <div className="flex gap-1">
                          {AVAILABLE_ICONS.map((iconOption) => {
                            const IconComp = iconOption.icon;
                            return (
                              <button
                                key={iconOption.name}
                                onClick={() => setEditingAppearance({ ...editingAppearance, icon: iconOption.name })}
                                className={`p-2 rounded transition-colors ${
                                  editingAppearance.icon === iconOption.name
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                                title={iconOption.label}
                              >
                                <IconComp size={16} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Seletor de cor */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Cor:</label>
                        <div className="flex gap-1">
                          {AVAILABLE_COLORS.map((colorOption) => (
                            <button
                              key={colorOption.name}
                              onClick={() => setEditingAppearance({ ...editingAppearance, color: colorOption.name })}
                              className={`w-8 h-8 rounded ${getColorClasses(colorOption.name)} ${
                                editingAppearance.color === colorOption.name
                                  ? 'ring-2 ring-offset-2 ring-blue-500'
                                  : ''
                              }`}
                              title={colorOption.label}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-2 rounded-lg text-white ${getColorClasses(template.color)}`}>
                      <Icon size={20} />
                    </div>
                  )}

                  {/* Informações */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {template.name}
                      </h4>
                      {template.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                          Padrão
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{template.fields.length} campos</span>
                      {template.fields.some(f => f.required) && (
                        <span>• {template.fields.filter(f => f.required).length} obrigatórios</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveAppearance}
                        className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                        title="Salvar aparência"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => setEditingAppearance(null)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Cancelar"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Editar Aparência (ícone e cor) */}
                      <button
                        onClick={() =>
                          setEditingAppearance({ id: template.id, icon: template.icon, color: template.color })
                        }
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Editar aparência (ícone e cor)"
                      >
                        <Edit2 size={16} />
                      </button>
                      {/* Editar Template Completo (apenas para customizados) */}
                      {!template.isDefault && (
                        <>
                          <button
                            onClick={() => setEditingTemplate(template)}
                            className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                            title="Editar template completo"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Deletar template"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Preview dos campos */}
              {template.fields.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {template.fields.map((field) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <span className="font-medium">{field.label}</span>
                        {field.required && (
                          <span className="text-red-500">*</span>
                        )}
                        <span className="text-gray-400">({field.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>Nenhum template criado ainda.</p>
          <p className="text-sm mt-1">Clique em "Novo Template" para criar seu primeiro template.</p>
        </div>
      )}

      {/* Nota sobre templates */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium">Sobre templates</p>
            <ul className="mt-2 space-y-1 text-blue-700 dark:text-blue-300 list-disc list-inside">
              <li>Templates <strong>padrão</strong> (Conclusão de Demanda e Comentário Livre) são protegidos - você pode apenas personalizar ícone e cor.</li>
              <li>Templates <strong>customizados</strong> podem ser totalmente editados ou deletados.</li>
              <li>Use o botão <strong>"Novo Template"</strong> para criar templates personalizados com campos customizados.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
