import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Tag, FolderGit2, RefreshCw, Layers, Edit2, Users, EyeOff, Eye } from 'lucide-react';
import {
  loadUserRepoMapping,
  saveUserRepoMapping,
  type UserRepoMapping
} from '../utils/userRepoMapping';
import {
  loadViewRepoMapping,
  saveViewRepoMapping,
  type ViewRepoMapping
} from '../utils/viewRepoMapping';
import {
  loadViewPeopleMapping,
  saveViewPeopleMapping,
  type ViewPeopleMapping
} from '../utils/viewPeopleMapping';
import {
  loadViewTagsMapping,
  saveViewTagsMapping,
  type ViewTagsMapping,
  type TagGroup
} from '../utils/viewTagsMapping';

import { Octokit } from '@octokit/rest';
import type { ViewTab } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  availableTags: string[];  // Tags únicas dos cards
  availableViews: ViewTab[]; // Views disponíveis
  org: string;              // Organização GitHub
  token: string;            // Token de autenticação
  inline?: boolean;         // Se true, renderiza sem backdrop/modal
}

export const RepoMappingConfig: React.FC<Props> = ({
  isOpen,
  onClose,
  availableTags,
  availableViews,
  org,
  token,
  inline = false
}) => {
  // Aba ativa
  const [activeTab, setActiveTab] = useState<'tags' | 'views' | 'people' | 'viewtags' | 'hiddenlabels'>('tags');

  // Estados para Tags → Repos
  const [mappings, setMappings] = useState<UserRepoMapping[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [searchRepo, setSearchRepo] = useState('');
  const [searchTag, setSearchTag] = useState('');

  // Estados para Views → Repos
  const [viewMappings, setViewMappings] = useState<ViewRepoMapping[]>([]);
  const [selectedView, setSelectedView] = useState<string>('');
  const [selectedViewRepos, setSelectedViewRepos] = useState<string[]>([]);
  const [searchViewRepo, setSearchViewRepo] = useState('');

  // Estados para Views → Pessoas
  const [peopleMappings, setPeopleMappings] = useState<ViewPeopleMapping[]>([]);
  const [selectedPeopleView, setSelectedPeopleView] = useState<string>('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);

  // Estados para Views → Tags Relevantes (apenas grupos)
  const [tagsMappings, setTagsMappings] = useState<ViewTagsMapping[]>([]);
  const [selectedTagsView, setSelectedTagsView] = useState<string>('');
  const [searchViewTag, setSearchViewTag] = useState('');

  // Estados para Grupos de Tags
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTags, setNewGroupTags] = useState<string[]>([]);
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null);

  // Estados para Labels Ocultas por View
  const [hiddenLabelsView, setHiddenLabelsView] = useState<string>('');
  const [hiddenLabelsByView, setHiddenLabelsByView] = useState<Record<string, string[]>>({});
  const [searchHiddenLabel, setSearchHiddenLabel] = useState('');

  // Estados comuns
  const [availableRepos, setAvailableRepos] = useState<string[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Estados para membros da organização
  const [orgMembers, setOrgMembers] = useState<Array<{ login: string; avatarUrl: string; url: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchMember, setSearchMember] = useState('');

  // Carregar mapeamentos salvos quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setMappings(loadUserRepoMapping());
      setViewMappings(loadViewRepoMapping());
      setPeopleMappings(loadViewPeopleMapping());
      setTagsMappings(loadViewTagsMapping());
      // Carregar labels ocultas por view do localStorage
      const savedHiddenLabels = localStorage.getItem('view_hidden_labels');
      if (savedHiddenLabels) {
        setHiddenLabelsByView(JSON.parse(savedHiddenLabels));
      }
    }
  }, [isOpen]);

  // Buscar repos da organização quando o modal abre
  useEffect(() => {
    if (isOpen && org && token) {
      loadRepos();
      loadMembers();
    }
  }, [isOpen, org, token]);

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const octokit = new Octokit({ auth: token });

      // Buscar todos os repositórios (paginação automática)
      let allRepos: string[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await octokit.repos.listForOrg({
          org,
          per_page: 100,
          page,
          sort: 'updated',
          type: 'all'
        });

        allRepos.push(...response.data.map(repo => repo.name));

        // Se retornou menos de 100, não há mais páginas
        hasMore = response.data.length === 100;
        page++;
      }

      setAvailableRepos(allRepos);
      console.log(`✓ Carregados ${allRepos.length} repositórios da organização ${org}`);
    } catch (error) {
      console.error('Erro ao buscar repositórios:', error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const octokit = new Octokit({ auth: token });

      // Buscar todos os membros da organização (paginação automática)
      const members = await octokit.paginate(
        octokit.orgs.listMembers,
        {
          org,
          per_page: 100,
        }
      );

      const formattedMembers = members.map(member => ({
        login: member.login,
        avatarUrl: member.avatar_url,
        url: member.html_url,
      }));

      setOrgMembers(formattedMembers);
      console.log(`✓ Carregados ${formattedMembers.length} membros da organização ${org}`);
    } catch (error) {
      console.error('Erro ao buscar membros da organização:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSave = () => {
    if (selectedTags.length === 0 || selectedRepos.length === 0) return;

    // Criar ou atualizar mapeamento para cada tag selecionada
    let newMappings = [...mappings];

    selectedTags.forEach(tag => {
      const existingIndex = newMappings.findIndex(m => m.tag.toLowerCase() === tag.toLowerCase());
      if (existingIndex >= 0) {
        newMappings[existingIndex] = { tag, repos: selectedRepos };
      } else {
        newMappings.push({ tag, repos: selectedRepos });
      }
    });

    setMappings(newMappings);
    saveUserRepoMapping(newMappings);

    // Limpar formulário
    setSelectedTags([]);
    setSelectedRepos([]);
    setSearchRepo('');
    setSearchTag('');
  };

  const handleDelete = (tags: string[]) => {
    const newMappings = mappings.filter(m => !tags.includes(m.tag));
    setMappings(newMappings);
    saveUserRepoMapping(newMappings);
  };

  const handleEdit = (tags: string[], repos: string[]) => {
    setSelectedTags(tags);
    setSelectedRepos(repos);
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const toggleRepo = (repo: string) => {
    if (selectedRepos.includes(repo)) {
      setSelectedRepos(selectedRepos.filter(r => r !== repo));
    } else {
      setSelectedRepos([...selectedRepos, repo]);
    }
  };

  // View Mapping Handlers
  const handleSaveViewMapping = () => {
    if (!selectedView || selectedViewRepos.length === 0) return;

    const existingIndex = viewMappings.findIndex(m => m.viewId === selectedView);
    let newMappings = [...viewMappings];

    if (existingIndex >= 0) {
      newMappings[existingIndex] = { viewId: selectedView, repos: selectedViewRepos };
    } else {
      newMappings.push({ viewId: selectedView, repos: selectedViewRepos });
    }

    setViewMappings(newMappings);
    saveViewRepoMapping(newMappings);

    // Limpar formulário
    setSelectedView('');
    setSelectedViewRepos([]);
    setSearchViewRepo('');
  };

  const handleDeleteViewMapping = (viewId: string) => {
    const updated = viewMappings.filter(vm => vm.viewId !== viewId);
    setViewMappings(updated);
    saveViewRepoMapping(updated);
  };

  // Handlers para People Mapping
  const handleSavePeopleMapping = () => {
    if (!selectedPeopleView || selectedPeople.length === 0) {
      return;
    }

    const existingIndex = peopleMappings.findIndex(pm => pm.viewId === selectedPeopleView);
    let updated: ViewPeopleMapping[];

    if (existingIndex >= 0) {
      // Atualizar mapeamento existente
      updated = [...peopleMappings];
      updated[existingIndex] = {
        viewId: selectedPeopleView,
        people: selectedPeople
      };
    } else {
      // Criar novo mapeamento
      updated = [...peopleMappings, {
        viewId: selectedPeopleView,
        people: selectedPeople
      }];
    }

    setPeopleMappings(updated);
    saveViewPeopleMapping(updated);
    setSelectedPeopleView('');
    setSelectedPeople([]);
  };

  const handleDeletePeopleMapping = (viewId: string) => {
    const updated = peopleMappings.filter(pm => pm.viewId !== viewId);
    setPeopleMappings(updated);
    saveViewPeopleMapping(updated);
  };

  const togglePerson = (login: string) => {
    if (selectedPeople.includes(login)) {
      setSelectedPeople(selectedPeople.filter(p => p !== login));
    } else {
      setSelectedPeople([...selectedPeople, login]);
    }
  };

  // Handlers para View Tags Mapping (apenas grupos)

  // Handlers para Tag Groups
  const handleAddTagGroup = () => {
    if (!selectedTagsView || !newGroupName.trim() || newGroupTags.length === 0) {
      return;
    }

    let updated = [...tagsMappings];
    let existingIndex = tagsMappings.findIndex(tm => tm.viewId === selectedTagsView);

    // Criar mapeamento se não existir (sem tags individuais, apenas grupos)
    if (existingIndex < 0) {
      updated.push({ viewId: selectedTagsView, tags: [], tagGroups: [] });
      existingIndex = updated.length - 1;
    }

    const currentGroups = updated[existingIndex].tagGroups || [];

    if (editingGroupIndex !== null) {
      // Editando grupo existente
      currentGroups[editingGroupIndex] = { name: newGroupName.trim(), tags: newGroupTags };
      setEditingGroupIndex(null);
    } else {
      // Adicionando novo grupo
      currentGroups.push({ name: newGroupName.trim(), tags: newGroupTags });
    }

    updated[existingIndex].tagGroups = currentGroups;
    setTagsMappings(updated);
    saveViewTagsMapping(updated);

    // Limpar formulário
    setNewGroupName('');
    setNewGroupTags([]);
  };

  const handleEditTagGroup = (index: number, group: TagGroup) => {
    setEditingGroupIndex(index);
    setNewGroupName(group.name);
    setNewGroupTags(group.tags);
  };

  const handleDeleteTagGroup = (groupIndex: number) => {
    if (!selectedTagsView) return;

    const existingIndex = tagsMappings.findIndex(tm => tm.viewId === selectedTagsView);
    if (existingIndex < 0) return;

    const updated = [...tagsMappings];
    const currentGroups = updated[existingIndex].tagGroups || [];
    currentGroups.splice(groupIndex, 1);
    updated[existingIndex].tagGroups = currentGroups;

    setTagsMappings(updated);
    saveViewTagsMapping(updated);
  };

  const toggleGroupTag = (tag: string) => {
    const updatedTags = newGroupTags.includes(tag)
      ? newGroupTags.filter(t => t !== tag)
      : [...newGroupTags, tag];

    setNewGroupTags(updatedTags);

    // Auto-preencher nome do grupo se apenas 1 tag selecionada
    if (updatedTags.length === 1) {
      setNewGroupName(updatedTags[0]);
    } else if (updatedTags.length === 0) {
      // Limpar nome se nenhuma tag selecionada
      setNewGroupName('');
    }
  };

  // Handlers para Labels Ocultas por View
  const handleToggleHiddenLabel = (label: string) => {
    if (!hiddenLabelsView) return;

    const currentHidden = hiddenLabelsByView[hiddenLabelsView] || [];
    const updated = { ...hiddenLabelsByView };

    if (currentHidden.includes(label)) {
      updated[hiddenLabelsView] = currentHidden.filter(l => l !== label);
    } else {
      updated[hiddenLabelsView] = [...currentHidden, label];
    }

    setHiddenLabelsByView(updated);
    localStorage.setItem('view_hidden_labels', JSON.stringify(updated));
  };

  const handleEditViewMapping = (_viewId: string, repos: string[]) => {
    setSelectedViewRepos(repos);
  };

  const toggleViewRepo = (repo: string) => {
    if (selectedViewRepos.includes(repo)) {
      setSelectedViewRepos(selectedViewRepos.filter(r => r !== repo));
    } else {
      setSelectedViewRepos([...selectedViewRepos, repo]);
    }
  };

  const filteredRepos = availableRepos.filter(repo =>
    repo.toLowerCase().includes(searchRepo.toLowerCase())
  );

  const filteredTags = availableTags.filter(tag =>
    tag.toLowerCase().includes(searchTag.toLowerCase())
  );

  const filteredViewRepos = availableRepos.filter(repo =>
    repo.toLowerCase().includes(searchViewRepo.toLowerCase())
  );

  const filteredViewTags = availableTags.filter(tag =>
    tag.toLowerCase().includes(searchViewTag.toLowerCase())
  );

  // Agrupar tags com mesmos repositórios
  const groupedMappings = mappings.reduce((acc, mapping) => {
    const repoKey = mapping.repos.sort().join(',');
    const existing = acc.find(g => g.repoKey === repoKey);
    if (existing) {
      existing.tags.push(mapping.tag);
    } else {
      acc.push({
        repoKey,
        tags: [mapping.tag],
        repos: mapping.repos
      });
    }
    return acc;
  }, [] as Array<{ repoKey: string; tags: string[]; repos: string[] }>);

  if (!isOpen && !inline) return null;

  // Se inline, renderiza conteúdo diretamente sem modal
  if (inline) {
    return (
      <div className="flex flex-col h-full">
        {/* Tabs Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'tags'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Tag size={16} />
            Tags → Repos
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
            Guias → Repos
          </button>
          <button
            onClick={() => setActiveTab('people')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'people'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Users size={16} />
            Guias → Pessoas
          </button>
          <button
            onClick={() => setActiveTab('viewtags')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'viewtags'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Tag size={16} />
            Grupos de Tags
          </button>
          <button
            onClick={() => setActiveTab('hiddenlabels')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'hiddenlabels'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <EyeOff size={16} />
            Labels Ocultas
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab: Tags */}
          {activeTab === 'tags' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário de Nova Regra */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Plus size={20} />
                {selectedTags.length > 0 ? 'Editar Regras' : 'Nova Regra'}
              </h3>

              {/* Selecionar Tags (múltipla seleção) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags ({selectedTags.length} selecionadas)
                </label>

                {/* Buscar tags */}
                <input
                  type="text"
                  placeholder="Buscar tags..."
                  value={searchTag}
                  onChange={(e) => setSearchTag(e.target.value)}
                  className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />

                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg mb-2">
                  {filteredTags.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      Nenhuma tag encontrada
                    </div>
                  ) : (
                    filteredTags.map(tag => (
                      <label
                        key={tag}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={() => toggleTag(tag)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100">{tag}</span>
                      </label>
                    ))
                  )}
                </div>

                {selectedTags.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedTags([]);
                      setSelectedRepos([]);
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>

              {/* Selecionar Repositórios */}
              {selectedTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Repositórios ({selectedRepos.length} selecionados)
                  </label>

                  {/* Buscar repos */}
                  <input
                    type="text"
                    placeholder="Buscar repositório..."
                    value={searchRepo}
                    onChange={(e) => setSearchRepo(e.target.value)}
                    className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />

                  <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                    {loadingRepos ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw size={20} className="animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Carregando repositórios...</span>
                      </div>
                    ) : filteredRepos.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                        Nenhum repositório encontrado
                      </div>
                    ) : (
                      filteredRepos.map(repo => (
                        <label
                          key={repo}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRepos.includes(repo)}
                            onChange={() => toggleRepo(repo)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{repo}</span>
                        </label>
                      ))
                    )}
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={selectedRepos.length === 0}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                  >
                    <Save size={16} />
                    Salvar Regra
                  </button>
                </div>
              )}
            </div>

            {/* Lista de Regras Existentes */}
            <div className="space-y-4 flex flex-col h-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 shrink-0">
                <Tag size={20} />
                Regras Configuradas ({groupedMappings.length} grupo{groupedMappings.length !== 1 ? 's' : ''})
              </h3>

              {groupedMappings.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="mb-2">Nenhuma regra configurada ainda</p>
                  <p className="text-sm">Selecione tags para começar</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {groupedMappings.map((group, idx) => (
                    <div
                      key={idx}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap gap-1">
                            {group.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-sm font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {group.repos.length} repositório{group.repos.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleEdit(group.tags, group.repos)}
                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Editar"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(group.tags)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.repos.map(repo => (
                          <span
                            key={repo}
                            className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                          >
                            {repo}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Tab: Views */}
          {activeTab === 'views' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulário */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Plus size={20} />
                    {selectedView ? 'Editar Mapeamento' : 'Novo Mapeamento'}
                  </h3>

                  {/* Selecionar Guia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Guia (View)
                    </label>
                    <select
                      value={selectedView}
                      onChange={(e) => setSelectedView(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Selecione uma guia...</option>
                      {availableViews.map(view => (
                        <option key={view.id} value={view.id}>{view.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selecionar Repositórios */}
                  {selectedView && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Repositórios ({selectedViewRepos.length} selecionados)
                      </label>

                      <input
                        type="text"
                        placeholder="Buscar repositório..."
                        value={searchViewRepo}
                        onChange={(e) => setSearchViewRepo(e.target.value)}
                        className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      />

                      <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                        {loadingRepos ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw size={20} className="animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Carregando repositórios...</span>
                          </div>
                        ) : filteredViewRepos.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                            Nenhum repositório encontrado
                          </div>
                        ) : (
                          filteredViewRepos.map(repo => (
                            <label
                              key={repo}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedViewRepos.includes(repo)}
                                onChange={() => toggleViewRepo(repo)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-900 dark:text-gray-100">{repo}</span>
                            </label>
                          ))
                        )}
                      </div>

                      <button
                        onClick={handleSaveViewMapping}
                        disabled={selectedViewRepos.length === 0}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                      >
                        Salvar Mapeamento
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de Mapeamentos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Mapeamentos Configurados ({viewMappings.length})
                  </h3>

                  {viewMappings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Layers size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Nenhum mapeamento configurado</p>
                      <p className="text-sm mt-1">Relacione guias com repositórios</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {viewMappings.map((mapping) => {
                        const view = availableViews.find(v => v.id === mapping.viewId);
                        return (
                          <div
                            key={mapping.viewId}
                            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Layers size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {view?.name || mapping.viewId}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditViewMapping(mapping.viewId, mapping.repos)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={14} className="text-gray-600 dark:text-gray-400" />
                                </button>
                                <button
                                  onClick={() => handleDeleteViewMapping(mapping.viewId)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {mapping.repos.map(repo => (
                                <span
                                  key={repo}
                                  className="px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs"
                                >
                                  {repo}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Pessoas */}
          {activeTab === 'people' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulário */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Plus size={20} />
                    {selectedPeopleView ? 'Editar Pessoas' : 'Novo Mapeamento'}
                  </h3>

                  {/* Selecionar Guia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Guia (Departamento)
                    </label>
                    <select
                      value={selectedPeopleView}
                      onChange={(e) => {
                        const viewId = e.target.value;
                        setSelectedPeopleView(viewId);
                        // Carregar pessoas já configuradas se existir mapeamento
                        const existing = peopleMappings.find(pm => pm.viewId === viewId);
                        setSelectedPeople(existing?.people || []);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Selecione uma guia...</option>
                      {availableViews.map(view => (
                        <option key={view.id} value={view.id}>{view.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selecionar Pessoas */}
                  {selectedPeopleView && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Membros da Organização ({selectedPeople.length} selecionados)
                      </label>

                      <input
                        type="text"
                        placeholder="Buscar membro..."
                        value={searchMember}
                        onChange={(e) => setSearchMember(e.target.value)}
                        className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      />

                      <div className="max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                        {loadingMembers ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw size={20} className="animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Carregando membros...</span>
                          </div>
                        ) : orgMembers.filter(member =>
                            member.login.toLowerCase().includes(searchMember.toLowerCase())
                          ).length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                            Nenhum membro encontrado
                          </div>
                        ) : (
                          orgMembers
                            .filter(member =>
                              member.login.toLowerCase().includes(searchMember.toLowerCase())
                            )
                            .map(member => (
                              <label
                                key={member.login}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPeople.includes(member.login)}
                                  onChange={() => togglePerson(member.login)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <img
                                  src={member.avatarUrl}
                                  alt={member.login}
                                  className="w-6 h-6 rounded-full"
                                />
                                <span className="text-sm text-gray-900 dark:text-gray-100">{member.login}</span>
                              </label>
                            ))
                        )}
                      </div>

                      <button
                        onClick={handleSavePeopleMapping}
                        disabled={selectedPeople.length === 0}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                      >
                        Salvar Mapeamento
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de Mapeamentos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Mapeamentos Configurados ({peopleMappings.length})
                  </h3>

                  {peopleMappings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Users size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Nenhum mapeamento configurado</p>
                      <p className="text-sm mt-1">Relacione pessoas com guias/departamentos</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {peopleMappings.map((mapping) => {
                        const view = availableViews.find(v => v.id === mapping.viewId);
                        return (
                          <div
                            key={mapping.viewId}
                            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Layers size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {view?.name || mapping.viewId}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedPeopleView(mapping.viewId);
                                    setSelectedPeople(mapping.people);
                                  }}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={14} className="text-gray-600 dark:text-gray-400" />
                                </button>
                                <button
                                  onClick={() => handleDeletePeopleMapping(mapping.viewId)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {mapping.people.map(person => (
                                <span
                                  key={person}
                                  className="px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs flex items-center gap-1"
                                >
                                  <Users size={12} />
                                  {person}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Tags Relevantes */}
          {activeTab === 'viewtags' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulário */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Plus size={20} />
                    {selectedTagsView ? 'Editar Grupos' : 'Novo Mapeamento'}
                  </h3>

                  {/* Selecionar Guia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Guia (Departamento)
                    </label>
                    <select
                      value={selectedTagsView}
                      onChange={(e) => setSelectedTagsView(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Selecione uma guia...</option>
                      {availableViews.map(view => (
                        <option key={view.id} value={view.id}>{view.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selecionar Tags */}
                  {selectedTagsView && (
                    <div>
                      {/* Grupos de Tags */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          💡 Crie grupos com uma ou múltiplas tags. Se selecionar apenas uma tag, o nome dela será preenchido automaticamente.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Grupos de Tags
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                          Agrupe múltiplas tags sob um nome (ex: "Meu Módulo" = App-Web + App-Mobile)
                        </p>

                        <input
                          type="text"
                          placeholder="Nome do grupo (ex: Meu Módulo)"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="w-full px-3 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                        />

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Selecione as Tags ({newGroupTags.length} selecionada{newGroupTags.length !== 1 ? 's' : ''})
                        </label>

                        <input
                          type="text"
                          placeholder="Buscar tag..."
                          value={searchViewTag}
                          onChange={(e) => setSearchViewTag(e.target.value)}
                          className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                        />

                        <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg mb-2">
                          {filteredViewTags.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-xs">
                              Nenhuma tag disponível
                            </div>
                          ) : (
                            filteredViewTags.map(tag => (
                              <label
                                key={`group-${tag}`}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={newGroupTags.includes(tag)}
                                  onChange={() => toggleGroupTag(tag)}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <Tag size={12} className="text-green-600 dark:text-green-400" />
                                <span className="text-xs text-gray-900 dark:text-gray-100">{tag}</span>
                              </label>
                            ))
                          )}
                        </div>

                        <button
                          onClick={handleAddTagGroup}
                          disabled={!newGroupName.trim() || newGroupTags.length === 0}
                          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          {editingGroupIndex !== null ? 'Atualizar Grupo' : 'Adicionar Grupo'}
                        </button>

                        {editingGroupIndex !== null && (
                          <button
                            onClick={() => {
                              setEditingGroupIndex(null);
                              setNewGroupName('');
                              setNewGroupTags([]);
                            }}
                            className="w-full mt-2 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            Cancelar Edição
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista de Grupos da Guia Selecionada */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedTagsView ? (
                      <span className="flex items-center gap-2">
                        <Tag size={20} className="text-green-600 dark:text-green-400" />
                        Grupos de {availableViews.find(v => v.id === selectedTagsView)?.name || selectedTagsView}
                      </span>
                    ) : (
                      'Grupos de Tags'
                    )}
                  </h3>

                  {!selectedTagsView ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Tag size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Selecione uma guia</p>
                      <p className="text-sm mt-1">Escolha uma guia para ver e gerenciar seus grupos de tags</p>
                    </div>
                  ) : (
                    <>
                      {tagsMappings.find(tm => tm.viewId === selectedTagsView)?.tagGroups?.length === 0 ||
                       !tagsMappings.find(tm => tm.viewId === selectedTagsView)?.tagGroups ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Tag size={48} className="mx-auto mb-2 opacity-50" />
                          <p>Nenhum grupo criado</p>
                          <p className="text-sm mt-1">Crie grupos de tags para organizar melhor</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                          {tagsMappings.find(tm => tm.viewId === selectedTagsView)!.tagGroups!.map((group, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-transparent hover:border-green-500 dark:hover:border-green-600 transition-colors"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <Tag size={18} className="text-green-600 dark:text-green-400 shrink-0" />
                                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">{group.name}</span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditTagGroup(idx, group)}
                                    className="p-2 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors"
                                    title="Editar grupo"
                                  >
                                    <Edit2 size={16} className="text-green-600 dark:text-green-400" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTagGroup(idx)}
                                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                    title="Remover grupo"
                                  >
                                    <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-sm font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {group.tags.length} tag{group.tags.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Labels Ocultas */}
          {activeTab === 'hiddenlabels' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 Configure quais labels devem ser ocultadas por padrão em cada guia. Usuários ainda poderão exibí-las manualmente através do filtro.
                </p>
              </div>

              {/* Seletor de View */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selecione uma Guia
                </label>
                <select
                  value={hiddenLabelsView}
                  onChange={(e) => setHiddenLabelsView(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Escolha uma guia...</option>
                  {availableViews.map(view => (
                    <option key={view.id} value={view.id}>
                      {view.icon} {view.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista de Labels */}
              {hiddenLabelsView && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Labels Disponíveis ({availableTags.length})
                    </label>
                    <input
                      type="text"
                      placeholder="Buscar label..."
                      value={searchHiddenLabel}
                      onChange={(e) => setSearchHiddenLabel(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-64"
                    />
                  </div>

                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-96 overflow-y-auto">
                    {availableTags
                      .filter(label => label.toLowerCase().includes(searchHiddenLabel.toLowerCase()))
                      .map(label => {
                        const isHidden = (hiddenLabelsByView[hiddenLabelsView] || []).includes(label);
                        return (
                          <button
                            key={label}
                            onClick={() => handleToggleHiddenLabel(label)}
                            className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors ${
                              isHidden
                                ? 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                            }`}
                          >
                            {isHidden ? (
                              <EyeOff size={18} className="text-orange-500 shrink-0" />
                            ) : (
                              <Eye size={18} className="text-gray-400 shrink-0" />
                            )}
                            <span className={`flex-1 text-left text-sm ${isHidden ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                              {label}
                            </span>
                            {isHidden && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                                Oculta
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>

                  {/* Resumo */}
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{(hiddenLabelsByView[hiddenLabelsView] || []).length}</strong> labels ocultas nesta guia
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <FolderGit2 size={24} className="text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Configurar Mapeamentos de Repositórios
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Relacione tags, guias e ignore repositórios para busca otimizada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'tags'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Tag size={16} />
            Tags
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
            Guias
          </button>
          <button
            onClick={() => setActiveTab('people')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'people'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Users size={16} />
            Pessoas
          </button>
          <button
            onClick={() => setActiveTab('viewtags')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'viewtags'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Tag size={16} />
            Grupos de Tags
          </button>
          <button
            onClick={() => setActiveTab('hiddenlabels')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'hiddenlabels'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <EyeOff size={16} />
            Labels Ocultas
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab: Tags */}
          {activeTab === 'tags' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário de Nova Regra */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Plus size={20} />
                {selectedTags.length > 0 ? 'Editar Regras' : 'Nova Regra'}
              </h3>

              {/* Selecionar Tags (múltipla seleção) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags ({selectedTags.length} selecionadas)
                </label>

                {/* Buscar tags */}
                <input
                  type="text"
                  placeholder="Buscar tags..."
                  value={searchTag}
                  onChange={(e) => setSearchTag(e.target.value)}
                  className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />

                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg mb-2">
                  {filteredTags.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      Nenhuma tag encontrada
                    </div>
                  ) : (
                    filteredTags.map(tag => (
                      <label
                        key={tag}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={() => toggleTag(tag)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100">{tag}</span>
                      </label>
                    ))
                  )}
                </div>

                {selectedTags.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedTags([]);
                      setSelectedRepos([]);
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>

              {/* Selecionar Repositórios */}
              {selectedTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Repositórios ({selectedRepos.length} selecionados)
                  </label>

                  {/* Buscar repos */}
                  <input
                    type="text"
                    placeholder="Buscar repositório..."
                    value={searchRepo}
                    onChange={(e) => setSearchRepo(e.target.value)}
                    className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />

                  <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                    {loadingRepos ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw size={20} className="animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Carregando repositórios...</span>
                      </div>
                    ) : filteredRepos.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                        Nenhum repositório encontrado
                      </div>
                    ) : (
                      filteredRepos.map(repo => (
                        <label
                          key={repo}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRepos.includes(repo)}
                            onChange={() => toggleRepo(repo)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{repo}</span>
                        </label>
                      ))
                    )}
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={selectedRepos.length === 0}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                  >
                    <Save size={16} />
                    Salvar Regra
                  </button>
                </div>
              )}
            </div>

            {/* Lista de Regras Existentes */}
            <div className="space-y-4 flex flex-col h-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 shrink-0">
                <Tag size={20} />
                Regras Configuradas ({groupedMappings.length} grupo{groupedMappings.length !== 1 ? 's' : ''})
              </h3>

              {groupedMappings.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="mb-2">Nenhuma regra configurada ainda</p>
                  <p className="text-sm">Selecione tags para começar</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {groupedMappings.map((group, idx) => (
                    <div
                      key={idx}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap gap-1">
                            {group.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-sm font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {group.repos.length} repositório{group.repos.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleEdit(group.tags, group.repos)}
                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Editar"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(group.tags)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.repos.map(repo => (
                          <span
                            key={repo}
                            className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                          >
                            {repo}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Tab: Views */}
          {activeTab === 'views' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulário */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Plus size={20} />
                    {selectedView ? 'Editar Mapeamento' : 'Novo Mapeamento'}
                  </h3>

                  {/* Selecionar Guia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Guia (View)
                    </label>
                    <select
                      value={selectedView}
                      onChange={(e) => setSelectedView(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Selecione uma guia...</option>
                      {availableViews.map(view => (
                        <option key={view.id} value={view.id}>{view.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selecionar Repositórios */}
                  {selectedView && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Repositórios ({selectedViewRepos.length} selecionados)
                      </label>

                      <input
                        type="text"
                        placeholder="Buscar repositório..."
                        value={searchViewRepo}
                        onChange={(e) => setSearchViewRepo(e.target.value)}
                        className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      />

                      <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                        {loadingRepos ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw size={20} className="animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Carregando repositórios...</span>
                          </div>
                        ) : filteredViewRepos.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                            Nenhum repositório encontrado
                          </div>
                        ) : (
                          filteredViewRepos.map(repo => (
                            <label
                              key={repo}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedViewRepos.includes(repo)}
                                onChange={() => toggleViewRepo(repo)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-900 dark:text-gray-100">{repo}</span>
                            </label>
                          ))
                        )}
                      </div>

                      <button
                        onClick={handleSaveViewMapping}
                        disabled={selectedViewRepos.length === 0}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                      >
                        Salvar Mapeamento
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de Mapeamentos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Mapeamentos Configurados ({viewMappings.length})
                  </h3>

                  {viewMappings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Layers size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Nenhum mapeamento configurado</p>
                      <p className="text-sm mt-1">Relacione guias com repositórios</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {viewMappings.map((mapping) => {
                        const view = availableViews.find(v => v.id === mapping.viewId);
                        return (
                          <div
                            key={mapping.viewId}
                            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Layers size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {view?.name || mapping.viewId}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditViewMapping(mapping.viewId, mapping.repos)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={14} className="text-gray-600 dark:text-gray-400" />
                                </button>
                                <button
                                  onClick={() => handleDeleteViewMapping(mapping.viewId)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {mapping.repos.map(repo => (
                                <span
                                  key={repo}
                                  className="px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs"
                                >
                                  {repo}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Pessoas */}
          {activeTab === 'people' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulário */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Plus size={20} />
                    {selectedPeopleView ? 'Editar Pessoas' : 'Novo Mapeamento'}
                  </h3>

                  {/* Selecionar Guia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Guia (Departamento)
                    </label>
                    <select
                      value={selectedPeopleView}
                      onChange={(e) => {
                        const viewId = e.target.value;
                        setSelectedPeopleView(viewId);
                        // Carregar pessoas já configuradas se existir mapeamento
                        const existing = peopleMappings.find(pm => pm.viewId === viewId);
                        setSelectedPeople(existing?.people || []);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Selecione uma guia...</option>
                      {availableViews.map(view => (
                        <option key={view.id} value={view.id}>{view.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selecionar Pessoas */}
                  {selectedPeopleView && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Membros da Organização ({selectedPeople.length} selecionados)
                      </label>

                      <input
                        type="text"
                        placeholder="Buscar membro..."
                        value={searchMember}
                        onChange={(e) => setSearchMember(e.target.value)}
                        className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      />

                      <div className="max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                        {loadingMembers ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw size={20} className="animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Carregando membros...</span>
                          </div>
                        ) : orgMembers.filter(member =>
                            member.login.toLowerCase().includes(searchMember.toLowerCase())
                          ).length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                            Nenhum membro encontrado
                          </div>
                        ) : (
                          orgMembers
                            .filter(member =>
                              member.login.toLowerCase().includes(searchMember.toLowerCase())
                            )
                            .map(member => (
                              <label
                                key={member.login}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPeople.includes(member.login)}
                                  onChange={() => togglePerson(member.login)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <img
                                  src={member.avatarUrl}
                                  alt={member.login}
                                  className="w-6 h-6 rounded-full"
                                />
                                <span className="text-sm text-gray-900 dark:text-gray-100">{member.login}</span>
                              </label>
                            ))
                        )}
                      </div>

                      <button
                        onClick={handleSavePeopleMapping}
                        disabled={selectedPeople.length === 0}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                      >
                        Salvar Mapeamento
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de Mapeamentos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Mapeamentos Configurados ({peopleMappings.length})
                  </h3>

                  {peopleMappings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Users size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Nenhum mapeamento configurado</p>
                      <p className="text-sm mt-1">Relacione pessoas com guias/departamentos</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {peopleMappings.map((mapping) => {
                        const view = availableViews.find(v => v.id === mapping.viewId);
                        return (
                          <div
                            key={mapping.viewId}
                            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Layers size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {view?.name || mapping.viewId}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedPeopleView(mapping.viewId);
                                    setSelectedPeople(mapping.people);
                                  }}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={14} className="text-gray-600 dark:text-gray-400" />
                                </button>
                                <button
                                  onClick={() => handleDeletePeopleMapping(mapping.viewId)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {mapping.people.map(person => (
                                <span
                                  key={person}
                                  className="px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs flex items-center gap-1"
                                >
                                  <Users size={12} />
                                  {person}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Tags Relevantes */}
          {activeTab === 'viewtags' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulário */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Plus size={20} />
                    {selectedTagsView ? 'Editar Grupos' : 'Novo Mapeamento'}
                  </h3>

                  {/* Selecionar Guia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Guia (Departamento)
                    </label>
                    <select
                      value={selectedTagsView}
                      onChange={(e) => setSelectedTagsView(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Selecione uma guia...</option>
                      {availableViews.map(view => (
                        <option key={view.id} value={view.id}>{view.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selecionar Tags */}
                  {selectedTagsView && (
                    <div>
                      {/* Grupos de Tags */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          💡 Crie grupos com uma ou múltiplas tags. Se selecionar apenas uma tag, o nome dela será preenchido automaticamente.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Grupos de Tags
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                          Agrupe múltiplas tags sob um nome (ex: "Meu Módulo" = App-Web + App-Mobile)
                        </p>

                        <input
                          type="text"
                          placeholder="Nome do grupo (ex: Meu Módulo)"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="w-full px-3 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                        />

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Selecione as Tags ({newGroupTags.length} selecionada{newGroupTags.length !== 1 ? 's' : ''})
                        </label>

                        <input
                          type="text"
                          placeholder="Buscar tag..."
                          value={searchViewTag}
                          onChange={(e) => setSearchViewTag(e.target.value)}
                          className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                        />

                        <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg mb-2">
                          {filteredViewTags.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-xs">
                              Nenhuma tag disponível
                            </div>
                          ) : (
                            filteredViewTags.map(tag => (
                              <label
                                key={`group-${tag}`}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={newGroupTags.includes(tag)}
                                  onChange={() => toggleGroupTag(tag)}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <Tag size={12} className="text-green-600 dark:text-green-400" />
                                <span className="text-xs text-gray-900 dark:text-gray-100">{tag}</span>
                              </label>
                            ))
                          )}
                        </div>

                        <button
                          onClick={handleAddTagGroup}
                          disabled={!newGroupName.trim() || newGroupTags.length === 0}
                          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          {editingGroupIndex !== null ? 'Atualizar Grupo' : 'Adicionar Grupo'}
                        </button>

                        {editingGroupIndex !== null && (
                          <button
                            onClick={() => {
                              setEditingGroupIndex(null);
                              setNewGroupName('');
                              setNewGroupTags([]);
                            }}
                            className="w-full mt-2 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            Cancelar Edição
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista de Grupos da Guia Selecionada */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedTagsView ? (
                      <span className="flex items-center gap-2">
                        <Tag size={20} className="text-green-600 dark:text-green-400" />
                        Grupos de {availableViews.find(v => v.id === selectedTagsView)?.name || selectedTagsView}
                      </span>
                    ) : (
                      'Grupos de Tags'
                    )}
                  </h3>

                  {!selectedTagsView ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Tag size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Selecione uma guia</p>
                      <p className="text-sm mt-1">Escolha uma guia para ver e gerenciar seus grupos de tags</p>
                    </div>
                  ) : (
                    <>
                      {tagsMappings.find(tm => tm.viewId === selectedTagsView)?.tagGroups?.length === 0 ||
                       !tagsMappings.find(tm => tm.viewId === selectedTagsView)?.tagGroups ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Tag size={48} className="mx-auto mb-2 opacity-50" />
                          <p>Nenhum grupo criado</p>
                          <p className="text-sm mt-1">Crie grupos de tags para organizar melhor</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                          {tagsMappings.find(tm => tm.viewId === selectedTagsView)!.tagGroups!.map((group, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-transparent hover:border-green-500 dark:hover:border-green-600 transition-colors"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <Tag size={18} className="text-green-600 dark:text-green-400 shrink-0" />
                                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">{group.name}</span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditTagGroup(idx, group)}
                                    className="p-2 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors"
                                    title="Editar grupo"
                                  >
                                    <Edit2 size={16} className="text-green-600 dark:text-green-400" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTagGroup(idx)}
                                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                    title="Remover grupo"
                                  >
                                    <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-sm font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {group.tags.length} tag{group.tags.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Labels Ocultas */}
          {activeTab === 'hiddenlabels' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 Configure quais labels devem ser ocultadas por padrão em cada guia. Usuários ainda poderão exibí-las manualmente através do filtro.
                </p>
              </div>

              {/* Seletor de View */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selecione uma Guia
                </label>
                <select
                  value={hiddenLabelsView}
                  onChange={(e) => setHiddenLabelsView(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Escolha uma guia...</option>
                  {availableViews.map(view => (
                    <option key={view.id} value={view.id}>
                      {view.icon} {view.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista de Labels */}
              {hiddenLabelsView && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Labels Disponíveis ({availableTags.length})
                    </label>
                    <input
                      type="text"
                      placeholder="Buscar label..."
                      value={searchHiddenLabel}
                      onChange={(e) => setSearchHiddenLabel(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-64"
                    />
                  </div>

                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-96 overflow-y-auto">
                    {availableTags
                      .filter(label => label.toLowerCase().includes(searchHiddenLabel.toLowerCase()))
                      .map(label => {
                        const isHidden = (hiddenLabelsByView[hiddenLabelsView] || []).includes(label);
                        return (
                          <button
                            key={label}
                            onClick={() => handleToggleHiddenLabel(label)}
                            className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors ${
                              isHidden
                                ? 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                            }`}
                          >
                            {isHidden ? (
                              <EyeOff size={18} className="text-orange-500 shrink-0" />
                            ) : (
                              <Eye size={18} className="text-gray-400 shrink-0" />
                            )}
                            <span className={`flex-1 text-left text-sm ${isHidden ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                              {label}
                            </span>
                            {isHidden && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                                Oculta
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>

                  {/* Resumo */}
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{(hiddenLabelsByView[hiddenLabelsView] || []).length}</strong> labels ocultas nesta guia
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              💡 Você pode selecionar múltiplas tags de uma vez para associá-las aos mesmos repositórios
            </p>
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
  );
};
