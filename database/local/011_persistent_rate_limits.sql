-- migrate:up

-- Contadores compartidos por todas las instancias serverless. Solo se guarda el
-- hash de IP/usuario; no se persisten identificadores personales en esta tabla.
create table if not exists api_rate_limit (
  key_hash text primary key,
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_limit_reset_idx on api_rate_limit (reset_at);

-- migrate:down

drop table if exists api_rate_limit;
