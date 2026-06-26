import { Octokit } from '@octokit/rest';
import { filterReposByRules } from '../utils/repoMapping';
import { getReposForView } from '../utils/viewRepoMapping';

// Em dev (localhost), redireciona chamadas para o proxy Vite para evitar CORS
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const proxyFetch: typeof fetch = (url, options) => {
  const proxied = isDev
    ? (url as string).replace('https://api.github.com', '/github-proxy')
    : url;
  return fetch(proxied, options);
};

export class GitHubService {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token, request: { fetch: proxyFetch } });
  }

  async getProjectItems(org: string, projectNumber: number) {
    try {
      let allItems: any[] = [];
      let hasNextPage = true;
      let endCursor: string | null = null;

      // Buscar todos os itens com paginação
      while (hasNextPage) {
        const query = `
          query($org: String!, $number: Int!, $cursor: String) {
            organization(login: $org) {
              projectV2(number: $number) {
                id
                title
                items(first: 100, after: $cursor) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    id
                    type
                    isArchived
                    fieldValues(first: 20) {
                      nodes {
                        ... on ProjectV2ItemFieldTextValue {
                          text
                          field {
                            ... on ProjectV2FieldCommon {
                              name
                            }
                          }
                        }
                        ... on ProjectV2ItemFieldDateValue {
                          date
                          field {
                            ... on ProjectV2FieldCommon {
                              name
                            }
                          }
                        }
                        ... on ProjectV2ItemFieldSingleSelectValue {
                          name
                          field {
                            ... on ProjectV2FieldCommon {
                              name
                            }
                          }
                        }
                      }
                    }
                    content {
                      ... on Issue {
                        number
                        title
                        body
                        url
                        state
                        assignees(first: 10) {
                          nodes {
                            login
                            avatarUrl
                          }
                        }
                        labels(first: 10) {
                          nodes {
                            name
                            color
                          }
                        }
                        createdAt
                        updatedAt
                        comments { totalCount }
                      }
                      ... on PullRequest {
                        number
                        title
                        body
                        url
                        state
                        assignees(first: 10) {
                          nodes {
                            login
                            avatarUrl
                          }
                        }
                        labels(first: 10) {
                          nodes {
                            name
                            color
                          }
                        }
                        createdAt
                        updatedAt
                        comments { totalCount }
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const response: any = await this.octokit.graphql(query, {
          org,
          number: projectNumber,
          cursor: endCursor,
        });

        const projectData = response.organization.projectV2.items;
        allItems = allItems.concat(projectData.nodes);
        hasNextPage = projectData.pageInfo.hasNextPage;
        endCursor = projectData.pageInfo.endCursor;

        console.log(`Carregados ${allItems.length} itens... ${hasNextPage ? 'continuando' : 'concluído'}`);
      }

      return this.parseProjectData({ organization: { projectV2: { items: { nodes: allItems } } } });
    } catch (error) {
      console.error('Erro ao buscar projeto:', error);
      throw error;
    }
  }

  private parseProjectData(data: any) {
    const items = data.organization.projectV2.items.nodes;

    // Contar itens arquivados antes de filtrar
    const archivedCount = items.filter((item: any) => item.isArchived).length;
    const totalCount = items.length;

    const mapItem = (item: any) => {
        const content = item.content;
        const statusField = item.fieldValues.nodes.find(
          (fv: any) => fv.field?.name === 'Status'
        );

        // Buscar campo de data (pode ser "Due Date", "Data de Entrega", etc)
        const dueDateField = item.fieldValues.nodes.find(
          (fv: any) => fv.date && (
            fv.field?.name?.toLowerCase().includes('due') ||
            fv.field?.name?.toLowerCase().includes('entrega') ||
            fv.field?.name?.toLowerCase().includes('prazo')
          )
        );

        return {
          id: item.id,
          number: content.number,
          title: content.title,
          body: content.body,
          status: statusField?.name || 'No Status',
          assignees: content.assignees.nodes.map((a: any) => ({
            login: a.login,
            avatarUrl: a.avatarUrl,
          })),
          labels: content.labels.nodes.map((l: any) => ({
            name: l.name,
            color: l.color,
          })),
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
          dueDate: dueDateField?.date,
          url: content.url,
          issueState: content.state,
          totalComments: content.comments?.totalCount,
          // Extrair repo da URL: https://github.com/org/repo/issues/123
          repo: content.url.split('/')[4],
        };
      };

    const cards = items
      .filter((item: any) => item.content && !item.isArchived)
      .map(mapItem);

    const archivedCards = items
      .filter((item: any) => item.content && item.isArchived)
      .map(mapItem);

    // Agrupar por status
    const groupedByStatus: { [key: string]: any[] } = {};
    cards.forEach((card: any) => {
      if (!groupedByStatus[card.status]) {
        groupedByStatus[card.status] = [];
      }
      groupedByStatus[card.status].push(card);
    });

    // Log sempre (para debug)
    console.log(`📊 Total itens recebidos: ${totalCount} | Ativos: ${cards.length} | Arquivados: ${archivedCards.length}`);
    if (archivedCount > 0) {
      console.log(`📦 ${archivedCount} cards arquivados foram filtrados de ${totalCount} itens totais`);
      console.log(`✅ ${cards.length} cards ativos carregados`);
    }

    return {
      columns: Object.keys(groupedByStatus).map((status) => ({
        id: status,
        name: status,
        cards: groupedByStatus[status],
      })),
      archivedCards,
    };
  }

  async verifyToken() {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return data;
    } catch (error) {
      console.error('Token inválido:', error);
      throw error;
    }
  }

  async searchIssueByNumber(org: string, issueNumber: number): Promise<import('../types').ProjectCard | null> {
    try {
      const result = await this.octokit.search.issuesAndPullRequests({
        q: `is:issue org:${org} ${issueNumber}`,
        per_page: 20,
      });
      const match = result.data.items.find((item: any) => item.number === issueNumber);
      if (!match) return null;
      // Extrair repo da URL: https://api.github.com/repos/org/repo/issues/N
      const repoPart = match.repository_url?.split('/repos/')?.[1]?.split('/')?.[1] ?? '';
      return {
        id: String(match.id),
        number: match.number,
        title: match.title,
        body: match.body ?? '',
        status: 'Arquivado',
        assignees: (match.assignees ?? []).map((a: any) => ({ login: a.login, avatarUrl: a.avatar_url })),
        labels: (match.labels ?? []).map((l: any) => ({ name: l.name, color: l.color })),
        createdAt: match.created_at,
        updatedAt: match.updated_at,
        url: match.html_url,
        repo: repoPart,
      };
    } catch (err) {
      console.error('Erro ao buscar issue por número:', err);
      return null;
    }
  }

  async getIssueComments(org: string, repo: string, issueNumber: number, count = 10) {
    try {
      const { data } = await this.octokit.issues.listComments({
        owner: org,
        repo,
        issue_number: issueNumber,
        per_page: 100,
      });
      // Retorna os últimos N comentários em ordem cronológica inversa
      return data.slice(-count).reverse().map((c: any) => ({
        id: c.id,
        author: c.user?.login ?? 'desconhecido',
        authorAvatar: c.user?.avatar_url ?? '',
        body: c.body ?? '',
        date: c.created_at,
      }));
    } catch (err) {
      console.error(`Erro ao buscar comentários de #${issueNumber}:`, err);
      return [];
    }
  }

  async getIssueLastEvent(org: string, repo: string, issueNumber: number) {
    try {
      // Buscar últimos 10 eventos para ter mais chances de pegar algo relevante
      const query = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $number) {
              updatedAt
              timelineItems(last: 10) {
                nodes {
                  __typename
                  ... on AddedToProjectV2Event {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on RemovedFromProjectV2Event {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on AssignedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    assignee {
                      ... on User {
                        login
                      }
                    }
                  }
                  ... on UnassignedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    assignee {
                      ... on User {
                        login
                      }
                    }
                  }
                  ... on LabeledEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    label {
                      name
                      color
                    }
                  }
                  ... on UnlabeledEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    label {
                      name
                      color
                    }
                  }
                  ... on ClosedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on ReopenedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on IssueComment {
                    createdAt
                    author {
                      login
                      avatarUrl
                    }
                    bodyText
                  }
                  ... on CrossReferencedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on ReferencedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on MilestonedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    milestoneTitle
                  }
                  ... on DemilestonedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    milestoneTitle
                  }
                  ... on RenamedTitleEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    previousTitle
                    currentTitle
                  }
                  ... on SubscribedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on UnsubscribedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on ConnectedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on DisconnectedEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on MarkedAsDuplicateEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on UnmarkedAsDuplicateEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on ConvertedToDiscussionEvent {
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                }
              }
              projectItems(last: 1) {
                nodes {
                  fieldValueByName(name: "Status") {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      updatedAt
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response: any = await this.octokit.graphql(query, {
        owner: org,
        repo: repo,
        number: issueNumber,
      });

      const events = response.repository.issue.timelineItems.nodes;
      const projectItems = response.repository.issue.projectItems.nodes;

      // Filtrar eventos que não conseguimos processar (ProjectV2ItemStatusChangedEvent vem mas sem campos)
      const validEvents = events.filter((e: any) =>
        e.__typename !== 'ProjectV2ItemStatusChangedEvent' &&
        e.__typename !== 'ConvertedNoteToIssueEvent' &&
        e.__typename !== 'TransferredEvent' &&
        e.__typename !== 'PinnedEvent' &&
        e.__typename !== 'UnpinnedEvent'
      );

      // Verificar se há mudança de status no projeto
      let statusChangeEvent = null;
      if (projectItems.length > 0 && projectItems[0].fieldValueByName) {
        const statusField = projectItems[0].fieldValueByName;
        if (statusField.updatedAt) {
          statusChangeEvent = {
            __typename: 'ProjectV2ItemStatusChangedEvent',
            statusName: statusField.name,
            updatedAt: statusField.updatedAt
          };
        }
      }

      // Se não há eventos válidos no timeline
      if (validEvents.length === 0) {
        // Retornar mudança de status se houver
        if (statusChangeEvent) {
          // Tentar buscar quem fez a mudança através da REST API
          let statusActor = 'someone';
          let statusAvatar = null;

          try {
            const restEvents = await this.octokit.issues.listEvents({
              owner: org,
              repo: repo,
              issue_number: issueNumber,
              per_page: 20
            });

            if (restEvents.data.length > 0) {
              // Tentar encontrar eventos próximos ao updatedAt do status
              const statusDate = new Date(statusChangeEvent.updatedAt);

              // Filtrar eventos relevantes para mudança de status (dentro de 10 minutos)
              const relevantEvents = restEvents.data.filter((e: any) => {
                const eventDate = new Date(e.created_at);
                const timeDiff = Math.abs(statusDate.getTime() - eventDate.getTime());
                return timeDiff < 10 * 60 * 1000; // 10 minutos
              });

              // Priorizar eventos de mudança de status do projeto
              const statusChangeEvents = relevantEvents.filter((e: any) =>
                e.event === 'project_v2_item_status_changed'
              );

              const eventToUse = statusChangeEvents.length > 0
                ? statusChangeEvents[statusChangeEvents.length - 1]
                : (relevantEvents.length > 0
                    ? relevantEvents[relevantEvents.length - 1]
                    : null);

              if (eventToUse && eventToUse.actor) {
                statusActor = eventToUse.actor.login;
                statusAvatar = eventToUse.actor.avatar_url;
                console.log(`Issue #${issueNumber}: Usando ator ${statusActor} de evento REST ${eventToUse.event} (${statusChangeEvents.length > 0 ? 'mudança de status' : 'correlação temporal'} - ${relevantEvents.length} eventos próximos)`);
              }
            }
          } catch (restError) {
            console.log('Não foi possível buscar eventos da REST API:', restError);
          }

          return {
            text: `moveu para ${statusChangeEvent.statusName}`,
            details: null,
            actor: statusActor,
            actorAvatar: statusAvatar
          };
        }
        return null;
      }

      // Pegar o último evento válido do timeline
      const lastEvent = validEvents[validEvents.length - 1];
      const lastEventDate = new Date(lastEvent.createdAt);

      // Se houver mudança de status e ela for mais recente que o último evento
      if (statusChangeEvent) {
        const statusDate = new Date(statusChangeEvent.updatedAt);
        if (statusDate > lastEventDate) {
          // Tentar buscar quem fez a mudança através da REST API
          let statusActor = 'someone';
          let statusAvatar = null;

          try {
            // Buscar eventos da REST API
            const restEvents = await this.octokit.issues.listEvents({
              owner: org,
              repo: repo,
              issue_number: issueNumber,
              per_page: 20
            });

            // Procurar por eventos próximos ao updatedAt do status
            const relevantEvents = restEvents.data.filter((e: any) => {
              const eventDate = new Date(e.created_at);
              const timeDiff = Math.abs(statusDate.getTime() - eventDate.getTime());
              // Eventos dentro de 10 minutos
              return timeDiff < 10 * 60 * 1000;
            });

            // Priorizar eventos de mudança de status do projeto
            const statusChangeEvents = relevantEvents.filter((e: any) =>
              e.event === 'project_v2_item_status_changed'
            );

            const eventToUse = statusChangeEvents.length > 0
              ? statusChangeEvents[statusChangeEvents.length - 1]
              : (relevantEvents.length > 0
                  ? relevantEvents[relevantEvents.length - 1]
                  : null);

            if (eventToUse && eventToUse.actor) {
              statusActor = eventToUse.actor.login;
              statusAvatar = eventToUse.actor.avatar_url;
              console.log(`Issue #${issueNumber}: Usando ator ${statusActor} de evento REST ${eventToUse.event} (${statusChangeEvents.length > 0 ? 'mudança de status' : 'correlação temporal'} - ${relevantEvents.length} eventos próximos)`);
            }
          } catch (restError) {
            console.log('Não foi possível buscar eventos da REST API:', restError);
          }

          return {
            text: `moveu para ${statusChangeEvent.statusName}`,
            details: null,
            actor: statusActor,
            actorAvatar: statusAvatar
          };
        }
      }

      const actor = lastEvent.actor || lastEvent.author;

      // Retornar objeto com texto, detalhes e ator
      const eventText = this.formatEvent(lastEvent);
      const eventDetails = lastEvent.__typename === 'IssueComment'
        ? lastEvent.bodyText
        : null;

      return {
        text: eventText,
        details: eventDetails,
        actor: actor?.login || 'someone',
        actorAvatar: actor?.avatarUrl || null
      };
    } catch (error) {
      console.error(`Erro ao buscar timeline da issue ${issueNumber}:`, error);
      return null;
    }
  }

  async getIssueDetails(org: string, repo: string, issueNumber: number) {
    try {
      // Buscar issue completa com comentários e eventos
      const query = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $number) {
              bodyHTML
              comments(last: 100) {
                nodes {
                  id
                  author {
                    login
                    avatarUrl
                  }
                  bodyHTML
                  createdAt
                }
              }
              timelineItems(last: 100) {
                nodes {
                  __typename
                  ... on IssueComment {
                    id
                    createdAt
                    author {
                      login
                      avatarUrl
                    }
                    bodyHTML
                  }
                  ... on AssignedEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    assignee {
                      ... on User {
                        login
                      }
                    }
                  }
                  ... on UnassignedEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    assignee {
                      ... on User {
                        login
                      }
                    }
                  }
                  ... on LabeledEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    label {
                      name
                      color
                    }
                  }
                  ... on UnlabeledEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    label {
                      name
                      color
                    }
                  }
                  ... on ClosedEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on ReopenedEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                  ... on RenamedTitleEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    previousTitle
                    currentTitle
                  }
                  ... on MilestonedEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    milestoneTitle
                  }
                  ... on DemilestonedEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    milestoneTitle
                  }
                  ... on CrossReferencedEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                    source {
                      __typename
                    }
                  }
                  ... on ReferencedEvent {
                    id
                    createdAt
                    actor {
                      login
                      avatarUrl
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response: any = await this.octokit.graphql(query, {
        owner: org,
        repo: repo,
        number: issueNumber,
      });

      const issue = response.repository.issue;

      // Processar comentários (apenas os da lista de comments, não da timeline)
      const comments = issue.comments.nodes.map((comment: any) => ({
        id: comment.id as string,
        author: comment.author?.login || 'unknown',
        authorAvatar: comment.author?.avatarUrl || '',
        body: comment.bodyHTML,
        createdAt: comment.createdAt,
      }));

      // Processar eventos da timeline (excluindo comentários que já estão na lista de comments)
      const events = issue.timelineItems.nodes
        .filter((event: any) => {
          // Filtrar eventos sem data válida
          if (!event.createdAt) {
            console.log('Evento sem createdAt:', event.__typename);
            return false;
          }

          // Filtrar eventos sem ator/autor
          if (!event.actor && !event.author) {
            console.log('Evento sem actor:', event.__typename);
            return false;
          }

          // Não incluir comentários na timeline (já estão em comments)
          if (event.__typename === 'IssueComment') {
            return false;
          }

          return true;
        })
        .map((event: any) => {
          const actor = event.actor || event.author;
          return {
            id: event.id || `${event.__typename}-${event.createdAt}`,
            type: event.__typename,
            actor: actor?.login || 'someone',
            actorAvatar: actor?.avatarUrl || '',
            createdAt: event.createdAt,
            description: this.formatEventDescription(event),
            metadata: this.extractEventMetadata(event),
          };
        });

      return {
        body: issue.bodyHTML || '',
        comments,
        events,
      };
    } catch (error) {
      console.error(`Erro ao buscar detalhes da issue ${issueNumber}:`, error);
      throw error;
    }
  }

  private extractEventMetadata(event: any): Record<string, any> | undefined {
    switch (event.__typename) {
      case 'LabeledEvent':
      case 'UnlabeledEvent':
        return { label: { name: event.label?.name, color: event.label?.color } };
      case 'AssignedEvent':
      case 'UnassignedEvent':
        return { assignee: { login: event.assignee?.login, avatarUrl: event.assignee?.avatarUrl } };
      default:
        return undefined;
    }
  }

  private formatEventDescription(event: any): string {
    switch (event.__typename) {
      case 'AssignedEvent':
        const assignee = event.assignee?.login || 'alguém';
        return `atribuiu para ${assignee}`;

      case 'UnassignedEvent':
        const unassignee = event.assignee?.login || 'alguém';
        return `removeu ${unassignee}`;

      case 'LabeledEvent':
        return `adicionou label "${event.label.name}"`;

      case 'UnlabeledEvent':
        return `removeu label "${event.label.name}"`;

      case 'ClosedEvent':
        return `fechou a issue`;

      case 'ReopenedEvent':
        return `reabriu a issue`;

      case 'RenamedTitleEvent':
        return `renomeou de "${event.previousTitle}" para "${event.currentTitle}"`;

      case 'MilestonedEvent':
        return `adicionou milestone "${event.milestoneTitle}"`;

      case 'DemilestonedEvent':
        return `removeu milestone "${event.milestoneTitle}"`;

      case 'CrossReferencedEvent':
        return `referenciou esta issue`;

      case 'ReferencedEvent':
        return `mencionou em um commit`;

      default:
        console.log(`Evento não mapeado: ${event.__typename}`);
        return `realizou uma ação`;
    }
  }

  async addComment(org: string, repo: string, issueNumber: number, body: string) {
    try {
      const response = await this.octokit.issues.createComment({
        owner: org,
        repo: repo,
        issue_number: issueNumber,
        body: body,
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      throw error;
    }
  }

  async addAssignee(org: string, repo: string, issueNumber: number, assignee: string) {
    try {
      const response = await this.octokit.issues.addAssignees({
        owner: org,
        repo: repo,
        issue_number: issueNumber,
        assignees: [assignee],
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao adicionar responsável:', error);
      throw error;
    }
  }

  async removeAssignee(org: string, repo: string, issueNumber: number, assignee: string) {
    try {
      const response = await this.octokit.issues.removeAssignees({
        owner: org,
        repo: repo,
        issue_number: issueNumber,
        assignees: [assignee],
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao remover responsável:', error);
      throw error;
    }
  }

  async addLabel(org: string, repo: string, issueNumber: number, label: string) {
    try {
      const response = await this.octokit.issues.addLabels({
        owner: org,
        repo: repo,
        issue_number: issueNumber,
        labels: [label],
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao adicionar label:', error);
      throw error;
    }
  }

  async removeLabel(org: string, repo: string, issueNumber: number, label: string) {
    try {
      const response = await this.octokit.issues.removeLabel({
        owner: org,
        repo: repo,
        issue_number: issueNumber,
        name: label,
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao remover label:', error);
      throw error;
    }
  }

  private formatEvent(event: any): string {
    switch (event.__typename) {
      case 'AddedToProjectV2Event':
        return `adicionou ao projeto`;

      case 'RemovedFromProjectV2Event':
        return `removeu do projeto`;

      case 'AssignedEvent':
        const assignee = event.assignee?.login || 'alguém';
        return `atribuiu para ${assignee}`;

      case 'UnassignedEvent':
        const unassignee = event.assignee?.login || 'alguém';
        return `removeu ${unassignee}`;

      case 'LabeledEvent':
        return `adicionou label "${event.label.name}"`;

      case 'UnlabeledEvent':
        return `removeu label "${event.label.name}"`;

      case 'ClosedEvent':
        return `fechou`;

      case 'ReopenedEvent':
        return `reabriu`;

      case 'IssueComment':
        return `comentou`;

      case 'CrossReferencedEvent':
        return `referenciou`;

      case 'ReferencedEvent':
        return `mencionou`;

      case 'MilestonedEvent':
        return `adicionou milestone "${event.milestoneTitle}"`;

      case 'DemilestonedEvent':
        return `removeu milestone "${event.milestoneTitle}"`;

      case 'RenamedTitleEvent':
        return `renomeou`;

      case 'SubscribedEvent':
        return `inscreveu-se`;

      case 'UnsubscribedEvent':
        return `desinscreveu-se`;

      case 'ConnectedEvent':
        return `conectou com outra issue`;

      case 'DisconnectedEvent':
        return `desconectou de outra issue`;

      case 'MarkedAsDuplicateEvent':
        return `marcou como duplicada`;

      case 'UnmarkedAsDuplicateEvent':
        return `desmarcou como duplicada`;

      case 'ConvertedToDiscussionEvent':
        return `converteu para discussão`;

      default:
        // Log para debug - ver quais eventos estão caindo aqui
        console.log(`Evento desconhecido: ${event.__typename}`, {
          typename: event.__typename,
          createdAt: event.createdAt,
          actor: event.actor?.login || event.author?.login,
          keys: Object.keys(event)
        });
        return `atualizou`;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Normaliza um commit da REST ou Search API para o formato interno */
  private _normalizeCommit(c: any, repoName: string, org: string) {
    const sha: string = c.sha ?? c.commit?.sha ?? '';
    const msg: string = (c.commit?.message ?? c.message ?? '').split('\n')[0];
    const author: string =
      c.commit?.author?.name ?? c.author?.login ?? 'Unknown';
    const date: string = c.commit?.author?.date ?? c.commit?.committer?.date ?? '';
    return {
      sha: sha.substring(0, 7),
      fullSha: sha,
      message: msg,
      author,
      authorAvatar: c.author?.avatar_url ?? '',
      date,
      repo: repoName,
      url: c.html_url ?? `https://github.com/${org}/${repoName}/commit/${sha}`,
    };
  }

  /** Verifica se uma mensagem de commit menciona o número da issue */
  private _commitMentionsIssue(msg: string, issueNumber: number): boolean {
    const n = issueNumber.toString();
    return (
      msg.includes(`#${n}`) ||
      new RegExp(`\\b${n}\\b`).test(msg) ||
      msg.includes(`[${n}]`) ||
      msg.includes(`(${n})`) ||
      msg.includes(`-${n}`) ||
      msg.includes(`_${n}`)
    );
  }

  /** Lista TODAS as branches de um repo com paginação automática */
  private async _listAllBranches(org: string, repo: string): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    while (true) {
      const res = await this.octokit.repos.listBranches({
        owner: org, repo, per_page: 100, page,
      });
      all.push(...res.data);
      if (res.data.length < 100) break;
      page++;
    }
    return all;
  }

  // ────────────────────────────────────────────────────────────────────────────

  async searchBranchesAndCommits(
    org: string,
    issueNumber: number,
    _cardTitle?: string,
    cardLabels?: string[],
    _cardAssignees?: string[],
    currentViewId?: string
  ) {
    try {
      console.log(`🔍 Buscando branches e commits para issue #${issueNumber}`);
      console.log(`   Org: ${org} | Tags: ${cardLabels?.join(', ') || 'N/A'} | View: ${currentViewId || 'N/A'}`);

      const branches: any[] = [];
      const commits: any[] = [];
      const seenCommits = new Set<string>();
      const seenBranches = new Set<string>();

      // ── 1. Determinar repositórios a buscar ────────────────────────────────
      let allRepos: string[] = [];
      try {
        let page = 1;
        while (true) {
          const res = await this.octokit.repos.listForOrg({ org, per_page: 100, page, type: 'all' });
          allRepos.push(...res.data.map((r: any) => r.name));
          if (res.data.length < 100) break;
          page++;
        }
        console.log(`   📦 ${allRepos.length} repositórios na organização`);
      } catch (err) {
        console.error('   ✗ Erro ao listar repos:', err);
        return { branches, commits };
      }

      const reposToSearch = filterReposByRules(allRepos, cardLabels || [], currentViewId);

      if (reposToSearch.length === 0) {
        const warning = `Para visualizar branches e commits, configure o mapeamento em Configurações:\n\n` +
          `• Aba "Tags": vincule as labels/tags do card aos repositórios\n` +
          `• Aba "Guias": vincule a view/área ativa aos repositórios`;
        return { branches, commits, warning };
      }

      console.log(`   🎯 Buscando em ${reposToSearch.length} repos: ${reposToSearch.join(', ')}`);

      // ── 2. Para cada repo: GraphQL timeline + branches ativas ──────────────
      const BATCH = 5; // paralelo conservador para não estressar rate limit
      for (let i = 0; i < reposToSearch.length; i += BATCH) {
        const batch = reposToSearch.slice(i, i + BATCH);

        await Promise.all(batch.map(async (repoName) => {
          try {
            console.log(`   📂 ${repoName}`);

            // ── 2a. GraphQL timeline da issue no repo ──────────────────────
            // Captura commits referenciados, PRs (inclusive de branches deletadas)
            try {
              const tlQuery = `
                query($owner: String!, $repo: String!, $number: Int!) {
                  repository(owner: $owner, name: $repo) {
                    issue(number: $number) {
                      timelineItems(first: 100, itemTypes: [
                        REFERENCED_EVENT,
                        CROSS_REFERENCED_EVENT,
                        CONNECTED_EVENT
                      ]) {
                        nodes {
                          ... on ReferencedEvent {
                            commit {
                              oid
                              message
                              committedDate
                              author { name email user { login avatarUrl } }
                              url
                            }
                          }
                          ... on CrossReferencedEvent {
                            source {
                              ... on PullRequest {
                                number
                                title
                                state
                                url
                                headRefName
                                commits(first: 100) {
                                  nodes {
                                    commit {
                                      oid
                                      message
                                      committedDate
                                      author { name email user { login avatarUrl } }
                                      url
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `;

              const tlRes: any = await this.octokit.graphql(tlQuery, {
                owner: org,
                repo: repoName,
                number: issueNumber,
              });

              const tlNodes = tlRes?.repository?.issue?.timelineItems?.nodes ?? [];

              for (const node of tlNodes) {
                // ReferencedEvent → commit direto
                if (node.commit) {
                  const c = node.commit;
                  if (!seenCommits.has(c.oid)) {
                    seenCommits.add(c.oid);
                    commits.push({
                      sha: c.oid.substring(0, 7),
                      fullSha: c.oid,
                      message: c.message.split('\n')[0],
                      author: c.author?.name ?? c.author?.user?.login ?? 'Unknown',
                      authorAvatar: c.author?.user?.avatarUrl ?? '',
                      date: c.committedDate,
                      repo: repoName,
                      url: c.url,
                    });
                  }
                }

                // CrossReferencedEvent → PR com headRefName e seus commits
                if (node.source?.headRefName) {
                  const pr = node.source;
                  const branchKey = `${repoName}:${pr.headRefName}`;

                  if (!seenBranches.has(branchKey)) {
                    seenBranches.add(branchKey);
                    // Adicionar branch (pode já ter sido deletada — registramos assim mesmo)
                    const prCommitNodes: any[] = pr.commits?.nodes ?? [];
                    const lastPrCommit = prCommitNodes[prCommitNodes.length - 1]?.commit;

                    branches.push({
                      name: pr.headRefName,
                      repo: repoName,
                      deletedAfterMerge: pr.state === 'MERGED',
                      prNumber: pr.number,
                      prState: pr.state,
                      prUrl: pr.url,
                      lastCommit: lastPrCommit ? {
                        sha: lastPrCommit.oid.substring(0, 7),
                        message: lastPrCommit.message.split('\n')[0],
                        author: lastPrCommit.author?.name ?? 'Unknown',
                        date: lastPrCommit.committedDate,
                      } : undefined,
                    });
                    console.log(`      🔀 Branch via PR #${pr.number}: ${pr.headRefName} [${pr.state}]`);
                  }

                  // Commits do PR
                  for (const prNode of (pr.commits?.nodes ?? [])) {
                    const c = prNode.commit;
                    if (!c?.oid || seenCommits.has(c.oid)) continue;
                    seenCommits.add(c.oid);
                    commits.push({
                      sha: c.oid.substring(0, 7),
                      fullSha: c.oid,
                      message: c.message.split('\n')[0],
                      author: c.author?.name ?? c.author?.user?.login ?? 'Unknown',
                      authorAvatar: c.author?.user?.avatarUrl ?? '',
                      date: c.committedDate,
                      repo: repoName,
                      url: c.url ?? `https://github.com/${org}/${repoName}/commit/${c.oid}`,
                    });
                  }
                }
              }
            } catch (gqlErr: any) {
              // Issue não existe neste repo — silencioso; outros erros, logar
              if (gqlErr.errors?.[0]?.type !== 'NOT_FOUND') {
                console.warn(`      ⚠️ GraphQL ${repoName}:`, gqlErr.message);
              }
            }

            // ── 2b. Branches ativas com paginação (complemento) ────────────
            let allBranches: any[] = [];
            try {
              allBranches = await this._listAllBranches(org, repoName);
            } catch {
              // repo inacessível — pular
              return;
            }

            const issueStr = issueNumber.toString();
            const pattern = new RegExp(`\\b${issueStr}\\b`, 'i');
            const matchingBranches = allBranches.filter((b: any) => pattern.test(b.name));

            if (matchingBranches.length > 0) {
              console.log(`      🌿 ${matchingBranches.length} branch(es) ativa(s): ${matchingBranches.map((b: any) => b.name).join(', ')}`);
            }

            for (const branch of matchingBranches) {
              const branchKey = `${repoName}:${branch.name}`;
              if (seenBranches.has(branchKey)) continue;
              seenBranches.add(branchKey);

              try {
                const commitDetails = await this.octokit.repos.getCommit({
                  owner: org, repo: repoName, ref: branch.commit.sha,
                });
                branches.push({
                  name: branch.name,
                  repo: repoName,
                  lastCommit: {
                    sha: branch.commit.sha.substring(0, 7),
                    message: commitDetails.data.commit.message.split('\n')[0],
                    author: commitDetails.data.commit.author?.name ?? 'Unknown',
                    date: commitDetails.data.commit.author?.date ?? '',
                  },
                });

                // Commits da branch que mencionam a issue (últimos 100)
                const branchCommits = await this.octokit.repos.listCommits({
                  owner: org, repo: repoName, sha: branch.name, per_page: 100,
                });
                for (const c of branchCommits.data) {
                  if (seenCommits.has(c.sha)) continue;
                  if (!this._commitMentionsIssue(c.commit.message, issueNumber)) continue;
                  seenCommits.add(c.sha);
                  commits.push(this._normalizeCommit(c, repoName, org));
                }
              } catch (err) {
                console.warn(`      ⚠️ Branch ${branch.name}:`, err);
              }
            }

            // ── 2c. Branches "base" — commits que mencionam a issue ────────
            // Captura commits feitos diretamente em develop/main/master sem branch dedicada
            const baseBranches = allBranches
              .filter((b: any) => /^(develop|main|master|homolog|hml|staging|release|production|prod)$/i.test(b.name))
              .map((b: any) => b.name);

            for (const baseBranch of baseBranches) {
              try {
                const bCommits = await this.octokit.repos.listCommits({
                  owner: org, repo: repoName, sha: baseBranch, per_page: 100,
                });
                for (const c of bCommits.data) {
                  if (seenCommits.has(c.sha)) continue;
                  if (!this._commitMentionsIssue(c.commit.message, issueNumber)) continue;
                  seenCommits.add(c.sha);
                  commits.push(this._normalizeCommit(c, repoName, org));
                }
              } catch {
                // branch não existe ou inacessível
              }
            }

          } catch (repoErr) {
            console.error(`   ✗ Erro no repo ${repoName}:`, repoErr);
          }
        }));
      }

      // ── 3. Search API — fallback único para commits sem padrão de referência
      // Uma única chamada por repo, apenas com #N
      if (commits.length === 0) {
        console.log(`   🔎 Nenhum commit encontrado até agora — tentando Search API...`);
        for (const repoName of reposToSearch) {
          try {
            const res = await this.octokit.search.commits({
              q: `#${issueNumber} repo:${org}/${repoName}`,
              per_page: 30,
              sort: 'committer-date',
              order: 'desc',
            });
            for (const c of res.data.items) {
              if (seenCommits.has(c.sha)) continue;
              if (!this._commitMentionsIssue(c.commit.message, issueNumber)) continue;
              seenCommits.add(c.sha);
              commits.push(this._normalizeCommit(c, repoName, org));
            }
            await new Promise(r => setTimeout(r, 200)); // respeitar rate limit
          } catch (err: any) {
            if (err.status !== 422 && err.status !== 403) {
              console.warn(`   ⚠️ Search API ${repoName}:`, err.message);
            }
          }
        }
      }

      // ── 4. Ordenar e retornar ───────────────────────────────────────────────
      commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log(`   ✅ Resultado: ${branches.length} branches, ${commits.length} commits`);
      return { branches, commits };
    } catch (error) {
      console.error('❌ Erro geral ao buscar branches e commits:', error);
      throw error;
    }
  }

  async getRelatedPullRequests(org: string, repo: string, issueNumber: number) {
    try {
      // Buscar PRs que mencionam esta issue
      const query = `
        query($owner: String!, $repo: String!, $issueNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
              timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
                nodes {
                  ... on CrossReferencedEvent {
                    source {
                      ... on PullRequest {
                        number
                        title
                        state
                        url
                        createdAt
                        author {
                          login
                          avatarUrl
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response: any = await this.octokit.graphql(query, {
        owner: org,
        repo: repo,
        issueNumber: issueNumber,
      });

      const prs = response.repository.issue.timelineItems.nodes
        .filter((node: any) => node.source && node.source.number)
        .map((node: any) => ({
          number: node.source.number,
          title: node.source.title,
          state: node.source.state,
          url: node.source.url,
          createdAt: node.source.createdAt,
          author: node.source.author?.login || 'unknown',
          authorAvatar: node.source.author?.avatarUrl || '',
        }));

      return prs;
    } catch (error) {
      console.error('Erro ao buscar PRs relacionados:', error);
      return [];
    }
  }

  async getIssueWithMilestone(org: string, repo: string, issueNumber: number) {
    try {
      const query = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $number) {
              milestone {
                title
                description
                dueOn
                state
                progressPercentage
                url
              }
            }
          }
        }
      `;

      const response: any = await this.octokit.graphql(query, {
        owner: org,
        repo: repo,
        number: issueNumber,
      });

      return response.repository.issue.milestone;
    } catch (error) {
      console.error('Erro ao buscar milestone:', error);
      return null;
    }
  }

  async listOrganizationMembers(org: string) {
    try {
      const members = await this.octokit.paginate(
        this.octokit.orgs.listMembers,
        {
          org: org,
          per_page: 100,
        }
      );

      return members.map(member => ({
        login: member.login,
        avatarUrl: member.avatar_url,
        url: member.html_url,
      }));
    } catch (error) {
      console.error('Erro ao buscar membros da organização:', error);
      return [];
    }
  }

  async updateProjectItemStatus(projectId: string, itemId: string, statusFieldId: string, statusOptionId: string) {
    try {
      console.log('🔧 updateProjectItemStatus chamado com:', {
        projectId,
        itemId,
        statusFieldId,
        statusOptionId
      });

      const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $projectId
              itemId: $itemId
              fieldId: $fieldId
              value: $value
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `;

      const result = await this.octokit.graphql(mutation, {
        projectId,
        itemId,
        fieldId: statusFieldId,
        value: {
          singleSelectOptionId: statusOptionId
        }
      });

      console.log('✅ updateProjectItemStatus resultado:', result);
      return result;
    } catch (error) {
      console.error('❌ Erro ao atualizar status do item:', error);
      console.error('   Detalhes:', (error as any).message);
      console.error('   Stack:', (error as any).stack);
      throw error;
    }
  }

  async getProjectStatusField(org: string, projectNumber: number) {
    try {
      const query = `
        query($org: String!, $number: Int!) {
          organization(login: $org) {
            projectV2(number: $number) {
              id
              field(name: "Status") {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `;

      const response: any = await this.octokit.graphql(query, {
        org,
        number: projectNumber
      });

      const project = response.organization.projectV2;
      const statusField = project.field;

      return {
        projectId: project.id,
        fieldId: statusField.id,
        options: statusField.options
      };
    } catch (error) {
      console.error('Erro ao buscar campo de status:', error);
      throw error;
    }
  }

  /**
   * Busca todas as atividades de um usuário em um período específico
   */
  async getDailyActivitiesForUser(
    org: string,
    username: string,
    startDate: Date,
    endDate: Date,
    columns: any[],
    currentViewId?: string
  ): Promise<any> {
    console.log(`🔍 getDailyActivitiesForUser - Iniciando para ${username}`);
    try {
      const allCards = columns.flatMap(col => col.cards);
      const userCards = allCards.filter(card =>
        card.assignees?.some((a: any) => a.login === username)
      );

      console.log(`📋 Cards do usuário ${username}:`, userCards.length);

      // Buscar timeline dos cards e push events do usuário em paralelo
      const timelinePromises = userCards
        .filter(card => card.repo)
        .map(async (card) => {
          try {
            return await this.getCardTimelineActivities(
              org, card.repo, card.number, username, startDate, endDate
            );
          } catch (error) {
            console.error(`❌ Erro na timeline do card #${card.number}:`, error);
            return [];
          }
        });

      const [timelineResults, pushCommits] = await Promise.all([
        Promise.all(timelinePromises),
        this.getUserPushEvents(org, username, startDate, endDate, allCards),
      ]);

      const timelineActivities = timelineResults.flat();

      // ── Determinar repos de código para buscar commits ──────────────────────
      const mgmtRepos = new Set(userCards.map((c: any) => c.repo).filter(Boolean));

      // 1. Prioridade: mapeamento Guia → Repos configurado pelo usuário
      const viewRepos = currentViewId ? getReposForView(currentViewId) : [];

      // 2. Repos encontrados nos push events (repos onde o dev realmente fez push)
      const pushRepos = [...new Set(pushCommits.map((c: any) => c.repo).filter(Boolean))] as string[];

      // 3. União: repos da guia + repos dos push events, excluindo repos de gestão
      let codeRepos = [...new Set([...viewRepos, ...pushRepos])].filter(r => !mgmtRepos.has(r));

      // 4. Fallback: se ainda vazio, listar todos repos da org
      if (codeRepos.length === 0 && userCards.length > 0) {
        try {
          const orgRepos: string[] = [];
          for (let page = 1; page <= 3; page++) {
            const res = await this.octokit.repos.listForOrg({ org, per_page: 100, page, type: 'all' });
            orgRepos.push(...res.data.map((r: any) => r.name as string));
            if (res.data.length < 100) break;
          }
          codeRepos = orgRepos.filter(r => !mgmtRepos.has(r));
          console.log(`⚠️ ${username}: fallback para ${codeRepos.length} repos da org`);
        } catch (e) {
          console.warn('Erro ao listar repos da org (fallback):', (e as any)?.message);
        }
      }

      console.log(`🗂️ ${username}: repos de código = [${codeRepos.join(', ')}] (view:${viewRepos.length} push:${pushRepos.length})`);

      // Buscar commits via staging + branches dos cards do usuário nos repos de código
      const knownShas = new Set(pushCommits.map((c: any) => c.commitSha).filter(Boolean));
      const stagingCommits = await this.getUserCommitsFromStaging(
        org, username, startDate, endDate, userCards, knownShas, codeRepos
      );

      const activities = [...timelineActivities, ...pushCommits, ...stagingCommits];

      activities.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      console.log(`✅ ${username}: ${timelineActivities.length} timeline + ${pushCommits.length} push events + ${stagingCommits.length} staging`);

      return { user: username, activities, cards: userCards };
    } catch (error) {
      console.error(`❌ Erro ao buscar atividades diárias de ${username}:`, error);
      throw error;
    }
  }

  private async getCardTimelineActivities(
    org: string, repo: string, issueNumber: number,
    username: string, startDate: Date, endDate: Date
  ): Promise<any[]> {
    try {
      const query = `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issueOrPullRequest(number: $number) {
            ... on Issue {
              number
              title
              url
              timelineItems(first: 100) {
                nodes {
                  __typename
                  ... on AssignedEvent { createdAt actor { login } }
                  ... on IssueComment { createdAt author { login } body }
                  ... on LabeledEvent { createdAt actor { login } label { name } }
                  ... on ClosedEvent { createdAt actor { login } }
                  ... on ReopenedEvent { createdAt actor { login } }
                }
              }
            }
            ... on PullRequest {
              number
              title
              url
              timelineItems(first: 100) {
                nodes {
                  __typename
                  ... on IssueComment { createdAt author { login } body }
                  ... on PullRequestReview { createdAt author { login } state body }
                  ... on MergedEvent { createdAt actor { login } }
                }
              }
            }
          }
        }
      }`;

      const response: any = await this.octokit.graphql(query, { owner: org, repo, number: issueNumber });
      const issueOrPR = response.repository.issueOrPullRequest;
      const events = issueOrPR.timelineItems.nodes;
      const activities: any[] = [];

      for (const event of events) {
        const actor = event.actor || event.author;
        if (!actor || actor.login !== username) continue;
        const eventDate = new Date(event.createdAt);
        if (eventDate < startDate || eventDate > endDate) continue;

        let activity: any = {
          timestamp: event.createdAt,
          cardNumber: issueNumber,
          cardTitle: issueOrPR.title,
          cardUrl: issueOrPR.url,
          repo: repo,
        };

        switch (event.__typename) {
          case 'IssueComment':
            activity.type = 'comment';
            activity.description = 'comentou';
            activity.details = event.body;
            break;
          case 'PullRequestReview':
            activity.type = 'comment';
            const reviewState = event.state === 'APPROVED' ? 'aprovou' :
              event.state === 'CHANGES_REQUESTED' ? 'solicitou mudanças' : 'comentou na revisão';
            activity.description = reviewState;
            activity.details = event.body;
            break;
          case 'AssignedEvent':
            activity.type = 'assigned';
            activity.description = 'foi atribuído';
            break;
          case 'LabeledEvent':
            activity.type = 'labeled';
            activity.description = `adicionou label: ${event.label.name}`;
            break;
          case 'ClosedEvent':
            activity.type = 'closed';
            activity.description = 'fechou';
            break;
          case 'MergedEvent':
            activity.type = 'closed';
            activity.description = 'mesclou o PR';
            break;
          default:
            continue;
        }
        activities.push(activity);
      }
      return activities;
    } catch (error) {
      console.error(`Erro ao buscar timeline do card #${issueNumber}:`, error);
      return [];
    }
  }

  private async getUserCommitsFromStaging(
    org: string,
    username: string,
    startDate: Date,
    endDate: Date,
    userCards: any[],
    knownShas: Set<string>,
    codeRepos: string[]
  ): Promise<any[]> {
    const commits: any[] = [];

    // codeRepos = repos de CÓDIGO, NÃO o repo de gestão do projeto
    // userCards = cards do projeto, usados apenas para metadados (título, URL, número)
    if (codeRepos.length === 0) {
      console.log(`⚠️ ${username}: nenhum repo de código identificado, pulando busca de commits`);
      return commits;
    }

    console.log(`🔎 ${username}: buscando commits em ${codeRepos.length} repos: [${codeRepos.join(', ')}]`);

    await Promise.all(codeRepos.map(async (repo) => {

      // ── 1. Listar branches do repo uma única vez (antes de qualquer query) ──
      const allBranches: any[] = [];
      try {
        for (let page = 1; page <= 2; page++) {
          const res = await this.octokit.request('GET /repos/{owner}/{repo}/branches', {
            owner: org, repo, per_page: 100, page,
          });
          allBranches.push(...res.data);
          if (res.data.length < 100) break;
        }
        console.log(`🌿 ${repo}: ${allBranches.length} branches (staging: ${allBranches.some((b: any) => b.name === 'staging') ? '✅' : '❌'})`);
      } catch (e) {
        console.warn(`Erro ao listar branches de ${repo}:`, (e as any)?.message);
        return;
      }

      // ── 2. Branches dos cards PRIMEIRO (para registrar o nome original da branch) ──
      await Promise.all(userCards.map(async (card: any) => {
        const pattern = new RegExp(`\\b${card.number}\\b`, 'i');
        const cardBranches = allBranches.filter((b: any) =>
          pattern.test(b.name) && b.name !== 'staging'
        );

        await Promise.all(cardBranches.map(async (branch: any) => {
          try {
            const commitsRes = await this.octokit.request('GET /repos/{owner}/{repo}/commits', {
              owner: org, repo,
              author: username,
              since: startDate.toISOString(),
              until: endDate.toISOString(),
              sha: branch.name,
              per_page: 100,
            });
            console.log(`📦 ${username} branch ${branch.name}: ${commitsRes.data.length} commits no período`);
            for (const commit of commitsRes.data) {
              const sha = commit.sha as string;
              const sha7 = sha.substring(0, 7);
              if (knownShas.has(sha7) || knownShas.has(sha)) continue;
              if ((commit.parents as any[])?.length > 1) continue;
              knownShas.add(sha7);
              knownShas.add(sha);
              commits.push({
                type: 'commit',
                timestamp: (commit.commit as any).author?.date || (commit.commit as any).committer?.date,
                description: 'fez commit',
                details: (commit.commit as any).message?.split('\n')[0].substring(0, 200),
                cardNumber: card.number,
                cardTitle: card.title,
                cardUrl: card.url,
                repo,
                branch: branch.name,
                commitSha: sha7,
                commitUrl: (commit as any).html_url,
              });
            }
          } catch { /* sem commits do usuário neste branch */ }
        }));
      }));

      // ── 3. Staging POR ÚLTIMO: só captura commits ainda não encontrados nos branches ──
      const hasStagingBranch = allBranches.some((b: any) => b.name === 'staging');
      if (hasStagingBranch) {
        try {
          const stagingRes = await this.octokit.request('GET /repos/{owner}/{repo}/commits', {
            owner: org, repo,
            author: username,
            since: startDate.toISOString(),
            until: endDate.toISOString(),
            sha: 'staging',
            per_page: 100,
          });
          for (const commit of stagingRes.data) {
            const sha = commit.sha as string;
            const sha7 = sha.substring(0, 7);
            if (knownShas.has(sha7) || knownShas.has(sha)) continue;
            if ((commit.parents as any[])?.length > 1) continue;
            knownShas.add(sha7);
            knownShas.add(sha);
            const message: string = (commit.commit as any).message || '';
            const msgMatch = message.match(/issue-(?:.*-)?([0-9]+)/i) || message.match(/#([0-9]+)/);
            const cardNumber = msgMatch ? parseInt(msgMatch[1]) : undefined;
            const matchedCard = cardNumber ? userCards.find((c: any) => c.number === cardNumber) : undefined;
            commits.push({
              type: 'commit',
              timestamp: (commit.commit as any).author?.date || (commit.commit as any).committer?.date,
              description: 'fez commit',
              details: message.split('\n')[0].substring(0, 200),
              cardNumber: matchedCard?.number ?? cardNumber,
              cardTitle: matchedCard?.title,
              cardUrl: matchedCard?.url,
              repo,
              branch: 'staging',
              commitSha: sha7,
              commitUrl: (commit as any).html_url,
            });
          }
        } catch { /* ignorar */ }
      }
    }));

    console.log(`📋 ${username}: ${commits.length} commits (staging + branches dos cards)`);
    return commits;
  }

  private async getUserPushEvents(
    org: string,
    username: string,
    startDate: Date,
    endDate: Date,
    allCards: any[]
  ): Promise<any[]> {
    // Regex: issue-123 ou issue-correcao-123 (número sempre no final após "issue-")
    const cardRegex = /^issue-(?:.*-)?([0-9]+)$/;
    const commits: any[] = [];

    try {
      for (let page = 1; page <= 3; page++) {
        let events: any[];
        try {
          const response = await this.octokit.request('GET /users/{username}/events', {
            username,
            per_page: 100,
            page,
          });
          events = response.data;
        } catch (e: any) {
          const status = e?.status ?? e?.response?.status;
          // 500 = erro no servidor do GitHub (perfil privado/inexistente), não é falha nossa
          if (status !== 500) {
            console.warn(`Erro ao buscar eventos página ${page} para ${username}:`, e);
          }
          break;
        }

        if (events.length === 0) break;

        let reachedBeforeStart = false;
        for (const event of events) {
          const eventDate = new Date(event.created_at);
          // Eventos vêm em ordem decrescente; ao ultrapassar startDate, parar
          if (eventDate < startDate) { reachedBeforeStart = true; break; }
          if (eventDate > endDate) continue;
          if (event.type !== 'PushEvent') continue;

          const fullRepoName: string = event.repo.name;
          if (!fullRepoName.startsWith(`${org}/`)) continue;
          const repo = fullRepoName.slice(org.length + 1);

          const payload = event.payload as any;
          const ref: string = payload.ref || '';
          const branchName = ref.replace('refs/heads/', '');

          const match = branchName.match(cardRegex);
          const cardNumber = match ? parseInt(match[1]) : undefined;
          const matchedCard = cardNumber ? allCards.find((c: any) => c.number === cardNumber) : undefined;

          const pushCommits: any[] = payload.commits || [];
          for (const commit of pushCommits) {
            commits.push({
              type: 'commit',
              timestamp: event.created_at,
              description: 'fez commit',
              details: (commit.message as string)?.split('\n')[0].substring(0, 200),
              cardNumber,
              cardTitle: matchedCard?.title,
              cardUrl: matchedCard?.url ?? (cardNumber ? `https://github.com/${org}/${repo}/issues/${cardNumber}` : undefined),
              repo,
              branch: branchName,
              commitSha: (commit.sha as string)?.substring(0, 7),
              commitUrl: `https://github.com/${org}/${repo}/commit/${commit.sha}`,
            });
          }
        }
        if (reachedBeforeStart || events.length < 100) break;
      }
    } catch (error) {
      console.error(`Erro ao buscar push events de ${username}:`, error);
    }

    return commits;
  }

  async getLastProductionTag(org: string, repo: string): Promise<string | null> {
    // refPrefix deve terminar com "/" — exigência da API GraphQL do GitHub.
    // Usamos query:"production-v" para filtrar apenas as tags que nos interessam.
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          refs(
            refPrefix: "refs/tags/"
            query: "production-v"
            first: 1
            orderBy: { field: TAG_COMMIT_DATE, direction: DESC }
          ) {
            nodes { name }
          }
        }
      }
    `;
    try {
      const result: any = await this.octokit.graphql(query, { owner: org, repo });
      return result?.repository?.refs?.nodes?.[0]?.name ?? null;
    } catch (error) {
      console.error(`[getLastProductionTag] ERRO GRAPHQL para ${repo}:`, error);
      // Fallback: pagina todas as tags e compara datas de commit
      // Amostra início + fim da lista alfabética para cobrir repos com mudança de formato
      // (ex: v210 → v10.76.419 onde o formato novo fica no final alfabético)
      try {
        const allTags = await this.octokit.paginate(this.octokit.repos.listTags, {
          owner: org,
          repo,
          per_page: 100,
        });
        const prodEntries = allTags.filter((t: any) => (t.name as string).startsWith('production-v'));
        if (prodEntries.length === 0) return null;
        // Pega até 10 do início e 10 do fim da lista alfabética para cobrir ambos os formatos
        const head = prodEntries.slice(0, 10);
        const tail = prodEntries.slice(-10);
        const seen = new Set<string>();
        const candidates = [...head, ...tail].filter((t: any) => {
          if (seen.has(t.name)) return false;
          seen.add(t.name);
          return true;
        });
        const withDates = await Promise.all(
          candidates.map(async (tag: any) => {
            try {
              const { data: commit } = await this.octokit.repos.getCommit({
                owner: org,
                repo,
                ref: tag.commit.sha,
              });
              const date = commit.commit.committer?.date || commit.commit.author?.date || '';
              return { name: tag.name as string, date };
            } catch {
              return { name: tag.name as string, date: '' };
            }
          })
        );
        withDates.sort((a: any, b: any) => b.date.localeCompare(a.date));
        return withDates[0]?.name ?? null;
      } catch (fallbackError) {
        console.error(`[getLastProductionTag] ERRO FALLBACK para ${repo}:`, fallbackError);
        return null;
      }
    }
  }
}
