# NEXA - Reglas de proyecto para Codex

Este es el archivo correcto para Codex. No hace falta moverlo a `CLAUDE.md`.
Codex debe leer `AGENTS.md` como contexto operativo antes de implementar cambios.

## 1. Identidad del proyecto

NEXA es un estudio de factibilidad y MVP academico para una plataforma web de asesoramiento empresarial digital dirigida a emprendimientos, microempresas y negocios de Cobija, Bolivia, con proyeccion nacional.

Titulo de trabajo:

> Estudio de factibilidad para la implementacion de una plataforma web de asesoramiento empresarial digital para microempresas en la ciudad de Cobija con proyeccion a nivel nacional.

Problema:

Los negocios de Cobija tienen limitaciones para usar herramientas digitales integrales que fortalezcan su gestion empresarial, comercial y estrategica. Falta una plataforma accesible que integre marketing digital, branding, ecommerce simple, analisis de costos e inteligencia artificial.

Prioridad del MVP:

1. Landing page profesional para explicar el proyecto y sostener la feria.
2. Modulo soporte tipo punto de venta para crear la base operativa.
3. Modulos core: PAM AI y calculadora de precios/rentabilidad.
4. Catalogo publico con pedido por WhatsApp, sin checkout ni pasarela.

## 2. Stack

- Framework: Nuxt + TypeScript.
- UI: PrimeVue + Tailwind CSS.
- Integracion PrimeVue: `@primevue/nuxt-module`.
- Tema PrimeVue: `@primeuix/themes/aura`.
- Tailwind v4: `@tailwindcss/vite` + `tailwindcss-primeui` importado desde CSS.
- Backend/Auth/DB futuro: Supabase con PostgreSQL y RLS.
- IA futura: Gemini desde endpoints `server/api/`; la key nunca va al cliente.
- Deploy futuro: Vercel.

Reglas UI:

- La landing y PAM AI deben verse pulidas.
- El soporte operativo puede usar PrimeVue de forma directa para velocidad.
- Marca base: azul oscuro `#0B1F3A`, amarillo `#F2C200`, blanco, con acentos verdes/celestes para operaciones.
- La primera pantalla debe mostrar NEXA y una senal visual clara del producto.
- Evitar que el proyecto parezca sistema de inventario puro: inventario es soporte, la propuesta es consultoria digital inteligente.

## 3. Alcance funcional

### Landing publica

Debe comunicar:

- Problema de transformacion digital en microempresas de Cobija.
- Justificacion social, economica, tecnica, tecnologica y academica de forma resumida.
- Modulos de NEXA: soporte POS, marketing/branding, calculadora, PAM AI y catalogo WhatsApp.
- Indicadores de la encuesta cuando existan: atraer clientes, branding y calculadora de precios.

### Modulo soporte

Tomar como referencia visual/funcional el POS de la imagen compartida:

- Vender: scanner/busqueda, catalogo rapido, carrito, descuento, cobro.
- Caja: movimientos, apertura/cierre simple.
- Clientes: registro basico.
- Catalogo: productos, stock, precios, visibilidad publica.
- Descuentos: reglas simples o descuento manual.
- Combos: productos compuestos para venta.
- Compras: nueva entrada, historial y proveedores.
- Analisis: reportes e historial de precios/costos.

El soporte existe para generar datos de negocio. No dedicar demasiado tiempo a funciones administrativas complejas.

### Core

- PAM AI: asesor empresarial en espanol, practico, contextualizado en Cobija y por rubro.
- Calculadora: costo unitario + costos fijos prorrateados + margen deseado = precio recomendado.
- Mostrar desglose, no solo el precio final.

### Traccion

- Catalogo publico por `tiendas.slug`.
- Productos visibles con boton de pedido por WhatsApp.
- Sin pasarela de pago real.

## 4. Modelo de base de datos recomendado

Usar una sola base PostgreSQL multi-tenant:

- `tiendas` representa el negocio.
- `profiles` vincula usuario Supabase Auth con tienda.
- Cada tabla privada de negocio lleva `tienda_id`.
- RLS filtra por `current_tienda_id()`.
- No crear una base por tienda.

### Esquema simplificado

```sql
create table tiendas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  nombre text not null,
  rubro text,
  ciudad text default 'Cobija',
  telefono_whatsapp text,
  slug text unique,
  logo_url text,
  color_primario text default '#0B1F3A',
  plan text default 'free',
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tienda_id uuid references tiendas(id) on delete cascade,
  nombre text,
  rol text default 'owner',
  created_at timestamptz default now()
);

create or replace function current_tienda_id()
returns uuid language sql stable as $$
  select tienda_id from profiles where id = auth.uid();
$$;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  nombre text not null,
  telefono text,
  notas text,
  created_at timestamptz default now()
);

create table proveedores (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  nombre text not null,
  telefono text,
  notas text,
  created_at timestamptz default now()
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  nombre text not null,
  created_at timestamptz default now()
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  categoria_id uuid references categorias(id) on delete set null,
  sku text,
  codigo_barras text,
  nombre text not null,
  tipo text default 'producto' check (tipo in ('producto', 'servicio', 'combo')),
  costo numeric(12,2) default 0,
  precio numeric(12,2) default 0,
  stock integer default 0,
  stock_minimo integer default 0,
  imagen_url text,
  visible_catalogo boolean default false,
  activo boolean default true,
  created_at timestamptz default now(),
  unique (tienda_id, sku),
  unique (tienda_id, codigo_barras)
);

create table combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references productos(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  cantidad integer not null default 1
);

create table ventas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  estado text default 'pagada' check (estado in ('cotizacion', 'pagada', 'anulada')),
  fecha timestamptz default now(),
  subtotal numeric(12,2) default 0,
  descuento numeric(12,2) default 0,
  total numeric(12,2) default 0,
  metodo_pago text,
  notas text,
  created_at timestamptz default now()
);

create table venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  nombre_producto text not null,
  cantidad integer not null default 1,
  costo_unitario numeric(12,2) default 0,
  precio_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

create table compras (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  proveedor_id uuid references proveedores(id) on delete set null,
  fecha date default current_date,
  total numeric(12,2) default 0,
  notas text,
  created_at timestamptz default now()
);

create table compra_items (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  cantidad integer not null default 1,
  costo_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

create table caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  venta_id uuid references ventas(id) on delete set null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  concepto text not null,
  monto numeric(12,2) not null default 0,
  metodo_pago text,
  created_at timestamptz default now()
);

create table precio_historial (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  producto_id uuid references productos(id) on delete cascade,
  costo_anterior numeric(12,2),
  costo_nuevo numeric(12,2),
  precio_anterior numeric(12,2),
  precio_nuevo numeric(12,2),
  motivo text,
  created_at timestamptz default now()
);

create table calculos_precio (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  nombre_producto text,
  costo_unitario numeric(12,2) default 0,
  costos_fijos numeric(12,2) default 0,
  margen_deseado numeric(5,2) default 0,
  precio_recomendado numeric(12,2) default 0,
  created_at timestamptz default now()
);

create table pam_conversaciones (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tiendas(id) on delete cascade,
  titulo text default 'Nueva conversacion',
  created_at timestamptz default now()
);

create table pam_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references pam_conversaciones(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant')),
  contenido text not null,
  created_at timestamptz default now()
);
```

### RLS base

```sql
alter table tiendas enable row level security;
alter table profiles enable row level security;
alter table clientes enable row level security;
alter table proveedores enable row level security;
alter table categorias enable row level security;
alter table productos enable row level security;
alter table combo_items enable row level security;
alter table ventas enable row level security;
alter table venta_items enable row level security;
alter table compras enable row level security;
alter table compra_items enable row level security;
alter table caja_movimientos enable row level security;
alter table precio_historial enable row level security;
alter table calculos_precio enable row level security;
alter table pam_conversaciones enable row level security;
alter table pam_mensajes enable row level security;

create policy "perfil propio" on profiles for all using (id = auth.uid());
create policy "tienda propia" on tiendas for all using (id = current_tienda_id() or owner_id = auth.uid());

-- Aplicar este patron a tablas con tienda_id:
-- for all using (tienda_id = current_tienda_id())

-- Tablas hijas sin tienda_id directo deben aislarse por su padre:
-- venta_items -> ventas
-- compra_items -> compras
-- combo_items -> productos del combo
-- pam_mensajes -> pam_conversaciones

create policy "catalogo publico" on productos
  for select using (visible_catalogo = true and activo = true);
```

No crear tablas separadas para cotizaciones si no es necesario: usar `ventas.estado = 'cotizacion'`.
No crear tabla de descuentos al inicio: descuento manual en `ventas.descuento` basta para la demo.

## 5. Reglas de implementacion

- Mantener nombres visibles en espanol.
- DB en `snake_case`; TypeScript en `camelCase`.
- No exponer claves privadas en cliente.
- Preferir componentes PrimeVue en formularios, tablas, dialogs y botones operativos.
- Usar Tailwind para layout, landing, espaciado y composicion visual.
- En soporte, priorizar flujo usable sobre perfeccion visual.
- En landing y PAM AI, priorizar claridad, impacto y acabado profesional.
- Antes de ampliar la BD, verificar si una columna o estado resuelve el caso de forma mas simple.

## 6. Fuera de alcance del MVP

- Facturacion legal.
- Pasarela de pago real.
- Multi-sucursal avanzada.
- Contabilidad completa.
- Seguridad empresarial avanzada.
- Integraciones externas complejas.
- Inventario como producto principal.
