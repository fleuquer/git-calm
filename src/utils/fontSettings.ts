/**
 * Configurações globais de tipografia (tamanho e família de fonte).
 * Aplicadas como CSS no elemento <html> para escalar todos os rem do sistema.
 */

export const FONT_SIZES = [
  { id: 'xs',  label: 'Pequena',      value: '85%',  preview: '11px' },
  { id: 'sm',  label: 'Menor',        value: '92%',  preview: '12px' },
  { id: 'md',  label: 'Normal',       value: '100%', preview: '14px' },
  { id: 'lg',  label: 'Grande',       value: '112%', preview: '16px' },
  { id: 'xl',  label: 'Extra grande', value: '125%', preview: '18px' },
] as const;

export type FontSizeId = typeof FONT_SIZES[number]['id'];

export const FONT_FAMILIES = [
  { id: 'system', label: 'Sistema',    value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: 'inter',  label: 'Inter',      value: "'Inter', system-ui, sans-serif" },
  { id: 'mono',   label: 'Monospace',  value: "'Consolas', 'Menlo', 'Courier New', monospace" },
] as const;

export type FontFamilyId = typeof FONT_FAMILIES[number]['id'];

const LS_SIZE   = 'github_font_size';
const LS_FAMILY = 'github_font_family';

export function applyFontSettings(): void {
  const sizeId   = (localStorage.getItem(LS_SIZE)   || 'md') as FontSizeId;
  const familyId = (localStorage.getItem(LS_FAMILY) || 'system') as FontFamilyId;

  const sizeEntry   = FONT_SIZES.find(s => s.id === sizeId)     ?? FONT_SIZES[2];
  const familyEntry = FONT_FAMILIES.find(f => f.id === familyId) ?? FONT_FAMILIES[0];

  document.documentElement.style.fontSize   = sizeEntry.value;
  document.documentElement.style.fontFamily = familyEntry.value;
}

export function saveFontSize(id: FontSizeId): void {
  localStorage.setItem(LS_SIZE, id);
  applyFontSettings();
}

export function saveFontFamily(id: FontFamilyId): void {
  localStorage.setItem(LS_FAMILY, id);
  applyFontSettings();
}

export function getFontSize():   FontSizeId   { return (localStorage.getItem(LS_SIZE)   || 'md')     as FontSizeId; }
export function getFontFamily(): FontFamilyId { return (localStorage.getItem(LS_FAMILY) || 'system') as FontFamilyId; }
