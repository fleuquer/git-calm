import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { CHANGELOG } from "../version";
import type { Change, VersionEntry } from "../version";
import { callDevTools } from "../services/devtoolsBridge";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "gitcalm" | "devtools";

type DevToolsChangelog =
  | { state: "carregando" }
  | { state: "ok"; entries: VersionEntry[] }
  | { state: "sem-suporte" }
  | { state: "erro"; message: string };

function ChangePill({ type }: { type: Change["type"] }) {
  const config = {
    feat: {
      label: "Novidade",
      cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    },
    fix: {
      label: "Correção",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    },
    improvement: {
      label: "Melhoria",
      cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    },
  }[type];

  return (
    <span
      className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.cls}`}
    >
      {config.label}
    </span>
  );
}

/** Tipo de mudança do devTools ("novidade", "correção", "melhoria"...) no formato do git-calm */
function toChangeType(tipo: unknown): Change["type"] {
  const t = String(tipo ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/^(novidade|nova|novo|feat|feature|new)/.test(t)) return "feat";
  if (/^(correcao|corrigido|fix|bug)/.test(t)) return "fix";
  return "improvement";
}

/**
 * Novidades do devTools (função `novidades()` da API dele), no formato do git-calm.
 * Esperado: [{ versao, data, label?, itens: [{ tipo, texto }] }]. Tolerante a nomes em inglês.
 */
function parseDevToolsChangelog(value: unknown): VersionEntry[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => {
      const items = Array.isArray(v.itens) ? v.itens : Array.isArray(v.changes) ? v.changes : [];
      return {
        version: String(v.versao ?? v.version ?? "").replace(/^v/, ""),
        date: String(v.data ?? v.date ?? ""),
        label: typeof v.label === "string" ? v.label : undefined,
        changes: items
          .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
          .map((i) => ({
            type: toChangeType(i.tipo ?? i.type),
            description: String(i.texto ?? i.description ?? ""),
          }))
          .filter((c) => c.description),
      };
    })
    .filter((e) => e.version);
}

function VersionList({ entries }: { entries: VersionEntry[] }) {
  // Ao abrir, só a versão mais recente fica expandida; abrir outra fecha a anterior (sempre 1 aberta).
  const [expandedVersion, setExpandedVersion] = useState<string | null>(
    () => entries[0]?.version ?? null
  );

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const isExpanded = expandedVersion === entry.version;
        return (
          <div
            key={entry.version}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedVersion(entry.version)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
              )}
              <span className="text-sm font-mono font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md">
                v{entry.version}
              </span>
              {entry.label && (
                <span className="text-sm px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full font-medium">
                  {entry.label}
                </span>
              )}
              <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto">
                {entry.date}
              </span>
            </button>

            {isExpanded && (
              <ul className="space-y-2 px-4 pb-3 pt-1">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <ChangePill type={change.type} />
                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {change.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DevToolsChangelogTab() {
  const [data, setData] = useState<DevToolsChangelog>({ state: "carregando" });

  useEffect(() => {
    let alive = true;
    callDevTools("novidades")
      .then((v) => {
        if (alive) setData({ state: "ok", entries: parseDevToolsChangelog(v) });
      })
      .catch((e: Error) => {
        if (!alive) return;
        // devTools sem a função novidades() ainda (pedida ao dev do devTools)
        if (/desconhecida/i.test(e.message)) setData({ state: "sem-suporte" });
        else setData({ state: "erro", message: e.message });
      });
    return () => { alive = false; };
  }, []);

  if (data.state === "carregando") {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        Buscando as novidades do devTools…
      </div>
    );
  }
  if (data.state === "ok" && data.entries.length) return <VersionList entries={data.entries} />;

  return (
    <div className="py-12 px-6 text-center text-sm text-gray-500 dark:text-gray-400 space-y-1.5">
      {data.state === "erro" ? (
        <p>Não foi possível buscar as novidades do devTools: {data.message}</p>
      ) : (
        <>
          <p>O devTools ainda não compartilha as novidades dele com o git-calm.</p>
          <p className="text-xs text-gray-400">
            Enquanto isso, veja na área devTools, clicando no número da versão no topo dele.
          </p>
        </>
      )}
    </div>
  );
}

export function ChangelogModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  // Montado só quando aberto: cada abertura começa na aba git-calm, na versão mais recente
  return <ChangelogContent onClose={onClose} />;
}

function ChangelogContent({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("gitcalm");

  const tabCls = (t: Tab) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors ${
      tab === t
        ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              O que há de novo
            </h2>
            <div role="tablist" className="flex gap-1 mt-2">
              <button role="tab" aria-selected={tab === "gitcalm"} onClick={() => setTab("gitcalm")} className={tabCls("gitcalm")}>
                git-calm
              </button>
              <button role="tab" aria-selected={tab === "devtools"} onClick={() => setTab("devtools")} className={tabCls("devtools")}>
                devTools
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {tab === "gitcalm" ? <VersionList entries={CHANGELOG} /> : <DevToolsChangelogTab />}
        </div>
      </div>
    </div>
  );
}
