-- migrate:up

-- Intenciones breves y de un solo uso para operaciones que vinculan o agregan
-- credenciales. Solo se guarda el hash del token entregado al navegador.
create unique index if not exists usuario_email_normalized_unique
  on usuario (lower(email))
  where email is not null;

create table if not exists auth_intent (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  tipo text not null check (tipo in ('link_oauth', 'connect_oauth', 'set_password')),
  usuario_id uuid not null references usuario(id) on delete cascade,
  provider text,
  provider_sub text,
  email text,
  avatar_url text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (tipo = 'link_oauth' and provider is not null and provider_sub is not null)
    or (tipo = 'connect_oauth' and provider is not null)
    or tipo = 'set_password'
  )
);

create index if not exists auth_intent_active_idx
  on auth_intent (tipo, usuario_id, expires_at)
  where consumed_at is null;

-- migrate:down

drop table if exists auth_intent;
drop index if exists usuario_email_normalized_unique;
