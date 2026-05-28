import React, { useState } from 'react';
import { LogIn, GitBranch, Info, ExternalLink, Lock, Building2, Hash, Eye, EyeOff } from 'lucide-react';

interface Props {
  onLogin: (token: string, org: string, projectNumber: number) => void;
}

export const LoginForm: React.FC<Props> = ({ onLogin }) => {
  const [token, setToken] = useState('');
  const [org, setOrg] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token.trim()) { setError('Token é obrigatório'); return; }
    if (!org.trim()) { setError('Organização é obrigatória'); return; }
    if (!projectNumber.trim()) { setError('Número do projeto é obrigatório'); return; }
    onLogin(token, org, parseInt(projectNumber));
  };

  const toggleHelp = (field: string) => {
    setShowHelp(prev => prev === field ? null : field);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e1b4b 100%)' }} className="flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }} className="inline-flex items-center justify-center rounded-2xl p-4 mb-4">
            <GitBranch style={{ color: '#fff' }} size={36} />
          </div>
          <h1 style={{ color: '#ffffff' }} className="text-4xl font-bold mb-2 tracking-tight">GitHub Project Manager</h1>
          <p style={{ color: '#93c5fd' }} className="text-base">Visualize e gerencie seus GitHub Projects de forma organizada</p>
        </div>

        {/* Main card */}
        <div className="grid grid-cols-1 lg:grid-cols-5 rounded-2xl overflow-hidden" style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>

          {/* Form — left (3 cols) */}
          <div className="lg:col-span-3 p-8" style={{ background: '#ffffff' }}>
            <h2 style={{ color: '#1e293b' }} className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Lock size={18} style={{ color: '#2563eb' }} />
              Configurar acesso
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Token */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label style={{ color: '#374151' }} className="text-sm font-semibold">
                    Personal Access Token
                  </label>
                  <button type="button" onClick={() => toggleHelp('token')} className="text-xs flex items-center gap-1 transition-colors" style={{ color: '#2563eb' }}>
                    <Info size={12} /> Como criar?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full px-4 py-3 pr-24 rounded-xl font-mono text-sm transition-all outline-none"
                    style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a' }}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                    style={{ color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0' }}
                  >
                    {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showToken ? 'ocultar' : 'mostrar'}
                  </button>
                </div>
                {showHelp === 'token' && (
                  <div className="mt-3 p-4 rounded-xl text-xs space-y-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    <p className="font-semibold" style={{ color: '#1e40af' }}>Como criar um Personal Access Token (Classic):</p>
                    <ol className="space-y-1 list-decimal list-inside" style={{ color: '#1d4ed8' }}>
                      <li>Acesse <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="underline font-medium">github.com/settings/tokens/new</a></li>
                      <li>Dê um nome (ex: <em>"Project Manager"</em>) e defina a validade</li>
                      <li>Marque as permissões abaixo e clique em <strong>Generate token</strong></li>
                      <li>Copie o token — ele só aparece uma vez</li>
                    </ol>
                    <div className="pt-1 space-y-1.5">
                      <p className="font-semibold" style={{ color: '#1e40af' }}>Permissões necessárias:</p>
                      {[
                        { scope: 'repo', desc: 'Leitura e escrita em issues, comentários, labels, branches e PRs' },
                        { scope: 'read:org', desc: 'Listar membros da organização' },
                        { scope: 'project', desc: 'Leitura e atualização de status nos GitHub Projects' },
                        { scope: 'notifications', desc: 'Receber alertas de menções e comentários em tempo real' },
                      ].map(({ scope, desc }) => (
                        <div key={scope} className="flex items-center gap-2">
                          <code className="px-1.5 py-0.5 rounded text-[11px] font-mono shrink-0" style={{ background: '#bfdbfe', color: '#1e3a8a' }}>{scope}</code>
                          <span style={{ color: '#1d4ed8' }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,read:org,project,notifications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold hover:underline pt-1"
                      style={{ color: '#2563eb' }}
                    >
                      <ExternalLink size={11} /> Abrir com permissões já selecionadas
                    </a>
                  </div>
                )}
              </div>

              {/* Org */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label style={{ color: '#374151' }} className="text-sm font-semibold flex items-center gap-1.5">
                    <Building2 size={14} style={{ color: '#9ca3af' }} />
                    Organização
                  </label>
                  <button type="button" onClick={() => toggleHelp('org')} className="text-xs flex items-center gap-1" style={{ color: '#2563eb' }}>
                    <Info size={12} /> Como encontrar?
                  </button>
                </div>
                <input
                  type="text"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl transition-all outline-none"
                  style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a' }}
                  onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                  placeholder="minha-organizacao"
                  autoComplete="off"
                />
                {showHelp === 'org' && (
                  <div className="mt-3 p-4 rounded-xl text-xs space-y-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    <p className="font-semibold" style={{ color: '#1e40af' }}>Como encontrar o nome da organização:</p>
                    <p style={{ color: '#1d4ed8' }}>Acesse o GitHub e clique na organização. O nome aparece na URL:</p>
                    <div className="px-3 py-2 rounded-lg font-mono text-[11px]" style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b' }}>
                      github.com/<span className="px-1 py-0.5 rounded font-bold" style={{ background: '#fef08a', color: '#713f12' }}>minha-org</span>
                    </div>
                    <p style={{ color: '#1d4ed8' }}>Use exatamente como está na URL (minúsculas, com hífens).</p>
                  </div>
                )}
              </div>

              {/* Project number */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label style={{ color: '#374151' }} className="text-sm font-semibold flex items-center gap-1.5">
                    <Hash size={14} style={{ color: '#9ca3af' }} />
                    Número do Projeto
                  </label>
                  <button type="button" onClick={() => toggleHelp('project')} className="text-xs flex items-center gap-1" style={{ color: '#2563eb' }}>
                    <Info size={12} /> Como encontrar?
                  </button>
                </div>
                <input
                  type="number"
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl transition-all outline-none"
                  style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a' }}
                  onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                  placeholder="1"
                  min="1"
                />
                {showHelp === 'project' && (
                  <div className="mt-3 p-4 rounded-xl text-xs space-y-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    <p className="font-semibold" style={{ color: '#1e40af' }}>Como encontrar o número do projeto:</p>
                    <p style={{ color: '#1d4ed8' }}>Abra o projeto no GitHub. O número está na URL:</p>
                    <div className="px-3 py-2 rounded-lg font-mono text-[11px]" style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b' }}>
                      github.com/orgs/minha-org/projects/<span className="px-1 py-0.5 rounded font-bold" style={{ background: '#fef08a', color: '#713f12' }}>3</span>
                    </div>
                    <p style={{ color: '#1d4ed8' }}>O número após <code className="px-1 rounded" style={{ background: '#dbeafe' }}>/projects/</code> é o que você precisa.</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                  <span className="shrink-0">⚠️</span> {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                style={{ background: 'linear-gradient(90deg, #2563eb, #4f46e5)', color: '#ffffff', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.92')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}
              >
                <LogIn size={20} />
                Acessar Projeto
              </button>
            </form>
          </div>

          {/* Info panel — right (2 cols) */}
          <div className="lg:col-span-2 p-8 flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%)' }}>
            <div>
              <h3 style={{ color: '#ffffff' }} className="font-bold text-base mb-5">O que você consegue fazer</h3>
              <ul className="space-y-3.5">
                {[
                  { icon: '📋', text: 'Visualizar cards em colunas por status' },
                  { icon: '🔍', text: 'Filtrar por label, responsável e status' },
                  { icon: '🏷️', text: 'Views personalizadas por time ou área' },
                  { icon: '📦', text: 'Gerenciar releases por repositório' },
                  { icon: '📝', text: 'Relatórios diários do time' },
                  { icon: '🔔', text: 'Atualizações em tempo real' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm">
                    <span className="text-base shrink-0 mt-0.5">{icon}</span>
                    <span style={{ color: '#bfdbfe' }}>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div className="flex items-start gap-2.5 text-xs">
                <span className="text-sm shrink-0 mt-0.5">🔒</span>
                <p style={{ color: '#bfdbfe' }}>
                  Suas credenciais são armazenadas <strong style={{ color: '#ffffff' }}>somente no seu navegador</strong> e nunca trafegam por servidores externos.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
