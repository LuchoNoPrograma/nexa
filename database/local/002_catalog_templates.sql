-- migrate:up

create table if not exists catalogo_plantilla (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  rubro text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists catalogo_plantilla_categoria (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references catalogo_plantilla(id) on delete cascade,
  nombre text not null,
  descripcion text,
  icono text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plantilla_id, nombre)
);

create table if not exists catalogo_plantilla_producto (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references catalogo_plantilla(id) on delete cascade,
  categoria_nombre text not null,
  nombre text not null,
  tipo text not null default 'producto' check (tipo in ('producto', 'servicio', 'combo')),
  unidad text not null default 'unidad',
  sku_sugerido text,
  descripcion text,
  stock_minimo numeric(12,2) not null default 0,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plantilla_id, nombre)
);

create index if not exists catalogo_plantilla_rubro_idx
  on catalogo_plantilla (rubro, activo);

create index if not exists catalogo_plantilla_categoria_idx
  on catalogo_plantilla_categoria (plantilla_id, activo, orden);

create index if not exists catalogo_plantilla_producto_idx
  on catalogo_plantilla_producto (plantilla_id, categoria_nombre, activo, orden);

insert into catalogo_plantilla (codigo, nombre, rubro, descripcion)
values (
  'minimarket_abarrotes',
  'Minimarket / Abarrotes',
  'abarrotes',
  'Categorias y productos sugeridos para tienda de barrio, minimarket o abarrotes.'
)
on conflict (codigo) do update
set
  nombre = excluded.nombre,
  rubro = excluded.rubro,
  descripcion = excluded.descripcion,
  activo = true,
  updated_at = now();

insert into catalogo_plantilla_categoria (plantilla_id, nombre, descripcion, icono, orden)
select p.id, c.nombre, c.descripcion, c.icono, c.orden
from catalogo_plantilla p
join (
  values
    ('Abarrotes', 'Arroz, azucar, aceite, fideos, harina y productos basicos.', 'pi pi-shopping-bag', 1),
    ('Bebidas', 'Agua, gaseosas, jugos, energizantes y bebidas familiares.', 'pi pi-cup', 2),
    ('Lacteos', 'Leche, yogurt, queso, mantequilla y derivados.', 'pi pi-box', 3),
    ('Panaderia', 'Pan, galletas, tostadas, queques y masas empacadas.', 'pi pi-prime', 4),
    ('Snacks y golosinas', 'Papas fritas, chocolates, caramelos, chicles y bocaditos.', 'pi pi-star', 5),
    ('Enlatados y conservas', 'Atun, sardina, leche evaporada, durazno y conservas.', 'pi pi-inbox', 6),
    ('Limpieza', 'Detergente, lavandina, desinfectante, esponjas y escobas.', 'pi pi-sparkles', 7),
    ('Higiene personal', 'Shampoo, jabon, pasta dental, papel higienico y afeitado.', 'pi pi-heart', 8),
    ('Hogar y descartables', 'Bolsas, vasos, platos, servilletas, focos y pilas.', 'pi pi-home', 9),
    ('Frutas y verduras', 'Productos frescos de rotacion diaria.', 'pi pi-apple', 10),
    ('Congelados', 'Pollo, carnes, helados, embutidos y productos frios.', 'pi pi-snowflake', 11),
    ('Mascotas', 'Alimento, arena y accesorios basicos para mascotas.', 'pi pi-github', 12),
    ('Recargas y servicios', 'Recargas, pagos simples y servicios complementarios.', 'pi pi-mobile', 13),
    ('Otros', 'Productos temporales, nuevos o sin clasificar.', 'pi pi-ellipsis-h', 99)
) as c(nombre, descripcion, icono, orden) on p.codigo = 'minimarket_abarrotes'
on conflict (plantilla_id, nombre) do update
set
  descripcion = excluded.descripcion,
  icono = excluded.icono,
  orden = excluded.orden,
  activo = true;

insert into catalogo_plantilla_producto (
  plantilla_id,
  categoria_nombre,
  nombre,
  tipo,
  unidad,
  sku_sugerido,
  descripcion,
  stock_minimo,
  orden
)
select p.id, pr.categoria_nombre, pr.nombre, pr.tipo, pr.unidad, pr.sku_sugerido, pr.descripcion, pr.stock_minimo, pr.orden
from catalogo_plantilla p
join (
  values
    ('Abarrotes', 'Arroz 1 kg', 'producto', 'unidad', 'ARR-1KG', 'Producto basico de alta rotacion.', 10, 1),
    ('Abarrotes', 'Azucar 1 kg', 'producto', 'unidad', 'AZU-1KG', 'Producto basico de alta rotacion.', 10, 2),
    ('Abarrotes', 'Aceite 1 L', 'producto', 'unidad', 'ACE-1L', 'Producto basico de cocina.', 8, 3),
    ('Abarrotes', 'Fideo 400 g', 'producto', 'unidad', 'FID-400G', 'Producto seco de rotacion frecuente.', 12, 4),
    ('Abarrotes', 'Harina 1 kg', 'producto', 'unidad', 'HAR-1KG', 'Producto basico de despensa.', 8, 5),
    ('Bebidas', 'Agua 2 L', 'producto', 'unidad', 'AGU-2L', 'Bebida de alta rotacion.', 12, 1),
    ('Bebidas', 'Gaseosa 2 L', 'producto', 'unidad', 'GAS-2L', 'Bebida familiar.', 10, 2),
    ('Bebidas', 'Jugo personal', 'producto', 'unidad', 'JUG-PER', 'Bebida individual.', 10, 3),
    ('Lacteos', 'Leche 1 L', 'producto', 'unidad', 'LEC-1L', 'Producto refrigerado o UHT.', 8, 1),
    ('Lacteos', 'Yogurt 1 L', 'producto', 'unidad', 'YOG-1L', 'Producto lacteo de rotacion media.', 6, 2),
    ('Panaderia', 'Pan molde', 'producto', 'unidad', 'PAN-MOL', 'Producto de panaderia empacado.', 5, 1),
    ('Panaderia', 'Galletas familiares', 'producto', 'unidad', 'GAL-FAM', 'Producto de consumo familiar.', 8, 2),
    ('Snacks y golosinas', 'Papas fritas personales', 'producto', 'unidad', 'SNA-PAP', 'Snack de impulso.', 10, 1),
    ('Snacks y golosinas', 'Chocolate pequeño', 'producto', 'unidad', 'GOL-CHO', 'Golosina de impulso.', 10, 2),
    ('Enlatados y conservas', 'Atun lata', 'producto', 'unidad', 'ATL-001', 'Conserva de alta demanda.', 6, 1),
    ('Limpieza', 'Detergente 1 kg', 'producto', 'unidad', 'DET-1KG', 'Producto de limpieza domestica.', 5, 1),
    ('Limpieza', 'Lavandina 1 L', 'producto', 'unidad', 'LAV-1L', 'Producto de limpieza domestica.', 5, 2),
    ('Higiene personal', 'Jabon de tocador', 'producto', 'unidad', 'HIG-JAB', 'Higiene personal basica.', 8, 1),
    ('Higiene personal', 'Papel higienico pack', 'producto', 'unidad', 'HIG-PAP', 'Higiene personal basica.', 6, 2),
    ('Hogar y descartables', 'Bolsas plasticas', 'producto', 'paquete', 'HOG-BOL', 'Descartable de uso diario.', 4, 1),
    ('Frutas y verduras', 'Tomate', 'producto', 'kg', 'VER-TOM', 'Producto fresco.', 3, 1),
    ('Frutas y verduras', 'Cebolla', 'producto', 'kg', 'VER-CEB', 'Producto fresco.', 3, 2),
    ('Congelados', 'Pollo trozado', 'producto', 'kg', 'CON-POL', 'Producto refrigerado/congelado.', 3, 1),
    ('Mascotas', 'Alimento para perro 1 kg', 'producto', 'unidad', 'MAS-PER-1KG', 'Producto basico para mascotas.', 4, 1),
    ('Recargas y servicios', 'Recarga telefonica', 'servicio', 'servicio', 'SER-REC', 'Servicio complementario sin stock.', 0, 1)
) as pr(categoria_nombre, nombre, tipo, unidad, sku_sugerido, descripcion, stock_minimo, orden) on p.codigo = 'minimarket_abarrotes'
on conflict (plantilla_id, nombre) do update
set
  categoria_nombre = excluded.categoria_nombre,
  tipo = excluded.tipo,
  unidad = excluded.unidad,
  sku_sugerido = excluded.sku_sugerido,
  descripcion = excluded.descripcion,
  stock_minimo = excluded.stock_minimo,
  orden = excluded.orden,
  activo = true;

create or replace function aplicar_catalogo_plantilla(
  tienda_uuid uuid,
  plantilla_codigo text,
  incluir_productos boolean default false
)
returns void
language plpgsql
as $$
declare
  plantilla_uuid uuid;
begin
  select id
    into plantilla_uuid
  from catalogo_plantilla
  where codigo = plantilla_codigo
    and activo = true
  limit 1;

  if plantilla_uuid is null then
    raise exception 'No existe la plantilla de catalogo %', plantilla_codigo;
  end if;

  insert into categoria (tienda_id, nombre, descripcion, icono, orden, activo)
  select tienda_uuid, c.nombre, c.descripcion, c.icono, c.orden, c.activo
  from catalogo_plantilla_categoria c
  where c.plantilla_id = plantilla_uuid
    and c.activo = true
  on conflict (tienda_id, nombre) do update
  set
    descripcion = coalesce(categoria.descripcion, excluded.descripcion),
    icono = coalesce(categoria.icono, excluded.icono),
    orden = excluded.orden,
    activo = true,
    updated_at = now();

  if incluir_productos then
    insert into producto (
      tienda_id,
      categoria_id,
      sku,
      nombre,
      descripcion,
      tipo,
      unidad,
      stock_minimo,
      visible_pos,
      visible_catalogo,
      activo,
      orden_catalogo
    )
    select
      tienda_uuid,
      c.id,
      pr.sku_sugerido,
      pr.nombre,
      pr.descripcion,
      pr.tipo,
      pr.unidad,
      pr.stock_minimo,
      true,
      false,
      true,
      pr.orden
    from catalogo_plantilla_producto pr
    join categoria c on c.tienda_id = tienda_uuid and c.nombre = pr.categoria_nombre
    where pr.plantilla_id = plantilla_uuid
      and pr.activo = true
    on conflict (tienda_id, sku) where sku is not null do update
    set
      categoria_id = excluded.categoria_id,
      descripcion = coalesce(producto.descripcion, excluded.descripcion),
      tipo = excluded.tipo,
      unidad = excluded.unidad,
      stock_minimo = excluded.stock_minimo,
      visible_pos = true,
      orden_catalogo = excluded.orden_catalogo,
      updated_at = now();
  end if;
end;
$$;

-- migrate:down
