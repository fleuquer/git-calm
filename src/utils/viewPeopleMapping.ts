/**
 * Gerenciamento de mapeamento entre Views/Guias e Pessoas
 * Permite vincular pessoas/funcionários a cada área (view)
 */

export interface ViewPeopleMapping {
  viewId: string;    // ID da view (web, qa, desk, etc)
  people: string[];  // Logins dos usuários do GitHub
}

const STORAGE_KEY = 'github-project-view-people-mapping';

export function loadViewPeopleMapping(): ViewPeopleMapping[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Erro ao carregar mapeamento View→Pessoas:', error);
    return [];
  }
}

export function saveViewPeopleMapping(mappings: ViewPeopleMapping[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.error('Erro ao salvar mapeamento View→Pessoas:', error);
  }
}

export function getPeopleForView(viewId: string): string[] {
  const mappings = loadViewPeopleMapping();
  const mapping = mappings.find(m => m.viewId === viewId);
  return mapping?.people || [];
}

export function addPersonToView(viewId: string, person: string): void {
  const mappings = loadViewPeopleMapping();
  const existingIndex = mappings.findIndex(m => m.viewId === viewId);

  if (existingIndex >= 0) {
    if (!mappings[existingIndex].people.includes(person)) {
      mappings[existingIndex].people.push(person);
    }
  } else {
    mappings.push({ viewId, people: [person] });
  }

  saveViewPeopleMapping(mappings);
}

export function removePersonFromView(viewId: string, person: string): void {
  const mappings = loadViewPeopleMapping();
  const existingIndex = mappings.findIndex(m => m.viewId === viewId);

  if (existingIndex >= 0) {
    mappings[existingIndex].people = mappings[existingIndex].people.filter(p => p !== person);
    if (mappings[existingIndex].people.length === 0) {
      mappings.splice(existingIndex, 1);
    }
    saveViewPeopleMapping(mappings);
  }
}
