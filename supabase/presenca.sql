-- Presença do git-calm ("quem está online"), no Supabase Realtime.
--
-- Rodar uma vez no projeto do Supabase (SQL Editor) e desligar "Allow public access" em
-- Project Settings › Realtime, para só existirem canais privados.
--
-- Só entra no canal "presenca:<organização>" quem tem um token assinado pela função
-- api/presenca.ts, que confere no GitHub que a pessoa é membro da organização e grava a
-- organização no token (claim "org"). Cada um só lê e envia presença no canal da própria
-- organização; nenhuma outra mensagem passa por esses canais.

create policy "git-calm: presença da própria organização (ler)"
on realtime.messages for select to authenticated
using (
  realtime.topic() = 'presenca:' || (auth.jwt() ->> 'org')
  and realtime.messages.extension = 'presence'
);

create policy "git-calm: presença da própria organização (enviar)"
on realtime.messages for insert to authenticated
with check (
  realtime.topic() = 'presenca:' || (auth.jwt() ->> 'org')
  and realtime.messages.extension = 'presence'
);
