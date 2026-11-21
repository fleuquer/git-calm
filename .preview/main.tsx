import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { CardDetailModal } from '../src/components/CardDetailModal';
import type { ProjectCard } from '../src/types';
const card: ProjectCard = { id: 'x', number: 1236, title: 'Multa no feriado', body: '- [x] ajustar\n- [ ] testar', status: 'Fazendo', assignees: [], labels: [], createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', url: 'https://github.com/geosiap/tiflux/issues/1236', repo: 'tiflux' };
createRoot(document.getElementById('root')!).render(<CardDetailModal card={card} isOpen onClose={() => {}} token="t" org="geosiap" />);
