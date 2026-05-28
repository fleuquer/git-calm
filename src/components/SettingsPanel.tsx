import React, { useState, useEffect, useRef } from 'react';
import { X, User, Palette, Layers, Settings as SettingsIcon, Building, Hash, Key, Calendar, GitBranch, MessageSquare, Download, Upload, CheckCircle, AlertCircle, HardDrive, Type } from 'lucide-react';
import { ViewManagerModal } from './ViewManagerModal';
import { RepoMappingConfig } from './RepoMappingConfig';
import { TemplateManager } from './TemplateManager';
import type { ViewTab } from '../types';
import { themes } from '../themes';
import { GitHubService } from '../services/github';
import { exportConfig, importConfig } from '../utils/configBackup';
import { FONT_SIZES, FONT_FAMILIES, getFontSize, getFontFamily, saveFontSize, saveFontFamily, type FontSizeId, type FontFamilyId } from '../utils/fontSettings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Dados da conta
  token: string;
  org: string;
  projectNumber: number;
  onLogout: () => void;
  // Tema
  selectedTheme: string;
  onThemeChange: (theme: string) => void;
  // Views
  views: ViewTab[];
  onSaveViews: (views: ViewTab[]) => void;
  allStatuses: string[];
  allLabels: string[];
  // Tags disponíveis
  availableTags: string[];
}

export const SettingsPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  token,
  org,
  projectNumber,
  onLogout,
  selectedTheme,
  onThemeChange,
  views,
  onSaveViews,
  allStatuses,
  allLabels,
  availableTags
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'theme' | 'views' | 'templates' | 'mappings' | 'backup'>('account');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [loadingAccountInfo, setLoadingAccountInfo] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState<FontSizeId>(getFontSize);
  const [currentFontFamily, setCurrentFontFamily] = useState<FontFamilyId>(getFontFamily);

  // Resetar para aba account quando abrir
  useEffect(() => {
    if (isOpen) {
      setActiveTab('account');
    }
  }, [isOpen]);

  // Carregar informações da conta quando a aba estiver ativa
  useEffect(() => {
    if (isOpen && activeTab === 'account' && !accountInfo) {
      loadAccountInfo();
    }
  }, [isOpen, activeTab, accountInfo]);

  const loadAccountInfo = async () => {
    setLoadingAccountInfo(true);
    try {
      const service = new GitHubService(token);
      const userData = await service.verifyToken();
      setAccountInfo(userData);
    } catch (error) {
      console.error('Erro ao carregar informações da conta:', error);
    } finally {
      setLoadingAccountInfo(false);
    }
  };

  if (!isOpen) return null;

  // Renderizar conteúdo baseado na aba ativa
  const renderContent = () => {
    if (activeTab === 'views') {
      return (
        <div className="flex-1 overflow-y-auto p-6">
          <ViewManagerModal
            isOpen={true}
            onClose={() => {}}
            views={views}
            onSaveViews={onSaveViews}
            allStatuses={allStatuses}
            allLabels={allLabels}
            inline={true}
          />
        </div>
      );
    }

    if (activeTab === 'templates') {
      return (
        <div className="flex-1 overflow-y-auto p-6">
          <TemplateManager onClose={onClose} />
        </div>
      );
    }

    if (activeTab === 'mappings') {
      return (
        <div className="flex-1 overflow-y-auto">
          <RepoMappingConfig
            isOpen={true}
            inline={true}
            onClose={() => {}}
            availableTags={availableTags}
            availableViews={views}
            org={org}
            token={token}
          />
        </div>
      );
    }

    if (activeTab === 'backup') {
      const CONFIG_LABELS: Record<string, string> = {
        github_views: 'Visualizações (abas)',
        github_active_view: 'Aba ativa',
        github_theme: 'Tema',
        github_compact_card_view: 'Modo compacto',
        realtime_enabled: 'Atualizações em tempo real',
        github_hidden_labels: 'Labels ocultas',
        github_force_visible_labels: 'Labels sempre visíveis',
        view_hidden_labels: 'Labels ocultas por aba',
        psi_repo_groups: 'Grupos de repositórios',
        'github-project-view-tags-mapping': 'Mapeamento de tags por aba',
        'github-project-view-people-mapping': 'Mapeamento de pessoas por aba',
        'github-project-ignored-repos': 'Repositórios ignorados',
        'github-project-view-repo-mapping': 'Mapeamento de repos por aba',
        'github-project-tag-repo-mapping': 'Mapeamento tag → repo',
        'github-project-comment-templates': 'Templates de comentário',
      };

      const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportStatus(null);
        const result = await importConfig(file);
        if (result.ok) {
          setImportStatus({ type: 'success', message: `${result.keysRestored} configurações importadas. A página será recarregada.` });
          setTimeout(() => window.location.reload(), 1800);
        } else {
          setImportStatus({ type: 'error', message: result.error });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      };

      return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Exportar */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Download size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Exportar Configurações</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Salva todas as configurações em um arquivo JSON</p>
              </div>
            </div>
            <button
              onClick={exportConfig}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <Download size={16} />
              Exportar configurações
            </button>
          </div>

          {/* Importar */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Upload size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Importar Configurações</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Restaura a partir de um arquivo exportado anteriormente</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2.5 mb-4 text-sm text-amber-700 dark:text-amber-300">
              ⚠️ A importação substitui as configurações atuais e recarrega a página. Suas credenciais de acesso (token, org, projeto) não são alteradas.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Upload size={16} />
              Selecionar arquivo e importar
            </button>
            {importStatus && (
              <div className={`mt-3 flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 ${
                importStatus.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}>
                {importStatus.type === 'success'
                  ? <CheckCircle size={16} className="mt-0.5 shrink-0" />
                  : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                {importStatus.message}
              </div>
            )}
          </div>

          {/* O que é incluído */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <HardDrive size={16} className="text-gray-500" />
              O que é incluído no backup
            </h3>
            <ul className="space-y-1.5">
              {Object.entries(CONFIG_LABELS).map(([key, label]) => {
                const exists = localStorage.getItem(key) !== null;
                return (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      exists ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                    <span className={exists ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
                      {label}
                    </span>
                    {!exists && <span className="text-xs text-gray-400">(não configurado)</span>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 pt-3">
              🔒 Token, organização e número do projeto <strong>não são incluídos</strong> no backup por segurança.
            </p>
          </div>
        </div>
      );
    }    return (
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Informações da Conta
              </h3>

              {loadingAccountInfo ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Carregando informações...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Informações do Usuário */}
                  {accountInfo && (
                    <div className="col-span-full">
                      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <img
                          src={accountInfo.avatar_url}
                          alt={accountInfo.login}
                          className="w-16 h-16 rounded-full border-2 border-blue-300 dark:border-blue-700"
                        />
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {accountInfo.name || accountInfo.login}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">@{accountInfo.login}</p>
                          {accountInfo.bio && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{accountInfo.bio}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Token */}
                  <div className="col-span-full">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Key size={16} />
                      Token de Acesso
                    </label>
                    <input
                      type="password"
                      value={token}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                    />
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Token ativo e configurado
                    </p>
                  </div>

                  {/* Organização */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Building size={16} />
                      Organização
                    </label>
                    <input
                      type="text"
                      value={org}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {/* ID do Projeto */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Hash size={16} />
                      ID do Projeto
                    </label>
                    <input
                      type="number"
                      value={projectNumber}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {/* Estatísticas do GitHub */}
                  {accountInfo && (
                    <>
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <GitBranch size={16} className="text-gray-600 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Repositórios Públicos</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {accountInfo.public_repos || 0}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <User size={16} className="text-gray-600 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Seguidores</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {accountInfo.followers || 0}
                        </p>
                      </div>

                      {accountInfo.created_at && (
                        <div className="col-span-full bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar size={16} className="text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Conta criada em</span>
                          </div>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {new Date(accountInfo.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Botão Sair */}
                  <div className="col-span-full pt-4">
                    <button
                      onClick={onLogout}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                    >
                      Sair da Conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'theme' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Selecionar Tema
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => onThemeChange(theme.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedTheme === theme.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`w-8 h-8 rounded-full ${theme.colors.primary}`}
                      />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {theme.name}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className={`flex-1 h-2 rounded ${theme.colors.primary}`} />
                      <div className={`flex-1 h-2 rounded ${theme.colors.badge}`} />
                      <div className={`flex-1 h-2 rounded ${theme.colors.columnHeader}`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tipografia ── */}
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Type size={18} className="text-gray-500" />
                Tipografia
              </h3>

              {/* Tamanho */}
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Tamanho da fonte</p>
                <div className="flex gap-2">
                  {FONT_SIZES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setCurrentFontSize(s.id); saveFontSize(s.id); }}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border-2 transition-all ${
                        currentFontSize === s.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span style={{ fontSize: s.preview, fontWeight: 600, lineHeight: 1 }}>Aa</span>
                      <span className="text-xs leading-none">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Família */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Família de fonte</p>
                <div className="flex flex-col gap-2">
                  {FONT_FAMILIES.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setCurrentFontFamily(f.id); saveFontFamily(f.id); }}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${
                        currentFontFamily === f.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span
                        style={{ fontFamily: f.value }}
                        className="text-sm text-gray-800 dark:text-gray-200 font-medium"
                      >
                        {f.label} — Texto de exemplo 0123
                      </span>
                      {currentFontFamily === f.id && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold shrink-0 ml-2">Ativo</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] min-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-2">
              <SettingsIcon size={24} className="text-gray-700 dark:text-gray-300" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Configurações</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 shrink-0">
            <button
              onClick={() => setActiveTab('account')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'account'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <User size={16} />
              Conta
            </button>
            <button
              onClick={() => setActiveTab('theme')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'theme'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Palette size={16} />
              Tema
            </button>
            <button
              onClick={() => setActiveTab('views')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'views'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Layers size={16} />
              Visualizações
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <MessageSquare size={16} />
              Templates
            </button>
            <button
              onClick={() => setActiveTab('mappings')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'mappings'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <SettingsIcon size={16} />
              Mapeamentos
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'backup'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <HardDrive size={16} />
              Backup
            </button>
          </div>

          {/* Content */}
          {renderContent()}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
            <div className="flex items-center justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
