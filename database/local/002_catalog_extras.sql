-- migrate:up

-- Campos adicionales del catálogo: margen, stock máximo, icono y variantes.

alter table tienda
  add column if not exists margen_default numeric(5,2) not null default 20;

alter table producto
  add column if not exists margen_minimo numeric(5,2),
  add column if not exists stock_maximo numeric(12,2),
  add column if not exists icono text;

create table if not exists producto_variante (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references producto(id) on delete cascade,
  nombre text not null,
  sku text,
  codigo_barras text,
  costo_unitario numeric(12,2),
  precio_venta numeric(12,2),
  stock_actual numeric(12,2) not null default 0,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists producto_variante_producto_idx
  on producto_variante (producto_id, activo, orden);

create unique index if not exists producto_variante_sku_unique
  on producto_variante (producto_id, sku)
  where sku is not null;

-- migrate:down
