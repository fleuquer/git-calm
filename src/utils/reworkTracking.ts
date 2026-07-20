// Rastreamento local de "retrabalho": toda vez que o app detecta (via polling) um card
// entrando em uma coluna marcada como retrabalho, registramos aqui.
//
// Importante: o GitHub não oferece uma API retroativa para reconstruir o histórico de
// mudanças de coluna de um Project v2 (isso só existe via webhook, em tempo real). Por isso
// este rastreamento só é confiável a partir do momento em que passou a ser usado — ele não
// enxerga movimentações que aconteceram antes disso ou enquanto o app estava fechado.
const REWORK_HISTORY_KEY = 'github_rework_history';

export interface ReworkInfo {
  count: number;
  lastAt: string;
  columns: string[];
}

type ReworkHistoryMap = Record<string, ReworkInfo>;

function loadHistory(): ReworkHistoryMap {
  try {
    const saved = localStorage.getItem(REWORK_HISTORY_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveHistory(history: ReworkHistoryMap): void {
  try {
    localStorage.setItem(REWORK_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // quota do localStorage estourada — ignora, não é dado crítico
  }
}

export function recordReworkVisit(cardNumber: number, column: string, at: string): void {
  const history = loadHistory();
  const key = String(cardNumber);
  const existing = history[key];
  history[key] = {
    count: (existing?.count ?? 0) + 1,
    lastAt: at,
    columns: [...(existing?.columns ?? []), column],
  };
  saveHistory(history);
}

export function getReworkInfo(cardNumber: number): ReworkInfo | undefined {
  return loadHistory()[String(cardNumber)];
}

export function getAllReworkInfo(): ReworkHistoryMap {
  return loadHistory();
}
