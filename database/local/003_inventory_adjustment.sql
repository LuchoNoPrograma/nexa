-- migrate:up

create table if not exists inventario_ajuste (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  producto_id uuid not null references producto(id) on delete cascade,
  producto_variante_id uuid references producto_variante(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  tipo text not null check (tipo in ('sumar', 'restar', 'fijar')),
  motivo text not null check (motivo in ('compra_recibida', 'producto_daniado', 'devolucion', 'recuento', 'traslado', 'otro')),
  sucursal text not null default 'Matriz',
  cantidad numeric(12,2) not null default 0,
  stock_anterior numeric(12,2) not null default 0,
  stock_nuevo numeric(12,2) not null default 0,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists inventario_ajuste_tienda_idx
  on inventario_ajuste (tienda_id, created_at desc);

create index if not exists inventario_ajuste_producto_idx
  on inventario_ajuste (producto_id, created_at desc);

-- migrate:down
