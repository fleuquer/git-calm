import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { rankUsers, type MentionUser } from './MentionAutocomplete';
import { UserOption } from './UserOption';

interface Props {
  users: MentionUser[];          // Em ordem de prioridade (mesma lista das menções)
  exclude: string[];             // Logins que já são responsáveis
  onSelect: (login: string) => Promise<void>;
  onCancel: () => void;
  onActivate?: () => void;       // Ao abrir (ex: carregar membros da org)
}

/**
 * Campo para adicionar responsável com sugestões de usuários (mesma ordem das menções:
 * pessoas do card, do board e membros da org). Aceita digitar com ou sem "@".
 */
export const AssigneePicker: React.FC<Props> = ({ users, exclude, onSelect, onCancel, onActivate }) => {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [saving, setSaving] = useState(false);
  const [activated, setActivated] = useState(false);

  const excluded = useMemo(() => new Set(exclude.map(l => l.toLowerCase())), [exclude]);
  const suggestions = useMemo(
    () => rankUsers(users.filter(u => !excluded.has(u.login.toLowerCase())), query),
    [users, excluded, query],
  );

  const submit = async (login: string) => {
    const clean = login.replace(/^@/, '').trim();
    if (!clean || saving) return;
    setSaving(true);
    try {
      await onSelect(clean);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setHighlighted(h => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setHighlighted(h => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Com sugestão na lista usa a destacada; sem nenhuma, tenta o texto digitado
      const pick = suggestions[Math.min(highlighted, suggestions.length - 1)];
      submit(pick ? pick.login : query);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="mt-2 relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
          onFocus={() => { if (!activated) { setActivated(true); onActivate?.(); } }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => { if (!saving) onCancel(); }, 150)}
          placeholder="Buscar usuário…"
          disabled={saving}
          className="w-full px-2 py-1 pr-7 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
        {saving && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
      </div>
      {!saving && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 overflow-hidden" role="listbox">
          {suggestions.length > 0 ? (
            suggestions.map((user, i) => (
              <UserOption
                key={user.login}
                user={user}
                highlighted={i === highlighted}
                onSelect={() => submit(user.login)}
                onHover={() => setHighlighted(i)}
              />
            ))
          ) : (
            <p className="px-2.5 py-2 text-xs text-gray-400 dark:text-gray-500">
              {query.trim() ? <>Nenhuma sugestão. Enter para adicionar <strong>{query.replace(/^@/, '').trim()}</strong>.</> : 'Carregando usuários…'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
