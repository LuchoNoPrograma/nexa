-- migrate:up

create extension if not exists pgcrypto;

create table if not exists usuario (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nombre text not null,
  password_hash text not null,
  telefono text,
  avatar_url text,
  estado text not null default 'activo' check (estado in ('invitado', 'activo', 'bloqueado')),
  ultimo_acceso_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tienda (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references usuario(id) on delete set null,
  nombre text not null,
  slug text not null unique,
  rubro text,
  descripcion text,
  ciudad text not null default 'Cobija',
  departamento text not null default 'Pando',
  pais text not null default 'Bolivia',
  telefono_whatsapp text,
  logo_url text,
  color_primario text not null default '#0B1F3A',
  plan text not null default 'free' check (plan in ('free', 'pro', 'demo')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tienda_usuario (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  usuario_id uuid not null references usuario(id) on delete cascade,
  cargo text,
  estado text not null default 'activo' check (estado in ('invitado', 'activo', 'suspendido')),
  invitado_por_id uuid references usuario(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, usuario_id)
);

create table if not exists rol (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references tienda(id) on delete cascade,
  alcance text not null check (alcance in ('plataforma', 'tienda')),
  codigo text not null,
  nombre text not null,
  descripcion text,
  sistema boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (alcance = 'plataforma' and tienda_id is null)
    or alcance = 'tienda'
  )
);

create unique index if not exists rol_plataforma_codigo_unique
  on rol (codigo)
  where alcance = 'plataforma' and tienda_id is null;

create unique index if not exists rol_tienda_codigo_unique
  on rol (tienda_id, codigo)
  where alcance = 'tienda';

create table if not exists usuario_rol (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario(id) on delete cascade,
  rol_id uuid not null references rol(id) on delete cascade,
  tienda_id uuid references tienda(id) on delete cascade,
  asignado_por_id uuid references usuario(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists usuario_rol_plataforma_unique
  on usuario_rol (usuario_id, rol_id)
  where tienda_id is null;

create unique index if not exists usuario_rol_tienda_unique
  on usuario_rol (usuario_id, rol_id, tienda_id)
  where tienda_id is not null;

create table if not exists categoria (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  nombre text not null,
  descripcion text,
  icono text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, nombre)
);

create table if not exists producto (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  categoria_id uuid references categoria(id) on delete set null,
  sku text,
  codigo_barras text,
  nombre text not null,
  descripcion text,
  tipo text not null default 'producto' check (tipo in ('producto', 'servicio', 'combo')),
  unidad text not null default 'unidad',
  costo_unitario numeric(12,2) not null default 0,
  precio_venta numeric(12,2) not null default 0,
  stock_actual numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  precio_variable boolean not null default false,
  orden_catalogo integer not null default 0,
  imagen_url text,
  visible_catalogo boolean not null default false,
  visible_pos boolean not null default true,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists producto_sku_unique
  on producto (tienda_id, sku)
  where sku is not null;

create table if not exists sesion (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists usuario_email_idx on usuario (lower(email));
create index if not exists tienda_usuario_usuario_idx on tienda_usuario (usuario_id, tienda_id);
create index if not exists usuario_rol_usuario_idx on usuario_rol (usuario_id, tienda_id);
create index if not exists producto_pos_idx on producto (tienda_id, visible_pos, activo, orden_catalogo);
create index if not exists sesion_token_hash_idx on sesion (token_hash);
create index if not exists sesion_usuario_idx on sesion (usuario_id, expires_at desc);

insert into rol (alcance, codigo, nombre, descripcion, sistema)
select v.alcance, v.codigo, v.nombre, v.descripcion, true
from (
  values
    ('plataforma', 'super_admin', 'Super admin', 'Control total de la plataforma NEXA'),
    ('plataforma', 'soporte', 'Soporte', 'Soporte operativo para tiendas'),
    ('tienda', 'propietario', 'Propietario', 'Control total de la tienda'),
    ('tienda', 'administrador', 'Administrador', 'Gestion operativa de la tienda'),
    ('tienda', 'cajero', 'Cajero', 'Uso del POS y caja')
) as v(alcance, codigo, nombre, descripcion)
where not exists (
  select 1
  from rol r
  where r.alcance = v.alcance
    and r.codigo = v.codigo
    and r.tienda_id is null
);

-- migrate:down
