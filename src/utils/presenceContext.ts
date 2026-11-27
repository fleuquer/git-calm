import { createContext, useContext } from 'react';
import { presenceCardKey, type OnlinePerson } from '../services/presence';

/** Quem está online, para os cards mostrarem quem está com eles abertos */
export const PresenceContext = createContext<{ people: OnlinePerson[]; myLogin?: string }>({ people: [] });

/** Outras pessoas com este card aberto agora (quem está editando vem primeiro) */
export function useCardViewers(repo: string | undefined, number: number | undefined): OnlinePerson[] {
  const { people, myLogin } = useContext(PresenceContext);
  if (number === undefined || !people.length) return [];
  const key = presenceCardKey(repo, number);
  return people
    .filter(p => p.cardKey === key && p.login !== myLogin && !p.ausente)
    .sort((a, b) => Number(!!b.editando) - Number(!!a.editando));
}
