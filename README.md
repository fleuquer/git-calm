# Git Calm

Uma aplicação web para visualizar e gerenciar projetos do GitHub com interface estilo Kanban, muito mais poderosa que a visualização padrão do GitHub Projects.

## 🛠️ Tecnologias

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Octokit (GitHub API v4 — GraphQL)
- Recharts (gráficos)
- Lucide Icons

## 📋 Pré-requisitos

**GitHub Personal Access Token** com as permissões:
- `repo`
- `read:org`
- `read:project`
- `notifications`

Crie seu token em: https://github.com/settings/tokens

## 🚀 Como usar

### Desenvolvimento local

```bash
npm install
npm run dev
```

Acesse http://localhost:5173

### Deploy no GitHub Pages

```bash
npm run deploy
```

A aplicação será publicada em `https://<usuario>.github.io/git-calm/`.

## 🔧 Configuração inicial

Na tela de login, informe:

1. **GitHub Personal Access Token** — seu token de acesso pessoal
2. **Organização** — nome da org no GitHub (ex: `minha-org`)
3. **Número do Projeto** — encontrado na URL: `https://github.com/orgs/minha-org/projects/X`

Todas as credenciais e preferências são salvas apenas no `localStorage` do navegador.

## 🎯 Funcionalidades

### 📋 Board Kanban
Visualização em colunas por status, com suporte a:
- **Visão compacta** dos cards
- **Colunas minimizáveis**
- **Agrupamento** por pessoa, tag, prioridade ou cidade
- **Busca** de cards por texto
- **Filtros rápidos** por assignee e label (clicáveis nos próprios cards)

### 🗂️ Abas / Visualizações personalizáveis
Crie e gerencie visualizações com filtros independentes de status e labels. As abas são salvas localmente e podem ser reordenadas.

### 🔄 Atualizações em tempo real
O board detecta automaticamente mudanças nos cards (status, assignees, labels, comentários, etc.) e exibe animações e notificações de atividade sem recarregar a página. Intervalo configurável.

### 🔔 Notificações do GitHub
Receba alertas de menções, comentários e atribuições diretamente na interface, com suporte a:
- Pop-ups para menções e comentários (modal completo)
- Toasts para outros eventos
- Sons configuráveis por tipo de notificação
- Sino de notificações com contagem de não lidas

### 📊 Dashboard de métricas
Painéis com gráficos interativos (ocultáveis individualmente):
- Cards por status, repositório, equipe/área, responsável e label
- Progresso por responsável
- Mapa de calor Labels × Status
- Cards criados por mês e atividade recente
- Risco de prazo

### 📝 Relatório diário
Gere relatórios de atividade por desenvolvedor com commits e comentários, filtrável por intervalo de datas (hoje, ontem, semana) e por coluna. Exportável.

### 🚀 Assistente de Release
Wizard guiado para preparar uma release: agrupa cards por repositório, gera comandos de merge/tag, permite pinagem de cards e cria uma mensagem de release formatada.

### 💬 Templates de comentário
Crie e gerencie templates reutilizáveis para comentários em issues/PRs, com suporte a Markdown, ícone e cor personalizados. Aplicáveis diretamente do modal de detalhes do card.

### 🗺️ Mapeamento de repositórios
Configure mapeamentos entre repositórios e exibições (view, pessoas, tags) via interface visual, sem editar código.

### 🎨 Temas
Múltiplos temas disponíveis (claro e escuro) com persistência de preferência.

## �️ Mapeamento de repositórios (busca inteligente)

Ao abrir um card, o sistema busca branches e commits relacionados. Para evitar consultar todos os repositórios da organização, você pode configurar regras de mapeamento em `src/utils/repoMapping.ts`:

```typescript
export const REPO_MAPPING_RULES: RepoMappingRule[] = [
  {
    keywords: ['minha-app', 'app-web'],
    repos: ['minha-app-front', 'minha-app-api']
  },
  {
    keywords: ['outro-modulo', 'mobile'],
    repos: ['outro-modulo-app', 'outro-modulo-api']
  }
];
```

- **keywords** — palavras-chave em minúsculas, sem acento (o sistema normaliza automaticamente). São comparadas contra o título e as tags do card.
- **repos** — lista de repositórios a consultar quando a keyword bater.
- Se nenhuma regra bater, ou a busca filtrada não encontrar nada, o sistema faz **fallback automático** para todos os repositórios da org.
- Para desativar o filtro e sempre buscar em todos os repos, deixe o array vazio: `REPO_MAPPING_RULES = []`.

## �🔒 Segurança

- O token é armazenado apenas no `localStorage` do navegador
- Nenhum dado é enviado para servidores terceiros
- Todas as requisições vão diretamente para a API do GitHub

## 📝 Licença

MIT
