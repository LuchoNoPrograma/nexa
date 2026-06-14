-- migrate:up

-- Personal / turnos / costo laboral estimado.
-- Empleados de la tienda + parámetros de cálculo + planilla semanal de horas.
-- El detalle de las celdas marcadas vive en `empleado_horario.slots` (jsonb).

create table if not exists empleado (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  usuario_id uuid references usuario(id) on delete set null,
  nombre text not null,
  puesto text,
  color text,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nomina_config (
  tienda_id uuid primary key references tienda(id) on delete cascade,
  salario_minimo_mensual numeric(12,2) not null default 3300,
  horas_mensuales_referencia numeric(6,2) not null default 240,
  semanas_por_mes numeric(4,2) not null default 4.33,
  updated_at timestamptz not null default now(),
  check (salario_minimo_mensual >= 0),
  check (horas_mensuales_referencia > 0),
  check (semanas_por_mes > 0)
);

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

alter table caja_sesion
  add column if not exists empleado_id uuid references empleado(id) on delete set null;

create index if not exists empleado_tienda_idx on empleado (tienda_id, activo, orden);
create index if not exists turno_laboral_tienda_idx on turno_laboral (tienda_id, activo);
create index if not exists empleado_horario_tienda_idx on empleado_horario (tienda_id);
create index if not exists empleado_turno_tienda_idx on empleado_turno (tienda_id, empleado_id, activo);

-- migrate:down

alter table caja_sesion drop column if exists empleado_id;
drop table if exists empleado_turno;
drop table if exists empleado_horario;
drop table if exists turno_laboral;
drop table if exists nomina_config;
drop table if exists empleado;
