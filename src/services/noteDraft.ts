/**
 * Pedido de "nova nota no devTools" vindo de qualquer lugar do app (botão do card, caixinha do
 * texto selecionado). A janela NewNoteDialog, montada no App, escuta e abre com o rascunho.
 */
export interface NoteDraft {
  titulo: string;
  conteudo: string;
  /** Rótulo do bloco (ex.: "Card", "Trecho do card") */
  rotulo?: string;
  /** Veio de uma seleção de texto: oferece incluir o link do card aberto */
  daSelecao?: boolean;
}

const listeners = new Set<(d: NoteDraft) => void>();

export function requestNewNote(draft: NoteDraft) {
  listeners.forEach(l => l(draft));
}

export function onNewNoteRequest(listener: (d: NoteDraft) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
