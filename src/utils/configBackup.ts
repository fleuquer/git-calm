/**
 * Exporta e importa todas as configurações do app (exceto credenciais de acesso).
 */

const BACKUP_VERSION = 1;

// Chaves de configuração a incluir no backup (sem token, org nem project)
const CONFIG_KEYS = [
  'github_views',
  'github_active_view',
  'github_theme',
  'github_collapsed_columns',
  'github_hidden_labels',
  'github_force_visible_labels',
  'github_compact_card_view',
  'realtime_enabled',
  'view_hidden_labels',
  'theme',
  'psi_repo_groups',
  'github-project-view-tags-mapping',
  'github-project-view-people-mapping',
  'github-project-ignored-repos',
  'github-project-view-repo-mapping',
  'github-project-tag-repo-mapping',
  'github-project-comment-templates',
  'github_font_size',
  'github_font_family',
  'notification_settings',
  // Monitor de atividades
  'activity_monitor_settings',
  'activity_log',
  // Templates de comentário
  'github-project-comment-templates-appearance',
  // Dashboard
  'dashboard_hidden_charts',
  'dashboard_table_byStatus',
  'dashboard_table_byRepo',
  'dashboard_table_byView',
  'dashboard_table_byAssignee',
  'dashboard_table_assigneeProgress',
  'dashboard_table_assigneeByLabel',
  'dashboard_table_byLabel',
  'dashboard_table_tagGroupVolume',
  'dashboard_table_labelHeatmap',
  'dashboard_table_byMonth',
  'dashboard_table_byWeekUpdated',
  'dashboard_table_dueDate',
  // Relatório diário
  'dailyReport_includedColumns',
] as const;

export type ConfigBackup = {
  _meta: {
    version: number;
    exportedAt: string;
    app: string;
  };
  [key: string]: unknown;
};

export function exportConfig(): void {
  const data: ConfigBackup = {
    _meta: {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'github-project-manager',
    },
  };

  for (const key of CONFIG_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      try {
        data[key] = JSON.parse(value);
      } catch {
        data[key] = value;
      }
    }
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `github-pm-config-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { ok: true; keysRestored: number }
  | { ok: false; error: string };

export async function importConfig(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const data: ConfigBackup = JSON.parse(raw);

        if (!data._meta || data._meta.app !== 'github-project-manager') {
          resolve({ ok: false, error: 'Arquivo inválido: não parece ser um backup desta aplicação.' });
          return;
        }

        let keysRestored = 0;
        for (const key of CONFIG_KEYS) {
          if (key in data) {
            const value = data[key];
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            keysRestored++;
          }
        }

        resolve({ ok: true, keysRestored });
      } catch {
        resolve({ ok: false, error: 'Erro ao ler o arquivo. Verifique se é um JSON válido.' });
      }
    };
    reader.readAsText(file);
  });
}
