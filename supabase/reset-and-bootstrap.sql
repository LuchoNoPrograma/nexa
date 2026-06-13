-- Reset + bootstrap IMPULSA para Supabase/PostgreSQL.
-- Este archivo borra las tablas de IMPULSA en public y recrea el modelo completo.

do $$
declare
  legacy_table text;
begin
  foreach legacy_table in array array[
    'ken' || 'chita_chat_config',
    'ken' || 'chita_mensaje',
    'ken' || 'chita_conversacion'
  ]
  loop
    execute format('drop table if exists %I cascade', legacy_table);
  end loop;
end $$;

drop table if exists
  dbmate_schema_migrations,
  schema_migration,
  schema_migrations,
  sesion,
  contacto_mensaje,
  haru_chat_config,
  haru_mensaje,
  haru_conversacion,
  diagnostico,
  calculo_precio,
  precio_historial,
  inventario_movimiento,
  inventario_ajuste,
  caja_movimiento,
  pago,
  compra_item,
  compra,
  venta_item,
  venta,
  caja_sesion,
  combo_item,
  producto_variante,
  producto,
  categoria,
  proveedor,
  cliente,
  catalogo_plantilla_producto,
  catalogo_plantilla_categoria,
  catalogo_plantilla,
  rol_permiso,
  permiso,
  usuario_rol,
  rol,
  tienda_usuario,
  tienda,
  usuario
cascade;

drop function if exists current_tienda_id() cascade;
drop function if exists is_miembro_tienda(uuid) cascade;
drop function if exists has_permiso(text, uuid) cascade;
drop function if exists aplicar_catalogo_plantilla(uuid, text, boolean) cascade;


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
  margen_default numeric(5,2) not null default 20,
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

create table if not exists permiso (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  modulo text not null,
  accion text not null,
  alcance text not null check (alcance in ('plataforma', 'tienda')),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists rol_permiso (
  id uuid primary key default gen_random_uuid(),
  rol_id uuid not null references rol(id) on delete cascade,
  permiso_id uuid not null references permiso(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (rol_id, permiso_id)
);

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

create table if not exists cliente (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  nombre text not null,
  telefono text,
  email text,
  documento text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists proveedor (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  nombre text not null,
  telefono text,
  email text,
  documento text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  stock_maximo numeric(12,2),
  margen_minimo numeric(5,2),
  precio_variable boolean not null default false,
  orden_catalogo integer not null default 0,
  imagen_url text,
  icono text,
  visible_catalogo boolean not null default false,
  visible_pos boolean not null default true,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists producto_sku_unique
  on producto (tienda_id, sku)
  where sku is not null;

create unique index if not exists producto_codigo_barras_unique
  on producto (tienda_id, codigo_barras)
  where codigo_barras is not null;

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

create unique index if not exists producto_variante_sku_unique
  on producto_variante (producto_id, sku)
  where sku is not null;

create unique index if not exists producto_variante_codigo_barras_unique
  on producto_variante (producto_id, codigo_barras)
  where codigo_barras is not null;

create table if not exists combo_item (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references producto(id) on delete cascade,
  producto_id uuid not null references producto(id) on delete restrict,
  cantidad numeric(12,2) not null default 1,
  created_at timestamptz not null default now(),
  unique (combo_id, producto_id),
  check (combo_id <> producto_id)
);

create table if not exists caja_sesion (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  usuario_id uuid references usuario(id) on delete set null,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  saldo_inicial numeric(12,2) not null default 0,
  saldo_esperado numeric(12,2) not null default 0,
  saldo_contado numeric(12,2),
  diferencia numeric(12,2),
  abierta_at timestamptz not null default now(),
  cerrada_at timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (estado = 'abierta' and cerrada_at is null)
    or (estado = 'cerrada' and cerrada_at is not null)
  )
);

create unique index if not exists caja_sesion_abierta_unique
  on caja_sesion (tienda_id)
  where estado = 'abierta';

create table if not exists venta (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  cliente_id uuid references cliente(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  caja_sesion_id uuid references caja_sesion(id) on delete set null,
  numero text,
  canal text not null default 'pos' check (canal in ('pos', 'catalogo_whatsapp', 'manual')),
  estado text not null default 'pendiente' check (estado in ('cotizacion', 'pendiente', 'parcial', 'pagada', 'anulada')),
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  fecha timestamptz not null default now(),
  fecha_vencimiento date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists venta_numero_unique
  on venta (tienda_id, numero)
  where numero is not null;

create table if not exists venta_item (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references venta(id) on delete cascade,
  producto_id uuid references producto(id) on delete set null,
  producto_variante_id uuid references producto_variante(id) on delete set null,
  nombre_producto text not null,
  tipo_producto text not null default 'producto' check (tipo_producto in ('producto', 'servicio', 'combo')),
  cantidad numeric(12,2) not null default 1,
  costo_unitario numeric(12,2) not null default 0,
  precio_unitario numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists compra (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  proveedor_id uuid references proveedor(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  numero text,
  estado text not null default 'recibida' check (estado in ('borrador', 'recibida', 'anulada')),
  estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente', 'parcial', 'pagada')),
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists compra_numero_unique
  on compra (tienda_id, numero)
  where numero is not null;

create table if not exists compra_item (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compra(id) on delete cascade,
  producto_id uuid references producto(id) on delete set null,
  producto_variante_id uuid references producto_variante(id) on delete set null,
  nombre_producto text not null,
  cantidad numeric(12,2) not null default 1,
  costo_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists pago (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  venta_id uuid references venta(id) on delete set null,
  compra_id uuid references compra(id) on delete set null,
  caja_sesion_id uuid references caja_sesion(id) on delete set null,
  cliente_id uuid references cliente(id) on delete set null,
  proveedor_id uuid references proveedor(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  metodo text not null check (metodo in ('efectivo', 'qr', 'transferencia', 'tarjeta', 'otro')),
  estado text not null default 'confirmado' check (estado in ('pendiente', 'confirmado', 'anulado')),
  monto numeric(12,2) not null default 0,
  referencia text,
  fecha timestamptz not null default now(),
  fecha_vencimiento date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (monto >= 0)
);

create table if not exists caja_movimiento (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  caja_sesion_id uuid references caja_sesion(id) on delete set null,
  pago_id uuid references pago(id) on delete set null,
  venta_id uuid references venta(id) on delete set null,
  compra_id uuid references compra(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  proveedor_id uuid references proveedor(id) on delete set null,
  cliente_id uuid references cliente(id) on delete set null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  categoria text not null default 'otro',
  concepto text not null,
  metodo text check (metodo in ('efectivo', 'qr', 'transferencia', 'tarjeta', 'otro')),
  monto numeric(12,2) not null default 0,
  estado text not null default 'confirmado' check (estado in ('pendiente', 'confirmado', 'anulado')),
  fecha timestamptz not null default now(),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (monto >= 0)
);

create table if not exists inventario_ajuste (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  producto_id uuid not null references producto(id) on delete cascade,
  producto_variante_id uuid references producto_variante(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  tipo text not null check (tipo in ('sumar', 'restar', 'fijar')),
  motivo text not null check (motivo in ('compra_recibida', 'venta', 'producto_daniado', 'devolucion', 'recuento', 'traslado', 'otro')),
  sucursal text not null default 'Matriz',
  cantidad numeric(12,2) not null default 0,
  stock_anterior numeric(12,2) not null default 0,
  stock_nuevo numeric(12,2) not null default 0,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists inventario_movimiento (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  producto_id uuid not null references producto(id) on delete cascade,
  producto_variante_id uuid references producto_variante(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  venta_id uuid references venta(id) on delete set null,
  compra_id uuid references compra(id) on delete set null,
  ajuste_id uuid references inventario_ajuste(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  origen text not null check (origen in ('venta', 'compra', 'manual', 'devolucion')),
  cantidad numeric(12,2) not null default 0,
  stock_anterior numeric(12,2) not null default 0,
  stock_nuevo numeric(12,2) not null default 0,
  costo_unitario numeric(12,2),
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists precio_historial (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  producto_id uuid references producto(id) on delete cascade,
  producto_variante_id uuid references producto_variante(id) on delete set null,
  usuario_id uuid references usuario(id) on delete set null,
  costo_anterior numeric(12,2),
  costo_nuevo numeric(12,2),
  precio_anterior numeric(12,2),
  precio_nuevo numeric(12,2),
  motivo text,
  created_at timestamptz not null default now()
);

create table if not exists calculo_precio (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  producto_id uuid references producto(id) on delete set null,
  nombre_producto text,
  costo_unitario numeric(12,2) not null default 0,
  costo_fijo_prorrateado numeric(12,2) not null default 0,
  otros_costos numeric(12,2) not null default 0,
  margen_deseado numeric(5,2) not null default 0,
  precio_recomendado numeric(12,2) not null default 0,
  ganancia_estimada numeric(12,2) not null default 0,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists diagnostico (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  rubro text,
  canal_venta_principal text,
  nivel_digital text check (nivel_digital in ('bajo', 'medio', 'alto')),
  problema_principal text,
  objetivo_principal text,
  resultado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists haru_conversacion (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  usuario_id uuid references usuario(id) on delete set null,
  titulo text not null default 'Nueva conversacion',
  contexto jsonb not null default '{}'::jsonb,
  origen text not null default 'burbuja_chat',
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada', 'archivada')),
  resumen text,
  resumen_updated_at timestamptz,
  resumen_mensajes integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists haru_mensaje (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references haru_conversacion(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant', 'system')),
  contenido text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists haru_chat_config (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  nombre_asistente text not null default 'Haru IA',
  saludo text not null default 'Hola, soy Haru. Puedo ayudarte con precios, ventas, catalogo y decisiones de tu negocio.',
  avatar_url text not null default '/haru-chat.png',
  prompts jsonb not null default '["Ideas para vender mas", "Analizar mis precios", "Que productos no se venden?"]'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id)
);

create table if not exists contacto_mensaje (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  rubro text,
  mensaje text not null,
  canal text not null default 'formulario' check (canal in ('formulario', 'whatsapp')),
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'cerrado')),
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
create index if not exists tienda_slug_idx on tienda (slug);
create index if not exists tienda_usuario_tienda_idx on tienda_usuario (tienda_id, usuario_id);
create index if not exists tienda_usuario_usuario_idx on tienda_usuario (usuario_id, tienda_id);
create index if not exists permiso_codigo_idx on permiso (codigo);
create index if not exists rol_permiso_rol_idx on rol_permiso (rol_id, permiso_id);
create index if not exists usuario_rol_usuario_idx on usuario_rol (usuario_id, tienda_id);
create index if not exists cliente_tienda_idx on cliente (tienda_id, nombre);
create index if not exists proveedor_tienda_idx on proveedor (tienda_id, nombre);
create index if not exists categoria_tienda_idx on categoria (tienda_id, activo, orden);
create index if not exists producto_tienda_nombre_idx on producto (tienda_id, nombre);
create index if not exists producto_pos_idx on producto (tienda_id, visible_pos, activo, orden_catalogo);
create index if not exists producto_catalogo_idx on producto (tienda_id, visible_catalogo, activo, orden_catalogo);
create index if not exists producto_variante_producto_idx on producto_variante (producto_id, activo, orden);
create index if not exists combo_item_combo_idx on combo_item (combo_id);
create index if not exists caja_sesion_tienda_idx on caja_sesion (tienda_id, estado, abierta_at desc);
create index if not exists venta_tienda_fecha_idx on venta (tienda_id, fecha desc);
create index if not exists venta_cliente_idx on venta (cliente_id, fecha desc);
create index if not exists venta_item_venta_idx on venta_item (venta_id);
create index if not exists compra_tienda_fecha_idx on compra (tienda_id, fecha desc);
create index if not exists compra_proveedor_idx on compra (proveedor_id, fecha desc);
create index if not exists compra_item_compra_idx on compra_item (compra_id);
create index if not exists pago_tienda_fecha_idx on pago (tienda_id, fecha desc);
create index if not exists pago_venta_idx on pago (venta_id, estado);
create index if not exists pago_compra_idx on pago (compra_id, estado);
create index if not exists caja_movimiento_tienda_fecha_idx on caja_movimiento (tienda_id, fecha desc);
create index if not exists caja_movimiento_tipo_idx on caja_movimiento (tienda_id, tipo, estado, fecha desc);
create index if not exists inventario_ajuste_tienda_idx on inventario_ajuste (tienda_id, created_at desc);
create index if not exists inventario_ajuste_producto_idx on inventario_ajuste (producto_id, created_at desc);
create index if not exists inventario_movimiento_tienda_idx on inventario_movimiento (tienda_id, created_at desc);
create index if not exists inventario_movimiento_producto_idx on inventario_movimiento (producto_id, created_at desc);
create index if not exists precio_historial_producto_idx on precio_historial (producto_id, created_at desc);
create index if not exists calculo_precio_tienda_idx on calculo_precio (tienda_id, created_at desc);
create index if not exists diagnostico_tienda_idx on diagnostico (tienda_id, created_at desc);
create index if not exists haru_conversacion_tienda_idx on haru_conversacion (tienda_id, estado, last_message_at desc, created_at desc);
create index if not exists haru_mensaje_conversacion_idx on haru_mensaje (conversacion_id, created_at);
create index if not exists haru_chat_config_tienda_idx on haru_chat_config (tienda_id, activo);
create index if not exists contacto_mensaje_estado_idx on contacto_mensaje (estado, created_at desc);
create index if not exists contacto_mensaje_created_at_idx on contacto_mensaje (created_at desc);
create index if not exists sesion_token_hash_idx on sesion (token_hash);
create index if not exists sesion_usuario_idx on sesion (usuario_id, expires_at desc);

insert into rol (alcance, codigo, nombre, descripcion, sistema)
select v.alcance, v.codigo, v.nombre, v.descripcion, true
from (
  values
    ('plataforma', 'super_admin', 'Super admin', 'Control total de la plataforma IMPULSA'),
    ('plataforma', 'soporte', 'Soporte', 'Soporte operativo para tiendas'),
    ('plataforma', 'comercial', 'Comercial', 'Gestion comercial de tiendas y prospectos'),
    ('plataforma', 'investigador', 'Investigador', 'Consulta de datos para el estudio academico'),
    ('tienda', 'propietario', 'Propietario', 'Control total de la tienda'),
    ('tienda', 'administrador', 'Administrador', 'Gestion operativa de la tienda'),
    ('tienda', 'cajero', 'Cajero', 'Uso del POS, ventas y caja'),
    ('tienda', 'inventario', 'Inventario', 'Gestion de catalogo, compras y stock'),
    ('tienda', 'consulta', 'Consulta', 'Lectura de reportes y analisis')
) as v(alcance, codigo, nombre, descripcion)
where not exists (
  select 1
  from rol r
  where r.alcance = v.alcance
    and r.codigo = v.codigo
    and r.tienda_id is null
);

insert into permiso (codigo, modulo, accion, alcance, descripcion)
select v.codigo, v.modulo, v.accion, v.alcance, v.descripcion
from (
  values
    ('plataforma.tienda.ver', 'plataforma', 'ver_tiendas', 'plataforma', 'Ver tiendas de la plataforma'),
    ('plataforma.tienda.gestionar', 'plataforma', 'gestionar_tiendas', 'plataforma', 'Crear y administrar tiendas'),
    ('plataforma.usuario.gestionar', 'plataforma', 'gestionar_usuarios', 'plataforma', 'Administrar usuarios internos'),
    ('plataforma.soporte.acceder', 'plataforma', 'acceder_soporte', 'plataforma', 'Acceder a soporte operativo'),
    ('plataforma.reporte.ver', 'plataforma', 'ver_reportes', 'plataforma', 'Ver reportes de plataforma'),
    ('pos.vender', 'pos', 'vender', 'tienda', 'Registrar ventas en POS'),
    ('pos.descuento.aplicar', 'pos', 'aplicar_descuento', 'tienda', 'Aplicar descuentos manuales'),
    ('caja.abrir', 'caja', 'abrir', 'tienda', 'Abrir caja'),
    ('caja.cerrar', 'caja', 'cerrar', 'tienda', 'Cerrar caja'),
    ('caja.movimiento.crear', 'caja', 'crear_movimiento', 'tienda', 'Registrar ingresos y egresos manuales'),
    ('producto.ver', 'producto', 'ver', 'tienda', 'Ver catalogo interno'),
    ('producto.gestionar', 'producto', 'gestionar', 'tienda', 'Gestionar productos, servicios y combos'),
    ('compra.gestionar', 'compra', 'gestionar', 'tienda', 'Registrar compras y reposicion'),
    ('cliente.gestionar', 'cliente', 'gestionar', 'tienda', 'Gestionar clientes'),
    ('proveedor.gestionar', 'proveedor', 'gestionar', 'tienda', 'Gestionar proveedores'),
    ('haru.usar', 'haru', 'usar', 'tienda', 'Usar Haru IA'),
    ('calculo_precio.usar', 'calculo_precio', 'usar', 'tienda', 'Usar calculadora de precios'),
    ('reporte.ver', 'reporte', 'ver', 'tienda', 'Ver ingresos, gastos y analisis'),
    ('configuracion.gestionar', 'configuracion', 'gestionar', 'tienda', 'Gestionar configuracion de tienda')
) as v(codigo, modulo, accion, alcance, descripcion)
where not exists (
  select 1
  from permiso p
  where p.codigo = v.codigo
);

insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
from rol r
join permiso p on (
  (r.codigo = 'super_admin')
  or (r.codigo = 'soporte' and p.codigo in ('plataforma.tienda.ver', 'plataforma.soporte.acceder', 'plataforma.reporte.ver'))
  or (r.codigo = 'comercial' and p.codigo in ('plataforma.tienda.ver', 'plataforma.tienda.gestionar'))
  or (r.codigo = 'investigador' and p.codigo in ('plataforma.reporte.ver'))
  or (r.codigo = 'propietario' and p.alcance = 'tienda')
  or (r.codigo = 'administrador' and p.codigo in ('pos.vender', 'pos.descuento.aplicar', 'caja.abrir', 'caja.cerrar', 'caja.movimiento.crear', 'producto.ver', 'producto.gestionar', 'compra.gestionar', 'cliente.gestionar', 'proveedor.gestionar', 'haru.usar', 'calculo_precio.usar', 'reporte.ver'))
  or (r.codigo = 'cajero' and p.codigo in ('pos.vender', 'pos.descuento.aplicar', 'caja.abrir', 'caja.cerrar', 'caja.movimiento.crear', 'producto.ver', 'cliente.gestionar'))
  or (r.codigo = 'inventario' and p.codigo in ('producto.ver', 'producto.gestionar', 'compra.gestionar', 'proveedor.gestionar', 'reporte.ver'))
  or (r.codigo = 'consulta' and p.codigo in ('producto.ver', 'reporte.ver', 'haru.usar'))
)
where r.tienda_id is null
on conflict do nothing;



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

