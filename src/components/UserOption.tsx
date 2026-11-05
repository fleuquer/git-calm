import type { MentionUser } from './MentionAutocomplete';

/** Item da lista de sugestões (compartilhado entre menções e seleção de responsável) */
export function UserOption({ user, highlighted, onSelect, onHover }: {
  user: MentionUser;
  highlighted: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={highlighted}
      onMouseDown={(e) => { e.preventDefault(); onSelect(); }}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors ${
        highlighted ? 'bg-blue-50 dark:bg-blue-900/30' : ''
      }`}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full shrink-0" />
      ) : (
        <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
      )}
      <span className="truncate text-gray-800 dark:text-gray-200">{user.login}</span>
      {user.hint && <span className="ml-auto shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{user.hint}</span>}
    </button>
  );
}
