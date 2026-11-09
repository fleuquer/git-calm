export const CURRENT_VERSION = '0.1.6';
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
    version: '0.1.6',
    date: '2026-11-09',
    label: '',
    changes: [
      { type: 'improvement', description: 'Ações da área devTools (sobre, recarregar e abrir em nova aba) agora ficam flutuando sobre o próprio devTools, sem alterar o cabeçalho ao trocar de aba' },
    ]
  },
  {
    version: '0.1.5',
    date: '2026-11-05',
    label: '',
    changes: [
      { type: 'improvement', description: 'Cabeçalho mais enxuto: os cards vistos recentemente agora aparecem ao clicar na busca, antes de digitar, em vez de um botão próprio' },
      { type: 'improvement', description: 'Troca de tema movida para o menu de opções do cabeçalho, com a lista de temas aberta no próprio menu' },
      { type: 'improvement', description: 'Atualizações automáticas (board, notificações e menções) pausadas enquanto a aba do app está em segundo plano, retomando ao voltar para ela, para economizar requisições ao GitHub' },
      { type: 'feat', description: 'Busca de branches e commits em todos os repositórios da organização, por parte do nome da branch, palavras da mensagem do commit (inclusive em develop/homolog e em branches de feature recentes, antes de chegar na principal) ou hash: mostra o repositório, em quais branches base (develop, homolog, master...) já está, os commits, PRs e o card relacionado (#10)' },
      { type: 'feat', description: 'Atalhos de teclado: / ou Ctrl+K abre a busca de cards e B abre a busca de branches e commits (reabrindo a última busca)' },
      { type: 'feat', description: 'Menções pendentes de resposta no cabeçalho: lista os cards em que você foi mencionado e ainda não comentou depois, com opção de marcar como respondida (#7)' },
      { type: 'feat', description: 'Nova área devTools ao lado de Board e Dados: exibe dentro do git-calm o devTools, kanban pessoal de cards, notas e ferramentas (projeto independente), com opção de abrir em nova aba' },
      { type: 'fix', description: 'A retomada das atualizações após atingir o limite de requisições do GitHub não gera mais atualizações duplicadas' },
    ]
  },
  {
    version: '0.1.4',
    date: '2026-11-04',
    label: '',
    changes: [
      { type: 'improvement', description: 'Temas visuais reformulados: Claro, Claro quente, Escuro suave, Escuro, Escuro quente e Violeta, com mais contraste entre fundo, colunas, cards e textos. Temas antigos são migrados automaticamente para o equivalente' },
      { type: 'improvement', description: 'Tema claro mais confortável, com superfícies em tom suave em vez de branco puro e labels legíveis em qualquer cor' },
      { type: 'improvement', description: 'Fonte Inter como padrão, carregada junto com o app (não depende mais de serviço externo)' },
      { type: 'improvement', description: 'Novo visual dos cards: tarja de tipo mais discreta e rodapé simplificado, com última atividade e responsáveis na mesma linha' },
      { type: 'improvement', description: 'Cores dos tipos de card (Erro, Problema, Adequação e Melhoria) mais fáceis de diferenciar' },
      { type: 'improvement', description: 'Cards sem responsável agora são destacados com borda tracejada, em vez da animação piscante' },
      { type: 'improvement', description: 'Títulos escritos em CAIXA ALTA são exibidos como frase normal nos cards, preservando siglas (o título original aparece ao passar o mouse)' },
      { type: 'improvement', description: 'Avatares maiores e sem cortes, inclusive na visão compacta' },
      { type: 'improvement', description: 'Atualização das bibliotecas do sistema e correção de vulnerabilidades' },
      { type: 'feat', description: 'Seletor rápido de tema no cabeçalho, sem precisar abrir as configurações' },
      { type: 'feat', description: 'Novo layout em lista (menu de opções), com cards em linhas contínuas e colunas em painéis, combinável com a visão compacta' },
      { type: 'feat', description: 'Ordenação dos cards por prioridade nas colunas, usando o campo "Priority" do Project ou labels de prioridade, configuráveis em Configurações › Mapeamentos › Prioridade' },
      { type: 'feat', description: 'Trilha de navegação no card aberto por link, mostrando de qual card você veio, com botão Voltar e atalho Alt+←' },
      { type: 'feat', description: 'Histórico dos últimos cards visualizados no cabeçalho, para reabrir um card fechado sem querer; com nenhum card aberto, Alt+← reabre o último (#6)' },
      { type: 'feat', description: 'Sugestão de usuários ao digitar @ nos comentários, priorizando quem participa do card e do board (#8)' },
      { type: 'feat', description: 'Adicionar responsável com sugestão de usuários (sem precisar digitar o username completo) e atalho "atribuir a mim" em cards sem responsável' },
      { type: 'fix', description: 'Gráfico "Cards por status" do Dashboard em barras ordenadas, com quantidade e percentual, legível mesmo com muitos status (#9)' },
      { type: 'fix', description: 'Edição de mapeamentos Guia → Repos agora carrega a guia e os repositórios salvos ao clicar em "Editar", sem precisar selecionar de novo (#3)' },
      { type: 'fix', description: 'Links para outros cards na descrição e nos comentários agora abrem o card dentro do app, em vez de sair para o GitHub (Ctrl+clique continua abrindo no GitHub) (#5)' },
    ]
  },
  {
    version: '0.1.3',
    date: '2026-07-24',
    label: '',
    changes: [
      { type: 'improvement', description: 'Adição de accordion para exibir detalhes de cada versão' },
      { type: 'improvement', description: 'Possibilidade de gerar relatório diário apenas para 1 usuário a definir no momento' },
      { type: 'feat', description: 'Ordenação visual de cards por coluna, com possibilidade de salvar preferências entre sessões' },
      { type: 'feat', description: 'Nova configuração para mapeamento de colunas de retorno' },
      { type: 'feat', description: 'Mapeado as colunas de retorno para exibir os cards retornados por usuário' },
      { type: 'feat', description: 'Nova configuração para mapeamento de colunas de bloqueio/retorno' },
      { type: 'feat', description: 'Nova seção de planejamento semanal, com intuito de facilitar a visão geral das atividades que precisam de tomadas de decisão' },
    ]
  },
  {
    version: '0.1.2',
    date: '2026-07-08',
    label: '',
    changes: [
      { type: 'fix', description: 'Removida a exigência de versionamento para cards com repositórios secundários detectados durante a geração do release.' },
      { type: 'improvement', description: 'Redução da quantidade de dados de atividades armazenados no localStorage, melhorando a performance e a privacidade.' },
      { type: 'improvement', description: 'As notificações agora são agrupadas por card, reduzindo a quantidade de notificações e a poluição visual.' },
      { type: 'improvement', description: 'As atividades agora são agrupadas por card, facilitando a visualização e reduzindo a poluição visual.' },
      { type: 'improvement', description: 'As configurações de notificações e atividades foram centralizadas nas configurações gerais e receberam uma nova interface.' },
      { type: 'feat', description: 'As notificações da aplicação agora também podem ser exibidas diretamente no sistema operacional.' }
    ]
  },
  {
    version: '0.1.1',
    date: '2026-06-26',
    label: '',
    changes: [
      { type: 'fix', description: 'Corrigido filtros de tags para guias/colunas de acordo com as labels do GitHub' },
      { type: 'improvement', description: 'Melhorias diversas geração de release' },
      { type: 'improvement', description: 'Melhorias diversas para seção de comentários nos cards' },
      { type: 'feat', description: 'Adicionado configuração de repositório personalizado para geração de release' },
      { type: 'feat', description: 'Adicionado opção de reportar bugs e solicitar features diretamente no app' },
      { type: 'feat', description: 'Adicionado numero da versão com modal para detalhes' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-28',
    label: 'Lançamento Beta',
    changes: [
      { type: 'improvement', description: 'Suporte a múltiplos temas visuais (claro, escuro e variantes)' },
      { type: 'improvement', description: 'Visão compacta dos cards para boards com muitos itens' },
      { type: 'feat', description: 'Board kanban integrado ao GitHub Projects com drag & drop entre colunas' },
      { type: 'feat', description: 'Filtros por label, status e responsável com clique direto nos cards' },
      { type: 'feat', description: 'Atualizações em tempo real com polling automático a cada 3 minutos' },
      { type: 'feat', description: 'Notificações do GitHub com alertas para menções e comentários' },
      { type: 'feat', description: 'Relatório diário gerado automaticamente a partir dos cards ativos' },
      { type: 'feat', description: 'Geração de notas de release com cards concluídos' },
      { type: 'feat', description: 'Agrupamento de cards por pessoa, tag ou prioridade' },
    ],
  },
];
