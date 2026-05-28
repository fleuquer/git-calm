import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart2, Eye, EyeOff, Filter, Table } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line,
} from 'recharts';
import type { ProjectColumn, ViewTab } from '../types';
import { filterColumns } from '../utils/filterUtils';
import { getPeopleForView } from '../utils/viewPeopleMapping';
import { loadViewTagsMapping } from '../utils/viewTagsMapping';

interface Props {
  columns: ProjectColumn[];
  views: ViewTab[];
}

const PALETTE = [
  '#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6',
  '#a855f7','#14b8a6','#f97316','#ec4899','#84cc16',
  '#06b6d4','#e11d48','#8b5cf6','#10b981','#fbbf24',
];
function color(i: number) { return PALETTE[i % PALETTE.length]; }

// ── Chart IDs & labels ────────────────────────────────────────────────────
const CHART_IDS = [
  'byStatus', 'byRepo', 'byView',
  'byAssignee', 'assigneeProgress', 'assigneeByLabel',
  'byLabel', 'tagGroupVolume', 'labelHeatmap',
  'byMonth', 'byWeekUpdated', 'dueDate',
] as const;
type ChartId = typeof CHART_IDS[number];

const CHART_LABELS: Record<ChartId, string> = {
  byStatus: 'Cards por status',
  byRepo: 'Cards por repositório',
  byView: 'Cards por equipe / área',
  byAssignee: 'Carga por responsável',
  assigneeProgress: 'Progresso por responsável',
  assigneeByLabel: 'Tipos de tarefa por responsável',
  byLabel: 'Labels mais frequentes',
  tagGroupVolume: 'Volume por grupo de tags',
  labelHeatmap: 'Mapa de calor — Labels × Status',
  byMonth: 'Cards criados por mês',
  byWeekUpdated: 'Atividade recente',
  dueDate: 'Risco de prazo',
};

const HIDDEN_STORAGE = 'dashboard_hidden_charts';

// ── CustomTooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.stroke || p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const renderPieLabel = ({ percent }: any) =>
  percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : '';

// ── SectionTitle ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="col-span-2 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-2 mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">
      {children}
    </h2>
  );
}

// ── FilterDropdown ────────────────────────────────────────────────────────
function FilterDropdown({ items, excluded, onToggle, onSelectAll, onClearAll }: {
  items: string[];
  excluded: Set<string>;
  onToggle: (item: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeCount = items.length - excluded.size;
  const hasFilter = excluded.size > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Filtrar itens exibidos"
        className={`flex items-center gap-1 px-1.5 py-1 text-[11px] rounded border transition-colors ${
          hasFilter
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'
            : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
        }`}
      >
        <Filter size={11} />
        {hasFilter && <span className="font-medium">{activeCount}/{items.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 min-w-[180px]">
          <div className="flex gap-3 mb-2 px-1 border-b border-gray-100 dark:border-gray-700 pb-1.5">
            <button onClick={onSelectAll} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">Todos</button>
            <button onClick={onClearAll} className="text-[11px] text-gray-400 hover:underline">Nenhum</button>
          </div>
          <div className="space-y-0.5 max-h-52 overflow-y-auto">
            {items.map(item => (
              <label key={item} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={!excluded.has(item)}
                  onChange={() => onToggle(item)}
                  className="w-3 h-3 accent-indigo-600"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SimpleTable ───────────────────────────────────────────────────────────
function SimpleTable({ rows, valueLabel = 'Cards' }: {
  rows: Array<{ name: string; value: number }>;
  valueLabel?: string;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="pb-2 pr-4 text-left font-semibold text-gray-500 dark:text-gray-400">Item</th>
            <th className="pb-2 px-3 text-right font-semibold text-gray-500 dark:text-gray-400">{valueLabel}</th>
            <th className="pb-2 pl-2 text-right font-semibold text-gray-500 dark:text-gray-400">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-700/40 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/20">
              <td className="py-1.5 pr-4 font-medium text-gray-800 dark:text-gray-200">{row.name}</td>
              <td className="py-1.5 px-3 text-right font-bold text-gray-700 dark:text-gray-300">{row.value}</td>
              <td className="py-1.5 pl-2 text-right text-gray-400 dark:text-gray-500">
                {total > 0 ? ((row.value / total) * 100).toFixed(1) : '0'}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, tableSlot, defaultShowTable = false, storageKey, cols = 1, onHide, filterSlot, className }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tableSlot?: React.ReactNode;
  defaultShowTable?: boolean;
  storageKey?: string;
  cols?: 1 | 2;
  onHide?: () => void;
  filterSlot?: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) return saved === '1';
      } catch { /* ignore */ }
    }
    return defaultShowTable;
  });

  const toggleTable = () => setShowTable(prev => {
    const next = !prev;
    if (storageKey) {
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* ignore */ }
    }
    return next;
  });
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${cols === 2 ? 'col-span-2' : ''} ${className ?? ''}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {filterSlot}
          {tableSlot && (
            <button
              onClick={toggleTable}
              title={showTable ? 'Ver gráfico' : 'Ver tabela'}
              className="p-1 text-gray-300 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400 rounded transition-colors"
            >
              {showTable ? <BarChart2 size={13} /> : <Table size={13} />}
            </button>
          )}
          {onHide && (
            <button
              onClick={onHide}
              title="Ocultar este gráfico"
              className="p-1 text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 rounded transition-colors"
            >
              <EyeOff size={13} />
            </button>
          )}
        </div>
      </div>
      {showTable && tableSlot ? tableSlot : children}
    </div>
  );
}

// ── DashboardModal ────────────────────────────────────────────────────────
export function DashboardModal({ columns, views }: Props) {
  const [selectedViewId, setSelectedViewId] = useState<'__all__' | string>('__all__');

  // Gráficos ocultos (persistido em localStorage)
  const [hiddenCharts, setHiddenCharts] = useState<Set<ChartId>>(() => {
    try {
      const saved = localStorage.getItem(HIDDEN_STORAGE);
      return new Set((saved ? JSON.parse(saved) : []) as ChartId[]);
    } catch { return new Set(); }
  });

  const hideChart = (id: ChartId) => setHiddenCharts(prev => {
    const next = new Set(prev); next.add(id);
    localStorage.setItem(HIDDEN_STORAGE, JSON.stringify([...next]));
    return next;
  });

  const showChart = (id: ChartId) => setHiddenCharts(prev => {
    const next = new Set(prev); next.delete(id);
    localStorage.setItem(HIDDEN_STORAGE, JSON.stringify([...next]));
    return next;
  });

  const isVisible = (id: ChartId) => !hiddenCharts.has(id);

  // Filtros por gráfico (não persistidos — redefinem ao trocar de equipe)
  const [byStatusExcluded, setByStatusExcluded] = useState<Set<string>>(new Set());
  const [byRepoExcluded, setByRepoExcluded] = useState<Set<string>>(new Set());
  const [byViewExcluded, setByViewExcluded] = useState<Set<string>>(new Set());
  const [byAssigneeExcluded, setByAssigneeExcluded] = useState<Set<string>>(new Set());
  const [progressPersonExcluded, setProgressPersonExcluded] = useState<Set<string>>(new Set());
  const [asgByLabelPersonExcluded, setAsgByLabelPersonExcluded] = useState<Set<string>>(new Set());
  const [byLabelExcluded, setByLabelExcluded] = useState<Set<string>>(new Set());
  const [tagGroupExcluded, setTagGroupExcluded] = useState<Set<string>>(new Set());
  const [heatmapLabelExcluded, setHeatmapLabelExcluded] = useState<Set<string>>(new Set());

  const allCards = useMemo(() => columns.flatMap(c => c.cards), [columns]);

  const filteredCards = useMemo(() => {
    if (selectedViewId === '__all__') return allCards;
    const view = views.find(v => v.id === selectedViewId);
    if (!view) return allCards;
    return filterColumns(columns, view).flatMap(c => c.cards);
  }, [allCards, columns, views, selectedViewId]);

  const viewPeople = useMemo(() => {
    if (selectedViewId === '__all__') return null;
    const people = getPeopleForView(selectedViewId);
    return people.length > 0 ? people : null;
  }, [selectedViewId]);

  const totalCards = filteredCards.length;

  // ── DISTRIBUIÇÃO ─────────────────────────────────────────────────────────

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    filteredCards.forEach(c => map.set(c.status, (map.get(c.status) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredCards]);

  const byAssignee = useMemo(() => {
    const map = new Map<string, number>();
    filteredCards.forEach(c => {
      if (c.assignees.length === 0) map.set('Sem responsável', (map.get('Sem responsável') || 0) + 1);
      else c.assignees.forEach(a => map.set(a.login, (map.get(a.login) || 0) + 1));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, isTeam: viewPeople ? viewPeople.includes(name) : true }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCards, viewPeople]);

  const byRepo = useMemo(() => {
    const map = new Map<string, number>();
    filteredCards.forEach(c => { const r = c.repo || 'sem repo'; map.set(r, (map.get(r) || 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredCards]);

  const byRepoFiltered = useMemo(
    () => byRepo.filter(r => !byRepoExcluded.has(r.name)),
    [byRepo, byRepoExcluded]
  );

  const byView = useMemo(() => {
    if (selectedViewId !== '__all__') return [];
    return views.map((view, i) => {
      const cards = filterColumns(columns, view).flatMap(c => c.cards);
      return { name: view.name, value: cards.length, fill: color(i) };
    }).filter(v => v.value > 0);
  }, [columns, views, selectedViewId]);

  const byViewFiltered = useMemo(
    () => byView.filter(v => !byViewExcluded.has(v.name)),
    [byView, byViewExcluded]
  );

  // ── LABELS ───────────────────────────────────────────────────────────────

  const byLabel = useMemo(() => {
    const map = new Map<string, number>();
    filteredCards.forEach(c => c.labels.forEach(l => map.set(l.name, (map.get(l.name) || 0) + 1)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 15);
  }, [filteredCards]);

  const labelStatusHeatmap = useMemo(() => {
    const statuses = [...new Set(filteredCards.map(c => c.status))].sort();
    const labels = byLabel.map(l => l.name);
    const grid: Record<string, Record<string, number>> = {};
    labels.forEach(l => { grid[l] = {}; });
    filteredCards.forEach(c => c.labels.forEach(l => {
      if (grid[l.name]) grid[l.name][c.status] = (grid[l.name][c.status] || 0) + 1;
    }));
    const maxVal = Math.max(1, ...labels.flatMap(l => statuses.map(s => grid[l][s] || 0)));
    return { statuses, labels, grid, maxVal };
  }, [filteredCards, byLabel]);

  const tagGroupVolume = useMemo(() => {
    const mappings = loadViewTagsMapping();
    const relevant = selectedViewId === '__all__' ? mappings : mappings.filter(m => m.viewId === selectedViewId);
    return relevant.flatMap(mapping =>
      (mapping.tagGroups || []).map(group => ({
        name: group.name,
        value: filteredCards.filter(c => c.labels.some(l => group.tags.includes(l.name))).length,
      }))
    ).filter(g => g.value > 0).sort((a, b) => b.value - a.value);
  }, [filteredCards, selectedViewId]);

  // ── RESPONSÁVEIS ─────────────────────────────────────────────────────────

  const assigneeByLabel = useMemo(() => {
    const topLabels = byLabel.slice(0, 6).map(l => l.name);
    const map = new Map<string, Record<string, number>>();
    filteredCards.forEach(c => {
      const assignees = c.assignees.length > 0 ? c.assignees.map(a => a.login) : ['Sem responsável'];
      assignees.forEach(a => {
        if (!map.has(a)) map.set(a, {});
        c.labels.forEach(l => {
          if (topLabels.includes(l.name)) {
            const rec = map.get(a)!;
            rec[l.name] = (rec[l.name] || 0) + 1;
          }
        });
      });
    });
    const people = viewPeople ? [...map.keys()].filter(k => viewPeople.includes(k)) : [...map.keys()];
    return {
      labels: topLabels,
      data: people.map(p => ({ name: p, ...map.get(p) }))
        .filter((d: any) => topLabels.some(l => d[l] > 0))
        .sort((a: any, b: any) => {
          const tA = topLabels.reduce((s, l) => s + (a[l] || 0), 0);
          const tB = topLabels.reduce((s, l) => s + (b[l] || 0), 0);
          return tB - tA;
        }),
    };
  }, [filteredCards, byLabel, viewPeople]);

  const assigneeProgress = useMemo(() => {
    const map = new Map<string, { total: number; byStatus: Record<string, number> }>();
    filteredCards.forEach(c => {
      const assignees = c.assignees.length > 0 ? c.assignees.map(a => a.login) : ['Sem responsável'];
      assignees.forEach(a => {
        if (!map.has(a)) map.set(a, { total: 0, byStatus: {} });
        const rec = map.get(a)!;
        rec.total++;
        rec.byStatus[c.status] = (rec.byStatus[c.status] || 0) + 1;
      });
    });
    // Ordena status por volume total (mais frequente primeiro)
    const statusTotals = new Map<string, number>();
    filteredCards.forEach(c => statusTotals.set(c.status, (statusTotals.get(c.status) || 0) + 1));
    const statuses = [...statusTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    const people = viewPeople ? [...map.keys()].filter(k => viewPeople.includes(k)) : [...map.keys()];
    return {
      statuses,
      data: people
        .map(person => ({ person, total: map.get(person)!.total, byStatus: map.get(person)!.byStatus }))
        .sort((a, b) => b.total - a.total),
    };
  }, [filteredCards, viewPeople]);

  // ── TEMPORAL ─────────────────────────────────────────────────────────────

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    filteredCards.forEach(c => {
      if (!c.createdAt) return;
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, value]) => {
      const [year, month] = key.split('-');
      return { name: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), value };
    });
  }, [filteredCards]);

  const byWeekUpdated = useMemo(() => {
    const now = new Date();
    const buckets: Record<string, number> = { 'Últimos 7 dias': 0, '8–14 dias': 0, '15–30 dias': 0, '31–60 dias': 0, '60+ dias': 0 };
    filteredCards.forEach(c => {
      if (!c.updatedAt) return;
      const diff = Math.floor((now.getTime() - new Date(c.updatedAt).getTime()) / 86400000);
      if (diff <= 7) buckets['Últimos 7 dias']++;
      else if (diff <= 14) buckets['8–14 dias']++;
      else if (diff <= 30) buckets['15–30 dias']++;
      else if (diff <= 60) buckets['31–60 dias']++;
      else buckets['60+ dias']++;
    });
    return Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filteredCards]);

  const dueDateBuckets = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const withDue = filteredCards.filter(c => c.dueDate);
    if (withDue.length === 0) return null;
    const fills: Record<string, string> = { 'Vencido': '#ef4444', 'Hoje': '#f97316', 'Próx. 7 dias': '#f59e0b', 'Próx. 30 dias': '#22c55e', 'Futuro': '#6366f1' };
    const map: Record<string, number> = { 'Vencido': 0, 'Hoje': 0, 'Próx. 7 dias': 0, 'Próx. 30 dias': 0, 'Futuro': 0 };
    withDue.forEach(c => {
      const due = new Date(c.dueDate!); due.setHours(0, 0, 0, 0);
      const diff = Math.floor((due.getTime() - now.getTime()) / 86400000);
      if (diff < 0) map['Vencido']++;
      else if (diff === 0) map['Hoje']++;
      else if (diff <= 7) map['Próx. 7 dias']++;
      else if (diff <= 30) map['Próx. 30 dias']++;
      else map['Futuro']++;
    });
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, fill: fills[name] }));
  }, [filteredCards]);

  // ── Arrays filtrados ──────────────────────────────────────────────────────

  const byStatusFiltered = useMemo(
    () => byStatus.filter(s => !byStatusExcluded.has(s.name)),
    [byStatus, byStatusExcluded]
  );
  const byAssigneeFiltered = useMemo(
    () => byAssignee.filter(a => !byAssigneeExcluded.has(a.name)),
    [byAssignee, byAssigneeExcluded]
  );
  const byLabelFiltered = useMemo(
    () => byLabel.filter(l => !byLabelExcluded.has(l.name)),
    [byLabel, byLabelExcluded]
  );
  const tagGroupFiltered = useMemo(
    () => tagGroupVolume.filter(g => !tagGroupExcluded.has(g.name)),
    [tagGroupVolume, tagGroupExcluded]
  );

  // ─────────────────────────────────────────────────────────────────────────

  const hiddenList = CHART_IDS.filter(id => hiddenCharts.has(id));

  const mkToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    (name: string) => setter(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const toggleStatusExcluded           = mkToggle(setByStatusExcluded);
  const toggleRepoExcluded             = mkToggle(setByRepoExcluded);
  const toggleViewExcluded             = mkToggle(setByViewExcluded);
  const toggleAssigneeExcluded         = mkToggle(setByAssigneeExcluded);
  const toggleProgressPersonExcluded   = mkToggle(setProgressPersonExcluded);
  const toggleAsgByLabelPersonExcluded  = mkToggle(setAsgByLabelPersonExcluded);
  const toggleLabelExcluded            = mkToggle(setByLabelExcluded);
  const toggleTagGroupExcluded         = mkToggle(setTagGroupExcluded);
  const toggleHeatmapLabelExcluded     = mkToggle(setHeatmapLabelExcluded);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Barra de controles */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">{totalCards} cards analisados</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Equipe / Área:</label>
          <select
            value={selectedViewId}
            onChange={e => setSelectedViewId(e.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="__all__">Todas as equipes</option>
            {views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {totalCards === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
            Nenhum card encontrado para esta equipe.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">

            {/* Chips de gráficos ocultos */}
            {hiddenList.length > 0 && (
              <div className="col-span-2 flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Ocultos:</span>
                {hiddenList.map(id => (
                  <button
                    key={id}
                    onClick={() => showChart(id)}
                    title="Clique para restaurar"
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <Eye size={10} />
                    {CHART_LABELS[id]}
                  </button>
                ))}
              </div>
            )}

            {/* ── DISTRIBUIÇÃO GERAL ── */}
            <SectionTitle>📊 Distribuição geral</SectionTitle>

            {/* Layout: byStatus ocupa a altura total à esquerda; byRepo + byView empilhados à direita */}
            <div className="col-span-2 flex gap-5 items-stretch">

              {/* Esquerda: Cards por status */}
              {isVisible('byStatus') && (
                <div className="flex-1 min-w-0 flex flex-col">
                  <ChartCard
                    className="flex flex-col flex-1"
                    title="Cards por status"
                    subtitle={byStatusExcluded.size > 0 ? `${byStatusFiltered.length} de ${byStatus.length} status` : `${totalCards} total`}
                    onHide={() => hideChart('byStatus')}
                    storageKey="dashboard_table_byStatus"
                    filterSlot={
                      <FilterDropdown
                        items={byStatus.map(s => s.name)}
                        excluded={byStatusExcluded}
                        onToggle={toggleStatusExcluded}
                        onSelectAll={() => setByStatusExcluded(new Set())}
                        onClearAll={() => setByStatusExcluded(new Set(byStatus.map(s => s.name)))}
                      />
                    }
                    tableSlot={byStatusFiltered.length > 0 ? <SimpleTable rows={byStatusFiltered} /> : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhum status selecionado.</p>}
                  >
                    {byStatusFiltered.length > 0 ? (
                      <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={byStatusFiltered} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={115} labelLine={false} label={renderPieLabel}>
                              {byStatusFiltered.map((_, i) => <Cell key={i} fill={color(i)} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend formatter={(v) => <span className="text-sm text-gray-700 dark:text-gray-300">{v}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhum status selecionado.</p>
                    )}
                  </ChartCard>
                </div>
              )}

              {/* Direita: byRepo + byView empilhados */}
              {(byRepo.length > 0 && isVisible('byRepo') || byView.length > 1 && isVisible('byView')) && (
                <div className="flex-1 min-w-0 flex flex-col gap-5">

                  {byRepo.length > 0 && isVisible('byRepo') && (
                    <ChartCard
                      title="Cards por repositório"
                      subtitle={byRepoExcluded.size > 0 ? `${byRepoFiltered.length} de ${byRepo.length} repos` : 'volume de demandas por repo'}
                      onHide={() => hideChart('byRepo')}
                      storageKey="dashboard_table_byRepo"
                      filterSlot={
                        <FilterDropdown
                          items={byRepo.map(r => r.name)}
                          excluded={byRepoExcluded}
                          onToggle={toggleRepoExcluded}
                          onSelectAll={() => setByRepoExcluded(new Set())}
                          onClearAll={() => setByRepoExcluded(new Set(byRepo.map(r => r.name)))}
                        />
                      }
                      tableSlot={byRepoFiltered.length > 0 ? <SimpleTable rows={byRepoFiltered} /> : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhum repositório selecionado.</p>}
                    >
                      {byRepoFiltered.length > 0 ? (
                        <ResponsiveContainer width="100%" height={Math.max(240, byRepoFiltered.length * 52)}>
                          <BarChart data={byRepoFiltered} layout="vertical" margin={{ left: 8, right: 36 }} barSize={22}>
                            <XAxis type="number" tick={{ fontSize: 14 }} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 14 }} width={160} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Cards" radius={[0, 5, 5, 0]} label={{ position: 'right', fontSize: 14, fill: 'currentColor' }}>
                              {byRepoFiltered.map((_, i) => <Cell key={i} fill={color(i + 7)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhum repositório selecionado.</p>
                      )}
                    </ChartCard>
                  )}

                  {byView.length > 1 && isVisible('byView') && (
                    <ChartCard
                      title="Cards por equipe / área"
                      subtitle={byViewExcluded.size > 0 ? `${byViewFiltered.length} de ${byView.length} áreas` : 'comparativo entre views configuradas'}
                      onHide={() => hideChart('byView')}
                      storageKey="dashboard_table_byView"
                      filterSlot={
                        <FilterDropdown
                          items={byView.map(v => v.name)}
                          excluded={byViewExcluded}
                          onToggle={toggleViewExcluded}
                          onSelectAll={() => setByViewExcluded(new Set())}
                          onClearAll={() => setByViewExcluded(new Set(byView.map(v => v.name)))}
                        />
                      }
                      tableSlot={byViewFiltered.length > 0 ? <SimpleTable rows={byViewFiltered} /> : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma área selecionada.</p>}
                    >
                      {byViewFiltered.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={byViewFiltered} margin={{ left: 0, right: 16, top: 8 }} barSize={34}>
                            <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                            <YAxis tick={{ fontSize: 14 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Cards" radius={[5, 5, 0, 0]} label={{ position: 'top', fontSize: 14, fill: 'currentColor' }}>
                              {byViewFiltered.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma área selecionada.</p>
                      )}
                    </ChartCard>
                  )}

                </div>
              )}

            </div>

            {/* ── RESPONSÁVEIS ── */}
            <SectionTitle>👥 Responsáveis</SectionTitle>

            {isVisible('byAssignee') && (
              <ChartCard
                title="Carga por responsável"
                subtitle={byAssigneeExcluded.size > 0 ? `${byAssigneeFiltered.length} de ${byAssignee.length} pessoas` : 'total de cards por pessoa'}
                onHide={() => hideChart('byAssignee')}
                storageKey="dashboard_table_byAssignee"
                filterSlot={
                  <FilterDropdown
                    items={byAssignee.map(a => a.name)}
                    excluded={byAssigneeExcluded}
                    onToggle={toggleAssigneeExcluded}
                    onSelectAll={() => setByAssigneeExcluded(new Set())}
                    onClearAll={() => setByAssigneeExcluded(new Set(byAssignee.map(a => a.name)))}
                  />
                }
                tableSlot={byAssigneeFiltered.length > 0 ? <SimpleTable rows={byAssigneeFiltered} /> : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma pessoa selecionada.</p>}
              >
                {byAssigneeFiltered.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(240, byAssigneeFiltered.length * 52)}>
                    <BarChart data={byAssigneeFiltered} layout="vertical" margin={{ left: 8, right: 36 }} barSize={22}>
                      <XAxis type="number" tick={{ fontSize: 14 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 14 }} width={130} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Cards" radius={[0, 5, 5, 0]} label={{ position: 'right', fontSize: 14, fill: 'currentColor' }}>
                        {byAssigneeFiltered.map((entry, i) => <Cell key={i} fill={entry.isTeam ? color(i) : '#d1d5db'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma pessoa selecionada.</p>
                )}
              </ChartCard>
            )}

            {assigneeProgress.data.length > 0 && isVisible('assigneeProgress') && (() => {
              const progressRows = assigneeProgress.data.filter(r => !progressPersonExcluded.has(r.person));
              const progressChartData = progressRows.map(r => ({ name: r.person, ...r.byStatus }));
              return (
                <ChartCard
                  title="Cards por pessoa e status"
                  subtitle={progressPersonExcluded.size > 0 ? `${progressRows.length} de ${assigneeProgress.data.length} pessoas` : 'quantidade exata de cards em cada status'}
                  defaultShowTable
                  storageKey="dashboard_table_assigneeProgress"
                  onHide={() => hideChart('assigneeProgress')}
                  filterSlot={
                    <FilterDropdown
                      items={assigneeProgress.data.map(r => r.person)}
                      excluded={progressPersonExcluded}
                      onToggle={toggleProgressPersonExcluded}
                      onSelectAll={() => setProgressPersonExcluded(new Set())}
                      onClearAll={() => setProgressPersonExcluded(new Set(assigneeProgress.data.map(r => r.person)))}
                    />
                  }
                  tableSlot={progressRows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="pb-2 pr-4 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Pessoa</th>
                            <th className="pb-2 px-2 text-center font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">Total</th>
                            {assigneeProgress.statuses.map((s, si) => (
                              <th key={s} className="pb-2 px-2 text-center font-semibold whitespace-nowrap" style={{ color: color(si) }}>{s}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {progressRows.map((row, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-gray-700/40 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                              <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.person}</td>
                              <td className="py-2 px-2 text-center font-bold text-gray-700 dark:text-gray-300">{row.total}</td>
                              {assigneeProgress.statuses.map(s => (
                                <td key={s} className="py-2 px-2 text-center text-gray-600 dark:text-gray-300">
                                  {row.byStatus[s] ? (
                                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-medium">{row.byStatus[s]}</span>
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-600">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma pessoa selecionada.</p>
                  )}
                >
                  {progressRows.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(260, progressRows.length * 52)}>
                      <BarChart data={progressChartData} layout="vertical" margin={{ left: 8, right: 16 }} barSize={22}>
                        <XAxis type="number" tick={{ fontSize: 14 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 14 }} width={130} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v) => <span className="text-sm text-gray-700 dark:text-gray-300">{v}</span>} />
                        {assigneeProgress.statuses.map((st, i) => <Bar key={st} dataKey={st} stackId="a" fill={color(i)} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma pessoa selecionada.</p>
                  )}
                </ChartCard>
              );
            })()}

            {assigneeByLabel.data.length > 0 && assigneeByLabel.labels.length > 0 && isVisible('assigneeByLabel') && (() => {
              const asgByLabelRows = assigneeByLabel.data.filter((d: any) => !asgByLabelPersonExcluded.has(d.name as string));
              return (
                <ChartCard
                  title="Tipos de tarefa por responsável"
                  subtitle={asgByLabelPersonExcluded.size > 0 ? `${asgByLabelRows.length} de ${assigneeByLabel.data.length} pessoas` : 'top labels por pessoa'}
                  cols={2}
                  onHide={() => hideChart('assigneeByLabel')}
                  storageKey="dashboard_table_assigneeByLabel"
                  filterSlot={
                    <FilterDropdown
                      items={assigneeByLabel.data.map((d: any) => d.name as string)}
                      excluded={asgByLabelPersonExcluded}
                      onToggle={toggleAsgByLabelPersonExcluded}
                      onSelectAll={() => setAsgByLabelPersonExcluded(new Set())}
                      onClearAll={() => setAsgByLabelPersonExcluded(new Set(assigneeByLabel.data.map((d: any) => d.name as string)))}
                    />
                  }
                  tableSlot={asgByLabelRows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="pb-2 pr-4 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Pessoa</th>
                            {assigneeByLabel.labels.map((l, i) => (
                              <th key={l} className="pb-2 px-2 text-center font-semibold whitespace-nowrap" style={{ color: color(i + 3) }}>{l}</th>
                            ))}
                            <th className="pb-2 pl-2 text-right font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {asgByLabelRows.map((row: any, i: number) => {
                            const rowTotal = assigneeByLabel.labels.reduce((s: number, l: string) => s + ((row[l] as number) || 0), 0);
                            return (
                              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/40 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                                <td className="py-1.5 pr-4 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.name}</td>
                                {assigneeByLabel.labels.map((l: string) => (
                                  <td key={l} className="py-1.5 px-2 text-center text-gray-600 dark:text-gray-300">
                                    {row[l] ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-medium">{row[l]}</span>
                                    ) : (
                                      <span className="text-gray-300 dark:text-gray-600">—</span>
                                    )}
                                  </td>
                                ))}
                                <td className="py-1.5 pl-2 text-right font-bold text-gray-700 dark:text-gray-300">{rowTotal}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma pessoa selecionada.</p>
                  )}
                >
                  {asgByLabelRows.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(260, asgByLabelRows.length * 52)}>
                      <BarChart data={asgByLabelRows} layout="vertical" margin={{ left: 8, right: 16 }} barSize={22}>
                        <XAxis type="number" tick={{ fontSize: 14 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 14 }} width={130} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v) => <span className="text-sm text-gray-700 dark:text-gray-300">{v}</span>} />
                        {assigneeByLabel.labels.map((label, i) => <Bar key={label} dataKey={label} stackId="a" fill={color(i + 3)} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma pessoa selecionada.</p>
                  )}
                </ChartCard>
              );
            })()}

            {/* ── LABELS E TAGS ── */}
            <SectionTitle>🏷️ Labels e tags</SectionTitle>

            {byLabel.length > 0 && isVisible('byLabel') && (
              <ChartCard
                title="Labels mais frequentes"
                subtitle={byLabelExcluded.size > 0 ? `${byLabelFiltered.length} de ${byLabel.length} labels` : 'top 15 por volume'}
                onHide={() => hideChart('byLabel')}
                storageKey="dashboard_table_byLabel"
                filterSlot={
                  <FilterDropdown
                    items={byLabel.map(l => l.name)}
                    excluded={byLabelExcluded}
                    onToggle={toggleLabelExcluded}
                    onSelectAll={() => setByLabelExcluded(new Set())}
                    onClearAll={() => setByLabelExcluded(new Set(byLabel.map(l => l.name)))}
                  />
                }
                tableSlot={byLabelFiltered.length > 0 ? <SimpleTable rows={byLabelFiltered} /> : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma label selecionada.</p>}
              >
                {byLabelFiltered.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(240, byLabelFiltered.length * 46)}>
                    <BarChart data={byLabelFiltered} layout="vertical" margin={{ left: 8, right: 36 }} barSize={20}>
                      <XAxis type="number" tick={{ fontSize: 14 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 14 }} width={150} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Cards" radius={[0, 5, 5, 0]} label={{ position: 'right', fontSize: 14, fill: 'currentColor' }}>
                        {byLabelFiltered.map((_, i) => <Cell key={i} fill={color(i + 4)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma label selecionada.</p>
                )}
              </ChartCard>
            )}

            {tagGroupVolume.length > 0 && isVisible('tagGroupVolume') && (
              <ChartCard
                title="Volume por grupo de tags"
                subtitle={tagGroupExcluded.size > 0 ? `${tagGroupFiltered.length} de ${tagGroupVolume.length} grupos` : 'demanda por sistema/produto configurado'}
                onHide={() => hideChart('tagGroupVolume')}
                storageKey="dashboard_table_tagGroupVolume"
                filterSlot={
                  <FilterDropdown
                    items={tagGroupVolume.map(g => g.name)}
                    excluded={tagGroupExcluded}
                    onToggle={toggleTagGroupExcluded}
                    onSelectAll={() => setTagGroupExcluded(new Set())}
                    onClearAll={() => setTagGroupExcluded(new Set(tagGroupVolume.map(g => g.name)))}
                  />
                }
                tableSlot={tagGroupFiltered.length > 0 ? <SimpleTable rows={tagGroupFiltered} /> : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhum grupo selecionado.</p>}
              >
                {tagGroupFiltered.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(240, tagGroupFiltered.length * 52)}>
                    <BarChart data={tagGroupFiltered} layout="vertical" margin={{ left: 8, right: 36 }} barSize={22}>
                      <XAxis type="number" tick={{ fontSize: 14 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 14 }} width={150} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Cards" radius={[0, 5, 5, 0]} label={{ position: 'right', fontSize: 14, fill: 'currentColor' }}>
                        {tagGroupFiltered.map((_, i) => <Cell key={i} fill={color(i + 2)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhum grupo selecionado.</p>
                )}
              </ChartCard>
            )}

            {labelStatusHeatmap.labels.length > 0 && labelStatusHeatmap.statuses.length > 0 && isVisible('labelHeatmap') && (() => {
              const visibleLabels = labelStatusHeatmap.labels.filter(l => !heatmapLabelExcluded.has(l));
              const chartData = visibleLabels.map(label => ({
                name: label,
                ...Object.fromEntries(labelStatusHeatmap.statuses.map(s => [s, labelStatusHeatmap.grid[label][s] || 0])),
              }));
              return (
                <ChartCard
                  title="Labels por status"
                  subtitle={heatmapLabelExcluded.size > 0 ? `${visibleLabels.length} de ${labelStatusHeatmap.labels.length} labels` : 'quantos cards de cada label estão em cada status'}
                  cols={2}
                  onHide={() => hideChart('labelHeatmap')}
                  storageKey="dashboard_table_labelHeatmap"
                  filterSlot={
                    <FilterDropdown
                      items={labelStatusHeatmap.labels}
                      excluded={heatmapLabelExcluded}
                      onToggle={toggleHeatmapLabelExcluded}
                      onSelectAll={() => setHeatmapLabelExcluded(new Set())}
                      onClearAll={() => setHeatmapLabelExcluded(new Set(labelStatusHeatmap.labels))}
                    />
                  }
                  tableSlot={visibleLabels.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="pb-2 pr-4 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Label</th>
                            {labelStatusHeatmap.statuses.map((s, i) => (
                              <th key={s} className="pb-2 px-2 text-center font-semibold whitespace-nowrap" style={{ color: color(i) }}>{s}</th>
                            ))}
                            <th className="pb-2 pl-2 text-right font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleLabels.map((label, i) => {
                            const rowTotal = labelStatusHeatmap.statuses.reduce((s, st) => s + (labelStatusHeatmap.grid[label][st] || 0), 0);
                            return (
                              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/40 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                                <td className="py-1.5 pr-4 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{label}</td>
                                {labelStatusHeatmap.statuses.map(st => (
                                  <td key={st} className="py-1.5 px-2 text-center text-gray-600 dark:text-gray-300">
                                    {labelStatusHeatmap.grid[label][st] ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-medium">{labelStatusHeatmap.grid[label][st]}</span>
                                    ) : (
                                      <span className="text-gray-300 dark:text-gray-600">—</span>
                                    )}
                                  </td>
                                ))}
                                <td className="py-1.5 pl-2 text-right font-bold text-gray-700 dark:text-gray-300">{rowTotal}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma label selecionada.</p>
                  )}
                >
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 46)}>
                      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }} barSize={20}>
                        <XAxis type="number" tick={{ fontSize: 14 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 14 }} width={150} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v) => <span className="text-sm text-gray-700 dark:text-gray-300">{v}</span>} />
                        {labelStatusHeatmap.statuses.map((st, i) => (
                          <Bar key={st} dataKey={st} stackId="a" fill={color(i)} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Nenhuma label selecionada.</p>
                  )}
                </ChartCard>
              );
            })()}

            {/* ── EVOLUÇÃO TEMPORAL ── */}
            <SectionTitle>📅 Evolução temporal</SectionTitle>

            {byMonth.length > 1 && isVisible('byMonth') && (
              <ChartCard title="Cards criados por mês" subtitle="ritmo de entrada de demandas (últimos 12 meses)" cols={2} onHide={() => hideChart('byMonth')}
                storageKey="dashboard_table_byMonth"
                tableSlot={<SimpleTable rows={byMonth} />}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={byMonth} margin={{ left: 0, right: 16, top: 8 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                    <YAxis tick={{ fontSize: 14 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" name="Criados" stroke="#6366f1" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {byWeekUpdated.length > 0 && isVisible('byWeekUpdated') && (
              <ChartCard title="Atividade recente" subtitle="cards por data da última atualização" onHide={() => hideChart('byWeekUpdated')}
                storageKey="dashboard_table_byWeekUpdated"
                tableSlot={<SimpleTable rows={byWeekUpdated} />}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byWeekUpdated} margin={{ left: 0, right: 16, top: 8 }} barSize={42}>
                    <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                    <YAxis tick={{ fontSize: 14 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Cards" radius={[5, 5, 0, 0]} label={{ position: 'top', fontSize: 14, fill: 'currentColor' }}>
                      {byWeekUpdated.map((_, i) => <Cell key={i} fill={color(i + 1)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {dueDateBuckets && dueDateBuckets.length > 0 && isVisible('dueDate') && (
              <ChartCard title="Risco de prazo" subtitle="cards com dueDate por proximidade do vencimento" onHide={() => hideChart('dueDate')}
                storageKey="dashboard_table_dueDate"
                tableSlot={<SimpleTable rows={dueDateBuckets!} />}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dueDateBuckets} margin={{ left: 0, right: 16, top: 8 }} barSize={42}>
                    <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                    <YAxis tick={{ fontSize: 14 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Cards" radius={[5, 5, 0, 0]} label={{ position: 'top', fontSize: 14, fill: 'currentColor' }}>
                      {dueDateBuckets.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
