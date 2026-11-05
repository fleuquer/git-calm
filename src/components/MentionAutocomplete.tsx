import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GitHubService } from '../services/github';
import { UserOption } from './UserOption';

/**
 * Autocomplete de menções (@usuario) em textareas de comentário (issue #8).
 *
 * Ao digitar "@", sugere usuários filtrando pelo que vem depois. As sugestões seguem a ordem de
 * prioridade recebida (ex: participantes do card, depois pessoas do board, depois membros da org).
 * A menção é inserida como "@login " em texto puro, então o GitHub identifica o usuário e
 * dispara a notificação normalmente ao publicar o comentário.
 */

export interface MentionUser {
  login: string;
  avatarUrl?: string;
  hint?: string; // ex: "neste card", "no board"
}

const MAX_SUGGESTIONS = 8;
// "@" no início ou após espaço/pontuação de abertura, seguido de até 39 caracteres válidos de login
const MENTION_BEFORE_CARET = /(?:^|[\s([{])@([A-Za-z0-9-]{0,39})$/;

/**
 * Filtra usuários pelo texto digitado (aceita "@" no início), mantendo a ordem de prioridade:
 * primeiro os logins que começam com o texto, depois os que apenas o contêm.
 */
export function rankUsers(users: MentionUser[], query: string, max = MAX_SUGGESTIONS): MentionUser[] {
  const q = query.replace(/^@/, '').trim().toLowerCase();
  if (!q) return users.slice(0, max);
  const starts = users.filter(u => u.login.toLowerCase().startsWith(q));
  const contains = users.filter(u => !u.login.toLowerCase().startsWith(q) && u.login.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, max);
}

// ── Membros da organização (carregados uma vez por org e mantidos em cache) ──────────────────
const orgMembersCache = new Map<string, Promise<MentionUser[]>>();

export function loadOrgMembers(token: string, org: string): Promise<MentionUser[]> {
  const key = org.toLowerCase();
  let cached = orgMembersCache.get(key);
  if (!cached) {
    cached = new GitHubService(token)
      .listOrganizationMembers(org)
      .then(members => members.map(m => ({ login: m.login, avatarUrl: m.avatarUrl })))
      .catch(() => {
        orgMembersCache.delete(key); // permite tentar de novo depois
        return [];
      });
    orgMembersCache.set(key, cached);
  }
  return cached;
}

// ── Posição do cursor dentro da textarea (técnica do "div espelho") ─────────────────────────
const MIRRORED_STYLES = [
  'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight',
  'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'fontFeatureSettings', 'textAlign', 'textTransform',
  'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize',
] as const;

function getCaretCoordinates(textarea: HTMLTextAreaElement, position: number): { top: number; left: number; height: number } {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  for (const prop of MIRRORED_STYLES) {
    (mirror.style as unknown as Record<string, string>)[prop] = style[prop];
  }
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement('span');
  marker.textContent = textarea.value.slice(position) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
  const coords = {
    top: marker.offsetTop - textarea.scrollTop,
    left: marker.offsetLeft - textarea.scrollLeft,
    height: lineHeight,
  };
  document.body.removeChild(mirror);
  return coords;
}

// ── Hook ─────────────────────────────────────────────────────────────────────────────────────
interface Options {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[]; // Em ordem de prioridade, sem duplicatas
  onActivate?: () => void; // Chamado na primeira vez que o usuário digita "@" (ex: carregar membros)
}

interface ActiveMention {
  start: number; // Índice do "@"
  query: string;
  top: number;
  left: number;
}

export function useMentionAutocomplete({ textareaRef, value, onChange, users, onActivate }: Options) {
  const [active, setActive] = useState<ActiveMention | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [activated, setActivated] = useState(false);

  const suggestions = useMemo(() => (active ? rankUsers(users, active.query) : []), [active, users]);

  // Recalcula a menção ativa a partir do texto antes do cursor
  const refresh = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || ta.selectionStart !== ta.selectionEnd) {
      setActive(null);
      return;
    }
    const caret = ta.selectionStart;
    const match = ta.value.slice(0, caret).match(MENTION_BEFORE_CARET);
    if (!match) {
      setActive(null);
      return;
    }
    const start = caret - match[1].length - 1;
    const coords = getCaretCoordinates(ta, start);
    if (active?.query !== match[1] || active?.start !== start) setHighlighted(0);
    setActive({ start, query: match[1], top: coords.top + coords.height + 4, left: coords.left });
    if (!activated) {
      setActivated(true);
      onActivate?.();
    }
  }, [textareaRef, active, activated, onActivate]);

  const select = useCallback((user: MentionUser) => {
    const ta = textareaRef.current;
    if (!ta || !active) return;
    const end = active.start + 1 + active.query.length;
    const insertion = `@${user.login} `;
    const next = value.slice(0, active.start) + insertion + value.slice(end).replace(/^ /, '');
    onChange(next);
    setActive(null);
    const caret = active.start + insertion.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }, [textareaRef, active, value, onChange]);

  // Fecha ao perder o foco (com atraso para permitir o clique numa sugestão)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const onBlur = () => setTimeout(() => setActive(null), 150);
    ta.addEventListener('blur', onBlur);
    return () => ta.removeEventListener('blur', onBlur);
  }, [textareaRef]);

  const isOpen = active !== null && suggestions.length > 0;

  /** Encaminhe o onKeyDown da textarea. Retorna true se a tecla foi tratada pelo autocomplete. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!isOpen) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => (h + 1) % suggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => (h - 1 + suggestions.length) % suggestions.length);
      return true;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      select(suggestions[Math.min(highlighted, suggestions.length - 1)]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setActive(null);
      return true;
    }
    return false;
  };

  // Lista de sugestões: renderize dentro de um container "relative" que envolva a textarea
  const popup = isOpen ? (
    <div
      className="absolute z-30 w-64 max-w-[calc(100%-1rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 overflow-hidden"
      style={{ top: active!.top, left: Math.max(0, active!.left) }}
      role="listbox"
    >
      {suggestions.map((user, i) => (
        <UserOption key={user.login} user={user} highlighted={i === highlighted} onSelect={() => select(user)} onHover={() => setHighlighted(i)} />
      ))}
    </div>
  ) : null;

  return {
    /** Chame no onChange/onClick/onKeyUp/onSelect da textarea para detectar "@" antes do cursor */
    refresh,
    handleKeyDown,
    popup,
  };
}
