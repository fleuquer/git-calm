import React, { useState, useEffect } from 'react';
import { X, GitBranch, AlertCircle, CheckCircle, Copy, ArrowRight, Package, Layers, MessageSquare, Pin, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { ProjectCard, ProjectColumn } from '../types';
import { getRepoFromBranches } from '../utils/repoMapping';
import { loadRepoGroups, findGroupForRepo, type RepoGroup } from '../utils/repoGroups';
import { GitHubService } from '../services/github';
import { CardDetailModal } from './CardDetailModal';
import { getPeopleForView } from '../utils/viewPeopleMapping';
import { getReleaseLinkRepo } from '../utils/releaseSettings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  columns: ProjectColumn[];
  currentViewId: string;
  currentViewName?: string;
  token: string;
  org: string;
  projectNumber: number;
  onCardsUpdated: () => void;
}

interface IssueComment {
  id: number;
  author: string;
  authorAvatar: string;
  body: string;
  date: string;
}

interface BranchWithRepo {
  name: string;
  repo: string;
}

interface CardsByRepo {
  repo: string;             // Nome de exibição (grupo ou repo real)
  isGroup?: boolean;        // true quando é grupo fictício
  groupRepos?: string[];    // repos reais dentro do grupo
  cards: {
    card: ProjectCard;
    branches: string[];           // nomes das branches (compatibilidade)
    branchesWithRepos: BranchWithRepo[]; // branches com seu repo de origem
    allRepos: string[];           // todos os repos únicos do card
    effectiveRepo: string;        // repo primário (pode ser sobrescrito)
  }[];
}

type Step = 'review' | 'commands' | 'finalize' | 'message';

export const ReleaseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  columns,
  currentViewId,
  currentViewName,
  token,
  org,
  projectNumber,
  onCardsUpdated,
}) => {
  const [step, setStep] = useState<Step>('review');
  const [cardsByRepo, setCardsByRepo] = useState<CardsByRepo[]>([]);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [versionNumbers, setVersionNumbers] = useState<Record<string, string>>({});
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [selectedCardForDetail, setSelectedCardForDetail] = useState<ProjectCard | null>(null);
  const [manualRepoMapping, setManualRepoMapping] = useState<Record<string, string>>({});
  const [allRepositories, setAllRepositories] = useState<string[]>([]);
  const [repoFilter, setRepoFilter] = useState<Record<string, string>>({});
  const [suggestedTags, setSuggestedTags] = useState<Record<string, string>>({});  // repo/grupo -> nextTag
  const [lastTags, setLastTags] = useState<Record<string, string | null>>({});  // repo/grupo -> lastTag
  const [repoGroups, setRepoGroups] = useState<RepoGroup[]>([]);

  // Estados para comentários
  const [cardComments, setCardComments] = useState<Record<string, IssueComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [pinnedComments, setPinnedComments] = useState<Set<string>>(new Set()); // `${cardId}::${commentId}`

  // Devs da guia envolvidos no card
  const [viewPeople, setViewPeople] = useState<string[]>([]);
  const [cardParticipants, setCardParticipants] = useState<Record<string, { login: string; avatarUrl: string }[]>>({});

  // Controla quais cards estão com o seletor de repo principal aberto
  const [repoChangeOpen, setRepoChangeOpen] = useState<Set<string>>(new Set());

  // Estados para repos extras por card
  const [extraCardRepos, setExtraCardRepos] = useState<Record<string, string[]>>({});
  const [, setExtraRepoVersions] = useState<Record<string, Record<string, string>>>({});
  const [extraRepoSearch, setExtraRepoSearch] = useState<Record<string, string>>({});
  const [extraRepoSearchOpen, setExtraRepoSearchOpen] = useState<Record<string, boolean>>({});
  const [secRepoTagEnabled, setSecRepoTagEnabled] = useState<Record<string, boolean>>({});
  const [doneRepos, setDoneRepos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (isOpen) {
      setStep('review');
      setCardsByRepo([]);
      setSelectedCards(new Set());
      setVersionNumbers({});
      setManualRepoMapping({});
      setSuggestedTags({});
      setLastTags({});
      setCardComments({});
      setLoadingComments(new Set());
      setExpandedComments(new Set());
      setPinnedComments(new Set());
      setCardParticipants({});
      const people = getPeopleForView(currentViewId);
      setViewPeople(people);
      setExtraCardRepos({});
      setExtraRepoVersions({});
      setExtraRepoSearch({});
      setExtraRepoSearchOpen({});
      setSecRepoTagEnabled({});
      setRepoChangeOpen(new Set());
      setDoneRepos(new Set());
      const groups = loadRepoGroups();
      setRepoGroups(groups);
      loadCardsForRelease(groups);
      loadAllRepositories();
    }
  }, [isOpen]); // Só roda ao abrir/fechar — não reage a mudanças em columns

  // Reagrupar cards quando mapeamento manual ou grupos mudar
  useEffect(() => {
    if (cardsByRepo.length === 0) return;

    // Coletar todos os cards de todos os grupos/repos atuais
    const allCards: { card: ProjectCard; branches: string[]; branchesWithRepos: BranchWithRepo[]; allRepos: string[]; detectedRepo: string }[] = [];
    cardsByRepo.forEach(({ cards }) => {
      cards.forEach(({ card, branches, branchesWithRepos, allRepos, effectiveRepo }) => {
        allCards.push({ card, branches, branchesWithRepos, allRepos, detectedRepo: effectiveRepo });
      });
    });

    // Reagrupar aplicando overrides manuais e grupos
    const repoMap: Record<string, { card: ProjectCard; branches: string[]; branchesWithRepos: BranchWithRepo[]; allRepos: string[]; effectiveRepo: string }[]> = {};

    allCards.forEach(({ card, branches, branchesWithRepos, allRepos, detectedRepo }) => {
      const overridden = manualRepoMapping[card.id];
      const effectiveRepo = overridden || detectedRepo;

      const group = findGroupForRepo(effectiveRepo, repoGroups);
      const displayKey = group ? group.name : effectiveRepo;

      if (!repoMap[displayKey]) repoMap[displayKey] = [];
      repoMap[displayKey].push({ card, branches, branchesWithRepos, allRepos, effectiveRepo });
    });

    const grouped = Object.entries(repoMap)
      .map(([key, cards]) => {
        const group = repoGroups.find(g => g.name === key);
        return {
          repo: key,
          isGroup: !!group,
          groupRepos: group?.repos,
          cards
        };
      })
      .sort((a, b) => {
        if (a.repo === 'Sem Repositório') return 1;
        if (b.repo === 'Sem Repositório') return -1;
        return a.repo.localeCompare(b.repo);
      });

    setCardsByRepo(grouped);
  }, [manualRepoMapping, repoGroups]);

  // Auto-carrega comentadores de todos os cards quando a guia tem pessoas mapeadas
  useEffect(() => {
    if (cardsByRepo.length === 0 || viewPeople.length === 0) return;
    const loadAll = async () => {
      const service = new GitHubService(token);
      const allCards = cardsByRepo.flatMap(({ cards }) =>
        // card.repo é o repo real do GitHub; effectiveRepo pode ser nome de grupo fictício
        cards.map(({ card }) => ({ card, repo: card.repo || '' }))
      );
      await Promise.all(allCards.map(async ({ card, repo }) => {
        if (!repo || repo === 'Sem Repositório' || cardParticipants[card.id]) return;
        try {
          const comments = await service.getIssueComments(org, repo, card.number, 100);
          const seen = new Map<string, { login: string; avatarUrl: string }>();
          comments.forEach(c => {
            if (!seen.has(c.author)) seen.set(c.author, { login: c.author, avatarUrl: c.authorAvatar });
          });
          setCardParticipants(prev => ({ ...prev, [card.id]: Array.from(seen.values()) }));
        } catch { /* silencioso */ }
      }));
    };
    loadAll();
  }, [cardsByRepo, viewPeople]);

  // Carregar tags sugeridas quando entrar no step de commands
  useEffect(() => {
    if (step === 'commands' && cardsByRepo.length > 0) {
      loadSuggestedTags();
    }
  }, [step, cardsByRepo]);

  // Auto-preencher versões quando as tags sugeridas carregarem (disponível já no passo 2)
  useEffect(() => {
    if (Object.keys(suggestedTags).length === 0) return;
    setVersionNumbers(prev => {
      const next = { ...prev };
      let changed = false;
      Object.entries(suggestedTags).forEach(([r, tag]) => {
        if (!next[r]) {
          next[r] = tag.replace('production-v', '');
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [suggestedTags]);

  const compareVersionStrings = (a: string, b: string): number => {
    const parseV = (v: string) => v.replace('production-v', '').split('.').map(Number);
    const aV = parseV(a);
    const bV = parseV(b);
    for (let i = 0; i < Math.max(aV.length, bV.length); i++) {
      const diff = (aV[i] || 0) - (bV[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  const loadSuggestedTags = async () => {
    const tags: Record<string, string> = {};
    const last: Record<string, string | null> = {};

    for (const { repo, isGroup, groupRepos, cards } of cardsByRepo) {
      if (repo === 'Sem Repositório') continue;

      const selectedRepoCards = cards.filter(({ card }) => selectedCards.has(card.id));
      if (selectedRepoCards.length === 0) continue;

      if (isGroup && groupRepos && groupRepos.length > 0) {
        // Para grupos: pegar a versão mais alta entre todos os repos do grupo
        const groupTagResults = await Promise.all(groupRepos.map(r => getLastProductionTag(r)));
        const maxTag = groupTagResults.reduce<string | null>((max, tag) => {
          if (!tag) return max;
          if (!max) return tag;
          return compareVersionStrings(tag, max) > 0 ? tag : max;
        }, null);

        const nextTag = incrementVersion(maxTag);
        tags[repo] = nextTag;
        last[repo] = maxTag;
        // Também registrar por repo individual (para lookups internos)
        groupRepos.forEach(groupRepo => {
          tags[groupRepo] = nextTag;
          last[groupRepo] = maxTag;
        });
      } else {
        const lastTag = await getLastProductionTag(repo);
        const nextTag = incrementVersion(lastTag);
        tags[repo] = nextTag;
        last[repo] = lastTag;
      }
    }

    // Repos secundários: cards que têm branches em repos além do effectiveRepo
    const secondaryReposSet = new Set<string>();
    cardsByRepo.forEach(({ cards }) => {
      cards.forEach(({ branchesWithRepos, effectiveRepo }) => {
        branchesWithRepos.forEach(b => {
          if (b.repo && b.repo !== effectiveRepo && !tags[b.repo]) {
            secondaryReposSet.add(b.repo);
          }
        });
      });
    });
    await Promise.all(Array.from(secondaryReposSet).map(async secRepo => {
      const lastTag = await getLastProductionTag(secRepo);
      const nextTag = incrementVersion(lastTag);
      tags[secRepo] = nextTag;
      last[secRepo] = lastTag;
    }));

    // Repos extras adicionados manualmente em step 1
    const extraReposSet = new Set<string>();
    cardsByRepo.forEach(({ cards }) => {
      cards.forEach(({ card }) => {
        (extraCardRepos[card.id] || []).forEach(r => {
          if (!tags[r]) extraReposSet.add(r);
        });
      });
    });
    await Promise.all(Array.from(extraReposSet).map(async r => {
      const lastTag = await getLastProductionTag(r);
      const nextTag = incrementVersion(lastTag);
      tags[r] = nextTag;
      last[r] = lastTag;
    }));

    setSuggestedTags(tags);
    setLastTags(last);
  };

  const loadCardsForRelease = async (loadedGroups?: RepoGroup[]) => {
    const groups = loadedGroups ?? repoGroups;
    // Encontrar coluna "Fechar Versão"
    const releaseColumn = columns.find(col =>
      col.name.toLowerCase().includes('fechar') && col.name.toLowerCase().includes('versão')
    );

    if (!releaseColumn) {
      console.warn('Coluna "Fechar Versão" não encontrada');
      return;
    }

    console.log('📦 Carregando cards para release...');
    console.log('   Total de cards na coluna:', releaseColumn.cards.length);

    setIsLoadingBranches(true);

    try {
      const service = new GitHubService(token);

      // Carregar branches para cada card
      const cardsWithBranches = await Promise.all(
        releaseColumn.cards.map(async (card) => {
          try {
            const labelNames = card.labels.map(l => l.name);
            const assigneeLogins = card.assignees.map(a => a.login);

            const data = await service.searchBranchesAndCommits(
              org,
              card.number,
              card.title,
              labelNames,
              assigneeLogins,
              currentViewId
            );

            const branchesData: BranchWithRepo[] = data.branches.map(b => ({
              name: b.name,
              repo: b.repo || ''
            }));
            const branches = branchesData.map(b => b.name);
            const repos = branchesData.map(b => b.repo);

            console.log(`   Card #${card.number}:`, {
              title: card.title,
              branchCount: branches.length,
              branches: branches,
              repos: repos
            });

            return { card, branches, branchesData, repos };
          } catch (error) {
            console.error(`Erro ao carregar branches do card #${card.number}:`, error);
            return { card, branches: [], branchesData: [], repos: [] };
          }
        })
      );

      // Agrupar cards por repositório (com suporte a grupos fictícios)
      const repoMap: Record<string, { card: ProjectCard; branches: string[]; branchesWithRepos: BranchWithRepo[]; allRepos: string[]; effectiveRepo: string }[]> = {};

      cardsWithBranches.forEach(({ card, branches, branchesData, repos }) => {
        const uniqueRepos = [...new Set((repos || []).filter(Boolean))];

        // Determinar repo primário
        let primaryRepo = 'Sem Repositório';
        if (uniqueRepos.length > 0) {
          primaryRepo = uniqueRepos[0];
          console.log(`   Repo(s) extraído(s) direto: ${uniqueRepos.join(', ')}`);
        } else if (branches.length > 0) {
          const extracted = getRepoFromBranches(branches);
          if (extracted) {
            primaryRepo = extracted;
            console.log(`   Repo extraído de branch: ${primaryRepo}`);
          } else {
            console.log(`   Não conseguiu extrair repo de:`, branches);
          }
        }

        // Verificar se pertence a um grupo fictício
        const group = findGroupForRepo(primaryRepo, groups);
        const displayKey = group ? group.name : primaryRepo;

        if (!repoMap[displayKey]) repoMap[displayKey] = [];
        repoMap[displayKey].push({
          card,
          branches,
          branchesWithRepos: branchesData || [],
          allRepos: uniqueRepos,
          effectiveRepo: primaryRepo
        });
      });

      // Converter para array e ordenar
      const grouped = Object.entries(repoMap)
        .map(([key, cards]) => {
          const group = groups.find(g => g.name === key);
          return {
            repo: key,
            isGroup: !!group,
            groupRepos: group?.repos,
            cards
          };
        })
        .sort((a, b) => {
          // Colocar "Sem Repositório" por último
          if (a.repo === 'Sem Repositório') return 1;
          if (b.repo === 'Sem Repositório') return -1;
          return a.repo.localeCompare(b.repo);
        });

      console.log('   Agrupamento por repositório:');
      grouped.forEach(({ repo, cards }) => {
        console.log(`      ${repo}: ${cards.length} card(s)`);
      });

      setCardsByRepo(grouped);

      // Selecionar todos os cards que têm branches
      const initialSelected = new Set<string>();
      grouped.forEach(({ cards }) => {
        cards.forEach(({ card, branches }) => {
          if (branches.length > 0) {
            initialSelected.add(card.id);
          }
        });
      });      setSelectedCards(initialSelected);
    } catch (error) {
      console.error('Erro ao carregar branches:', error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const toggleDone = (key: string) => {
    setDoneRepos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const loadAllRepositories = async () => {
    try {
      const service = new GitHubService(token);
      const octokit = service['octokit']; // Acessar octokit interno
      // Paginar todos os repositórios da organização
      const allRepos = await octokit.paginate(octokit.repos.listForOrg, {
        org,
        type: 'all',
        per_page: 100,
      });

      const repoNames = allRepos.map((repo: { name: string }) => repo.name).sort();
      setAllRepositories(repoNames);
    } catch (error) {
      console.error('Erro ao carregar repositórios:', error);
      // Fallback: usar apenas os repositórios já detectados
      const detectedRepos = cardsByRepo
        .filter(r => r.repo !== 'Sem Repositório')
        .map(r => r.repo);
      setAllRepositories(detectedRepos);
    }
  };

  const loadCommentsForCard = async (card: { id: string; number: number; repo?: string }) => {
    if (cardComments[card.id] !== undefined || loadingComments.has(card.id)) return;
    const repo = card.repo;
    if (!repo) return;
    setLoadingComments(prev => new Set(prev).add(card.id));
    try {
      const service = new GitHubService(token);
      const comments = await service.getIssueComments(org, repo, card.number, 5);
      setCardComments(prev => ({ ...prev, [card.id]: comments }));
    } finally {
      setLoadingComments(prev => { const s = new Set(prev); s.delete(card.id); return s; });
    }
  };

  const toggleCommentExpand = (cardId: string, card: { id: string; number: number; repo?: string }) => {
    setExpandedComments(prev => {
      const s = new Set(prev);
      if (s.has(cardId)) { s.delete(cardId); } else {
        s.add(cardId);
        loadCommentsForCard(card);
      }
      return s;
    });
  };

  const togglePinComment = (cardId: string, commentId: number) => {
    const key = `${cardId}::${commentId}`;
    setPinnedComments(prev => {
      const s = new Set(prev);
      if (s.has(key)) { s.delete(key); } else { s.add(key); }
      return s;
    });
  };

  const isPinned = (cardId: string, commentId: number) => pinnedComments.has(`${cardId}::${commentId}`);

  const addExtraRepo = (cardId: string, repoName: string) => {
    setExtraCardRepos(prev => ({
      ...prev,
      [cardId]: [...(prev[cardId] || []).filter(r => r !== repoName), repoName],
    }));
  };

  const removeExtraRepo = (cardId: string, repoName: string) => {
    setExtraCardRepos(prev => ({
      ...prev,
      [cardId]: (prev[cardId] || []).filter(r => r !== repoName),
    }));
  };

  const toggleCardSelection = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const assignCardToRepo = (cardId: string, repoName: string) => {
    setManualRepoMapping(prev => ({
      ...prev,
      [cardId]: repoName
    }));
  };

  const getLastProductionTag = async (repo: string): Promise<string | null> => {
    const service = new GitHubService(token);
    return service.getLastProductionTag(org, repo);
  };

  const incrementVersion = (lastTag: string | null): string => {
    if (!lastTag) {
      // Se não tem tag, começar com v1.0.0.1
      return 'production-v1.0.0.1';
    }

    // Extrair números da versão (ex: production-v1.0.26.2 → [1, 0, 26, 2])
    const versionMatch = lastTag.match(/production-v(.+)/);
    if (!versionMatch) {
      return 'production-v1.0.0.1';
    }

    const versionParts = versionMatch[1].split('.').map(Number);

    // Incrementar o último número
    versionParts[versionParts.length - 1]++;

    return `production-v${versionParts.join('.')}`;
  };

  const generateMergeCommands = (branches: string[]) => {
    const commands: string[] = [];
    branches.forEach(branch => {
      const issueMatch = branch.match(/issue-(\d+)/);
      const issueNumber = issueMatch ? issueMatch[1] : branch;
      commands.push(`git merge origin/issue-${issueNumber}`);
    });
    return commands.join('\n');
  };

  /** Coleta branches de cards selecionados filtradas por repo específico */
  const getBranchesForSubRepo = (
    cards: CardsByRepo['cards'],
    subRepo: string
  ): string[] => {
    const branches: string[] = [];
    cards.forEach(({ card, branchesWithRepos, branches: allBranches }) => {
      if (!selectedCards.has(card.id)) return;
      if (branchesWithRepos.length > 0) {
        branchesWithRepos
          .filter(b => b.repo === subRepo)
          .forEach(b => branches.push(b.name));
      } else {
        // fallback: sem info de repo, inclui todas
        allBranches.forEach(b => branches.push(b));
      }
    });
    return [...new Set(branches)];
  };

  const getVSCodePath = (repo: string) => {
    // Gerar caminho VSCode para abrir o repositório
    // Assumindo que todos estão em /home/embras/Projetos/
    const basePath = '/home/embras/Projetos';
    return `vscode://file${basePath}/${repo}`;
  };

  const generateReleaseMessage = () => {
    const today = new Date().toLocaleDateString('pt-BR');

    let message = `🗓️ Liberação de Versão — ${today}\n`;

    cardsByRepo.forEach(({ repo, cards }) => {
      const selectedRepoCards = cards.filter(({ card }) => selectedCards.has(card.id));
      if (selectedRepoCards.length === 0) return;

      const version = versionNumbers[repo] || '';
      const versionText = version ? ` v${version}` : '';

      message += `\n📦 ${repo}${versionText}\n`;

      selectedRepoCards.forEach(({ card }) => {
        // Adicionar link clicável para o card com título
        message += `    #${card.number} - ${card.title}\n`;
      });
    });

    return message;
  };

  const generateReleaseMessageMarkdown = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    const linkRepoOverride = getReleaseLinkRepo();

    let message = `>>> ### 🗓️ Liberação de Versão — ${today}\n`;

    cardsByRepo.forEach(({ repo, cards }) => {
      const selectedRepoCards = cards.filter(({ card }) => selectedCards.has(card.id));
      if (selectedRepoCards.length === 0) return;

      const version = versionNumbers[repo] || '';
      const versionText = version ? ` *v${version}*` : '';

      message += `📦 **${repo}**${versionText}\n`;

      selectedRepoCards.forEach(({ card, effectiveRepo, allRepos }) => {
        const cardRepo = linkRepoOverride || effectiveRepo || allRepos?.[0] || repo;
        const issueUrl = `https://github.com/${org}/${cardRepo}/issues/${card.number}`;
        message += `- [#${card.number} - ${card.title}](${issueUrl})\n`;
      });
    });

    return message;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  // Repos secundários (auto-detectados + extras manuais) que de fato terão versão própria nesta release,
  // ou seja, cuja tag foi habilitada no passo "Comandos Git" (mesma regra usada lá).
  const getEnabledSecondaryRepos = (
    cardId: string,
    allRepos: string[],
    effectiveRepo: string,
    branchesWithRepos: BranchWithRepo[]
  ): string[] => {
    const autoSecondaries = (allRepos || []).filter(r => r !== effectiveRepo);
    const manualExtras = (extraCardRepos[cardId] || []).filter(r => !autoSecondaries.includes(r));
    const candidates = [...autoSecondaries, ...manualExtras];
    return candidates.filter(secRepo => {
      const secBranches = (branchesWithRepos || []).filter(b => b.repo === secRepo);
      return secBranches.length === 0
        ? secRepoTagEnabled[secRepo] !== false
        : !!secRepoTagEnabled[secRepo];
    });
  };

  const handleFinalize = async () => {
    console.log('🚀 handleFinalize chamado!');
    console.log('   isProcessing:', isProcessing);
    console.log('   versionNumbers:', versionNumbers);
    console.log('   selectedCards:', Array.from(selectedCards));
    console.log('   cardsByRepo:', cardsByRepo);

    setIsProcessing(true);

    try {
      const service = new GitHubService(token);

      // 1. Buscar campo de status e opção "Produção"
      console.log('🔍 Buscando campo de status do projeto...');
      console.log('   org:', org);
      console.log('   projectNumber:', projectNumber);

      const statusInfo = await service.getProjectStatusField(org, projectNumber);
      const productionOption = statusInfo.options.find((opt: any) =>
        opt.name.toLowerCase().includes('produção') ||
        opt.name.toLowerCase().includes('producao') ||
        opt.name.toLowerCase() === 'production'
      );

      if (!productionOption) {
        throw new Error('Coluna "Produção" não encontrada no projeto');
      }

      console.log('✅ Campo de status encontrado:', {
        projectId: statusInfo.projectId,
        fieldId: statusInfo.fieldId,
        productionId: productionOption.id,
        productionName: productionOption.name,
        allOptions: statusInfo.options.map((o: any) => o.name)
      });

      // 2. Processar cada card selecionado
      const selectedCardsList = cardsByRepo.flatMap(({ repo, cards }) =>
        cards
          .filter(({ card }) => selectedCards.has(card.id))
          .map(({ card, branches, branchesWithRepos, effectiveRepo, allRepos }) => ({ card, branches, branchesWithRepos, repo, effectiveRepo, allRepos }))
      );

      console.log(`📦 Processando ${selectedCardsList.length} cards...`);

      for (const { card, repo, effectiveRepo, allRepos, branchesWithRepos } of selectedCardsList) {
        const versionNumber = versionNumbers[repo];

        if (!versionNumber) {
          console.warn(`⚠️ Sem versão definida para ${repo}, pulando card #${card.number}`);
          continue;
        }

        try {
          // Repo onde o comentário será postado (issue do card)
          const commentRepo = card.repo || effectiveRepo;
          // Nome do repo principal no comentário (repo de versionamento, não o da issue)
          const primaryRepoLabel = effectiveRepo || card.repo;

          console.log(`📝 Card #${card.number}:`, {
            commentRepo,
            primaryRepoLabel,
            displayGroup: repo,
            url: card.url
          });

          // Repos secundários que de fato terão versão própria (tag habilitada no passo "Comandos Git")
          const allSecondaries = getEnabledSecondaryRepos(card.id, allRepos, effectiveRepo, branchesWithRepos);

          // 2.1. Comentar no card
          let commentBody: string;
          if (allSecondaries.length === 0) {
            commentBody = `**Liberado na versão ${versionNumber}**\n\n`;
          } else {
            const lines = [`**Liberado na versão:**\n`];
            lines.push(`- ${primaryRepoLabel}: ${versionNumber}`);
            allSecondaries.forEach(secRepo => {
              const secVersion = versionNumbers[secRepo] || versionNumber;
              lines.push(`- ${secRepo}: ${secVersion}`);
            });
            commentBody = lines.join('\n') + '\n\n';
          }

          console.log(`💬 Comentando no card #${card.number} no repo ${commentRepo}...`);
          await service.addComment(org, commentRepo, card.number, commentBody);
          console.log(`   ✅ Comentário adicionado`);

          // 2.2. Mover para Produção
          console.log(`📋 Movendo card #${card.number} para Produção...`);
          console.log(`   Parâmetros:`, {
            projectId: statusInfo.projectId,
            itemId: card.id,
            fieldId: statusInfo.fieldId,
            statusOptionId: productionOption.id
          });

          const moveResult = await service.updateProjectItemStatus(
            statusInfo.projectId,
            card.id,
            statusInfo.fieldId,
            productionOption.id
          );

          console.log(`   ✅ Card movido, resultado:`, moveResult);

          console.log(`✅ Card #${card.number} processado com sucesso`);
        } catch (error) {
          const errorMessage = (error as Error).message;
          console.error(`❌ Erro ao processar card #${card.number}:`, error);

          // Verificar se é erro de permissão
          if (errorMessage.includes('required scopes') && errorMessage.includes('project')) {
            console.error(`⚠️  ERRO DE PERMISSÃO: O token não tem permissão 'project' para escrever no projeto.`);
            console.error(`    Acesse: https://github.com/settings/tokens`);
            console.error(`    E marque a permissão 'project' (não apenas 'read:project')`);
          }
        }
      }

      console.log('✅ Release finalizado com sucesso!');

      // Notificar que os cards foram atualizados (sem fechar o modal)
      console.log('🔄 Chamando onCardsUpdated...');
      onCardsUpdated();
      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('❌ Erro FATAL ao finalizar release:', error);
      console.error('   Stack:', (error as Error).stack);

      if (errorMessage.includes('required scopes') && errorMessage.includes('project')) {
        alert('❌ Erro de Permissão\n\n' +
          'Seu token do GitHub não tem permissão para mover cards no projeto.\n\n' +
          'Você precisa adicionar a permissão "project" (escrita) ao seu token.\n\n' +
          'Acesse: https://github.com/settings/tokens\n' +
          'E marque a opção "project" (não apenas "read:project")');
      } else {
        alert(`Erro ao finalizar release: ${errorMessage}\n\nVerifique o console para mais detalhes.`);
      }
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Package className="text-blue-600 dark:text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Gerar Release{currentViewName ? ` — ${currentViewName}` : ''}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className={`flex items-center gap-2 ${step === 'review' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'review' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
              1
            </div>
            <span className="text-sm font-medium">Revisar Cards</span>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
          <div className={`flex items-center gap-2 ${step === 'commands' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'commands' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
              2
            </div>
            <span className="text-sm font-medium">Comandos Git</span>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
          <div className={`flex items-center gap-2 ${step === 'finalize' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'finalize' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
              3
            </div>
            <span className="text-sm font-medium">Finalizar</span>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
          <div className={`flex items-center gap-2 ${step === 'message' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'message' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
              4
            </div>
            <span className="text-sm font-medium">Mensagem</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingBranches ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 dark:text-gray-400">Carregando branches dos cards...</p>
            </div>
          ) : step === 'review' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Revise os cards agrupados por repositório. Desmarque cards que não devem fazer parte desta release.
              </p>

              {cardsByRepo.map(({ repo, isGroup, groupRepos, cards }) => (
                <div key={repo} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    {isGroup ? <Layers size={20} className="text-purple-500" /> : <GitBranch size={20} />}
                    {repo}
                    {isGroup && (
                      <span className="text-xs font-normal text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                        grupo
                      </span>
                    )}
                    <span className="text-sm font-normal text-gray-500">
                      ({cards.length} {cards.length === 1 ? 'card' : 'cards'})
                    </span>

                    {/* Devs da guia envolvidos em qualquer card deste repo */}
                    {viewPeople.length > 0 && (() => {
                      const repoAssignees = new Map<string, { login: string; avatarUrl: string }>();
                      const repoCommenters = new Map<string, { login: string; avatarUrl: string }>();
                      const stillLoading = cards.some(({ card }) => card.repo && !cardParticipants[card.id]);
                      cards.forEach(({ card }) => {
                        card.assignees.forEach(a => {
                          if (viewPeople.includes(a.login)) repoAssignees.set(a.login, a);
                        });
                        (cardParticipants[card.id] || []).forEach(p => {
                          if (viewPeople.includes(p.login) && !repoAssignees.has(p.login))
                            repoCommenters.set(p.login, p);
                        });
                      });
                      const allDevs = [...repoAssignees.values(), ...repoCommenters.values()];
                      if (allDevs.length === 0 && !stillLoading) return null;
                      return (
                        <div className="ml-auto flex items-center gap-1.5 font-normal">
                          {allDevs.map(dev => {
                            const isAssignee = repoAssignees.has(dev.login);
                            return (
                              <span
                                key={dev.login}
                                title={isAssignee ? `${dev.login} — responsável` : `${dev.login} — comentou`}
                                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                                  isAssignee
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                                }`}
                              >
                                <img src={dev.avatarUrl} alt={dev.login} className="w-4 h-4 rounded-full" />
                                {dev.login}
                              </span>
                            );
                          })}
                          {stillLoading && allDevs.length === 0 && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">verificando...</span>
                          )}
                        </div>
                      );
                    })()}
                  </h3>

                  {isGroup && groupRepos && (
                    <div className="mb-3 flex flex-wrap gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>Repos:</span>
                      {groupRepos.map(r => (
                        <span key={r} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">{r}</span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    {cards.map(({ card, branches, allRepos, effectiveRepo }) => {
                      const isUnmapped = repo === 'Sem Repositório';
                      const secondaryRepos = allRepos.filter(r => r !== effectiveRepo);

                      return (
                        <div
                          key={card.id}
                          className={`p-3 rounded-lg border ${
                            selectedCards.has(card.id)
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedCards.has(card.id)}
                              onChange={() => toggleCardSelection(card.id)}
                              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <button
                                  onClick={() => setSelectedCardForDetail(card)}
                                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                  #{card.number}
                                </button>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {card.title}
                                </span>
                              </div>
                              {branches.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {branches.map(branch => (
                                    <span
                                      key={branch}
                                      className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                                    >
                                      {branch}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                                  <AlertCircle size={12} />
                                  Nenhuma branch encontrada
                                </div>
                              )}

                              {/* ── Repos de versionamento ── */}
                              <div className="mt-1.5 space-y-1">
                                {/* Repo principal */}
                                {(() => {
                                  const hasOverride = !!manualRepoMapping[card.id];
                                  const isSearchOpen = repoChangeOpen.has(card.id);
                                  return (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Repo principal:</span>
                                        {isUnmapped ? (
                                          <span className="text-xs text-orange-500 dark:text-orange-400 italic">não identificado</span>
                                        ) : (
                                          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                                            hasOverride
                                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                          }`}>
                                            {effectiveRepo}
                                          </span>
                                        )}
                                        {!isUnmapped && !isSearchOpen && !hasOverride && (
                                          <button
                                            onClick={() => setRepoChangeOpen(prev => { const s = new Set(prev); s.add(card.id); return s; })}
                                            className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 underline"
                                          >
                                            Alterar
                                          </button>
                                        )}
                                        {hasOverride && (
                                          <button
                                            onClick={() => {
                                              const m = { ...manualRepoMapping };
                                              delete m[card.id];
                                              setManualRepoMapping(m);
                                              setRepoFilter(prev => ({ ...prev, [card.id]: '' }));
                                              setRepoChangeOpen(prev => { const s = new Set(prev); s.delete(card.id); return s; });
                                            }}
                                            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 underline"
                                          >
                                            Restaurar original
                                          </button>
                                        )}
                                      </div>

                                      {/* Busca para alterar repo principal */}
                                      {!isUnmapped && isSearchOpen && (
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="text"
                                              placeholder="Buscar repositório..."
                                              value={repoFilter[card.id] || ''}
                                              onChange={(e) => setRepoFilter(prev => ({ ...prev, [card.id]: e.target.value }))}
                                              className="text-xs flex-1 px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                              autoFocus
                                            />
                                            <button
                                              onClick={() => {
                                                setRepoChangeOpen(prev => { const s = new Set(prev); s.delete(card.id); return s; });
                                                setRepoFilter(prev => ({ ...prev, [card.id]: '' }));
                                              }}
                                              className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                              title="Cancelar"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                          {repoFilter[card.id] && (
                                            <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
                                              {allRepositories
                                                .filter(r => r.toLowerCase().includes(repoFilter[card.id].toLowerCase()))
                                                .slice(0, 10)
                                                .map(repoName => (
                                                  <button
                                                    key={repoName}
                                                    onClick={() => {
                                                      assignCardToRepo(card.id, repoName);
                                                      setRepoFilter(prev => ({ ...prev, [card.id]: '' }));
                                                      setRepoChangeOpen(prev => { const s = new Set(prev); s.delete(card.id); return s; });
                                                    }}
                                                    className="w-full text-left px-2 py-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-900 dark:text-gray-100"
                                                  >
                                                    {repoName}
                                                  </button>
                                                ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Repos secundários: auto-detectados + adicionados manualmente */}
                                {(() => {
                                  const manualExtras = (extraCardRepos[card.id] || []).filter(r => !secondaryRepos.includes(r));
                                  const allSecondary = [...secondaryRepos, ...manualExtras];
                                  if (allSecondary.length === 0) return null;
                                  return (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <AlertCircle size={12} className="text-amber-500 shrink-0" />
                                      <span className="text-xs text-amber-600 dark:text-amber-400">Também liberar em:</span>
                                      {secondaryRepos.map(r => (
                                        <span key={r} className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-mono">
                                          {r}
                                        </span>
                                      ))}
                                      {manualExtras.map(r => (
                                        <span key={r} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-mono">
                                          {r}
                                          <button onClick={() => removeExtraRepo(card.id, r)} title="Remover" className="hover:text-red-600">
                                            <X size={10} />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })()}

                                {/* Seletor de repo principal para cards sem repo */}
                                {isUnmapped && (
                                  <div className="mt-1 space-y-1">
                                    <p className="text-xs text-orange-600 dark:text-orange-400">
                                      Nenhum repositório detectado — selecione manualmente:
                                    </p>
                                    <input
                                      type="text"
                                      placeholder="Buscar repositório..."
                                      value={repoFilter[card.id] || ''}
                                      onChange={(e) => setRepoFilter(prev => ({ ...prev, [card.id]: e.target.value }))}
                                      className="text-xs w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                    {repoFilter[card.id] && (
                                      <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
                                        {allRepositories
                                          .filter(r => r.toLowerCase().includes(repoFilter[card.id].toLowerCase()))
                                          .slice(0, 10)
                                          .map(repoName => (
                                            <button
                                              key={repoName}
                                              onClick={() => {
                                                assignCardToRepo(card.id, repoName);
                                                setRepoFilter(prev => ({ ...prev, [card.id]: '' }));
                                              }}
                                              className="w-full text-left px-2 py-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-900 dark:text-gray-100"
                                            >
                                              {repoName}
                                            </button>
                                          ))}
                                      </div>
                                    )}
                                    {manualRepoMapping[card.id] && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-green-600 dark:text-green-400">
                                          ✓ Repo selecionado: {manualRepoMapping[card.id]}
                                        </span>
                                        <button
                                          onClick={() => {
                                            const newMapping = { ...manualRepoMapping };
                                            delete newMapping[card.id];
                                            setManualRepoMapping(newMapping);
                                            setRepoFilter(prev => ({ ...prev, [card.id]: '' }));
                                          }}
                                          className="text-xs text-red-600 hover:text-red-700"
                                        >
                                          Alterar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Botão: também liberar em outro repo */}
                                {!isUnmapped && (
                                  <div>
                                    <button
                                      onClick={() => setExtraRepoSearchOpen(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
                                      className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                                    >
                                      <Plus size={11} />
                                      Também liberar em outro repo
                                    </button>
                                    {extraRepoSearchOpen[card.id] && (
                                      <div className="mt-1">
                                        <input
                                          type="text"
                                          value={extraRepoSearch[card.id] || ''}
                                          onChange={(e) => setExtraRepoSearch(prev => ({ ...prev, [card.id]: e.target.value }))}
                                          placeholder="Buscar repositório..."
                                          autoFocus
                                          className="text-xs w-full px-2 py-1 border border-amber-300 dark:border-amber-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        />
                                        {extraRepoSearch[card.id] && (
                                          <div className="max-h-28 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 mt-0.5">
                                            {allRepositories
                                              .filter(r =>
                                                r.toLowerCase().includes(extraRepoSearch[card.id].toLowerCase()) &&
                                                !(extraCardRepos[card.id] || []).includes(r) &&
                                                r !== effectiveRepo &&
                                                !secondaryRepos.includes(r)
                                              )
                                              .slice(0, 8)
                                              .map(repoName => (
                                                <button
                                                  key={repoName}
                                                  onClick={() => {
                                                    addExtraRepo(card.id, repoName);
                                                    setExtraRepoSearch(prev => ({ ...prev, [card.id]: '' }));
                                                    setExtraRepoSearchOpen(prev => ({ ...prev, [card.id]: false }));
                                                  }}
                                                  className="w-full text-left px-2 py-1 text-xs hover:bg-amber-50 dark:hover:bg-amber-900 text-gray-900 dark:text-gray-100"
                                                >
                                                  {repoName}
                                                </button>
                                              ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* ── Comentários da issue ── */}
                              {card.repo && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => toggleCommentExpand(card.id, card)}
                                    className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  >
                                    <MessageSquare size={12} />
                                    {expandedComments.has(card.id) ? 'Ocultar comentários' : 'Ver comentários recentes'}
                                    {loadingComments.has(card.id) && <span className="animate-pulse">…</span>}
                                    {expandedComments.has(card.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    {pinnedComments.size > 0 && Array.from(pinnedComments).some(k => k.startsWith(card.id + '::')) && (
                                      <span className="ml-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-medium">
                                        {Array.from(pinnedComments).filter(k => k.startsWith(card.id + '::')).length} fixado(s)
                                      </span>
                                    )}
                                  </button>

                                  {expandedComments.has(card.id) && (
                                    <div className="mt-2 space-y-1.5">
                                      {loadingComments.has(card.id) ? (
                                        <p className="text-xs text-gray-400 italic px-1">Carregando…</p>
                                      ) : !cardComments[card.id] || cardComments[card.id].length === 0 ? (
                                        <p className="text-xs text-gray-400 italic px-1">Nenhum comentário encontrado.</p>
                                      ) : (
                                        cardComments[card.id].map(comment => {
                                          const pinned = isPinned(card.id, comment.id);
                                          return (
                                            <div
                                              key={comment.id}
                                              className={`group rounded-lg text-xs transition-colors ${
                                                pinned
                                                  ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-700'
                                                  : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700'
                                              }`}
                                            >
                                              {/* cabeçalho */}
                                              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-600/50">
                                                <div className="flex items-center gap-2">
                                                  {comment.authorAvatar
                                                    ? <img src={comment.authorAvatar} alt="" className="w-5 h-5 rounded-full ring-1 ring-gray-200 dark:ring-gray-600" />
                                                    : <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[9px] text-gray-600 dark:text-gray-300 font-bold">{comment.author[0]?.toUpperCase()}</div>
                                                  }
                                                  <span className="font-semibold text-gray-700 dark:text-gray-200">{comment.author}</span>
                                                  <span className="text-gray-400 dark:text-gray-500 text-[11px]">{new Date(comment.date).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                <button
                                                  onClick={() => togglePinComment(card.id, comment.id)}
                                                  title={pinned ? 'Desafixar' : 'Fixar para referência no passo 2'}
                                                  className={`p-1 rounded transition-colors ${
                                                    pinned
                                                      ? 'text-amber-500 dark:text-amber-400'
                                                      : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-400 hover:!text-amber-500'
                                                  }`}
                                                >
                                                  <Pin size={12} className={pinned ? 'fill-amber-400' : ''} />
                                                </button>
                                              </div>
                                              {/* corpo */}
                                              <p className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">{comment.body}</p>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'commands' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Comandos Git para merge das issues. Copie e cole no terminal do repositório.
              </p>

              {cardsByRepo.map(({ repo, isGroup, groupRepos, cards }) => {
                const selectedRepoCards = cards.filter(({ card }) => selectedCards.has(card.id));
                if (selectedRepoCards.length === 0) return null;

                const suggestedTag = suggestedTags[repo] || 'production-v1.0.0.1';
                const versionForTag = versionNumbers[repo]
                  ? `production-v${versionNumbers[repo]}`
                  : suggestedTag;

                if (isGroup && groupRepos && groupRepos.length > 0) {
                  const isGroupDone = doneRepos.has(repo);
                  // ── Modo grupo: sub-seção por repo real ──────────────────
                  return (
                    <div key={repo} className={`border rounded-lg p-4 transition-colors ${isGroupDone ? 'border-green-400 dark:border-green-600 bg-green-50/30 dark:bg-green-900/10' : 'border-purple-300 dark:border-purple-700'}`}>
                      <div className="flex items-center gap-2 mb-4">
                        {isGroupDone ? <CheckCircle size={20} className="text-green-500" /> : <Layers size={20} className="text-purple-500" />}
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{repo}</h3>
                        <span className="text-xs font-normal text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                          grupo
                        </span>
                        <span className="text-xs text-gray-500">
                          ({selectedRepoCards.length} {selectedRepoCards.length === 1 ? 'card' : 'cards'})
                        </span>
                        <button
                          onClick={() => toggleDone(repo)}
                          className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            isGroupDone
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <CheckCircle size={14} />
                          {isGroupDone ? 'Reabrir' : 'Marcar como feito'}
                        </button>
                      </div>

                      {!isGroupDone && <>
                      {/* Versão */}
                      <div className="mb-4 flex flex-col gap-1.5">
                        {lastTags[repo] && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Última tag: <span className="font-mono font-semibold">{lastTags[repo].replace('production-v', '')}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-mono text-gray-400 shrink-0">production-v</span>
                          <input
                            type="text"
                            value={versionNumbers[repo] || ''}
                            onChange={(e) => setVersionNumbers(prev => ({ ...prev, [repo]: e.target.value }))}
                            placeholder={suggestedTag.replace('production-v', '')}
                            className="w-36 px-2 py-1 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          {!lastTags[repo] && <span className="text-xs text-gray-400">nenhuma tag anterior</span>}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {groupRepos.map(subRepo => {
                          const subBranches = getBranchesForSubRepo(selectedRepoCards, subRepo);
                          const subMergeCommands = generateMergeCommands(subBranches);
                          const subTagCommands = `\n\n# Criar e enviar tag\ngit tag ${versionForTag}\ngit push origin ${versionForTag}`;
                          const subCommands = subBranches.length > 0
                            ? subMergeCommands + subTagCommands
                            : `# Criar e enviar tag\ngit tag ${versionForTag}\ngit push origin ${versionForTag}`;
                          const subCopyId = `${repo}::${subRepo}`;

                          const subDoneKey = `${repo}::${subRepo}`;
                          const isSubDone = doneRepos.has(subDoneKey);
                          return (
                            <div key={subRepo} className={`border rounded-lg p-3 transition-colors ${isSubDone ? 'border-green-400 dark:border-green-600 bg-green-50/20 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {isSubDone ? <CheckCircle size={16} className="text-green-500" /> : <GitBranch size={16} className="text-gray-500" />}
                                  <span className="font-medium text-gray-800 dark:text-gray-200 font-mono text-sm">{subRepo}</span>
                                  {subBranches.length === 0 && !isSubDone && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                                      apenas tag
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {!isSubDone && <>
                                  <a
                                    href={getVSCodePath(subRepo)}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-xs"
                                    title="Abrir no VSCode"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
                                    </svg>
                                    VSCode
                                  </a>
                                  <button
                                    onClick={() => copyToClipboard(subCommands, subCopyId)}
                                    className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-xs"
                                  >
                                    {copiedCommand === subCopyId ? (
                                      <><CheckCircle size={12} /> Copiado!</>
                                    ) : (
                                      <><Copy size={12} /> Copiar</>
                                    )}
                                  </button>
                                  </>}
                                  <button
                                    onClick={() => toggleDone(subDoneKey)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      isSubDone
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                    }`}
                                  >
                                    <CheckCircle size={12} />
                                    {isSubDone ? 'Reabrir' : 'Feito'}
                                  </button>
                                </div>
                              </div>
                              {!isSubDone && <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto font-mono">
                                {subCommands}
                              </pre>}
                            </div>
                          );
                        })}
                      </div>
                      </>}
                    </div>
                  );
                }

                // ── Modo repo único ────────────────────────────────────────
                const allBranches = selectedRepoCards.flatMap(({ branches }) => branches);
                // Deduplicar
                const uniqueBranches = [...new Set(allBranches)];
                const mergeCommands = generateMergeCommands(uniqueBranches);
                const tagCommands = `\n\n# Criar e enviar tag\ngit tag ${versionForTag}\ngit push origin ${versionForTag}`;
                const commands = mergeCommands + tagCommands;

                const vscodeUri = getVSCodePath(repo);

                // Repos secundários: auto-detectados (branches em outro repo) + extras manuais
                const secondaryRepoMap: Record<string, string[]> = {};
                selectedRepoCards.forEach(({ branchesWithRepos, allRepos, effectiveRepo, card }) => {
                  // Auto-detectados via branches
                  allRepos.filter(r => r !== effectiveRepo).forEach(secRepo => {
                    const secBranches = branchesWithRepos
                      .filter(b => b.repo === secRepo)
                      .map(b => b.name);
                    if (!secondaryRepoMap[secRepo]) secondaryRepoMap[secRepo] = [];
                    secBranches.forEach(b => {
                      if (!secondaryRepoMap[secRepo].includes(b)) secondaryRepoMap[secRepo].push(b);
                    });
                  });
                  // Extras adicionados manualmente
                  (extraCardRepos[card.id] || []).forEach(extraRepo => {
                    if (!(extraRepo in secondaryRepoMap)) secondaryRepoMap[extraRepo] = [];
                  });
                });
                const hasSecondaryRepos = Object.keys(secondaryRepoMap).length > 0;
                const isRepoDone = doneRepos.has(repo);

                return (
                  <div key={repo} className={`border rounded-lg p-4 transition-colors ${isRepoDone ? 'border-green-400 dark:border-green-600 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {isRepoDone ? <CheckCircle size={20} className="text-green-500" /> : <GitBranch size={20} />}
                        {repo}
                      </h3>
                      <div className="flex items-center gap-2">
                        {!isRepoDone && <>
                        <a
                          href={vscodeUri}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                          title="Abrir no VSCode"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
                          </svg>
                          Abrir VSCode
                        </a>
                        <button
                          onClick={() => copyToClipboard(commands, repo)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                          {copiedCommand === repo ? (
                            <><CheckCircle size={14} /> Copiado!</>
                          ) : (
                            <><Copy size={14} /> Copiar</>
                          )}
                        </button>
                        </>}
                        <button
                          onClick={() => toggleDone(repo)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isRepoDone
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <CheckCircle size={14} />
                          {isRepoDone ? 'Reabrir' : 'Marcar como feito'}
                        </button>
                      </div>
                    </div>

                    {!isRepoDone && <>
                    <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                      <p className="font-medium mb-1">Cards incluídos ({selectedRepoCards.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedRepoCards.map(({ card }) => (
                          <span key={card.id} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                            #{card.number}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-col gap-1.5">
                      {lastTags[repo] && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Última tag: <span className="font-mono font-semibold">{lastTags[repo].replace('production-v', '')}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-mono text-gray-400 shrink-0">production-v</span>
                        <input
                          type="text"
                          value={versionNumbers[repo] || ''}
                          onChange={(e) => setVersionNumbers(prev => ({ ...prev, [repo]: e.target.value }))}
                          placeholder={suggestedTag.replace('production-v', '')}
                          className="w-36 px-2 py-1 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                        {!lastTags[repo] && <span className="text-xs text-gray-400">nenhuma tag anterior</span>}
                      </div>
                    </div>

                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                      {commands}
                    </pre>

                    {/* Repos secundários que também precisam ser liberados */}
                    {hasSecondaryRepos && (
                      <div className="mt-3 border border-amber-300 dark:border-amber-700 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/10">
                        <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400">
                          <AlertCircle size={16} />
                          <span className="text-sm font-medium">Também precisa ser liberado em:</span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(secondaryRepoMap).map(([secRepo, secBranches]) => {
                            // Repos sem branches são manuais: tag ligada por padrão
                            const tagEnabled = secBranches.length === 0
                              ? (secRepoTagEnabled[secRepo] !== false)
                              : !!secRepoTagEnabled[secRepo];
                            const isSecDone = doneRepos.has(`secondary::${secRepo}`);
                            const secSuggested = suggestedTags[secRepo] || versionForTag;
                            const secVersionForTag = versionNumbers[secRepo]
                              ? `production-v${versionNumbers[secRepo]}`
                              : secSuggested;
                            const secMerge = generateMergeCommands(secBranches);
                            const secTagCmd = `\n\n# Criar e enviar tag\ngit tag ${secVersionForTag}\ngit push origin ${secVersionForTag}`;
                            const secCommands = tagEnabled ? secMerge + secTagCmd : secMerge;
                            const secCopyId = `secondary::${secRepo}`;
                            return (
                              <div key={secRepo} className={`border rounded p-2 transition-colors ${isSecDone ? 'border-green-400 dark:border-green-600 bg-green-50/20 dark:bg-green-900/10' : 'border-amber-200 dark:border-amber-700 bg-white dark:bg-gray-800'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                    {isSecDone && <CheckCircle size={12} className="text-green-500" />}
                                    {secRepo}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {!isSecDone && <>
                                    <a
                                      href={getVSCodePath(secRepo)}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
                                      </svg>
                                      VSCode
                                    </a>
                                    <button
                                      onClick={() => copyToClipboard(secCommands, secCopyId)}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                                    >
                                      {copiedCommand === secCopyId ? <><CheckCircle size={10} /> Copiado!</> : <><Copy size={10} /> Copiar</>}
                                    </button>
                                    </>}
                                    <button
                                      onClick={() => toggleDone(`secondary::${secRepo}`)}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                        isSecDone
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                      }`}
                                    >
                                      <CheckCircle size={10} />
                                      {isSecDone ? 'Reabrir' : 'Feito'}
                                    </button>
                                  </div>
                                </div>
                                {!isSecDone && <>
                                {/* Toggle de tag opcional */}
                                <label className="flex items-center gap-1.5 mb-2 cursor-pointer select-none w-fit">
                                  <input
                                    type="checkbox"
                                    checked={tagEnabled}
                                    onChange={(e) => setSecRepoTagEnabled(prev => ({ ...prev, [secRepo]: e.target.checked }))}
                                    className="accent-amber-500"
                                  />
                                  <span className="text-xs text-gray-600 dark:text-gray-400">Gerar tag neste repo</span>
                                </label>
                                {tagEnabled && (
                                  <div className="mb-2 flex flex-col gap-1">
                                    {lastTags[secRepo] && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Última tag: <span className="font-mono font-semibold">{lastTags[secRepo]!.replace('production-v', '')}</span>
                                      </p>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-mono text-gray-400 shrink-0">production-v</span>
                                      <input
                                        type="text"
                                        value={versionNumbers[secRepo] || ''}
                                        onChange={(e) => setVersionNumbers(prev => ({ ...prev, [secRepo]: e.target.value }))}
                                        placeholder={secSuggested.replace('production-v', '')}
                                        className="w-32 px-2 py-0.5 text-xs font-mono border border-amber-300 dark:border-amber-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                      />
                                      {!lastTags[secRepo] && <span className="text-xs text-gray-400">nenhuma tag anterior</span>}
                                    </div>
                                  </div>
                                )}
                                <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto font-mono">
                                  {secCommands}
                                </pre>
                                </>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Comentários fixados + repos extras por card ── */}
                    {selectedRepoCards.some(({ card }) =>
                      Array.from(pinnedComments).some(k => k.startsWith(card.id + '::')) ||
                      (extraCardRepos[card.id] || []).length > 0
                    ) && (
                      <div className="mt-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Referências por card</p>
                        {selectedRepoCards.map(({ card }) => {
                          const cardPins = Array.from(pinnedComments)
                            .filter(k => k.startsWith(card.id + '::'))
                            .map(k => {
                              const commentId = parseInt(k.split('::')[1], 10);
                              return (cardComments[card.id] || []).find(c => c.id === commentId);
                            })
                            .filter(Boolean) as IssueComment[];
                          const extras = extraCardRepos[card.id] || [];
                          if (cardPins.length === 0 && extras.length === 0) return null;
                          return (
                            <div key={card.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                              <p className="text-xs font-semibold mb-2">
                                <span className="text-blue-600 dark:text-blue-400">#{card.number}</span>
                                <span className="text-gray-600 dark:text-gray-400 ml-1.5">{card.title}</span>
                              </p>
                              {cardPins.map(comment => (
                                <div key={comment.id} className="mb-2 border border-amber-200 dark:border-amber-700 rounded p-2 bg-amber-50 dark:bg-amber-900/10">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    {comment.authorAvatar && <img src={comment.authorAvatar} alt="" className="w-4 h-4 rounded-full" />}
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{comment.author}</span>
                                    <span className="text-xs text-gray-400">· {new Date(comment.date).toLocaleDateString('pt-BR')}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto">{comment.body}</p>
                                </div>
                              ))}
                              {/* Repos extras + add */}
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {extras.length > 0 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Repos extras:</span>
                                )}
                                {extras.map(r => (
                                  <span key={r} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                                    {r}
                                    <button onClick={() => removeExtraRepo(card.id, r)} title="Remover"><X size={10} /></button>
                                  </span>
                                ))}
                                <button
                                  onClick={() => setExtraRepoSearchOpen(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
                                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  <Plus size={11} />
                                  Adicionar repo extra
                                </button>
                              </div>
                              {extraRepoSearchOpen[card.id] && (
                                <div className="mt-1">
                                  <input
                                    type="text"
                                    value={extraRepoSearch[card.id] || ''}
                                    onChange={(e) => setExtraRepoSearch(prev => ({ ...prev, [card.id]: e.target.value }))}
                                    placeholder="Buscar repositório..."
                                    autoFocus
                                    className="text-xs w-full px-2 py-1 border border-indigo-300 dark:border-indigo-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  />
                                  {extraRepoSearch[card.id] && (
                                    <div className="max-h-28 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 mt-0.5">
                                      {allRepositories
                                        .filter(r =>
                                          r.toLowerCase().includes(extraRepoSearch[card.id].toLowerCase()) &&
                                          !extras.includes(r)
                                        )
                                        .slice(0, 8)
                                        .map(repoName => (
                                          <button
                                            key={repoName}
                                            onClick={() => {
                                              addExtraRepo(card.id, repoName);
                                              setExtraRepoSearch(prev => ({ ...prev, [card.id]: '' }));
                                              setExtraRepoSearchOpen(prev => ({ ...prev, [card.id]: false }));
                                            }}
                                            className="w-full text-left px-2 py-1 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900 text-gray-900 dark:text-gray-100"
                                          >
                                            {repoName}
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </>}
                  </div>
                );
              })}
            </div>
          )}

          {step === 'finalize' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                <p className="text-blue-800 dark:text-blue-200">
                  ℹ️ As versões foram preenchidas automaticamente. Revise e ajuste se necessário antes de finalizar.
                </p>
              </div>

              {cardsByRepo.map(({ repo, isGroup, groupRepos, cards }) => {
                const selectedRepoCards = cards.filter(({ card }) => selectedCards.has(card.id));
                if (selectedRepoCards.length === 0) return null;

                return (
                  <div key={repo} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                      {isGroup ? <Layers size={20} className="text-purple-500" /> : <GitBranch size={20} />}
                      {repo}
                      {isGroup && (
                        <span className="text-xs font-normal text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                          grupo
                        </span>
                      )}
                    </h3>
                    {isGroup && groupRepos && (
                      <div className="mb-3 flex flex-wrap gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>A versão será aplicada em:</span>
                        {groupRepos.map(r => (
                          <span key={r} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">{r}</span>
                        ))}
                      </div>
                    )}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Versão
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-mono text-gray-400 shrink-0">production-v</span>
                        <input
                          type="text"
                          value={versionNumbers[repo] || ''}
                          onChange={(e) => setVersionNumbers({ ...versionNumbers, [repo]: e.target.value })}
                          placeholder="Ex: 1.2.3.4"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                        />
                      </div>
                    </div>

                    {/* Versões de repos secundários por card (apenas os com tag habilitada) */}
                    {selectedRepoCards.some(({ card, allRepos, effectiveRepo, branchesWithRepos }) =>
                      getEnabledSecondaryRepos(card.id, allRepos, effectiveRepo, branchesWithRepos).length > 0
                    ) && (
                      <div className="mb-4 space-y-3 border-t border-dashed border-gray-200 dark:border-gray-700 pt-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Versões dos repos secundários</p>
                        {selectedRepoCards.map(({ card, allRepos, effectiveRepo, branchesWithRepos }) => {
                          const allSecondaries = getEnabledSecondaryRepos(card.id, allRepos, effectiveRepo, branchesWithRepos);
                          if (allSecondaries.length === 0) return null;
                          return (
                            <div key={card.id}>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">#{card.number}</span> {card.title}
                              </p>
                              {allSecondaries.map(secRepo => (
                                <div key={secRepo} className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono w-44 shrink-0 truncate text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                                    {secRepo}
                                  </span>
                                  <input
                                    type="text"
                                    value={versionNumbers[secRepo] || ''}
                                    onChange={(e) => setVersionNumbers(prev => ({ ...prev, [secRepo]: e.target.value }))}
                                    placeholder="Ex: 1.2.3.4"
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p className="mb-2 font-medium">Ações que serão executadas:</p>
                      <ul className="list-disc list-inside space-y-1 mb-3">
                        <li>Mover {selectedRepoCards.length} {selectedRepoCards.length === 1 ? 'card' : 'cards'} para coluna "Produção"</li>
                        <li>Comentar em cada card:</li>
                      </ul>
                      <div className="space-y-2 ml-4">
                        {selectedRepoCards.map(({ card, effectiveRepo, allRepos, branchesWithRepos }) => {
                          const primaryLabel = effectiveRepo || card.repo || repo;
                          const version = versionNumbers[repo] || 'X';
                          const allSec = getEnabledSecondaryRepos(card.id, allRepos, effectiveRepo, branchesWithRepos);

                          const commentPreview = allSec.length === 0
                            ? `**Liberado na versão ${version}**`
                            : [`**Liberado na versão:**`, ``, `- ${primaryLabel}: ${version}`, ...allSec.map(r => `- ${r}: ${versionNumbers[r] || version}`)].join('\n');

                          return (
                            <div key={card.id} className="rounded border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">#{card.number}</span>
                                <span className="truncate">{card.title}</span>
                              </div>
                              <pre className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap leading-relaxed bg-white dark:bg-gray-800">
                                {commentPreview}
                              </pre>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 'message' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mensagem formatada para copiar e colar no grupo. Disponível em formato simples e Markdown (Discord).
              </p>

              {/* Versão Simples */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    📝 Formato Simples
                  </h3>
                  <button
                    onClick={() => copyToClipboard(generateReleaseMessage(), 'simple')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                  >
                    {copiedCommand === 'simple' ? (
                      <>
                        <CheckCircle size={14} />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap font-sans">
                  {generateReleaseMessage()}
                </pre>
              </div>

              {/* Versão Markdown (Discord) */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    💬 Formato Discord/Markdown
                  </h3>
                  <button
                    onClick={() => copyToClipboard(generateReleaseMessageMarkdown(), 'markdown')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                  >
                    {copiedCommand === 'markdown' ? (
                      <>
                        <CheckCircle size={14} />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap font-sans">
                  {generateReleaseMessageMarkdown()}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCards.size} {selectedCards.size === 1 ? 'card selecionado' : 'cards selecionados'}
          </div>
          <div className="flex items-center gap-2">
            {step !== 'review' && step !== 'message' && (
              <button
                onClick={() => {
                  if (step === 'commands') setStep('review');
                  if (step === 'finalize') setStep('commands');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Voltar
              </button>
            )}
            {step === 'message' && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <CheckCircle size={16} />
                Concluir
              </button>
            )}
            {step !== 'message' && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            )}
            {step === 'review' && (
              <button
                onClick={() => setStep('commands')}
                disabled={selectedCards.size === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            )}
            {step === 'commands' && (
              <button
                onClick={() => setStep('finalize')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Próximo
              </button>
            )}
            {step === 'finalize' && (
              <button
                onClick={async () => {
                  const success = await handleFinalize();
                  if (success) {
                    setStep('message');
                  }
                }}
                disabled={isProcessing || Object.keys(versionNumbers).length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Finalizar Release
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCardForDetail && (
        <CardDetailModal
          card={selectedCardForDetail}
          isOpen={true}
          onClose={() => setSelectedCardForDetail(null)}
          token={token}
          org={org}
          onUpdate={onCardsUpdated}
          currentViewId={currentViewId}
        />
      )}
    </div>
  );
};
