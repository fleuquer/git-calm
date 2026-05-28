export interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    primary: string;
    primaryHover: string;
    cardBg: string;
    cardBorder: string;
    columnBg: string;
    columnHeader: string;
    badge: string;
    badgeText: string;
  };
}

export const themes: Theme[] = [
  {
    id: 'light',
    name: 'Light',
    isDark: false,
    colors: {
      background: 'bg-[#f6f8fa]',
      surface: 'bg-white',
      surfaceHover: 'hover:bg-[#f6f8fa]',
      border: 'border-[#d0d7de]',
      text: 'text-[#24292f]',
      textSecondary: 'text-[#57606a]',
      primary: 'bg-[#0969da]',
      primaryHover: 'hover:bg-[#0860ca]',
      cardBg: 'bg-white',
      cardBorder: 'border-[#d0d7de]',
      columnBg: 'bg-[#f6f8fa]',
      columnHeader: 'bg-white',
      badge: 'bg-[#ddf4ff]',
      badgeText: 'text-[#0969da]',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    isDark: true,
    colors: {
      background: 'bg-gray-900',
      surface: 'bg-gray-800',
      surfaceHover: 'hover:bg-gray-700',
      border: 'border-gray-700',
      text: 'text-gray-100',
      textSecondary: 'text-gray-400',
      primary: 'bg-blue-600',
      primaryHover: 'hover:bg-blue-700',
      cardBg: 'bg-gray-800',
      cardBorder: 'border-gray-700',
      columnBg: 'bg-gray-800/50',
      columnHeader: 'bg-gray-800',
      badge: 'bg-gray-700',
      badgeText: 'text-gray-300',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    isDark: true,
    colors: {
      background: 'bg-[#282a36]',
      surface: 'bg-[#383a59]',
      surfaceHover: 'hover:bg-[#44475a]',
      border: 'border-[#44475a]',
      text: 'text-[#f8f8f2]',
      textSecondary: 'text-[#6272a4]',
      primary: 'bg-[#bd93f9]',
      primaryHover: 'hover:bg-[#a97fe8]',
      cardBg: 'bg-[#383a59]',
      cardBorder: 'border-[#44475a]',
      columnBg: 'bg-[#282a36]',
      columnHeader: 'bg-[#383a59]',
      badge: 'bg-[#44475a]',
      badgeText: 'text-[#f8f8f2]',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    isDark: true,
    colors: {
      background: 'bg-[#272822]',
      surface: 'bg-[#3e3d32]',
      surfaceHover: 'hover:bg-[#49483e]',
      border: 'border-[#49483e]',
      text: 'text-[#f8f8f2]',
      textSecondary: 'text-[#75715e]',
      primary: 'bg-[#66d9ef]',
      primaryHover: 'hover:bg-[#52c5db]',
      cardBg: 'bg-[#3e3d32]',
      cardBorder: 'border-[#49483e]',
      columnBg: 'bg-[#272822]',
      columnHeader: 'bg-[#3e3d32]',
      badge: 'bg-[#49483e]',
      badgeText: 'text-[#a6e22e]',
    },
  },
  {
    id: 'atom',
    name: 'Atom One Dark',
    isDark: true,
    colors: {
      background: 'bg-[#282c34]',
      surface: 'bg-[#21252b]',
      surfaceHover: 'hover:bg-[#2c313a]',
      border: 'border-[#181a1f]',
      text: 'text-[#abb2bf]',
      textSecondary: 'text-[#5c6370]',
      primary: 'bg-[#61afef]',
      primaryHover: 'hover:bg-[#4d9ad9]',
      cardBg: 'bg-[#21252b]',
      cardBorder: 'border-[#181a1f]',
      columnBg: 'bg-[#282c34]',
      columnHeader: 'bg-[#21252b]',
      badge: 'bg-[#2c313a]',
      badgeText: 'text-[#98c379]',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    isDark: true,
    colors: {
      background: 'bg-[#0d1117]',
      surface: 'bg-[#161b22]',
      surfaceHover: 'hover:bg-[#21262d]',
      border: 'border-[#30363d]',
      text: 'text-[#c9d1d9]',
      textSecondary: 'text-[#8b949e]',
      primary: 'bg-[#58a6ff]',
      primaryHover: 'hover:bg-[#4493e6]',
      cardBg: 'bg-[#161b22]',
      cardBorder: 'border-[#30363d]',
      columnBg: 'bg-[#0d1117]',
      columnHeader: 'bg-[#161b22]',
      badge: 'bg-[#21262d]',
      badgeText: 'text-[#c9d1d9]',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    isDark: true,
    colors: {
      background: 'bg-[#2e3440]',
      surface: 'bg-[#3b4252]',
      surfaceHover: 'hover:bg-[#434c5e]',
      border: 'border-[#4c566a]',
      text: 'text-[#eceff4]',
      textSecondary: 'text-[#d8dee9]',
      primary: 'bg-[#88c0d0]',
      primaryHover: 'hover:bg-[#73b0c0]',
      cardBg: 'bg-[#3b4252]',
      cardBorder: 'border-[#4c566a]',
      columnBg: 'bg-[#2e3440]',
      columnHeader: 'bg-[#3b4252]',
      badge: 'bg-[#434c5e]',
      badgeText: 'text-[#81a1c1]',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    isDark: true,
    colors: {
      background: 'bg-[#002b36]',
      surface: 'bg-[#073642]',
      surfaceHover: 'hover:bg-[#094050]',
      border: 'border-[#586e75]',
      text: 'text-[#839496]',
      textSecondary: 'text-[#657b83]',
      primary: 'bg-[#268bd2]',
      primaryHover: 'hover:bg-[#2176b8]',
      cardBg: 'bg-[#073642]',
      cardBorder: 'border-[#586e75]',
      columnBg: 'bg-[#002b36]',
      columnHeader: 'bg-[#073642]',
      badge: 'bg-[#094050]',
      badgeText: 'text-[#93a1a1]',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    isDark: true,
    colors: {
      background: 'bg-[#282828]',
      surface: 'bg-[#3c3836]',
      surfaceHover: 'hover:bg-[#504945]',
      border: 'border-[#504945]',
      text: 'text-[#ebdbb2]',
      textSecondary: 'text-[#a89984]',
      primary: 'bg-[#b8bb26]',
      primaryHover: 'hover:bg-[#98971a]',
      cardBg: 'bg-[#3c3836]',
      cardBorder: 'border-[#504945]',
      columnBg: 'bg-[#282828]',
      columnHeader: 'bg-[#3c3836]',
      badge: 'bg-[#504945]',
      badgeText: 'text-[#b8bb26]',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    isDark: true,
    colors: {
      background: 'bg-[#1e1e2e]',
      surface: 'bg-[#313244]',
      surfaceHover: 'hover:bg-[#45475a]',
      border: 'border-[#45475a]',
      text: 'text-[#cdd6f4]',
      textSecondary: 'text-[#a6adc8]',
      primary: 'bg-[#89b4fa]',
      primaryHover: 'hover:bg-[#74a0e8]',
      cardBg: 'bg-[#313244]',
      cardBorder: 'border-[#45475a]',
      columnBg: 'bg-[#1e1e2e]',
      columnHeader: 'bg-[#313244]',
      badge: 'bg-[#45475a]',
      badgeText: 'text-[#89b4fa]',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    isDark: true,
    colors: {
      background: 'bg-[#1a1b26]',
      surface: 'bg-[#24283b]',
      surfaceHover: 'hover:bg-[#292e42]',
      border: 'border-[#414868]',
      text: 'text-[#c0caf5]',
      textSecondary: 'text-[#9aa5ce]',
      primary: 'bg-[#7aa2f7]',
      primaryHover: 'hover:bg-[#6590e5]',
      cardBg: 'bg-[#24283b]',
      cardBorder: 'border-[#414868]',
      columnBg: 'bg-[#1a1b26]',
      columnHeader: 'bg-[#24283b]',
      badge: 'bg-[#292e42]',
      badgeText: 'text-[#7aa2f7]',
    },
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    isDark: true,
    colors: {
      background: 'bg-[#2d2a2e]',
      surface: 'bg-[#403e41]',
      surfaceHover: 'hover:bg-[#5b595c]',
      border: 'border-[#727072]',
      text: 'text-[#fcfcfa]',
      textSecondary: 'text-[#939293]',
      primary: 'bg-[#ffd866]',
      primaryHover: 'hover:bg-[#ffcc33]',
      cardBg: 'bg-[#403e41]',
      cardBorder: 'border-[#5b595c]',
      columnBg: 'bg-[#221f22]',
      columnHeader: 'bg-[#403e41]',
      badge: 'bg-[#5b595c]',
      badgeText: 'text-[#a9dc76]',
    },
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    isDark: true,
    colors: {
      background: 'bg-[#282c34]',
      surface: 'bg-[#2c313c]',
      surfaceHover: 'hover:bg-[#3e4451]',
      border: 'border-[#3e4451]',
      text: 'text-[#abb2bf]',
      textSecondary: 'text-[#5c6370]',
      primary: 'bg-[#61afef]',
      primaryHover: 'hover:bg-[#528bcc]',
      cardBg: 'bg-[#2c313c]',
      cardBorder: 'border-[#3e4451]',
      columnBg: 'bg-[#21252b]',
      columnHeader: 'bg-[#2c313c]',
      badge: 'bg-[#3e4451]',
      badgeText: 'text-[#98c379]',
    },
  },
  {
    id: 'material-theme',
    name: 'Material Theme',
    isDark: true,
    colors: {
      background: 'bg-[#263238]',
      surface: 'bg-[#2e3c43]',
      surfaceHover: 'hover:bg-[#37474f]',
      border: 'border-[#37474f]',
      text: 'text-[#eeffff]',
      textSecondary: 'text-[#546e7a]',
      primary: 'bg-[#80cbc4]',
      primaryHover: 'hover:bg-[#6fb8b0]',
      cardBg: 'bg-[#2e3c43]',
      cardBorder: 'border-[#37474f]',
      columnBg: 'bg-[#1e272c]',
      columnHeader: 'bg-[#2e3c43]',
      badge: 'bg-[#37474f]',
      badgeText: 'text-[#c3e88d]',
    },
  },
  {
    id: 'palenight',
    name: 'Palenight',
    isDark: true,
    colors: {
      background: 'bg-[#292d3e]',
      surface: 'bg-[#32364a]',
      surfaceHover: 'hover:bg-[#3b3f51]',
      border: 'border-[#3b3f51]',
      text: 'text-[#a6accd]',
      textSecondary: 'text-[#676e95]',
      primary: 'bg-[#82aaff]',
      primaryHover: 'hover:bg-[#6f95e6]',
      cardBg: 'bg-[#32364a]',
      cardBorder: 'border-[#3b3f51]',
      columnBg: 'bg-[#232635]',
      columnHeader: 'bg-[#32364a]',
      badge: 'bg-[#3b3f51]',
      badgeText: 'text-[#c3e88d]',
    },
  },
];

// Função auxiliar para extrair valor hexadecimal das classes Tailwind
function extractColorValue(className: string): string {
  // Se é uma classe custom com [], extrai o valor
  const customMatch = className.match(/\[([#\w]+)\]/);
  if (customMatch) {
    return customMatch[1];
  }

  // Mapeamento de cores Tailwind padrão para hex
  const colorMap: Record<string, string> = {
    'gray-50': '#f9fafb',
    'gray-100': '#f3f4f6',
    'gray-200': '#e5e7eb',
    'gray-300': '#d1d5db',
    'gray-400': '#9ca3af',
    'gray-500': '#6b7280',
    'gray-600': '#4b5563',
    'gray-700': '#374151',
    'gray-800': '#1f2937',
    'gray-900': '#111827',
    'white': '#ffffff',
    'blue-500': '#3b82f6',
    'blue-600': '#2563eb',
    'blue-700': '#1d4ed8',
  };

  // Remove prefixo (bg-, text-, border-) e busca no mapa
  const colorKey = className.replace(/^(bg-|text-|border-|hover:bg-)/, '');
  return colorMap[colorKey] || colorKey;
}

// Função para clarear uma cor hex (aumentar contraste para bordas)
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const factor = 1 - percent / 100;
  const r = Math.max(0, Math.floor((num >> 16) * factor));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * factor));
  const b = Math.max(0, Math.floor((num & 0x0000FF) * factor));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + ((255 - (num >> 16)) * percent / 100)));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + ((255 - ((num >> 8) & 0x00FF)) * percent / 100)));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + ((255 - (num & 0x0000FF)) * percent / 100)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

export function getTheme(themeId: string): Theme {
  return themes.find(t => t.id === themeId) || themes[0];
}

// Aplica as cores do tema como CSS variables
export function applyThemeColors(theme: Theme) {
  const root = document.documentElement;

  const bgColor = extractColorValue(theme.colors.background);
  const surfaceColor = extractColorValue(theme.colors.surface);
  let borderColor = extractColorValue(theme.colors.border);
  const textColor = extractColorValue(theme.colors.text);
  const textSecondaryColor = extractColorValue(theme.colors.textSecondary);

  // Para temas dark, clarear a borda em 20% para melhor contraste
  if (theme.isDark && borderColor.startsWith('#')) {
    borderColor = lightenColor(borderColor, 20);
  }

  console.log('🎨 Aplicando tema:', theme.name);
  console.log('  Background:', bgColor);
  console.log('  Surface:', surfaceColor);
  console.log('  Border:', borderColor);
  console.log('  Text:', textColor);
  console.log('  Text Secondary:', textSecondaryColor);

  root.style.setProperty('--color-background', bgColor);
  root.style.setProperty('--color-surface', surfaceColor);
  root.style.setProperty('--color-border', borderColor);
  root.style.setProperty('--color-text', textColor);
  root.style.setProperty('--color-text-secondary', textSecondaryColor);
  root.style.setProperty('--color-card-bg', extractColorValue(theme.colors.cardBg));
  root.style.setProperty('--color-card-border', extractColorValue(theme.colors.cardBorder));
  root.style.setProperty('--color-column-bg', extractColorValue(theme.colors.columnBg));

  // Cores para os comentários adaptadas ao tema
  // Dark: header = bgColor (mais escuro), body = surface clarificado (+10%) para contrastar com o fundo do modal
  // Light: header = bgColor (levemente cinza), body = surface escurecido (-4%) para contrastar com o branco do modal
  const commentHeaderColor = bgColor;
  const commentBodyColor = theme.isDark
    ? (surfaceColor.startsWith('#') ? lightenColor(surfaceColor, 10) : surfaceColor)
    : (surfaceColor.startsWith('#') ? darkenColor(surfaceColor, 4) : '#f4f4f4');
  root.style.setProperty('--color-comment-header', commentHeaderColor);
  root.style.setProperty('--color-comment-body', commentBodyColor);
  root.style.setProperty('--color-comment-border', borderColor);
}
