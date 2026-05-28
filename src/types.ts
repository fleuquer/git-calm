export interface Label {
  name: string;
  color: string;
}

export interface Assignee {
  login: string;
  avatarUrl: string;
}

export interface ProjectCard {
  id: string;
  number: number;
  title: string;
  body?: string;
  status: string;
  assignees: Assignee[];
  labels: Label[];
  issueState?: 'OPEN' | 'CLOSED' | 'MERGED' | string;
  totalComments?: number;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  url: string;
  lastEvent?: string;
  lastEventDetails?: string; // Detalhes adicionais como corpo do comentário
  lastEventActor?: string; // Login do usuário que fez a ação
  lastEventActorAvatar?: string; // Avatar do usuário que fez a ação
  lastEventLoading?: boolean;
  repo?: string;
}

export interface ProjectColumn {
  id: string;
  name: string;
  cards: ProjectCard[];
}

export interface ViewFilter {
  id: string;
  name: string;
  icon?: string;
  statuses?: string[]; // Lista de status para incluir
  excludeStatuses?: string[]; // Lista de status para excluir (com -)
  labels?: string[]; // Lista de labels para incluir
  excludeLabels?: string[]; // Lista de labels para excluir
  columnOrder?: string[]; // Ordem customizada das colunas
  hiddenLabels?: string[]; // Labels que devem ser ocultadas por padrão nesta view
  isDefault?: boolean;
  isCustom?: boolean;
}

export interface ViewTab extends ViewFilter {
  color?: string;
}

export interface DailyActivity {
  type: 'status_change' | 'comment' | 'commit' | 'assigned' | 'labeled' | 'created' | 'closed' | 'reopened';
  timestamp: string;
  description: string;
  details?: string;
  cardNumber?: number;
  cardTitle?: string;
  cardUrl?: string;
  fromStatus?: string;
  toStatus?: string;
  repo?: string;
  commitSha?: string;
  commitUrl?: string;
  branch?: string;
}

export interface UserDailyReport {
  user: string;
  avatarUrl?: string;
  activities: DailyActivity[];
  cardActivities?: Array<{
    card: ProjectCard;
    activities: DailyActivity[];
    firstAssignment?: string;
    totalTimeInExecution?: string;
  }>;
  summary: {
    totalActivities: number;
    cardsWorked: number;
    commentsAdded: number;
    commitsMade: number;
    statusChanges: number;
    mainCard?: {
      number: number;
      title: string;
      url: string;
      timeSpent?: string;
      status: string;
    };
  };
}

