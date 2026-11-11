import { useEffect, useState } from 'react';
import { Building2, Download, X } from 'lucide-react';
import { exportConfig } from '../utils/configBackup';
import {
  appliedOrgConfigVersion,
  applyOrgConfig,
  declinedOrgConfigVersion,
  declineOrgConfig,
  fetchOrgConfig,
  ORG_CONFIG_NOTICE_KEY,
  orgConfigAppliedMessage,
  TEAM_KEY_LABELS,
  TEAM_KEYS,
  type OrgConfigFile,
} from '../utils/orgConfig';

interface Props {
  token: string;
  org: string;
}

/**
 * Aviso ao abrir o app, para quem já usa: a organização publicou uma configuração padrão
 * (ou atualizou a que existia). Pergunta se quer usar; "Agora não" vale só para aquela
 * versão. A mesma opção fica sempre em Configurações › Backup.
 */
export function OrgConfigPrompt({ token, org }: Props) {
  const [offer, setOffer] = useState<{ versao: string; config: OrgConfigFile; update: boolean } | null>(null);

  useEffect(() => {
    if (!token || !org) return;
    let alive = true;
    // espera o app carregar antes de perguntar
    const timer = setTimeout(() => {
      fetchOrgConfig(token, org).then(r => {
        if (!alive || r.status !== 'ok') return;
        const applied = appliedOrgConfigVersion(org);
        if (applied === r.versao || declinedOrgConfigVersion(org) === r.versao) return;
        setOffer({ versao: r.versao, config: r.config, update: !!applied });
      });
    }, 2500);
    return () => { alive = false; clearTimeout(timer); };
  }, [token, org]);

  if (!offer) return null;

  const included = TEAM_KEYS.filter(k => k in offer.config).map(k => TEAM_KEY_LABELS[k]);

  const accept = () => {
    const n = applyOrgConfig(org, offer.versao, offer.config);
    sessionStorage.setItem(ORG_CONFIG_NOTICE_KEY, orgConfigAppliedMessage(org, n, offer.config));
    window.location.reload();
  };
  const decline = () => {
    declineOrgConfig(org, offer.versao);
    setOffer(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-label="Configuração padrão da organização" className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg shrink-0">
            <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {offer.update ? `A configuração padrão da ${org} foi atualizada` : `A ${org} tem uma configuração padrão`}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {offer.update
                ? 'Quer atualizar a sua com a versão nova?'
                : 'Quer usar a configuração da equipe no lugar da sua?'}
            </p>
          </div>
          <button onClick={decline} title="Agora não" className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2 text-xs text-gray-600 dark:text-gray-300">
          {included.length > 0 && (
            <p><span className="font-medium">Substitui:</span> {included.join(', ')}.</p>
          )}
          <p><span className="font-medium">Não muda:</span> tema, fonte, notificações, menções, históricos e o que mais for pessoal.</p>
          <button
            onClick={exportConfig}
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Download size={12} />
            Exportar a minha configuração antes, por garantia
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-[11px] text-gray-400">Dá para decidir depois em Configurações › Backup.</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={decline} className="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              Agora não
            </button>
            <button onClick={accept} className="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white">
              {offer.update ? 'Atualizar' : 'Usar a da equipe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
