-- migrate:up

-- Tipo de negocio a nivel tienda (global). Pre-llena el tipo de costeo de cada
-- producto, pero cada producto puede sobreescribirlo (override por producto).
-- Mapea con producto.tipo_costeo: comercial->reventa, produccion->produccion,
-- servicios->servicio. Nullable: se setea en el onboarding/diagnostico.
alter table tienda
  add column if not exists tipo_negocio text
  check (tipo_negocio in ('produccion', 'comercial', 'servicios'));

-- Desglose opcional del costo directo de un producto (materia prima, mano de
-- obra, gas/insumos, otros). La suma de los componentes alimenta
-- producto.costo_unitario. Si el dueno no usa el desglose, la tabla queda vacia
-- y se mantiene el costo como un solo numero.
create table if not exists producto_costo_componente (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references producto(id) on delete cascade,
  tipo text not null default 'otro'
    check (tipo in ('materia_prima', 'mano_obra', 'insumo', 'otro')),
  nombre text not null,
  monto numeric(12,2) not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (monto >= 0)
);

create index if not exists producto_costo_componente_producto_idx
  on producto_costo_componente (producto_id, orden);

-- migrate:down

drop table if exists producto_costo_componente cascade;
alter table tienda drop column if exists tipo_negocio;
