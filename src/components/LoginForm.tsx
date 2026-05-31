import React, { useState } from 'react';
import { LogIn, GitBranch, Info, ExternalLink, Lock, Building2, Hash, Eye, EyeOff } from 'lucide-react';

interface Props {
  onLogin: (token: string, org: string, projectNumber: number) => void;
}

// ── Board preview (decorativo) ───────────────────────────────────────────────
const PREVIEW_COLUMNS = [
  {
    name: 'Backlog', color: '#64748b',
    cards: [
      { title: 'Implementar autenticação OAuth', labels: ['backend', 'security'] },
      { title: 'Revisar documentação da API', labels: ['docs'] },
      { title: 'Configurar CI/CD pipeline', labels: ['devops'] },
      { title: 'Adicionar testes unitários', labels: ['testing'] },
    ],
  },
  {
    name: 'Em Progresso', color: '#3b82f6',
    cards: [
      { title: 'Migrar banco de dados para Postgres', labels: ['backend', 'database'] },
      { title: 'Redesign da tela de dashboard', labels: ['frontend', 'design'] },
      { title: 'Corrigir bug no relatório mensal', labels: ['bug'] },
      { title: 'Implementar cache Redis', labels: ['performance'] },
    ],
  },
  {
    name: 'Em Revisão', color: '#f59e0b',
    cards: [
      { title: 'Otimizar queries do módulo fiscal', labels: ['performance'] },
      { title: 'Atualizar dependências do projeto', labels: ['maintenance'] },
      { title: 'Validar fluxo de emissão de nota', labels: ['testing'] },
    ],
  },
  {
    name: 'QA', color: '#8b5cf6',
    cards: [
      { title: 'Testar integração com gateway', labels: ['integration'] },
      { title: 'Validar paginação na listagem', labels: ['frontend'] },
      { title: 'Checar responsividade mobile', labels: ['frontend', 'design'] },
    ],
  },
  {
    name: 'Concluído', color: '#10b981',
    cards: [
      { title: 'Deploy hotfix v2.3.1', labels: ['deploy'] },
      { title: 'Corrigir timeout na API de CEP', labels: ['bug', 'api'] },
      { title: 'Configurar monitoramento', labels: ['devops'] },
      { title: 'Adicionar dark mode', labels: ['frontend'] },
    ],
  },
];

const LABEL_COLORS: Record<string, string> = {
  backend: '#3b82f6', frontend: '#8b5cf6', bug: '#ef4444', devops: '#f59e0b',
  testing: '#06b6d4', docs: '#64748b', design: '#ec4899', performance: '#10b981',
  database: '#6366f1', security: '#f97316', api: '#14b8a6', deploy: '#84cc16',
  maintenance: '#94a3b8', integration: '#a78bfa', maintenance2: '#94a3b8',
};
function labelColor(l: string) { return LABEL_COLORS[l] ?? '#64748b'; }

function BoardPreview() {
  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
    }}>
      {/* board */}
      <div style={{
        position: 'absolute', top: '4%', left: '-3%', right: '-3%',
        display: 'flex', gap: '10px', alignItems: 'flex-start',
        opacity: 0.32,
        filter: 'blur(0px)',
        transform: 'perspective(1200px) rotateX(5deg) scale(1.18)',
        transformOrigin: 'top center',
      }}>
        {PREVIEW_COLUMNS.map(col => (
          <div key={col.name} style={{
            flex: '1', minWidth: 0,
            background: 'rgba(255,255,255,0.09)',
            borderRadius: '10px',
            padding: '10px 8px',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            {/* column header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              marginBottom: '8px', paddingBottom: '6px',
              borderBottom: `2px solid ${col.color}`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
              <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {col.name}
              </span>
            </div>
            {/* cards */}
            {col.cards.map((card, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.11)',
                borderRadius: '7px',
                padding: '8px',
                marginBottom: '6px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                {/* avatar placeholder */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${col.color}55` }} />
                </div>
                {/* title lines */}
                <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.35)', marginBottom: 4, width: '90%' }} />
                <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.2)', marginBottom: 8, width: '60%' }} />
                {/* labels */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {card.labels.map(l => (
                    <div key={l} style={{
                      height: 5, width: 32, borderRadius: 3,
                      background: `${labelColor(l)}88`,
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* vignette — garante legibilidade do form */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 55% 55% at 50% 40%, transparent 0%, rgba(30,48,56,0.82) 100%)',
      }} />

      {/* ── bottom half: métricas + atividade ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%',
        display: 'flex', gap: '12px', alignItems: 'flex-end', padding: '0 2% 2%',
        opacity: 0.28,
        transform: 'perspective(1200px) rotateX(-5deg) scale(1.18)',
        transformOrigin: 'bottom center',
      }}>
        {/* gráfico de barras — cards por status */}
        <div style={{
          flex: 2, background: 'rgba(255,255,255,0.07)', borderRadius: '10px',
          padding: '12px', border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{ height: 7, width: 120, borderRadius: 4, background: 'rgba(255,255,255,0.35)', marginBottom: 12 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200 }}>
            {[
              { h: '45%', color: '#64748b' },
              { h: '80%', color: '#3b82f6' },
              { h: '55%', color: '#f59e0b' },
              { h: '35%', color: '#8b5cf6' },
              { h: '90%', color: '#10b981' },
            ].map((bar, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: bar.h, borderRadius: '4px 4px 0 0', background: `${bar.color}cc` }} />
                <div style={{ height: 4, width: '70%', borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
              </div>
            ))}
          </div>
        </div>

        {/* lista de atividade */}
        <div style={{
          flex: 2, background: 'rgba(255,255,255,0.07)', borderRadius: '10px',
          padding: '12px', border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{ height: 7, width: 100, borderRadius: 4, background: 'rgba(255,255,255,0.35)', marginBottom: 12 }} />
          {[
            { color: '#3b82f6', w1: '75%', w2: '45%' },
            { color: '#10b981', w1: '60%', w2: '55%' },
            { color: '#f59e0b', w1: '80%', w2: '35%' },
            { color: '#8b5cf6', w1: '50%', w2: '60%' },
            { color: '#10b981', w1: '70%', w2: '40%' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.3)', marginBottom: 4, width: row.w1 }} />
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.15)', width: row.w2 }} />
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${row.color}44`, flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* donut / progresso por responsável */}
        <div style={{
          flex: 1.5, background: 'rgba(255,255,255,0.07)', borderRadius: '10px',
          padding: '12px', border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ height: 7, width: 90, borderRadius: 4, background: 'rgba(255,255,255,0.35)', marginBottom: 4 }} />
          {[
            { color: '#10b981', pct: '82%' },
            { color: '#3b82f6', pct: '61%' },
            { color: '#f59e0b', pct: '44%' },
            { color: '#8b5cf6', pct: '73%' },
            { color: '#ef4444', pct: '38%' },
            { color: '#06b6d4', pct: '91%' },
            { color: '#f97316', pct: '55%' },
            { color: '#10b981', pct: '67%' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${item.color}44`, border: `2px solid ${item.color}99`, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{ height: '100%', width: item.pct, borderRadius: 3, background: `${item.color}bb` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #2d3f52 0%, #1f4040 45%, #2c3a4a 100%)', position: 'relative' }} className="flex items-start justify-center p-4 pt-12">
      <BoardPreview />
      <div className="w-full max-w-4xl" style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="text-center mb-8">
          <div style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)' }} className="inline-flex items-center justify-center rounded-2xl p-4 mb-5">
            <GitBranch style={{ color: '#2dd4bf' }} size={36} />
          </div>
          <h1 className="mb-3 leading-none">
            <span style={{
              display: 'inline-block',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '3rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(120deg, #5eead4 0%, #38bdf8 50%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 20px rgba(94,234,212,0.3))',
            }}>
              Git
            </span>
            <span style={{
              display: 'inline-block',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '3rem',
              fontWeight: 300,
              letterSpacing: '-0.03em',
              color: '#e2e8f0',
              marginLeft: '0.4rem',
            }}>
              calm
            </span>
          </h1>
          <p style={{ color: '#94a3b8' }} className="text-base">Seu GitHub Projects, sem o caos. Organizado, claro e no seu ritmo.</p>
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
                  <div className="mt-3 p-4 rounded-xl text-xs space-y-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    {/* Botão principal — destaque máximo */}
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,read:org,project,notifications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(90deg, #0d9488, #0891b2)', color: '#ffffff', boxShadow: '0 2px 8px rgba(13,148,136,0.35)' }}
                    >
                      <ExternalLink size={13} /> Criar token com permissões já marcadas
                    </a>

                    <p className="text-center" style={{ color: '#64748b' }}>— ou siga os passos manualmente —</p>

                    <ol className="space-y-1 list-decimal list-inside" style={{ color: '#1d4ed8' }}>
                      <li>Acesse <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="underline font-medium">github.com/settings/tokens/new</a></li>
                      <li>Dê um nome (ex: <em>"Git Calm"</em>) e defina a validade</li>
                      <li>Marque as permissões abaixo e clique em <strong>Generate token</strong></li>
                      <li>Copie o token — ele só aparece uma vez</li>
                    </ol>
                    <div className="space-y-1.5">
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
                style={{ background: 'linear-gradient(90deg, #0d9488, #0891b2)', color: '#ffffff', boxShadow: '0 4px 14px rgba(13,148,136,0.35)' }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.92')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}
              >
                <LogIn size={20} />
                Acessar Projeto
              </button>
            </form>
          </div>

          {/* Info panel — right (2 cols) */}
          <div className="lg:col-span-2 p-8 flex flex-col justify-between" style={{ background: 'linear-gradient(160deg, #134e4a 0%, #164e63 100%)' }}>
            <div>
              <h3 style={{ color: '#ccfbf1' }} className="font-bold text-base mb-5">Tudo que você precisa, sem ruído</h3>
              <ul className="space-y-3.5">
                {[
                  { icon: '📋', text: 'Board Kanban por status, limpo e direto' },
                  { icon: '🔍', text: 'Filtros por label, responsável e área' },
                  { icon: '🏷️', text: 'Views personalizadas por time ou projeto' },
                  { icon: '📦', text: 'Assistente de release por repositório' },
                  { icon: '📝', text: 'Relatório diário do time' },
                  { icon: '🔔', text: 'Notificações de menções em tempo real' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm">
                    <span className="text-base shrink-0 mt-0.5">{icon}</span>
                    <span style={{ color: '#99f6e4' }}>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div className="flex items-start gap-2.5 text-xs">
                <span className="text-sm shrink-0 mt-0.5">🔒</span>
                <p style={{ color: '#99f6e4' }}>
                  Suas credenciais são armazenadas <strong style={{ color: '#ccfbf1' }}>somente no seu navegador</strong> e nunca trafegam por servidores externos.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
