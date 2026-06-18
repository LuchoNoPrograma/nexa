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
  costo_unitario numeric(12,2) not null default 0,
  precio_venta numeric(12,2) not null default 0,
  stock_inicial numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plantilla_id, nombre)
);

alter table catalogo_plantilla_producto
  add column if not exists costo_unitario numeric(12,2) not null default 0,
  add column if not exists precio_venta numeric(12,2) not null default 0,
  add column if not exists stock_inicial numeric(12,2) not null default 0;

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
    ('Combos', 'Paquetes sugeridos para aumentar ticket promedio.', 'pi pi-tags', 14),
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
  costo_unitario,
  precio_venta,
  stock_inicial,
  stock_minimo,
  orden
)
select p.id, pr.categoria_nombre, pr.nombre, pr.tipo, pr.unidad, pr.sku_sugerido, pr.descripcion, pr.costo_unitario, pr.precio_venta, pr.stock_inicial, pr.stock_minimo, pr.orden
from catalogo_plantilla p
join (
  values
    ('Abarrotes', 'Arroz Grano de Oro 1 kg', 'producto', 'unidad', 'ABA-ARR-001', 'Arroz popular para venta diaria en tienda de barrio boliviana.', 6.20, 8.00, 48, 10, 1),
    ('Abarrotes', 'Azucar Guabira 1 kg', 'producto', 'unidad', 'ABA-AZU-001', 'Azucar boliviana de alta rotacion.', 5.80, 7.50, 36, 8, 2),
    ('Abarrotes', 'Aceite Fino 900 ml', 'producto', 'unidad', 'ABA-ACE-001', 'Aceite de cocina familiar.', 12.50, 15.00, 24, 6, 3),
    ('Abarrotes', 'Fideo Princesa 400 g', 'producto', 'unidad', 'ABA-FID-001', 'Fideo seco de alta rotacion para almuerzo familiar.', 4.10, 5.50, 40, 10, 4),
    ('Abarrotes', 'Harina nacional 1 kg', 'producto', 'unidad', 'ABA-HAR-001', 'Harina para panaderia casera, masas y reposteria.', 5.20, 7.00, 20, 5, 5),
    ('Abarrotes', 'Sal fina yodada 1 kg', 'producto', 'unidad', 'ABA-SAL-001', 'Producto basico de despensa familiar.', 2.50, 3.50, 30, 8, 6),
    ('Abarrotes', 'Cafe soluble nacional 50 g', 'producto', 'unidad', 'ABA-CAF-001', 'Cafe soluble de consumo diario.', 10.00, 13.00, 12, 4, 7),
    ('Abarrotes', 'Te Windsor 25 sobres', 'producto', 'unidad', 'ABA-TE-001', 'Te filtrante tradicional.', 5.40, 7.00, 16, 4, 8),
    ('Abarrotes', 'Sopa instantanea criolla paquete', 'producto', 'unidad', 'ABA-SOP-001', 'Producto economico de preparacion rapida.', 2.10, 3.00, 30, 8, 9),
    ('Abarrotes', 'Mayonesa nacional sachet 100 g', 'producto', 'unidad', 'ABA-MAY-001', 'Acompanamiento de alta rotacion.', 3.20, 4.50, 22, 6, 10),
    ('Bebidas', 'Agua Vital 2 L', 'producto', 'unidad', 'BEB-AGU-001', 'Agua embotellada familiar.', 3.80, 5.00, 36, 10, 1),
    ('Bebidas', 'Gaseosa cola familiar 2 L', 'producto', 'unidad', 'BEB-COL-002', 'Gaseosa familiar para comidas y reuniones.', 10.50, 13.00, 30, 8, 2),
    ('Bebidas', 'Refresco popular 2 L', 'producto', 'unidad', 'BEB-REF-002', 'Refresco familiar de alta salida en barrio.', 9.50, 12.00, 24, 6, 3),
    ('Bebidas', 'Simba durazno 2 L', 'producto', 'unidad', 'BEB-SIM-002', 'Gaseosa saborizada popular.', 8.20, 10.50, 18, 5, 4),
    ('Bebidas', 'Pilfrut personal', 'producto', 'unidad', 'BEB-JUG-001', 'Bebida lactea frutal de consumo individual.', 3.20, 4.50, 24, 6, 5),
    ('Bebidas', 'Energizante lata', 'producto', 'unidad', 'BEB-ENE-001', 'Bebida energizante individual.', 6.50, 8.50, 18, 5, 6),
    ('Lacteos', 'Leche PIL 946 ml', 'producto', 'unidad', 'LAC-LEC-001', 'Leche UHT de consumo familiar.', 5.50, 7.00, 24, 6, 1),
    ('Lacteos', 'Yogurt PIL 1 L', 'producto', 'unidad', 'LAC-YOG-001', 'Yogurt bebible familiar.', 9.00, 11.50, 12, 4, 2),
    ('Lacteos', 'Queso criollo 500 g', 'producto', 'unidad', 'LAC-QUE-001', 'Queso fresco para desayuno y cocina.', 14.00, 18.00, 8, 3, 3),
    ('Lacteos', 'Mantequilla 200 g', 'producto', 'unidad', 'LAC-MAN-001', 'Producto refrigerado de rotacion media.', 8.80, 11.00, 10, 3, 4),
    ('Panaderia', 'Pan molde familiar', 'producto', 'unidad', 'PAN-MOL-001', 'Pan empacado para desayuno.', 9.50, 12.00, 10, 3, 1),
    ('Panaderia', 'Galletas Mabel paquete', 'producto', 'unidad', 'PAN-GAL-001', 'Galleta dulce de consumo familiar.', 4.80, 6.50, 24, 6, 2),
    ('Panaderia', 'Crackers paquete', 'producto', 'unidad', 'PAN-CRA-001', 'Galleta salada para acompanar comidas.', 3.80, 5.00, 18, 5, 3),
    ('Panaderia', 'Queque individual', 'producto', 'unidad', 'PAN-QUE-001', 'Producto de impulso para merienda.', 2.60, 3.50, 20, 5, 4),
    ('Snacks y golosinas', 'Papas fritas personales', 'producto', 'unidad', 'SNA-PAP-001', 'Snack salado para consumo individual.', 3.00, 4.50, 30, 8, 1),
    ('Snacks y golosinas', 'Chizitos bolsa', 'producto', 'unidad', 'SNA-CHI-001', 'Snack economico de alta rotacion.', 1.60, 2.50, 40, 10, 2),
    ('Snacks y golosinas', 'Chocolate boliviano personal', 'producto', 'unidad', 'SNA-CHO-001', 'Chocolate de impulso en caja.', 3.80, 5.00, 24, 8, 3),
    ('Snacks y golosinas', 'Caramelos surtidos 100 g', 'producto', 'unidad', 'SNA-CAR-001', 'Golosina fraccionada para venta al detalle.', 2.80, 4.00, 20, 6, 4),
    ('Snacks y golosinas', 'Chicle paquete', 'producto', 'unidad', 'SNA-CHI-002', 'Golosina de caja.', 1.20, 2.00, 30, 8, 5),
    ('Enlatados y conservas', 'Atun en lata familiar', 'producto', 'unidad', 'CON-ATU-001', 'Conserva para comidas rapidas.', 8.50, 11.00, 18, 5, 1),
    ('Enlatados y conservas', 'Sardina lata', 'producto', 'unidad', 'CON-SAR-001', 'Conserva economica de alta demanda.', 6.50, 8.50, 15, 5, 2),
    ('Enlatados y conservas', 'Leche evaporada lata', 'producto', 'unidad', 'CON-LEV-001', 'Conserva para cocina y reposteria.', 7.50, 9.50, 12, 4, 3),
    ('Enlatados y conservas', 'Durazno al jugo lata', 'producto', 'unidad', 'CON-DUR-001', 'Conserva dulce para postres.', 12.00, 15.50, 8, 3, 4),
    ('Limpieza', 'Detergente nacional 800 g', 'producto', 'unidad', 'LIM-DET-001', 'Detergente en polvo para ropa.', 13.50, 17.00, 14, 4, 1),
    ('Limpieza', 'Lavandina 1 L', 'producto', 'unidad', 'LIM-LAV-001', 'Producto basico de desinfeccion.', 4.50, 6.00, 18, 5, 2),
    ('Limpieza', 'Lava vajilla 500 ml', 'producto', 'unidad', 'LIM-VAJ-001', 'Limpieza de cocina.', 6.80, 9.00, 12, 4, 3),
    ('Limpieza', 'Esponja de cocina', 'producto', 'unidad', 'LIM-ESP-001', 'Producto complementario de limpieza.', 1.50, 2.50, 20, 5, 4),
    ('Limpieza', 'Desinfectante 900 ml', 'producto', 'unidad', 'LIM-DES-001', 'Limpieza de pisos y superficies.', 7.00, 9.50, 12, 4, 5),
    ('Higiene personal', 'Jabon de tocador', 'producto', 'unidad', 'HIG-JAB-001', 'Jabon individual para higiene personal.', 2.80, 4.00, 24, 8, 1),
    ('Higiene personal', 'Pasta dental 90 g', 'producto', 'unidad', 'HIG-PAS-001', 'Higiene dental familiar.', 7.00, 9.50, 12, 4, 2),
    ('Higiene personal', 'Shampoo sachet', 'producto', 'unidad', 'HIG-SHA-001', 'Presentacion economica de rotacion alta.', 1.00, 1.50, 50, 12, 3),
    ('Higiene personal', 'Papel higienico 4 rollos', 'producto', 'paquete', 'HIG-PAP-001', 'Producto familiar de alta rotacion.', 10.50, 13.50, 14, 4, 4),
    ('Higiene personal', 'Toallas higienicas paquete', 'producto', 'paquete', 'HIG-TOA-001', 'Producto de higiene personal.', 7.80, 10.00, 12, 4, 5),
    ('Hogar y descartables', 'Bolsas plasticas paquete', 'producto', 'paquete', 'HOG-BOL-001', 'Descartable para ventas y hogar.', 4.00, 6.00, 10, 3, 1),
    ('Hogar y descartables', 'Vasos descartables 50 unid.', 'producto', 'paquete', 'HOG-VAS-001', 'Descartables para reuniones.', 6.50, 9.00, 8, 3, 2),
    ('Hogar y descartables', 'Servilletas paquete', 'producto', 'paquete', 'HOG-SER-001', 'Producto de mesa y cocina.', 4.20, 6.00, 12, 4, 3),
    ('Hogar y descartables', 'Pilas AA par', 'producto', 'unidad', 'HOG-PIL-001', 'Producto de caja para controles y linternas.', 5.50, 8.00, 10, 3, 4),
    ('Frutas y verduras', 'Tomate seleccionado', 'producto', 'kg', 'VER-TOM-001', 'Producto fresco de venta por kilo.', 4.00, 6.00, 12, 3, 1),
    ('Frutas y verduras', 'Cebolla roja', 'producto', 'kg', 'VER-CEB-001', 'Producto fresco de cocina diaria.', 3.50, 5.00, 15, 4, 2),
    ('Frutas y verduras', 'Papa holandesa', 'producto', 'kg', 'VER-PAP-001', 'Producto fresco de alta rotacion.', 4.20, 6.00, 20, 5, 3),
    ('Frutas y verduras', 'Platano maduro', 'producto', 'unidad', 'VER-PLA-001', 'Producto fresco para consumo diario.', 0.70, 1.00, 40, 10, 4),
    ('Congelados', 'Pollo trozado 1 kg', 'producto', 'kg', 'FRI-POL-001', 'Producto refrigerado para cocina familiar.', 16.00, 20.00, 12, 3, 1),
    ('Congelados', 'Salchicha paquete', 'producto', 'unidad', 'FRI-SAL-001', 'Embutido refrigerado de rotacion media.', 8.50, 11.00, 10, 3, 2),
    ('Congelados', 'Helado personal', 'producto', 'unidad', 'FRI-HEL-001', 'Producto frio de impulso.', 3.00, 5.00, 20, 5, 3),
    ('Mascotas', 'Alimento perro 1 kg', 'producto', 'unidad', 'MAS-PER-001', 'Alimento seco para perro.', 12.50, 16.00, 12, 4, 1),
    ('Mascotas', 'Alimento gato 1 kg', 'producto', 'unidad', 'MAS-GAT-001', 'Alimento seco para gato.', 14.00, 18.00, 8, 3, 2),
    ('Recargas y servicios', 'Recarga telefonica', 'servicio', 'servicio', 'SER-REC-001', 'Servicio complementario sin inventario.', 0.00, 0.00, 0, 0, 1),
    ('Recargas y servicios', 'Pago QR asistido', 'servicio', 'servicio', 'SER-QR-001', 'Servicio de apoyo para cobros o pagos simples.', 0.00, 1.00, 0, 0, 2),
    ('Combos', 'Combo desayuno rapido', 'combo', 'combo', 'COM-DES-001', 'Leche, pan molde y galletas para compra rapida.', 18.00, 22.00, 8, 2, 1),
    ('Combos', 'Combo cocina basica', 'combo', 'combo', 'COM-COC-001', 'Arroz, aceite, fideo y sal para reposicion familiar.', 25.00, 31.00, 8, 2, 2)
) as pr(categoria_nombre, nombre, tipo, unidad, sku_sugerido, descripcion, costo_unitario, precio_venta, stock_inicial, stock_minimo, orden) on p.codigo = 'minimarket_abarrotes'
on conflict (plantilla_id, nombre) do update
set
  categoria_nombre = excluded.categoria_nombre,
  tipo = excluded.tipo,
  unidad = excluded.unidad,
  sku_sugerido = excluded.sku_sugerido,
  descripcion = excluded.descripcion,
  costo_unitario = excluded.costo_unitario,
  precio_venta = excluded.precio_venta,
  stock_inicial = excluded.stock_inicial,
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
    update producto
    set activo = false, updated_at = now()
    where tienda_id = tienda_uuid
      and coalesce(precio_venta, 0) = 0
      and coalesce(stock_actual, 0) = 0
      and sku in (
        'ARR-1KG',
        'AZU-1KG',
        'ACE-1L',
        'FID-400G',
        'HAR-1KG',
        'AGU-2L',
        'GAS-2L',
        'JUG-PER',
        'LEC-1L',
        'YOG-1L',
        'PAN-MOL',
        'GAL-FAM',
        'SNA-PAP',
        'GOL-CHO',
        'ATL-001',
        'DET-1KG',
        'LAV-1L',
        'HIG-JAB',
        'HIG-PAP',
        'HOG-BOL',
        'VER-TOM',
        'VER-CEB',
        'CON-POL',
        'MAS-PER-1KG',
        'SER-REC'
      );

    insert into producto (
      tienda_id,
      categoria_id,
      sku,
      nombre,
      descripcion,
      tipo,
      unidad,
      costo_unitario,
      precio_venta,
      stock_actual,
      stock_minimo,
      visible_pos,
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
      pr.costo_unitario,
      pr.precio_venta,
      pr.stock_inicial,
      pr.stock_minimo,
      true,
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
      costo_unitario = excluded.costo_unitario,
      precio_venta = excluded.precio_venta,
      stock_actual = case
        when producto.stock_actual = 0 then excluded.stock_actual
        else producto.stock_actual
      end,
      stock_minimo = excluded.stock_minimo,
      visible_pos = true,
      orden_catalogo = excluded.orden_catalogo,
      updated_at = now();
  end if;
end;
$$;

-- migrate:down
