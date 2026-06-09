-- migrate:up

create table if not exists kenchita_conversacion (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  usuario_id uuid references usuario(id) on delete set null,
  titulo text not null default 'Nueva conversacion',
  contexto jsonb not null default '{}'::jsonb,
  origen text not null default 'burbuja_chat',
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada', 'archivada')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kenchita_mensaje (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references kenchita_conversacion(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant', 'system')),
  contenido text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists kenchita_chat_config (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  nombre_asistente text not null default 'Kenchita IA',
  saludo text not null default 'Hola, soy Kenchita. Puedo ayudarte con precios, ventas, catalogo y decisiones de tu negocio.',
  avatar_url text not null default '/kenchita-chat.png',
  prompts jsonb not null default '["Ideas para vender mas", "Analizar mis precios", "Que productos no se venden?"]'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id)
);

create index if not exists kenchita_conversacion_tienda_idx
  on kenchita_conversacion (tienda_id, estado, last_message_at desc, created_at desc);

create index if not exists kenchita_mensaje_conversacion_idx
  on kenchita_mensaje (conversacion_id, created_at);

create index if not exists kenchita_chat_config_tienda_idx
  on kenchita_chat_config (tienda_id, activo);

-- migrate:down

drop table if exists kenchita_chat_config;
drop table if exists kenchita_mensaje;
drop table if exists kenchita_conversacion;
