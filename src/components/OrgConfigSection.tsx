import { useEffect, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import {
  appliedOrgConfigVersion,
  applyOrgConfig,
  downloadOrgConfigFile,
  fetchOrgConfig,
  ORG_CONFIG_NOTICE_KEY,
  TEAM_KEY_LABELS,
  TEAM_KEYS,
  type OrgConfigResult,
} from '../utils/orgConfig';

interface Props {
  token: string;
  org: string;
  projectNumber: number;
}

/**
 * Configuração padrão da organização (em Configurações › Backup): aplicar o padrão
 * publicado e gerar o arquivo para publicar a configuração da equipe.
 */
export function OrgConfigSection({ token, org, projectNumber }: Props) {
  const [result, setResult] = useState<OrgConfigResult | 'carregando'>('carregando');
  const [showHow, setShowHow] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchOrgConfig(token, org).then(r => { if (alive) setResult(r); });
    return () => { alive = false; };
  }, [token, org, reload]);

  const applied = appliedOrgConfigVersion(org);

  const apply = () => {
    if (result === 'carregando' || result.status !== 'ok') return;
    const ok = window.confirm(
      `Aplicar a configuração padrão da ${org}?\n\nSubstitui abas, mapeamentos, templates, prioridade e colunas de retrabalho/bloqueadas por as do padrão. ` +
      'O que é pessoal (tema, fonte, notificações, menções, históricos) não muda. A página será recarregada.',
    );
    if (!ok) return;
    const n = applyOrgConfig(org, result.versao, result.config);
    sessionStorage.setItem(ORG_CONFIG_NOTICE_KEY, `Configuração padrão da ${org} aplicada (${n} ${n === 1 ? 'item' : 'itens'}).`);
    window.location.reload();
  };

  let status: React.ReactNode;
  if (result === 'carregando') {
    status = <span className="flex items-center gap-1.5 text-gray-500"><Loader2 size={13} className="animate-spin" /> Procurando a configuração padrão da {org}…</span>;
  } else if (result.status === 'erro') {
    status = <span className="text-red-600 dark:text-red-400">{result.message}</span>;
  } else if (result.status === 'nenhuma') {
    status = <span className="text-gray-500 dark:text-gray-400">A {org} não tem configuração padrão publicada.</span>;
  } else if (applied && applied === result.versao) {
    status = <span className="text-green-700 dark:text-green-400">Você está com a configuração padrão da {org} em dia.</span>;
  } else {
    status = (
      <span className="text-amber-700 dark:text-amber-300">
        {applied ? `Há uma versão nova da configuração padrão da ${org}.` : `A ${org} tem uma configuração padrão que você ainda não aplicou.`}
      </span>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
          <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Configuração da organização</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Padrão da equipe para quem entra pela primeira vez: só membros da {org} recebem.
          </p>
        </div>
        <button
          onClick={() => { setResult('carregando'); setReload(n => n + 1); }}
          title="Procurar de novo"
          className="p-1.5 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <p className="text-sm mb-3">{status}</p>

      <div className="flex flex-wrap gap-2">
        {result !== 'carregando' && result.status === 'ok' && (
          <button
            onClick={apply}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Building2 size={15} />
            {applied ? 'Atualizar com a configuração da organização' : `Aplicar a configuração da ${org}`}
          </button>
        )}
        <button
          onClick={() => downloadOrgConfigFile(org, projectNumber)}
          title="Gera o arquivo com a parte da equipe da sua configuração atual, para publicar como padrão"
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={15} />
          Gerar arquivo da configuração da equipe
        </button>
      </div>

      <button
        onClick={() => setShowHow(v => !v)}
        className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        {showHow ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        O que entra e como publicar
      </button>
      {showHow && (
        <div className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-300">
          <p>
            <span className="font-medium">Entra (da equipe):</span> {TEAM_KEYS.map(k => TEAM_KEY_LABELS[k]).join(', ')}, e o número do projeto.
          </p>
          <p>
            <span className="font-medium">Não entra (pessoal):</span> token, tema, fonte, notificações, menções, histórico de atividades e de retrabalho,
            colunas recolhidas, labels ocultas, dashboard e relatório diário.
          </p>
          <p className="font-medium pt-1">Para publicar ou atualizar o padrão:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Deixe a sua configuração como quer que a equipe receba e clique em <b>Gerar arquivo da configuração da equipe</b>.</li>
            <li>Coloque o arquivo baixado (<code>{org.toLowerCase()}.json</code>) na pasta <code>orgs/</code> do repositório privado de configurações padrão e faça o commit.</li>
            <li>Quem entrar pela primeira vez já recebe; quem já usa vê aqui a opção de atualizar.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
