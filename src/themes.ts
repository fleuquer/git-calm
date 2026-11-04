/**
 * Temas do sistema.
 *
 * As cores vêm do Radix Colors (https://www.radix-ui.com/colors): escalas de
 * 12 tons feitas para interface, com contraste testado no claro e no escuro.
 * Os componentes usam a escala do Tailwind (bg-gray-800, text-gray-400,
 * bg-blue-600...); no Tailwind v4 cada tom é uma variável CSS, então cada tema
 * aponta --color-gray-* e --color-blue-* para o tom Radix com o mesmo papel.
 */
import '@radix-ui/colors/slate.css';
import '@radix-ui/colors/slate-dark.css';
import '@radix-ui/colors/sand.css';
import '@radix-ui/colors/sand-dark.css';
import '@radix-ui/colors/mauve.css';
import '@radix-ui/colors/mauve-dark.css';
import '@radix-ui/colors/indigo.css';
import '@radix-ui/colors/indigo-dark.css';
import '@radix-ui/colors/blue.css';
import '@radix-ui/colors/blue-dark.css';
import '@radix-ui/colors/iris.css';
import '@radix-ui/colors/iris-dark.css';
import '@radix-ui/colors/teal.css';
import '@radix-ui/colors/teal-dark.css';

type Step = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950';
const STEPS: Step[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

export interface Theme {
  id: string;
  name: string;
  description: string;
  isDark: boolean;
  /** Escala neutra do Radix (fundos, bordas e textos) */
  gray: 'slate' | 'sand' | 'mauve';
  /** Escala de destaque do Radix (substitui blue-* do Tailwind) */
  accent: 'indigo' | 'blue' | 'iris' | 'teal';
  /** Só escuros: quantos tons clarear os fundos (aceita meio tom; 1 = escuro, 2.5 = suave) */
  lift?: number;
  /** Cores para a miniatura no seletor de temas: [fundo, card, texto, destaque] */
  swatch: [string, string, string, string];
}

export const DEFAULT_LIGHT_THEME = 'light';
export const DEFAULT_DARK_THEME = 'dim';

export const themes: Theme[] = [
  {
    id: 'light',
    name: 'Claro',
    description: 'Neutro, alto contraste',
    isDark: false,
    gray: 'slate',
    accent: 'indigo',
    swatch: ['#e0e1e6', '#f0f0f3', '#1c2024', '#3e63dd'],
  },
  {
    id: 'light-warm',
    name: 'Claro quente',
    description: 'Tons de papel, menos frio',
    isDark: false,
    gray: 'sand',
    accent: 'indigo',
    swatch: ['#e2e1de', '#f1f0ef', '#21201c', '#3e63dd'],
  },
  {
    id: 'dim',
    name: 'Escuro suave',
    description: 'Fundos em cinza médio, cansa menos',
    isDark: true,
    gray: 'slate',
    accent: 'blue',
    lift: 2.5,
    swatch: ['#242528', '#323539', '#edeef0', '#0090ff'],
  },
  {
    id: 'dark',
    name: 'Escuro',
    description: 'Mais escuro, máximo contraste',
    isDark: true,
    gray: 'slate',
    accent: 'indigo',
    lift: 1,
    swatch: ['#18191b', '#272a2d', '#edeef0', '#3e63dd'],
  },
  {
    id: 'dark-warm',
    name: 'Escuro quente',
    description: 'Cinzas amarronzados, destaque verde-água',
    isDark: true,
    gray: 'sand',
    accent: 'teal',
    lift: 2,
    swatch: ['#222221', '#31312e', '#eeeeec', '#12a594'],
  },
  {
    id: 'violet',
    name: 'Violeta',
    description: 'Cinzas levemente arroxeados',
    isDark: true,
    gray: 'mauve',
    accent: 'iris',
    lift: 2,
    swatch: ['#232225', '#323035', '#eeeef0', '#5b5bd6'],
  },
];

/** Temas removidos nas reformulações visuais → tema equivalente atual */
const LEGACY_THEME_MAP: Record<string, string> = {
  'github-dark': 'dim',
  'atom': 'dim',
  'one-dark-pro': 'dim',
  'solarized-dark': 'dim',
  'nord': 'dark',
  'tokyo-night': 'dark',
  'dracula': 'violet',
  'palenight': 'violet',
  'material-theme': 'violet',
  'catppuccin': 'violet',
  'monokai': 'dark-warm',
  'monokai-pro': 'dark-warm',
  'gruvbox': 'dark-warm',
};

export function resolveThemeId(themeId: string | null): string {
  if (themeId && themes.some(t => t.id === themeId)) return themeId;
  if (themeId && LEGACY_THEME_MAP[themeId]) return LEGACY_THEME_MAP[themeId];
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
}

export function getTheme(themeId: string): Theme {
  return themes.find(t => t.id === resolveThemeId(themeId)) || themes[0];
}

// Um tom Radix (1-12, aceita fração como 4.5) ou uma mistura entre dois tons
type Tone = number | [number, number, number];

const tone = (scale: string, t: Tone): string => {
  if (typeof t === 'number') {
    if (Number.isInteger(t)) return `var(--${scale}-${t})`;
    const low = Math.floor(t);
    return tone(scale, [low, low + 1, Math.round((t - low) * 100)]);
  }
  return `color-mix(in oklab, var(--${scale}-${t[0]}), var(--${scale}-${t[1]}) ${t[2]}%)`;
};

/*
 * Papel de cada tom do Tailwind nos componentes → tom Radix equivalente.
 * Radix: 1-2 fundo do app, 3-5 fundo de elementos, 6-8 bordas,
 * 9-10 cor sólida, 11 texto secundário, 12 texto principal.
 */
const LIGHT_GRAY: Record<Step, Tone> = {
  '50': 4,             // hover sutil sobre cards/painéis
  '100': 5,            // fundo da página e das colunas, botões neutros
  '200': 6.5,          // bordas sutis, badges
  '300': 7,            // bordas de input
  '400': 9,            // ícones, texto apagado
  '500': 10,           // texto terciário
  '600': 11,           // texto secundário
  '700': [11, 12, 50], // texto secundário forte
  '800': [11, 12, 80],
  '900': 12,           // texto principal
  '950': 12,
};

// Escuro: os tons de fundo sobem `lift` passos nos temas mais suaves
function darkGray(lift: number): Record<Step, Tone> {
  return {
    '50': 12,
    '100': 12,                       // texto principal
    '200': [11, 12, 75],
    '300': [11, 12, 40],
    '400': 11,                       // texto secundário
    '500': 10,                       // texto terciário, ícones
    '600': Math.min(6.5 + lift, 8),  // bordas de input, hover sobre elementos
    '700': Math.min(5.5 + lift, 7),  // bordas, hover, inputs
    '800': 3 + lift,                 // cards, painéis, cabeçalho
    '900': 1 + lift,                 // fundo da página
    '950': 1,
  };
}

// Tom das superfícies (bg-white) nos temas claros
const LIGHT_SURFACE: Tone = 3;

const LIGHT_ACCENT: Record<Step, Tone> = {
  '50': 2, '100': 3, '200': 5, '300': 7, '400': 8, '500': 9,
  '600': 9,   // botões; com indigo também tem contraste para texto
  '700': 10,  // hover de botão
  '800': 11, '900': 12, '950': 12,
};

const DARK_ACCENT: Record<Step, Tone> = {
  '50': 12, '100': 12, '200': 12, '300': 11,
  '400': 11,  // links e textos de destaque
  '500': 9, '600': 9, '700': 10,
  '800': 7, '900': 6, '950': 3,  // fundos tingidos (bg-blue-900/30)
};

/** Aplica as escalas de cor do tema e a classe dark/light no <html> */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme.isDark);
  root.classList.toggle('light', !theme.isDark);
  root.style.colorScheme = theme.isDark ? 'dark' : 'light';
  root.setAttribute('data-theme', theme.id);

  const gray = theme.isDark ? darkGray(theme.lift ?? 0) : LIGHT_GRAY;
  const accent = theme.isDark ? DARK_ACCENT : LIGHT_ACCENT;
  for (const step of STEPS) {
    root.style.setProperty(`--color-gray-${step}`, tone(theme.gray, gray[step]));
    root.style.setProperty(`--color-blue-${step}`, tone(theme.accent, accent[step]));
  }

  // No claro, "branco" (cards, cabeçalho, modais) vira um off-white do tema:
  // o #fff puro sobre o fundo cinza contrastava demais
  if (theme.isDark) {
    root.style.removeProperty('--color-white');
  } else {
    root.style.setProperty('--color-white', tone(theme.gray, LIGHT_SURFACE));
  }
}
