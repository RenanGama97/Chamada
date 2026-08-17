-- Banco de dados do app "Igreja Aberta" (Supabase / PostgreSQL).
--
-- Como usar: crie um projeto gratuito em supabase.com, abra o SQL Editor,
-- cole este arquivo inteiro e clique em RUN.

create table if not exists membros (
  id text primary key,
  nome text not null,
  telefone text,
  email text,
  admin boolean not null default false,
  ativo boolean not null default true,
  tipos jsonb not null default '["domingo_manha","domingo_noite","quinta_estudo"]',
  criado_em timestamptz not null default now()
);

create table if not exists indisponibilidades (
  id text primary key,
  membro_id text not null references membros (id) on delete cascade,
  data date not null,
  tipo text,                       -- nulo = o dia inteiro
  motivo text default '',
  criado_em timestamptz not null default now()
);

create index if not exists indisponibilidades_membro_data
  on indisponibilidades (membro_id, data);

create table if not exists escalas (
  id text primary key,
  periodo text not null unique,     -- "AAAA-MM"
  status text not null default 'rascunho',
  itens jsonb not null default '[]',
  criado_em timestamptz not null default now(),
  publicado_em timestamptz
);

create table if not exists preferencias (
  id int primary key default 1,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Um registro por navegador/aparelho que aceitou receber notificação.
create table if not exists push_inscricoes (
  endpoint text primary key,
  membro_id text not null references membros (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

-- Registro do que já foi avisado, para o servidor não repetir a notificação.
create table if not exists lembretes_enviados (
  chave text primary key,           -- "membro_id|data|tipo|quando"
  enviado_em timestamptz not null default now()
);

/* ------------------------------------------------------------------
   Acesso
   ------------------------------------------------------------------
   O app não usa senha: é um grupo pequeno e de confiança, e a chave
   "anon" fica dentro do app. As regras abaixo liberam leitura e escrita
   para quem tem essa chave.

   Consequência: quem conseguir o endereço do app consegue mexer nos
   dados. Para um grupo de irmãos da igreja isso costuma ser aceitável —
   mas não guarde nada sigiloso aqui. Se um dia quiser fechar mais,
   troque estas políticas por Supabase Auth (login por e-mail).
   ------------------------------------------------------------------ */

alter table membros enable row level security;
alter table indisponibilidades enable row level security;
alter table escalas enable row level security;
alter table preferencias enable row level security;
alter table push_inscricoes enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'membros', 'indisponibilidades', 'escalas', 'preferencias', 'push_inscricoes'
    ])
  loop
    execute format('drop policy if exists "grupo igreja aberta" on %I', t);
    execute format(
      'create policy "grupo igreja aberta" on %I for all to anon, authenticated
         using (true) with check (true)',
      t
    );
  end loop;
end
$$;

-- A tabela de lembretes enviados é usada só pelo servidor (service_role),
-- então fica sem política nenhuma.
alter table lembretes_enviados enable row level security;
