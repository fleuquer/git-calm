import { useEffect, useState } from 'react';
import { BookA, Check, Loader2, Wand2 } from 'lucide-react';
import { GitHubService } from '../services/github';
import type { ProjectCard } from '../types';
import { loadGlossaryText, parseGlossary, saveGlossaryText } from '../utils/glossary';
import { suggestGlossary, type GlossarySuggestion } from '../utils/glossarySuggest';
import { fetchOrgConfig, type OrgConfigResult } from '../utils/orgConfig';
import { PublishOrgConfigButton } from './PublishOrgConfigButton';

const EXEMPLO = `DAM = guia = boleto
NFS-e = nota fiscal de serviço = nota fiscal eletrônica
emissão = geração = emitir = gerar
IPTU = imposto predial`;

const REASON: Record<GlossarySuggestion['reason'], string> = {
  definida: 'definida no texto',
  iniciais: 'mesmas iniciais',
  variacao: 'jeitos de escrever',
};

interface Props {
  token: string;
  org: string;
  projectNumber: number;
  /** Cards do quadro, para sugerir o glossário inicial */
  boardCards: ProjectCard[];
}

/**
 * Configurações › Glossário: palavras que querem dizer a mesma coisa, para a sugestão de cards
 * relacionados ligar cards que usam vocabulário diferente. Sugere um glossário inicial a partir
 * dos cards e dos repositórios, e quem pode publica direto para a equipe.
 */
export function GlossarySetting({ token, org, projectNumber, boardCards }: Props) {
  const [text, setText] = useState(loadGlossaryText);
  const [saved, setSaved] = useState(true);
  const [suggestions, setSuggestions] = useState<GlossarySuggestion[] | 'carregando' | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [orgResult, setOrgResult] = useState<OrgConfigResult | 'carregando'>('carregando');
  const groups = parseGlossary(text);

  useEffect(() => {
    let alive = true;
    fetchOrgConfig(token, org).then(r => { if (alive) setOrgResult(r); });
    return () => { alive = false; };
  }, [token, org]);

  const save = (value = text) => {
    saveGlossaryText(value);
    setSaved(true);
  };

  const suggest = async () => {
    setSuggestions('carregando');
    const sources = boardCards
      .filter(c => c.title)
      .map(c => ({ ref: `#${c.number}`, text: `${c.title}\n${c.body ?? ''}` }));
    try {
      const repos = await new GitHubService(token).listOrgRepoDescriptions(org);
      for (const r of repos) if (r.description) sources.push({ ref: `repositório ${r.name}`, text: r.description });
    } catch { /* sem acesso aos repositórios: só os cards */ }
    const list = suggestGlossary(sources, text);
    setSuggestions(list);
    // marcadas de início: as definidas no próprio texto, que são as mais seguras
    setPicked(new Set(list.map((s, i) => (s.reason === 'definida' ? i : -1)).filter(i => i >= 0)));
  };

  const addPicked = () => {
    if (!Array.isArray(suggestions)) return;
    const lines = suggestions.filter((_, i) => picked.has(i)).map(s => s.terms.join(' = '));
    if (!lines.length) return;
    const next = `${text.replace(/\s+$/, '')}${text.trim() ? '\n' : ''}${lines.join('\n')}\n`;
    setText(next);
    save(next);
    setSuggestions(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <BookA size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Glossário da equipe</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Palavras que querem dizer a mesma coisa. A sugestão de cards relacionados passa a ligar cards que usam termos
              diferentes, como "emissão de guia" e "geração do DAM".
            </p>
          </div>
          <button
            onClick={suggest}
            disabled={suggestions === 'carregando'}
            title="Procura siglas e termos nos cards do quadro e na descrição dos repositórios"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-60"
          >
            {suggestions === 'carregando' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            Sugerir a partir dos cards
          </button>
        </div>

        {Array.isArray(suggestions) && (
          <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 space-y-2">
            {suggestions.length === 0 ? (
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Nada novo encontrado nos {boardCards.length} cards do quadro e nos repositórios. Sinônimos de verdade (ex.:
                "guia" e "boleto") não dá para descobrir sem IA: esses entram à mão.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Encontrado nos {boardCards.length} cards do quadro e nos repositórios. Marque o que entra; as definidas no próprio
                  texto já vêm marcadas.
                </p>
                <ul className="max-h-72 overflow-y-auto space-y-0.5">
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <label className="flex items-start gap-2 px-1.5 py-1 rounded hover:bg-white dark:hover:bg-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={picked.has(i)}
                          onChange={() => setPicked(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-mono text-gray-800 dark:text-gray-100 break-words">{s.terms.join(' = ')}</span>
                          <span className="block text-[10px] text-gray-400 truncate" title={s.refs.join(', ')}>
                            {REASON[s.reason]} · {s.refs.slice(0, 4).join(', ')}{s.refs.length > 4 ? ` e mais ${s.refs.length - 4}` : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setSuggestions(null)} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Cancelar
                  </button>
                  <button
                    onClick={addPicked}
                    disabled={!picked.size}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-50"
                  >
                    Adicionar {picked.size || ''} ao glossário
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setSaved(false); }}
          onBlur={() => save()}
          rows={12}
          spellCheck={false}
          placeholder={EXEMPLO}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-mono text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500 resize-y"
        />

        <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Uma linha por grupo, termos separados por <code>=</code>. Linhas com <code>#</code> são comentário.
            {groups.length > 0 && ` ${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}.`}
          </span>
          <button
            onClick={() => save()}
            disabled={saved}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            {saved ? <><Check size={13} /> Salvo</> : 'Salvar'}
          </button>
        </div>

        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-3">
          <PublishOrgConfigButton
            token={token}
            org={org}
            projectNumber={projectNumber}
            result={orgResult}
            label="Publicar para a equipe"
            onPublished={() => fetchOrgConfig(token, org).then(setOrgResult)}
          />
          <p className="flex-1 min-w-[200px] text-xs text-gray-400 dark:text-gray-500">
            O glossário vai junto com a configuração padrão da organização. Quem tem permissão no repositório de padrões
            publica por aqui; os demais recebem o aviso de configuração atualizada.
          </p>
        </div>
      </div>
    </div>
  );
}
