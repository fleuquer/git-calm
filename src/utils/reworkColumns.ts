// Configuração global de quais colunas contam como "retrabalho" (ex: uma coluna "Retorno").
// Cada projeto pode nomear essa coluna como quiser, por isso é uma lista configurável de nomes.
const REWORK_COLUMNS_KEY = 'github_rework_columns';

export function getReworkColumns(): string[] {
  try {
    const saved = localStorage.getItem(REWORK_COLUMNS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function setReworkColumns(columns: string[]): void {
  localStorage.setItem(REWORK_COLUMNS_KEY, JSON.stringify(columns));
}

export function isReworkColumn(columnName: string, reworkColumns: string[] = getReworkColumns()): boolean {
  return reworkColumns.includes(columnName);
}
