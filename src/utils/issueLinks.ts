/**
 * Links do GitHub para issues/PRs da mesma organização (ex: referências "#123" no corpo de um
 * card, que o GitHub já entrega como <a href="https://github.com/org/repo/issues/123">).
 * Usado para abrir o card dentro do app em vez de sair para o GitHub (issue #5).
 */
export interface IssueLinkRef {
  owner: string;
  repo: string;
  number: number;
  kind: 'issue' | 'pull';
  url: string;
}

const ISSUE_URL = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/(issues|pull)\/(\d+)\/?(?:[?#].*)?$/i;

export function parseIssueLink(href: string, org: string): IssueLinkRef | null {
  const m = href.match(ISSUE_URL);
  if (!m) return null;
  const [, owner, repo, kind, num] = m;
  if (!org || owner.toLowerCase() !== org.toLowerCase()) return null;
  return { owner, repo, number: Number(num), kind: kind.toLowerCase() === 'pull' ? 'pull' : 'issue', url: href };
}

/** Clique "normal" (botão esquerdo, sem Ctrl/Cmd/Shift/Alt): os outros mantêm o comportamento do navegador. */
export function isPlainLeftClick(e: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}
