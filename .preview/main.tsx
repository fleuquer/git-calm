import { createRoot } from 'react-dom/client';
import '../src/index.css';
import * as PC from '../src/components/ProjectCard';
import type { ProjectCard as Card } from '../src/types';
const Comp = (PC as unknown as Record<string, React.FC<{ card: Card }>>).ProjectCard ?? (PC as unknown as { default: React.FC<{ card: Card }> }).default;
const base = { assignees: [], labels: [], createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', status: 'Fazendo', url: '#', repo: 'tiflux', id: 'x' };
const cards: Card[] = [
  { ...base, id: '1', number: 1100, title: 'Reformulação da emissão de guias', relations: { subTotal: 3, subCompleted: 1, blockedBy: 0, blockedByOpen: 0, blocking: 0 } },
  { ...base, id: '2', number: 1236, title: 'Multa no feriado', relations: { parent: { number: 1100, title: 'Reformulação da emissão de guias' }, subTotal: 0, subCompleted: 0, blockedBy: 1, blockedByOpen: 1, blocking: 0 } },
  { ...base, id: '3', number: 1300, title: 'Card sem vínculo nenhum' },
];
createRoot(document.getElementById('root')!).render(<div className="bg-gray-100 p-4 space-y-3" style={{ width: 300 }}>{cards.map(c => <Comp key={c.id} card={c} />)}</div>);
