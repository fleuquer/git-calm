import { useEffect, useState } from 'react';
import { Check, Loader2, UploadCloud } from 'lucide-react';
import { canPublishOrgConfig, publishOrgConfig, type OrgConfigResult } from '../utils/orgConfig';

interface Props {
  token: string;
  org: string;
  projectNumber?: number;
  /** Resultado da busca do padrão da organização (traz onde ele fica e a versão atual) */
  result: OrgConfigResult | 'carregando';
  onPublished?: () => void;
  label?: string;
}

/**
 * "Publicar como padrão da equipe": grava a configuração da equipe deste navegador no
 * repositório de padrões, com o token da própria pessoa. Só aparece para quem tem permissão de
 * escrita nesse repositório.
 */
export function PublishOrgConfigButton({ token, org, projectNumber, result, onPublished, label }: Props) {
  const origem = result !== 'carregando' && result.status !== 'erro' ? result.origem : undefined;
  const [allowed, setAllowed] = useState(false);
  const [state, setState] = useState<'idle' | 'publicando' | 'ok' | 'erro'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!origem) return;
    let alive = true;
    canPublishOrgConfig(token, origem).then(ok => { if (alive) setAllowed(ok); });
    return () => { alive = false; };
  }, [token, origem?.repo, origem?.caminho]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!origem || !allowed) return null;

  const publish = async () => {
    const ok = window.confirm(
      `Publicar a sua configuração da equipe como padrão da ${org}?\n\n` +
      'Vai: abas, mapeamentos, templates, prioridade, colunas, glossário e o número do projeto. ' +
      'Não vai: nada pessoal (token, tema, notificações, históricos).\n\n' +
      'Quem já usa recebe o aviso de configuração atualizada e escolhe se aplica.',
    );
    if (!ok) return;
    setState('publicando');
    setMsg('');
    try {
      const versao = result !== 'carregando' && result.status === 'ok' ? result.versao : undefined;
      await publishOrgConfig(token, org, origem, projectNumber, versao);
      setState('ok');
      setMsg('Publicado. A equipe vai receber o aviso de configuração atualizada.');
      onPublished?.();
    } catch (e) {
      const status = (e as { status?: number })?.status;
      setState('erro');
      setMsg(status === 409 || status === 422
        ? 'O padrão mudou desde que você abriu esta tela: atualize a seção e publique de novo.'
        : `Não foi possível publicar: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={publish}
        disabled={state === 'publicando'}
        title={`Grava em ${origem.repo}/${origem.caminho}`}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
      >
        {state === 'publicando' ? <Loader2 size={15} className="animate-spin" /> : state === 'ok' ? <Check size={15} /> : <UploadCloud size={15} />}
        {label ?? 'Publicar como padrão da equipe'}
      </button>
      {msg && <p className={`text-xs ${state === 'erro' ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{msg}</p>}
    </div>
  );
}
