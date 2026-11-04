import type { CSSProperties } from 'react';

/**
 * Estilo de uma label do GitHub legível em qualquer tema: fundo levemente
 * tingido com a cor da label e texto na mesma cor, escurecido no tema claro
 * e clareado no escuro (labels amarelas/claras ficavam ilegíveis com texto branco).
 */
export function getLabelStyle(color: string): CSSProperties {
  const c = `#${color}`;
  const isDark = document.documentElement.classList.contains('dark');
  return isDark
    ? {
        backgroundColor: `color-mix(in oklch, ${c} 18%, transparent)`,
        color: `color-mix(in oklch, ${c} 65%, white)`,
        borderColor: `color-mix(in oklch, ${c} 35%, transparent)`,
        borderWidth: '1px',
      }
    : {
        backgroundColor: `color-mix(in oklch, ${c} 14%, white)`,
        color: `color-mix(in oklch, ${c} 50%, black)`,
        borderColor: `color-mix(in oklch, ${c} 35%, white)`,
        borderWidth: '1px',
      };
}
