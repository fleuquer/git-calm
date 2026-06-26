export const CURRENT_VERSION = '0.1.1';
export const VERSION_STORAGE_KEY = 'app_last_seen_version';

export interface Change {
  type: 'feat' | 'fix' | 'improvement';
  description: string;
}

export interface VersionEntry {
  version: string;
  date: string;
  label?: string;
  changes: Change[];
}

export const CHANGELOG: VersionEntry[] = [
  {
    version: '0.1.1',
    date: '2026-06-26',
    label: '',
    changes: [
      { type: 'feat', description: 'Adicionado configuração de repositório personalizado para geração de release' },
      { type: 'improvement', description: 'Melhorias diversas geração de release' },
      { type: 'improvement', description: 'Melhorias diversas para seção de comentários nos cards' },
      { type: 'feat', description: 'Adicionado opção de reportar bugs e solicitar features diretamente no app' },
      { type: 'feat', description: 'Adicionado numero da versão com modal para detalhes' },
      { type: 'fix', description: 'Corrigido filtros de tags para guias/colunas de acordo com as labels do GitHub' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-28',
    label: 'Lançamento Beta',
    changes: [
      { type: 'feat', description: 'Board kanban integrado ao GitHub Projects com drag & drop entre colunas' },
      { type: 'feat', description: 'Filtros por label, status e responsável com clique direto nos cards' },
      { type: 'feat', description: 'Atualizações em tempo real com polling automático a cada 3 minutos' },
      { type: 'feat', description: 'Notificações do GitHub com alertas para menções e comentários' },
      { type: 'feat', description: 'Relatório diário gerado automaticamente a partir dos cards ativos' },
      { type: 'feat', description: 'Geração de notas de release com cards concluídos' },
      { type: 'feat', description: 'Agrupamento de cards por pessoa, tag ou prioridade' },
      { type: 'improvement', description: 'Suporte a múltiplos temas visuais (claro, escuro e variantes)' },
      { type: 'improvement', description: 'Visão compacta dos cards para boards com muitos itens' },
    ],
  },
];
