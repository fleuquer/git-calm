import React, { useState } from 'react';
import { Sun, Moon, Check, ChevronDown } from 'lucide-react';
import { themes, getTheme, type Theme } from '../themes';

interface Props {
  selectedTheme: string;
  onThemeChange: (themeId: string) => void;
}

const Swatch: React.FC<{ theme: Theme }> = ({ theme }) => {
  const [bg, card, text, accent] = theme.swatch;
  return (
    <span className="w-7 h-5 rounded shrink-0 p-[3px] flex ring-1 ring-black/10 dark:ring-white/10" style={{ background: bg }}>
      <span className="flex-1 rounded-[2px] p-[2px] flex flex-col justify-between" style={{ background: card }}>
        <span className="h-[2px] w-full rounded-full" style={{ background: text, opacity: 0.8 }} />
        <span className="h-[2px] w-2/3 rounded-full" style={{ background: accent }} />
      </span>
    </span>
  );
};

/**
 * Troca rápida de tema dentro do menu de opções do cabeçalho: uma linha "Tema" que expande
 * a lista de temas no próprio menu (o menu continua aberto para ver o resultado na hora).
 */
export const ThemeMenuItem: React.FC<Props> = ({ selectedTheme, onThemeChange }) => {
  const [expanded, setExpanded] = useState(false);
  const current = getTheme(selectedTheme);

  const renderOption = (theme: Theme) => {
    const isSelected = theme.id === current.id;
    return (
      <button
        key={theme.id}
        onClick={() => onThemeChange(theme.id)}
        className={`w-full flex items-center gap-3 pl-6 pr-3 py-1.5 text-xs transition-colors ${
          isSelected
            ? 'text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/60'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <Swatch theme={theme} />
        <span className="text-left">{theme.name}</span>
        {isSelected && <Check size={12} className="ml-auto text-blue-600 dark:text-blue-400" />}
      </button>
    );
  };

  return (
    <>
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {current.isDark
          ? <Moon size={14} className="text-gray-400 shrink-0" />
          : <Sun size={14} className="text-gray-400 shrink-0" />}
        <span>Tema</span>
        <span className="ml-auto flex items-center gap-1 text-gray-400 dark:text-gray-500 min-w-0">
          <span className="truncate">{current.name}</span>
          <ChevronDown size={12} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div className="pb-1">
          <p className="pl-6 pr-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Claros</p>
          {themes.filter(t => !t.isDark).map(renderOption)}
          <p className="pl-6 pr-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Escuros</p>
          {themes.filter(t => t.isDark).map(renderOption)}
        </div>
      )}
    </>
  );
};
