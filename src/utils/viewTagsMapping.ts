/**
 * Gerenciamento de mapeamento entre Views/Guias e Tags Relevantes
 * Permite vincular tags específicas a cada área (view) para agrupamento
 * Suporta grupos nomeados (múltiplas tags com um nome customizado)
 */

export interface TagGroup {
  name: string;      // Nome do grupo (ex: "Meu Módulo")
  tags: string[];    // Tags que compõem o grupo (ex: ["App-Web", "App-Mobile"])
}

export interface ViewTagsMapping {
  viewId: string;       // ID da view (web, qa, desk, etc)
  tags: string[];       // Nomes das tags individuais relevantes
  tagGroups?: TagGroup[]; // Grupos nomeados de tags
}

const STORAGE_KEY = 'github-project-view-tags-mapping';

export function loadViewTagsMapping(): ViewTagsMapping[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Erro ao carregar mapeamento View→Tags:', error);
    return [];
  }
}

export function saveViewTagsMapping(mappings: ViewTagsMapping[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.error('Erro ao salvar mapeamento View→Tags:', error);
  }
}

export function getTagsForView(viewId: string): string[] {
  const mappings = loadViewTagsMapping();
  const mapping = mappings.find(m => m.viewId === viewId);
  return mapping?.tags || [];
}

export function getTagGroupsForView(viewId: string): TagGroup[] {
  const mappings = loadViewTagsMapping();
  const mapping = mappings.find(m => m.viewId === viewId);
  return mapping?.tagGroups || [];
}

export function addTagToView(viewId: string, tag: string): void {
  const mappings = loadViewTagsMapping();
  const existingIndex = mappings.findIndex(m => m.viewId === viewId);

  if (existingIndex >= 0) {
    if (!mappings[existingIndex].tags.includes(tag)) {
      mappings[existingIndex].tags.push(tag);
    }
  } else {
    mappings.push({ viewId, tags: [tag], tagGroups: [] });
  }

  saveViewTagsMapping(mappings);
}

export function removeTagFromView(viewId: string, tag: string): void {
  const mappings = loadViewTagsMapping();
  const existingIndex = mappings.findIndex(m => m.viewId === viewId);

  if (existingIndex >= 0) {
    mappings[existingIndex].tags = mappings[existingIndex].tags.filter(t => t !== tag);
    if (mappings[existingIndex].tags.length === 0 && (!mappings[existingIndex].tagGroups || mappings[existingIndex].tagGroups.length === 0)) {
      mappings.splice(existingIndex, 1);
    }
    saveViewTagsMapping(mappings);
  }
}
