import type { MentionedIssue } from '../services/github';

/**
 * Menções pendentes de resposta (issue #7).
 *
 * Uma menção (@usuario feito por outra pessoa, na descrição ou num comentário do card) fica
 * pendente até que:
 *  - o usuário comente no mesmo card depois dela (marcando ou não quem o mencionou), ou
 *  - o usuário marque o card como respondido (ex: outra pessoa já respondeu por ele).
 * Se alguém mencionar o usuário de novo depois disso, o card volta a ficar pendente.
 */

export interface PendingMention {
  key: string;          // "repo#numero"
  repo: string;
  number: number;
  title: string;
  url: string;          // Link da issue
  mentionUrl: string;   // Link do comentário com a menção (ou da issue, se foi na descrição)
  mentionedBy: string;
  mentionedByAvatar: string;
  mentionedAt: string;
  excerpt: string;
  count: number;        // Menções sem resposta neste card
  closed: boolean;
}

const RESOLVED_KEY = 'github_mentions_resolved';
const RESOLVED_TTL_DAYS = 120;

export function mentionKey(repo: string, number: number): string {
  return `${repo.toLowerCase()}#${number}`;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentionRegex(login: string): RegExp {
  return new RegExp(`(^|[^A-Za-z0-9-_/@.])@${escapeRegex(login)}(?![A-Za-z0-9-])`, 'i');
}

/** Remove blocos de código e citações ("> ...") para não contar menções copiadas/citadas */
function stripQuotedAndCode(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .split('\n')
    .filter(line => !/^\s*>/.test(line))
    .join('\n');
}

function makeExcerpt(body: string, login: string): string {
  const clean = stripQuotedAndCode(body);
  const re = mentionRegex(login);
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const line = lines.find(l => re.test(l)) ?? lines[0] ?? '';
  const text = line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[imagem]')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

// ── Cards marcados como respondidos manualmente ──────────────────────────────────────────────
export function loadResolvedMentions(): Record<string, string> {
  try {
    const saved = localStorage.getItem(RESOLVED_KEY);
    const parsed: Record<string, string> = saved ? JSON.parse(saved) : {};
    // Descarta marcações antigas (a busca só olha os últimos meses)
    const limit = Date.now() - RESOLVED_TTL_DAYS * 86400000;
    return Object.fromEntries(Object.entries(parsed).filter(([, at]) => new Date(at).getTime() > limit));
  } catch {
    return {};
  }
}

export function saveResolvedMentions(resolved: Record<string, string>): void {
  try {
    localStorage.setItem(RESOLVED_KEY, JSON.stringify(resolved));
  } catch {
    // localStorage indisponível
  }
}

// ── Cálculo ──────────────────────────────────────────────────────────────────────────────────
export function computePendingMentions(
  issues: MentionedIssue[],
  login: string,
  resolved: Record<string, string>,
): PendingMention[] {
  const me = login.toLowerCase();
  const re = mentionRegex(login);
  const result: PendingMention[] = [];

  for (const issue of issues) {
    // Linha do tempo: descrição + comentários, em ordem cronológica
    const entries = [
      { body: issue.body, createdAt: issue.createdAt, url: issue.url, author: issue.author, authorAvatar: issue.authorAvatar },
      ...issue.comments,
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const key = mentionKey(issue.repo, issue.number);
    const resolvedAt = resolved[key] ? new Date(resolved[key]).getTime() : 0;

    // Último comentário meu (responde todas as menções anteriores a ele)
    let myLastReply = 0;
    for (const e of entries) {
      if (e.author.toLowerCase() === me) myLastReply = Math.max(myLastReply, new Date(e.createdAt).getTime());
    }
    const answeredUntil = Math.max(myLastReply, resolvedAt);

    const unanswered = entries.filter(e =>
      e.author &&
      e.author.toLowerCase() !== me &&
      new Date(e.createdAt).getTime() > answeredUntil &&
      re.test(stripQuotedAndCode(e.body))
    );
    if (unanswered.length === 0) continue;

    const last = unanswered[unanswered.length - 1];
    result.push({
      key,
      repo: issue.repo,
      number: issue.number,
      title: issue.title,
      url: issue.url,
      mentionUrl: last.url,
      mentionedBy: last.author,
      mentionedByAvatar: last.authorAvatar,
      mentionedAt: last.createdAt,
      excerpt: makeExcerpt(last.body, login),
      count: unanswered.length,
      closed: issue.state === 'CLOSED',
    });
  }

  // Mais recentes primeiro
  return result.sort((a, b) => new Date(b.mentionedAt).getTime() - new Date(a.mentionedAt).getTime());
}
