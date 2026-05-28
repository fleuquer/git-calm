import type { CommentTemplate, TemplateField } from '../types/commentTemplates';
import { DEFAULT_COMPLETION_TEMPLATE, DEFAULT_FREE_TEMPLATE } from '../types/commentTemplates';

const STORAGE_KEY = 'github-project-comment-templates';

/**
 * Processa um campo e retorna o markdown correspondente
 */
function processFieldValue(field: TemplateField, value: any): string {
  // Pular campos vazios que não são obrigatórios
  if (!field.required && (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && !value.trim()))) {
    return '';
  }

  let markdown = `## ${field.label}\n`;

  switch (field.type) {
    case 'link-list': {
      const urls = (value || []).filter((url: string) => url.trim());
      if (urls.length > 0) {
        urls.forEach((url: string, idx: number) => {
          markdown += `- [Link ${idx + 1}](${url})\n`;
        });
      } else if (field.required) {
        markdown += 'Nenhum link adicionado\n';
      }
      break;
    }

    case 'task-list': {
      // Aceita tanto array quanto string
      const lines = Array.isArray(value)
        ? value.filter((l: string) => l.trim())
        : (value && value.trim()) ? value.split('\n').filter((l: string) => l.trim()) : [];

      if (lines.length > 0) {
        // Se tem predefinedItems, usa como labels (checkbox marcado ou não)
        if (field.predefinedItems && field.allowDynamicItems === false) {
          field.predefinedItems.forEach((item, idx) => {
            const isChecked = value && Array.isArray(value) && value[idx] === item;
            markdown += `- [${isChecked ? 'x' : ' '}] ${item}\n`;
          });
        } else {
          // Lista dinâmica normal
          lines.forEach((line: string) => {
            markdown += `- [ ] ${line.trim()}\n`;
          });
        }
      } else if (field.required) {
        markdown += `- [ ] ${field.placeholder || 'Tarefa não informada'}\n`;
      }
      break;
    }

    case 'bullet-list': {
      // Aceita tanto array quanto string
      const lines = Array.isArray(value)
        ? value.filter((l: string) => l.trim())
        : (value && value.trim()) ? value.split('\n').filter((l: string) => l.trim()) : [];

      if (lines.length > 0) {
        // Se tem predefinedItems, combina label + valor
        if (field.predefinedItems && field.allowDynamicItems === false) {
          field.predefinedItems.forEach((item, idx) => {
            const val = value && Array.isArray(value) ? value[idx] : '';
            if (val && val.trim()) {
              markdown += `- **${item}**: ${val.trim()}\n`;
            }
          });
        } else {
          // Lista dinâmica normal
          lines.forEach((line: string) => {
            markdown += `- ${line.trim()}\n`;
          });
        }
      } else if (field.required) {
        markdown += `- ${field.placeholder || 'Item não informado'}\n`;
      }
      break;
    }

    case 'numbered-list': {
      // Aceita tanto array quanto string
      const lines = Array.isArray(value)
        ? value.filter((l: string) => l.trim())
        : (value && value.trim()) ? value.split('\n').filter((l: string) => l.trim()) : [];

      if (lines.length > 0) {
        // Se tem predefinedItems, combina label + valor
        if (field.predefinedItems && field.allowDynamicItems === false) {
          let counter = 1;
          field.predefinedItems.forEach((item, idx) => {
            const val = value && Array.isArray(value) ? value[idx] : '';
            if (val && val.trim()) {
              markdown += `${counter}. **${item}**: ${val.trim()}\n`;
              counter++;
            }
          });
        } else {
          // Lista dinâmica normal
          lines.forEach((line: string, idx: number) => {
            markdown += `${idx + 1}. ${line.trim()}\n`;
          });
        }
      } else if (field.required) {
        markdown += `1. ${field.placeholder || 'Item não informado'}\n`;
      }
      break;
    }

    case 'code-block': {
      if (value && value.trim()) {
        markdown += '```\n';
        markdown += value;
        if (!value.endsWith('\n')) markdown += '\n';
        markdown += '```\n';
      } else if (field.required) {
        markdown += '```\n';
        markdown += field.placeholder || 'Código não informado';
        markdown += '\n```\n';
      }
      break;
    }

    case 'table': {
      if (value && value.trim()) {
        const lines = value.split('\n').filter((l: string) => l.trim());
        if (lines.length > 0) {
          // Primeira linha é o cabeçalho
          markdown += `${lines[0]}\n`;
          // Linha separadora (baseada no número de colunas)
          const numCols = lines[0].split('|').filter((c: string) => c.trim()).length;
          markdown += '|' + ' --- |'.repeat(numCols) + '\n';
          // Demais linhas são dados
          for (let i = 1; i < lines.length; i++) {
            markdown += `${lines[i]}\n`;
          }
        }
      } else if (field.required) {
        markdown += '| Coluna 1 | Coluna 2 |\n';
        markdown += '| --- | --- |\n';
        markdown += '| Dado 1 | Dado 2 |\n';
      }
      break;
    }

    case 'textarea': {
      if (value && value.trim()) {
        markdown += `${value}\n`;
      } else if (field.required) {
        markdown += `${field.placeholder || 'Não informado'}\n`;
      }
      break;
    }

    case 'text':
    default: {
      markdown += `${value || field.placeholder || 'Não informado'}\n`;
      break;
    }
  }

  return markdown + '\n';
}

/**
 * Serviço para gerenciar templates de comentários
 */
export class CommentTemplateService {
  /**
   * Obtém todos os templates (padrões + customizados)
   */
  static getAll(): CommentTemplate[] {
    const customTemplates = this.getCustomTemplates();
    return [DEFAULT_COMPLETION_TEMPLATE, DEFAULT_FREE_TEMPLATE, ...customTemplates];
  }

  /**
   * Obtém apenas templates customizados
   */
  static getCustomTemplates(): CommentTemplate[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const templates = JSON.parse(stored) as CommentTemplate[];

      // Restaurar a função generateMarkdown para cada template
      return templates.filter(t => !t.isDefault).map(template => {
        const generateMarkdown = (data: Record<string, any>) => {
          let markdown = '';

          template.fields.forEach((field) => {
            const fieldMarkdown = processFieldValue(field, data[field.id]);
            if (fieldMarkdown) {
              markdown += fieldMarkdown;
            }
          });

          return markdown.trim();
        };

        return {
          ...template,
          generateMarkdown,
        };
      });
    } catch (error) {
      console.error('Erro ao carregar templates customizados:', error);
      return [];
    }
  }

  /**
   * Obtém um template por ID
   */
  static getById(id: string): CommentTemplate | undefined {
    return this.getAll().find(t => t.id === id);
  }

  /**
   * Obtém templates disponíveis para uma view específica
   */
  static getAvailableForView(viewId: string): CommentTemplate[] {
    const allTemplates = this.getAll();
    return allTemplates.filter(template => {
      // Se availableViews não está definido, o template aparece em todas as views
      if (!template.availableViews || template.availableViews.length === 0) {
        return true;
      }
      // Caso contrário, verifica se a view está na lista
      return template.availableViews.includes(viewId);
    });
  }

  /**
   * Salva um novo template customizado
   */
  static save(template: Omit<CommentTemplate, 'id'>): CommentTemplate {
    const customTemplates = this.getCustomTemplates();

    // Gerar função generateMarkdown automaticamente
    const generateMarkdown = (data: Record<string, any>) => {
      let markdown = '';

      template.fields.forEach((field) => {
        const fieldMarkdown = processFieldValue(field, data[field.id]);
        if (fieldMarkdown) {
          markdown += fieldMarkdown;
        }
      });

      return markdown.trim();
    };

    const newTemplate: CommentTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      isDefault: false,
      generateMarkdown,
    };

    customTemplates.push(newTemplate);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));

    return newTemplate;
  }

  /**
   * Atualiza um template customizado existente
   */
  static update(id: string, updates: Partial<CommentTemplate>): boolean {
    const customTemplates = this.getCustomTemplates();
    const index = customTemplates.findIndex(t => t.id === id);

    if (index === -1) return false;

    // Não permitir editar templates padrão
    if (customTemplates[index].isDefault) return false;

    // Mesclar updates com template existente
    const updatedTemplate = { ...customTemplates[index], ...updates, id };

    // Regenerar generateMarkdown se os campos foram alterados
    if (updates.fields) {
      const generateMarkdown = (data: Record<string, any>) => {
        let markdown = '';

        updatedTemplate.fields.forEach((field) => {
          const fieldMarkdown = processFieldValue(field, data[field.id]);
          if (fieldMarkdown) {
            markdown += fieldMarkdown;
          }
        });

        return markdown.trim();
      };

      updatedTemplate.generateMarkdown = generateMarkdown;
    }

    customTemplates[index] = updatedTemplate;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));

    return true;
  }

  /**
   * Remove um template customizado
   */
  static delete(id: string): boolean {
    const customTemplates = this.getCustomTemplates();
    const template = customTemplates.find(t => t.id === id);

    // Não permitir deletar templates padrão
    if (!template || template.isDefault) return false;

    const filtered = customTemplates.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    return true;
  }

  /**
   * Atualiza apenas a aparência (ícone e cor) de um template padrão
   */
  static updateAppearance(id: string, icon: string, color: string): boolean {
    if (id === DEFAULT_COMPLETION_TEMPLATE.id) {
      // Salvar customização de aparência separadamente
      const appearanceKey = `${STORAGE_KEY}-appearance`;
      try {
        const stored = localStorage.getItem(appearanceKey);
        const appearances = stored ? JSON.parse(stored) : {};
        appearances[id] = { icon, color };
        localStorage.setItem(appearanceKey, JSON.stringify(appearances));
        return true;
      } catch (error) {
        console.error('Erro ao salvar aparência:', error);
        return false;
      }
    }

    // Para templates customizados, usar update normal
    return this.update(id, { icon, color });
  }

  /**
   * Obtém customização de aparência de um template padrão
   */
  static getAppearance(id: string): { icon: string; color: string } | null {
    const appearanceKey = `${STORAGE_KEY}-appearance`;
    try {
      const stored = localStorage.getItem(appearanceKey);
      if (!stored) return null;

      const appearances = JSON.parse(stored);
      return appearances[id] || null;
    } catch (error) {
      console.error('Erro ao carregar aparência:', error);
      return null;
    }
  }
}
