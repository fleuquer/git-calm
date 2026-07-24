// Configuração global de quais colunas contam como "bloqueio/impedimento" (ex: uma coluna "Bloqueado" ou "Pausado").
// Cada projeto pode nomear essa coluna como quiser, por isso é uma lista configurável de nomes.
const BLOCKED_COLUMNS_KEY = 'github_blocked_columns';

export function getBlockedColumns(): string[] {
  try {
    const saved = localStorage.getItem(BLOCKED_COLUMNS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function setBlockedColumns(columns: string[]): void {
  localStorage.setItem(BLOCKED_COLUMNS_KEY, JSON.stringify(columns));
}

export function isBlockedColumn(columnName: string, blockedColumns: string[] = getBlockedColumns()): boolean {
  return blockedColumns.includes(columnName);
}
