// Tipos para sistema de templates de comentários

export interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'link-list' | 'task-list' | 'bullet-list' | 'numbered-list' | 'code-block' | 'table';
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  // Para listas: se true, usuário pode adicionar/remover itens. Se false, usa predefinedItems
  allowDynamicItems?: boolean;
  // Itens pré-definidos para listas fixas (cada item pode ter um valor inicial)
  predefinedItems?: string[];
}

export interface CommentTemplate {
  id: string;
  name: string;
  description?: string;
  icon: string; // Nome do ícone Lucide React
  color: string; // Classe Tailwind (ex: 'green', 'blue', 'purple')
  fields: TemplateField[];
  generateMarkdown: (data: Record<string, any>, context?: TemplateContext) => string;
  isDefault?: boolean; // Não pode ser deletado
  availableViews?: string[]; // Views onde o template aparece (ex: ['web', 'qa', 'desk']). Se undefined, aparece em todas
}

export interface TemplateContext {
  branches: Array<{
    name: string;
    repo: string;
    lastCommit: {
      sha: string;
      message: string;
    };
  }>;
  commits: Array<{
    sha: string;
    fullSha: string;
    message: string;
    repo: string;
  }>;
  cardNumber: number;
}

// Template padrão de Conclusão de Demanda (não pode ser deletado/editado estruturalmente)
export const DEFAULT_COMPLETION_TEMPLATE: CommentTemplate = {
  id: 'completion-default',
  name: 'Conclusão de Demanda',
  description: 'Template padrão para documentar a conclusão de uma demanda',
  icon: 'CheckCircle',
  color: 'green',
  isDefault: true,
  // availableViews não definido = aparece em todas as views
  fields: [
    {
      id: 'descricao',
      label: 'Descrição da Alteração',
      type: 'textarea',
      required: true,
      placeholder: 'Explique qual foi a alteração realizada...',
    },
    {
      id: 'linksTeste',
      label: 'Links para Teste',
      type: 'link-list',
      required: false,
      placeholder: 'http://ambiente-teste.com',
    },
    {
      id: 'testesRealizados',
      label: 'Testes a Serem Realizados (um por linha)',
      type: 'textarea',
      required: false,
      placeholder: 'Verificar login\nTestar recuperação de senha\nValidar redirecionamento',
    },
    {
      id: 'informacoesAuxiliares',
      label: 'Informações Auxiliares',
      type: 'textarea',
      required: false,
      placeholder: 'Credenciais: user@test.com / 123456\nVídeo: http://link-video.com',
    },
  ],
  generateMarkdown: (data: Record<string, any>, context?: TemplateContext) => {
    let template = '## Descrição da Alteração\n';
    template += data.descricao || 'Descreva aqui as alterações realizadas na demanda...';
    template += '\n\n';

    // Branches (todas detectadas)
    if (context?.branches && context.branches.length > 0) {
      if (context.branches.length === 1) {
        template += `## Branch associada\n\`${context.branches[0].name}\`\n\n`;
      } else {
        template += '## Branches associadas\n';
        context.branches.forEach(branch => {
          template += `- \`${branch.name}\` (${branch.repo})\n`;
        });
        template += '\n';
      }
    } else if (context?.cardNumber) {
      template += `## Branch associada\n\`issue-${context.cardNumber}\`\n\n`;
    }

    // Commits (todos detectados)
    if (context?.commits && context.commits.length > 0) {
      if (context.commits.length === 1) {
        template += `## Número do Commit\n${context.commits[0].sha} (${context.commits[0].fullSha})\n\n`;
        template += `## Mensagem do Commit\n${context.commits[0].message}\n\n`;
      } else {
        template += '## Commits relacionados\n';
        context.commits.forEach(commit => {
          template += `- \`${commit.sha}\` - ${commit.message} (${commit.repo})\n`;
        });
        template += '\n';
      }
    } else {
      template += '## Número do Commit\nabc1234\n\n';
    }

    // Links de teste (múltiplos)
    const linksValidos = (data.linksTeste || []).filter((link: string) => link.trim());
    if (linksValidos.length > 0) {
      if (linksValidos.length === 1) {
        template += `## Link para Teste\n[Ambiente de Teste](${linksValidos[0]})\n\n`;
      } else {
        template += '## Links para Teste\n';
        linksValidos.forEach((link: string, idx: number) => {
          template += `- [Ambiente ${idx + 1}](${link})\n`;
        });
        template += '\n';
      }
    }

    // Testes (opcional - só adiciona se houver conteúdo)
    if (data.testesRealizados && data.testesRealizados.trim()) {
      template += '## Testes a Serem Realizados\n';
      const testes = data.testesRealizados.split('\n').filter((t: string) => t.trim());
      testes.forEach((teste: string) => {
        template += `- ${teste.trim()}\n`;
      });
      template += '\n';
    }

    // Informações auxiliares (opcional - só adiciona se houver conteúdo)
    if (data.informacoesAuxiliares && data.informacoesAuxiliares.trim()) {
      template += '## Informações Auxiliares\n';
      template += data.informacoesAuxiliares;
    }

    return template;
  },
};

// Template simples de comentário livre (padrão)
export const DEFAULT_FREE_TEMPLATE: CommentTemplate = {
  id: 'free-default',
  name: 'Comentário Livre',
  description: 'Template livre para comentários gerais',
  icon: 'FileText',
  color: 'blue',
  isDefault: true,
  // availableViews não definido = aparece em todas as views
  fields: [],
  generateMarkdown: () => '',
};
