-- migrate:up

-- Configuracion de facturacion electronica SIAT (SIN Bolivia) por tienda.
-- La modalidad 1 (electronica) firma el XML con certificado digital;
-- la modalidad 2 (computarizada) solo requiere credenciales del sistema.
create table if not exists facturacion_config (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null unique references tienda(id) on delete cascade,
  nit text not null,
  razon_social text not null,
  municipio text,
  telefono text,
  direccion text,
  modalidad smallint not null default 2 check (modalidad in (1, 2)),
  ambiente smallint not null default 2 check (ambiente in (1, 2)),
  codigo_sistema text,
  codigo_sucursal integer not null default 0,
  codigo_punto_venta integer not null default 0,
  codigo_actividad text,
  codigo_documento_sector integer not null default 1,
  token_delegado text,
  cuis text,
  cuis_vigencia timestamptz,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pruebas', 'activo', 'suspendido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CUFD: codigo unico de facturacion diaria. Se solicita al SIN cada dia
-- por punto de venta; su codigo de control forma parte del CUF de cada factura.
create table if not exists facturacion_cufd (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references facturacion_config(id) on delete cascade,
  tienda_id uuid not null references tienda(id) on delete cascade,
  codigo text not null,
  codigo_control text not null,
  direccion text,
  fecha_vigencia timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists facturacion_cufd_config_idx
  on facturacion_cufd (config_id, fecha_vigencia desc);

create table if not exists factura (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  config_id uuid not null references facturacion_config(id) on delete cascade,
  cufd_id uuid references facturacion_cufd(id) on delete set null,
  venta_id uuid references venta(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  numero_factura bigint not null,
  cuf text,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'emitida', 'observada', 'rechazada', 'anulada')),
  tipo_emision smallint not null default 1,
  fecha_emision timestamptz,
  tipo_documento_identidad smallint not null default 1,
  numero_documento_cliente text not null default '0',
  complemento_documento text,
  razon_social_cliente text not null default 'S/N',
  correo_cliente text,
  codigo_metodo_pago smallint not null default 1,
  numero_tarjeta text,
  monto_total numeric(12,2) not null default 0,
  monto_total_sujeto_iva numeric(12,2) not null default 0,
  descuento_adicional numeric(12,2) not null default 0,
  moneda smallint not null default 1,
  tipo_cambio numeric(12,5) not null default 1,
  leyenda text,
  xml text,
  codigo_recepcion text,
  codigo_motivo_anulacion smallint,
  mensajes_sin jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists factura_numero_unique
  on factura (config_id, numero_factura);

create index if not exists factura_tienda_idx on factura (tienda_id, fecha_emision desc);
create index if not exists factura_venta_idx on factura (venta_id);

create table if not exists factura_item (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references factura(id) on delete cascade,
  producto_id uuid references producto(id) on delete set null,
  descripcion text not null,
  codigo_producto text not null default 'ITEM',
  codigo_producto_sin text not null default '99100',
  codigo_actividad text,
  unidad_medida smallint not null default 58,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Catalogos parametricos sincronizados desde el SIAT (leyendas, actividades,
-- productos SIN, metodos de pago, unidades de medida, motivos de anulacion...).
create table if not exists facturacion_catalogo (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  tipo text not null,
  datos jsonb not null default '[]'::jsonb,
  sincronizado_at timestamptz not null default now(),
  unique (tienda_id, tipo)
);

-- migrate:down

drop table if exists facturacion_catalogo;
drop table if exists factura_item;
drop table if exists factura;
drop table if exists facturacion_cufd;
drop table if exists facturacion_config;
