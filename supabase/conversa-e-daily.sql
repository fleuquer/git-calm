-- Conversa nos cards e modo daily do git-calm.
--
-- Rodar uma vez no projeto do Supabase (SQL Editor), depois de presenca.sql. Pode rodar de
-- novo sem problema: tudo aqui é refeito do mesmo jeito.
--
-- Quem entra: só quem tem o token assinado pela função api/presenca.ts, que confere no GitHub
-- que a pessoa é membro da organização e grava no token a organização ("org") e o login ("sub").

-- ── 1. Canais ao vivo ───────────────────────────────────────────────────────────────────────
-- "presenca:<org>": quem está online (presença).
-- "eventos:<org>":  mensagens ao vivo entre os git-calm abertos (daily, conversa nova, menção).
drop policy if exists "git-calm: presença da própria organização (ler)" on realtime.messages;
drop policy if exists "git-calm: presença da própria organização (enviar)" on realtime.messages;
drop policy if exists "git-calm: canais da própria organização (ler)" on realtime.messages;
drop policy if exists "git-calm: canais da própria organização (enviar)" on realtime.messages;

-- Ler (e entrar no canal): os dois canais da própria organização. Não filtra pelo tipo de
-- mensagem porque o Supabase confere a permissão de entrar no canal sem ser pela presença.
create policy "git-calm: canais da própria organização (ler)"
on realtime.messages for select to authenticated
using (
  realtime.topic() in ('presenca:' || (auth.jwt() ->> 'org'), 'eventos:' || (auth.jwt() ->> 'org'))
);

-- Enviar: presença só no canal de presença, mensagens só no canal de eventos
create policy "git-calm: canais da própria organização (enviar)"
on realtime.messages for insert to authenticated
with check (
  (realtime.topic() = 'presenca:' || (auth.jwt() ->> 'org') and realtime.messages.extension = 'presence')
  or (realtime.topic() = 'eventos:' || (auth.jwt() ->> 'org') and realtime.messages.extension = 'broadcast')
);

-- ── 2. Conversa nos cards (com histórico, sem ir para o GitHub) ─────────────────────────────
create table if not exists public.gitcalm_card_chat (
  id uuid primary key default gen_random_uuid(),
  org text not null,
  -- "repositório#número": o mesmo número existe em repositórios diferentes
  card_key text not null,
  card_numero int not null,
  card_repo text not null default '',
  card_titulo text not null default '',
  autor text not null,
  autor_nome text not null default '',
  autor_avatar text not null default '',
  texto text not null check (char_length(texto) between 1 and 4000),
  -- logins mencionados com @, para avisar quem precisa responder
  mencoes text[] not null default '{}',
  criado_em timestamptz not null default now()
);

create index if not exists gitcalm_card_chat_card on public.gitcalm_card_chat (org, card_key, criado_em desc);
create index if not exists gitcalm_card_chat_mencoes on public.gitcalm_card_chat using gin (mencoes);

alter table public.gitcalm_card_chat enable row level security;
grant select, insert, delete on public.gitcalm_card_chat to authenticated;

drop policy if exists "git-calm: ler conversas da própria organização" on public.gitcalm_card_chat;
drop policy if exists "git-calm: escrever como si mesmo" on public.gitcalm_card_chat;
drop policy if exists "git-calm: apagar as próprias mensagens" on public.gitcalm_card_chat;

create policy "git-calm: ler conversas da própria organização"
on public.gitcalm_card_chat for select to authenticated
using (org = auth.jwt() ->> 'org');

create policy "git-calm: escrever como si mesmo"
on public.gitcalm_card_chat for insert to authenticated
with check (org = auth.jwt() ->> 'org' and autor = auth.jwt() ->> 'sub');

create policy "git-calm: apagar as próprias mensagens"
on public.gitcalm_card_chat for delete to authenticated
using (org = auth.jwt() ->> 'org' and autor = auth.jwt() ->> 'sub');

-- ── 3. Histórico de 30 dias ─────────────────────────────────────────────────────────────────
-- Todo dia às 4h (UTC) apaga as mensagens com mais de 30 dias.
create extension if not exists pg_cron;
select cron.schedule(
  'gitcalm-limpa-conversas',
  '0 4 * * *',
  $$delete from public.gitcalm_card_chat where criado_em < now() - interval '30 days'$$
);
