import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Check } from 'lucide-react';
import { themes, getTheme, type Theme } from '../themes';

interface Props {
  selectedTheme: string;
  onThemeChange: (themeId: string) => void;
}

/** Seletor rápido de tema no cabeçalho (sem precisar abrir as configurações) */
export const ThemeSwitcher: React.FC<Props> = ({ selectedTheme, onThemeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getTheme(selectedTheme);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const renderOption = (theme: Theme) => {
    const [bg, card, text, accent] = theme.swatch;
    const isSelected = theme.id === current.id;
    return (
      <button
        key={theme.id}
        onClick={() => onThemeChange(theme.id)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-xs transition-colors ${
          isSelected
            ? 'text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/60'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        {/* Miniatura: fundo, card com texto e destaque */}
        <span
          className="w-7 h-5 rounded shrink-0 p-[3px] flex ring-1 ring-black/10 dark:ring-white/10"
          style={{ background: bg }}
        >
          <span className="flex-1 rounded-[2px] p-[2px] flex flex-col justify-between" style={{ background: card }}>
            <span className="h-[2px] w-full rounded-full" style={{ background: text, opacity: 0.8 }} />
            <span className="h-[2px] w-2/3 rounded-full" style={{ background: accent }} />
          </span>
        </span>
        <span className="text-left">{theme.name}</span>
        {isSelected && <Check size={12} className="ml-auto text-blue-600 dark:text-blue-400" />}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
          isOpen
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title={`Tema: ${current.name}`}
      >
        {current.isDark ? <Moon size={15} /> : <Sun size={15} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1 overflow-hidden">
          <div className="px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Claros</p>
          </div>
          {themes.filter(t => !t.isDark).map(renderOption)}

          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

          <div className="px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Escuros</p>
          </div>
          {themes.filter(t => t.isDark).map(renderOption)}
        </div>
      )}
    </div>
  );
};
