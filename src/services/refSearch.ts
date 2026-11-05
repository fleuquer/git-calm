import { createOctokit } from './github';

/**
 * Busca geral de branches e commits na organização (issue #10).
 *
 * - Branches: filtra pelo nome em todos os repositórios da org, numa consulta GraphQL paginada
 *   (o próprio GitHub filtra as refs pelo texto, então não é preciso listar todas as branches).
 * - Commits por texto: Search API do GitHub (só considera a branch principal de cada repositório,
 *   e o índice pode demorar a incluir commits novos) + varredura dos commits recentes das
 *   branches base (develop, homolog, staging...) e da principal, filtrando pela mensagem aqui.
 * - Commits por hash (7 a 40 caracteres hexadecimais): procurado em todos os repositórios, em
 *   qualquer branch.
 *
 * Os detalhes (em quais branches base já está, commits da branch, PRs e cards ligados) são
 * buscados só ao selecionar um resultado.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────────────────────
export interface RefCommit {
  oid: string;
  shortOid: string;
  message: string;      // Primeira linha
  date: string;
  url: string;
  author: string;
  authorLogin?: string;
  authorAvatar?: string;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  url: string;
  headRefName?: string;
  baseRefName?: string;
  closingIssues: { number: number; title: string; url: string; repo: string }[];
}

export interface BranchHit {
  repo: string;
  name: string;
  isDefault: boolean;
  archived: boolean;
  head: RefCommit | null;
  prs: Pick<PullRequestInfo, 'number' | 'title' | 'state' | 'url'>[];
}

export interface CommitHit extends RefCommit {
  repo: string;
  foundBy: 'hash' | 'message';
  /** Branch base em que foi encontrado pela varredura de commits recentes */
  branch?: string;
}

export interface RefSearchResult {
  branches: BranchHit[];
  commits: CommitHit[];
  reposScanned: number;
  /** Repositórios com mais branches correspondentes do que as exibidas */
  truncatedRepos: string[];
  commitSearchError?: string;
}

/** Situação da branch/commit em relação a uma branch base (develop, homolog, master...) */
export interface BaseStatus {
  name: string;
  isDefault: boolean;
  contained: boolean;   // Todos os commits já estão na base
  missing: number;      // Commits que ainda não estão na base
}

export interface BranchDetail {
  defaultBranch: string;
  bases: BaseStatus[];
  /** Commits da branch que ainda não estão na branch principal (mais recentes primeiro) */
  aheadCommits: RefCommit[];
  aheadTotal: number;
  /** Últimos commits da branch (quando ela não tem nada além da principal) */
  history: RefCommit[];
  prs: PullRequestInfo[];
}

export interface CommitDetail {
  fullMessage: string;
  additions: number;
  deletions: number;
  changedFiles: number | null;
  bases: BaseStatus[];
  prs: PullRequestInfo[];
}

// ── Utilidades ───────────────────────────────────────────────────────────────────────────────
export const MIN_QUERY_LENGTH = 3;
const REPOS_PER_PAGE = 50;
const MAX_REPO_PAGES = 20;          // até 1000 repositórios
const BRANCHES_PER_REPO = 15;
const HEX_SHA = /^[0-9a-f]{7,40}$/i;
/** Varredura de commits recentes: quantos dias e quantos commits por branch base */
const HISTORY_DAYS = 180;
const HISTORY_PER_BRANCH = 100;
/** Branches base onde costuma ficar o trabalho ainda não liberado na principal */
const HISTORY_BRANCHES = ['develop', 'dev', 'homolog', 'homologacao', 'hml', 'staging', 'release'];
/** Branches com atividade recente (feature, hotfix...): as mais recentes de cada repositório */
const ACTIVE_BRANCHES_PER_REPO = 20;
const ACTIVE_DAYS = 30;
const ACTIVE_COMMITS_PER_BRANCH = 30;

/** Branches que costumam ser destino de merge; só as que existirem no repo são consideradas */
const BASE_CANDIDATES = ['develop', 'dev', 'homolog', 'homologacao', 'hml', 'staging', 'release', 'master', 'main', 'production', 'prod'];

export function looksLikeSha(text: string): boolean {
  return HEX_SHA.test(text.trim());
}

interface GqlAuthor { name?: string | null; user?: { login: string; avatarUrl: string } | null }
interface GqlCommit {
  oid: string;
  abbreviatedOid: string;
  messageHeadline: string;
  committedDate: string;
  url: string;
  author?: GqlAuthor | null;
}
interface GqlPr {
  number: number;
  title: string;
  state: PullRequestInfo['state'];
  url: string;
  headRefName?: string;
  baseRefName?: string;
  closingIssuesReferences?: { nodes: ({ number: number; title: string; url: string; repository: { name: string } } | null)[] };
}
interface GqlCompare { aheadBy: number; behindBy: number; status: string }
interface GqlBaseRef { name: string; compare: GqlCompare | null }

const COMMIT_FIELDS = `
  oid abbreviatedOid messageHeadline committedDate url
  author { name user { login avatarUrl } }
`;

const PR_FIELDS = `
  number title state url headRefName baseRefName
  closingIssuesReferences(first: 5) { nodes { number title url repository { name } } }
`;

function toCommit(c: GqlCommit): RefCommit {
  return {
    oid: c.oid,
    shortOid: c.abbreviatedOid,
    message: c.messageHeadline,
    date: c.committedDate,
    url: c.url,
    author: c.author?.user?.login ?? c.author?.name ?? 'Desconhecido',
    authorLogin: c.author?.user?.login,
    authorAvatar: c.author?.user?.avatarUrl,
  };
}

function toPr(pr: GqlPr): PullRequestInfo {
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    url: pr.url,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    closingIssues: (pr.closingIssuesReferences?.nodes ?? [])
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map(n => ({ number: n.number, title: n.title, url: n.url, repo: n.repository.name })),
  };
}

/**
 * Executa uma consulta GraphQL aceitando resposta parcial: se só alguns campos falharem
 * (ex: comparação com uma branch base), usa o que veio em vez de descartar tudo.
 */
async function graphqlPartial<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  try {
    return await createOctokit(token).graphql<T>(query, variables);
  } catch (err) {
    const data = (err as { data?: T }).data;
    if (data) return data;
    throw err;
  }
}

/** Campos GraphQL com a comparação de `head` contra cada branch base candidata (b0, b1...) */
function baseCompareFields(): string {
  return BASE_CANDIDATES
    .map((name, i) => `b${i}: ref(qualifiedName: "refs/heads/${name}") { name compare(headRef: $head) { aheadBy behindBy status } }`)
    .join('\n');
}

function collectBases(repo: Record<string, unknown>, defaultBranch: string, defaultCompare: GqlCompare | null): BaseStatus[] {
  const bases: BaseStatus[] = [];
  const seen = new Set<string>();
  const add = (name: string, cmp: GqlCompare | null) => {
    if (!cmp || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    // base.compare(head): aheadBy = commits do head que a base ainda não tem
    bases.push({ name, isDefault: name === defaultBranch, contained: cmp.aheadBy === 0, missing: cmp.aheadBy });
  };
  add(defaultBranch, defaultCompare);
  BASE_CANDIDATES.forEach((_, i) => {
    const ref = repo[`b${i}`] as GqlBaseRef | null | undefined;
    if (ref) add(ref.name, ref.compare);
  });
  return bases;
}

/** Minúsculas e sem acentos, para comparar textos */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Todas as palavras da busca aparecem na mensagem (em qualquer ordem, sem diferenciar acentos) */
export function messageMatches(message: string, query: string): boolean {
  const msg = normalize(message);
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every(w => msg.includes(w));
}

// ── Busca ────────────────────────────────────────────────────────────────────────────────────
interface SearchPage {
  organization: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: {
        name: string;
        isArchived: boolean;
        defaultBranchRef: { name: string } | null;
        refs: {
          totalCount: number;
          nodes: {
            name: string;
            target: GqlCommit | null;
            associatedPullRequests: { nodes: GqlPr[] };
          }[];
        } | null;
        commit?: GqlCommit | null;
      }[];
    };
  } | null;
}

async function searchBranches(token: string, org: string, text: string) {
  const withSha = looksLikeSha(text);
  const query = `
    query($org: String!, $q: String!, $cursor: String, $sha: String!, $withSha: Boolean!) {
      organization(login: $org) {
        repositories(first: ${REPOS_PER_PAGE}, after: $cursor, orderBy: { field: PUSHED_AT, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            name
            isArchived
            defaultBranchRef { name }
            refs(refPrefix: "refs/heads/", query: $q, first: ${BRANCHES_PER_REPO}, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
              totalCount
              nodes {
                name
                target { ... on Commit { ${COMMIT_FIELDS} } }
                associatedPullRequests(first: 2, orderBy: { field: UPDATED_AT, direction: DESC }) {
                  nodes { number title state url }
                }
              }
            }
            commit: object(expression: $sha) @include(if: $withSha) { ... on Commit { ${COMMIT_FIELDS} } }
          }
        }
      }
    }
  `;

  const branches: BranchHit[] = [];
  const hashCommits: CommitHit[] = [];
  const truncatedRepos: string[] = [];
  let reposScanned = 0;
  let cursor: string | null = null;

  for (let page = 0; page < MAX_REPO_PAGES; page++) {
    const data: SearchPage = await graphqlPartial<SearchPage>(token, query, {
      org, q: text, cursor, sha: withSha ? text : '', withSha,
    });
    const repos = data.organization?.repositories;
    if (!repos) break;

    for (const repo of repos.nodes) {
      if (!repo) continue;
      reposScanned++;
      const defaultBranch = repo.defaultBranchRef?.name;
      const refs = repo.refs?.nodes ?? [];
      if ((repo.refs?.totalCount ?? 0) > refs.length) truncatedRepos.push(repo.name);
      for (const ref of refs) {
        branches.push({
          repo: repo.name,
          name: ref.name,
          isDefault: ref.name === defaultBranch,
          archived: repo.isArchived,
          head: ref.target?.oid ? toCommit(ref.target) : null,
          prs: (ref.associatedPullRequests?.nodes ?? []).map(pr => ({ number: pr.number, title: pr.title, state: pr.state, url: pr.url })),
        });
      }
      if (repo.commit?.oid) hashCommits.push({ ...toCommit(repo.commit), repo: repo.name, foundBy: 'hash' });
    }

    if (!repos.pageInfo.hasNextPage) break;
    cursor = repos.pageInfo.endCursor;
  }

  return { branches, hashCommits, truncatedRepos, reposScanned };
}

interface SearchCommitItem {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { name?: string; date?: string } | null; committer?: { date?: string } | null };
  author?: { login: string; avatar_url: string } | null;
  repository: { name: string };
}

async function searchCommitMessages(token: string, org: string, text: string): Promise<CommitHit[]> {
  const res = await createOctokit(token).search.commits({
    q: `${text} org:${org}`,
    sort: 'committer-date',
    order: 'desc',
    per_page: 30,
  });
  return (res.data.items as unknown as SearchCommitItem[]).map(item => ({
    oid: item.sha,
    shortOid: item.sha.slice(0, 7),
    message: item.commit.message.split('\n')[0],
    date: item.commit.committer?.date ?? item.commit.author?.date ?? '',
    url: item.html_url,
    author: item.author?.login ?? item.commit.author?.name ?? 'Desconhecido',
    authorLogin: item.author?.login,
    authorAvatar: item.author?.avatar_url,
    repo: item.repository.name,
    foundBy: 'message' as const,
  }));
}

type HistoryCommit = GqlCommit & { message: string };
interface HistoryRef { name: string; target: { history?: { nodes: HistoryCommit[] } } | null }
interface HistoryPage {
  organization: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: (Record<string, unknown> & {
        name: string;
        defaultBranchRef: HistoryRef | null;
        active: { nodes: HistoryRef[] } | null;
      })[];
    };
  } | null;
}

/**
 * Commits recentes das branches base e da principal de cada repositório (últimos 6 meses) e das
 * branches com atividade recente, como features e hotfixes (últimos 30 dias), filtrados pela mensagem.
 * Cobre o que a Search API não acha: commits que ainda não chegaram na branch principal
 * (ex: já estão em develop/homolog) e commits novos que o índice de busca ainda não incluiu.
 */
async function searchRecentHistory(token: string, org: string, text: string): Promise<CommitHit[]> {
  const historyFields = `target { ... on Commit { history(first: ${HISTORY_PER_BRANCH}, since: $since) { nodes { ${COMMIT_FIELDS} message } } } }`;
  const activeHistoryFields = `target { ... on Commit { history(first: ${ACTIVE_COMMITS_PER_BRANCH}, since: $activeSince) { nodes { ${COMMIT_FIELDS} message } } } }`;
  const query = `
    query($org: String!, $cursor: String, $since: GitTimestamp!, $activeSince: GitTimestamp!) {
      organization(login: $org) {
        repositories(first: ${REPOS_PER_PAGE}, after: $cursor, orderBy: { field: PUSHED_AT, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            name
            defaultBranchRef { name ${historyFields} }
            ${HISTORY_BRANCHES.map((name, i) => `h${i}: ref(qualifiedName: "refs/heads/${name}") { name ${historyFields} }`).join('\n')}
            active: refs(refPrefix: "refs/heads/", first: ${ACTIVE_BRANCHES_PER_REPO}, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
              nodes { name ${activeHistoryFields} }
            }
          }
        }
      }
    }
  `;
  const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
  const activeSince = new Date(Date.now() - ACTIVE_DAYS * 86400000).toISOString();
  const sinceTime = new Date(since).getTime();
  const hits: CommitHit[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_REPO_PAGES; page++) {
    const data: HistoryPage = await graphqlPartial<HistoryPage>(token, query, { org, cursor, since, activeSince });
    const repos = data.organization?.repositories;
    if (!repos) break;
    let anyRecent = false;

    for (const repo of repos.nodes) {
      if (!repo) continue;
      // Base primeiro: um commit que já está em develop/master aparece como de lá, não da feature
      const baseRefs: HistoryRef[] = [
        repo.defaultBranchRef,
        ...HISTORY_BRANCHES.map((_, i) => repo[`h${i}`] as HistoryRef | null | undefined),
      ].filter((r): r is HistoryRef => !!r);
      const baseNames = new Set(baseRefs.map(r => r.name));
      const refs = [...baseRefs, ...(repo.active?.nodes ?? []).filter(r => r && !baseNames.has(r.name))];
      for (const ref of refs) {
        const nodes = ref.target?.history?.nodes ?? [];
        if (nodes.length > 0) anyRecent = true;
        for (const c of nodes) {
          const key = `${repo.name}:${c.oid}`;
          if (seen.has(key) || !messageMatches(c.message, text)) continue;
          seen.add(key);
          hits.push({ ...toCommit(c), repo: repo.name, foundBy: 'message', branch: ref.name });
        }
      }
    }

    // Repositórios vêm do push mais recente para o mais antigo: se uma página inteira não teve
    // nenhum commit no período, as próximas também não terão
    if (!anyRecent || !repos.pageInfo.hasNextPage) break;
    cursor = repos.pageInfo.endCursor;
  }

  return hits
    .filter(c => new Date(c.date).getTime() >= sinceTime)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function searchRefs(token: string, org: string, rawText: string): Promise<RefSearchResult> {
  const text = rawText.trim();
  const [branchRes, messageRes, historyRes] = await Promise.allSettled([
    searchBranches(token, org, text),
    searchCommitMessages(token, org, text),
    looksLikeSha(text) ? Promise.resolve([]) : searchRecentHistory(token, org, text),
  ]);
  if (branchRes.status === 'rejected' && messageRes.status === 'rejected' && historyRes.status === 'rejected') throw branchRes.reason;
  if (messageRes.status === 'rejected') console.warn('Busca de commits (Search API) falhou:', messageRes.reason);
  if (historyRes.status === 'rejected') console.warn('Varredura de commits recentes falhou:', historyRes.reason);

  const b = branchRes.status === 'fulfilled' ? branchRes.value : { branches: [], hashCommits: [], truncatedRepos: [], reposScanned: 0 };
  const byMessage = messageRes.status === 'fulfilled' ? messageRes.value : [];
  const byHistory = historyRes.status === 'fulfilled' ? historyRes.value : [];

  // Hash primeiro; depois os commits por mensagem, mais recentes primeiro, sem repetir o mesmo commit
  // (quando o mesmo commit vem das duas fontes, fica a versão com a branch onde foi visto)
  const byKey = new Map<string, CommitHit>();
  for (const c of [...byHistory, ...byMessage]) {
    const key = `${c.repo}:${c.oid}`;
    if (!byKey.has(key)) byKey.set(key, c);
  }
  const hashKeys = new Set(b.hashCommits.map(c => `${c.repo}:${c.oid}`));
  const commits = [
    ...b.hashCommits,
    ...[...byKey.entries()]
      .filter(([key]) => !hashKeys.has(key))
      .map(([, c]) => c)
      .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime()),
  ];

  // Branches: nome exato primeiro, depois atividade mais recente; repositórios arquivados no fim
  const lower = text.toLowerCase();
  const branches = [...b.branches].sort((x, y) =>
    Number(x.archived) - Number(y.archived) ||
    Number(y.name.toLowerCase() === lower) - Number(x.name.toLowerCase() === lower) ||
    new Date(y.head?.date ?? 0).getTime() - new Date(x.head?.date ?? 0).getTime()
  );

  return {
    branches,
    commits,
    reposScanned: b.reposScanned,
    truncatedRepos: b.truncatedRepos,
    commitSearchError: messageRes.status === 'rejected' && historyRes.status === 'rejected'
      ? 'Não foi possível buscar commits pelo texto agora. Tente de novo em instantes.'
      : messageRes.status === 'rejected'
        ? 'A busca completa de commits do GitHub falhou agora (pode ser o limite de buscas por minuto); mostrando só os commits recentes das branches base.'
        : undefined,
  };
}

// ── Detalhes ─────────────────────────────────────────────────────────────────────────────────
interface BranchDetailResponse {
  repository: Record<string, unknown> & {
    defaultBranchRef: { name: string; compare: (GqlCompare & { commits: { totalCount: number; nodes: GqlCommit[] } }) | null } | null;
    ref: {
      target: { history?: { nodes: GqlCommit[] } } | null;
      associatedPullRequests: { nodes: GqlPr[] };
    } | null;
  } | null;
}

export async function getBranchDetail(token: string, org: string, repo: string, branch: string): Promise<BranchDetail> {
  const query = `
    query($owner: String!, $repo: String!, $head: String!, $qualified: String!) {
      repository(owner: $owner, name: $repo) {
        defaultBranchRef {
          name
          compare(headRef: $head) {
            aheadBy behindBy status
            commits(last: 100) { totalCount nodes { ${COMMIT_FIELDS} } }
          }
        }
        ref(qualifiedName: $qualified) {
          target { ... on Commit { history(first: 15) { nodes { ${COMMIT_FIELDS} } } } }
          associatedPullRequests(first: 5, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { ${PR_FIELDS} } }
        }
        ${baseCompareFields()}
      }
    }
  `;
  const data = await graphqlPartial<BranchDetailResponse>(token, query, {
    owner: org, repo, head: branch, qualified: `refs/heads/${branch}`,
  });
  const r = data.repository;
  if (!r) throw new Error('Repositório não encontrado');

  const defaultBranch = r.defaultBranchRef?.name ?? '';
  const cmp = r.defaultBranchRef?.compare ?? null;
  const byDateDesc = (a: RefCommit, b: RefCommit) => new Date(b.date).getTime() - new Date(a.date).getTime();

  return {
    defaultBranch,
    bases: collectBases(r, defaultBranch, cmp),
    aheadCommits: (cmp?.commits.nodes ?? []).map(toCommit).sort(byDateDesc),
    aheadTotal: cmp?.aheadBy ?? 0,
    history: (r.ref?.target?.history?.nodes ?? []).map(toCommit),
    prs: (r.ref?.associatedPullRequests.nodes ?? []).map(toPr),
  };
}

interface CommitDetailResponse {
  repository: Record<string, unknown> & {
    defaultBranchRef: { name: string; compare: GqlCompare | null } | null;
    object: {
      message: string;
      additions: number;
      deletions: number;
      changedFilesIfAvailable: number | null;
      associatedPullRequests: { nodes: GqlPr[] };
    } | null;
  } | null;
}

export async function getCommitDetail(token: string, org: string, repo: string, oid: string): Promise<CommitDetail> {
  const query = `
    query($owner: String!, $repo: String!, $head: String!, $oid: GitObjectID!) {
      repository(owner: $owner, name: $repo) {
        defaultBranchRef { name compare(headRef: $head) { aheadBy behindBy status } }
        object(oid: $oid) {
          ... on Commit {
            message additions deletions changedFilesIfAvailable
            associatedPullRequests(first: 5) { nodes { ${PR_FIELDS} } }
          }
        }
        ${baseCompareFields()}
      }
    }
  `;
  const data = await graphqlPartial<CommitDetailResponse>(token, query, { owner: org, repo, head: oid, oid });
  const r = data.repository;
  if (!r) throw new Error('Repositório não encontrado');
  const defaultBranch = r.defaultBranchRef?.name ?? '';
  return {
    fullMessage: r.object?.message ?? '',
    additions: r.object?.additions ?? 0,
    deletions: r.object?.deletions ?? 0,
    changedFiles: r.object?.changedFilesIfAvailable ?? null,
    bases: collectBases(r, defaultBranch, r.defaultBranchRef?.compare ?? null),
    prs: (r.object?.associatedPullRequests.nodes ?? []).map(toPr),
  };
}

/** Números de issue citados num texto ("#123") ou num nome de branch ("feature/123-ajuste") */
export function issueNumbersIn(text: string, { bare = false } = {}): number[] {
  const re = bare ? /(?:^|[^0-9A-Za-z])#?(\d{2,6})(?![0-9])/g : /(?:^|[^0-9A-Za-z&])#(\d{1,6})(?![0-9])/g;
  const found = new Set<number>();
  for (const m of text.matchAll(re)) found.add(Number(m[1]));
  return [...found];
}
