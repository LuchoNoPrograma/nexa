-- migrate:up

create extension if not exists pgcrypto;

create table if not exists usuario (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  nombre text not null,
  password_hash text not null,
  telefono text,
  ci text,
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
  onboarding_diagnostico text not null default 'pendiente' check (onboarding_diagnostico in ('pendiente', 'completado', 'omitido')),
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
  tipo_costeo text not null default 'reventa' check (tipo_costeo in ('reventa', 'produccion', 'servicio')),
  unidad text not null default 'unidad',
  costo_unitario numeric(12,2) not null default 0,
  precio_venta numeric(12,2) not null default 0,
  stock_actual numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  stock_maximo numeric(12,2),
  margen_minimo numeric(5,2),
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
  usuario_id uuid references usuario(id) on delete set null,
  rubro text,
  canal_venta_principal text,
  nivel_digital text check (nivel_digital in ('bajo', 'medio', 'alto')),
  problema_principal text,
  objetivo_principal text,
  salud_general smallint,
  nivel text check (nivel in ('bajo', 'medio', 'alto')),
  score_ventas smallint,
  score_finanzas smallint,
  score_marketing smallint,
  score_inventario smallint,
  resultado jsonb not null default '{}'::jsonb,
  completado_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===================== Personal / turnos / costo laboral =====================
-- Empleados de la tienda (cajeros u otros); no requieren login.
create table if not exists empleado (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  usuario_id uuid references usuario(id) on delete set null,
  numero integer,
  nombre text not null,
  celular text,
  fecha_nacimiento date,
  direccion text,
  puesto text,
  valor_hora numeric(12,2),
  fecha_alta date default current_date,
  fecha_baja date,
  color text,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valor_hora is null or valor_hora >= 0)
);

-- Parámetros de cálculo de costo laboral estimado por tienda (una fila por tienda).
create table if not exists nomina_config (
  tienda_id uuid primary key references tienda(id) on delete cascade,
  salario_minimo_mensual numeric(12,2) not null default 3300,
  horas_mensuales_referencia numeric(6,2) not null default 207.84,
  semanas_por_mes numeric(4,2) not null default 4.33,
  updated_at timestamptz not null default now(),
  check (salario_minimo_mensual >= 0),
  check (horas_mensuales_referencia > 0),
  check (semanas_por_mes > 0)
);

-- Turnos reutilizables para planificar personal sin convertirlo en nómina legal.
create table if not exists turno_laboral (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  nombre text not null,
  color text,
  slots jsonb not null default '[]'::jsonb,
  horas_semanales numeric(6,2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, nombre),
  check (horas_semanales >= 0)
);

-- Planilla semanal: celdas (día/hora) marcadas por empleado.
create table if not exists empleado_horario (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleado(id) on delete cascade,
  tienda_id uuid not null references tienda(id) on delete cascade,
  slots jsonb not null default '[]'::jsonb,
  horas_semanales numeric(6,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (empleado_id),
  check (horas_semanales >= 0)
);

-- Asignación opcional de turnos reutilizables a trabajadores.
create table if not exists empleado_turno (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  empleado_id uuid not null references empleado(id) on delete cascade,
  turno_id uuid not null references turno_laboral(id) on delete cascade,
  fecha_inicio date,
  fecha_fin date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empleado_id, turno_id, fecha_inicio),
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

-- Atribuir un turno de caja a un empleado-cajero (aunque no tenga login).
alter table caja_sesion
  add column if not exists empleado_id uuid references empleado(id) on delete set null;

create index if not exists empleado_tienda_idx on empleado (tienda_id, activo, orden);
create index if not exists turno_laboral_tienda_idx on turno_laboral (tienda_id, activo);
create index if not exists empleado_horario_tienda_idx on empleado_horario (tienda_id);
create index if not exists empleado_turno_tienda_idx on empleado_turno (tienda_id, empleado_id, activo);

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

create table if not exists marketing_publicacion (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  usuario_id uuid references usuario(id) on delete set null,
  producto_id uuid references producto(id) on delete set null,
  producto_nombre text,
  titulo text not null,
  texto text not null,
  hashtags jsonb not null default '[]'::jsonb,
  idea_video text,
  mejor_hora text,
  audiencia text,
  objetivo text,
  impacto smallint not null default 4 check (impacto between 1 and 5),
  imagen_url text,
  estado text not null default 'sugerida' check (estado in ('sugerida', 'publicada', 'descartada')),
  publicado_at timestamptz,
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

create index if not exists usuario_email_idx on usuario (lower(email)) where email is not null;
create unique index if not exists usuario_telefono_unique on usuario (telefono) where telefono is not null;
create unique index if not exists usuario_ci_unique on usuario (ci) where ci is not null;
create index if not exists tienda_slug_idx on tienda (slug);
create index if not exists tienda_owner_idx on tienda (owner_id);
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
create index if not exists empleado_numero_idx on empleado (tienda_id, numero);
create index if not exists haru_conversacion_tienda_idx on haru_conversacion (tienda_id, estado, last_message_at desc, created_at desc);
create index if not exists haru_mensaje_conversacion_idx on haru_mensaje (conversacion_id, created_at);
create index if not exists haru_chat_config_tienda_idx on haru_chat_config (tienda_id, activo);
create index if not exists contacto_mensaje_estado_idx on contacto_mensaje (estado, created_at desc);
create index if not exists contacto_mensaje_created_at_idx on contacto_mensaje (created_at desc);
create index if not exists marketing_publicacion_tienda_idx on marketing_publicacion (tienda_id, estado, created_at desc);
create index if not exists sesion_token_hash_idx on sesion (token_hash);
create index if not exists sesion_usuario_idx on sesion (usuario_id, expires_at desc);

insert into rol (alcance, codigo, nombre, descripcion, sistema)
select v.alcance, v.codigo, v.nombre, v.descripcion, true
from (
  values
    ('plataforma', 'super_admin', 'Super admin', 'Control total de la plataforma NEXA'),
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

-- migrate:down
