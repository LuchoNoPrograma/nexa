# Modelo de base de datos IMPULSA

## Criterios de diseño

- Base única PostgreSQL multi-tenant.
- Todas las tablas se nombran en singular y en `snake_case`.
- `tienda` representa cada negocio o microempresa.
- Las tablas privadas del negocio llevan `tienda_id` para aplicar RLS.
- El POS es soporte operativo para generar datos; no es el producto principal.
- Haru IA, calculadora, catálogo público y análisis de rentabilidad son el núcleo del MVP.
- No se modela facturación legal, pasarela de pago, contabilidad completa ni multisucursal avanzada.
- Se prefiere resolver casos simples con columnas/estados antes de crear tablas adicionales.

## Núcleo multi-tenant

### `usuario`

Representa el perfil interno de una cuenta autenticada. La autenticación la maneja Supabase en `auth.users`; esta tabla guarda los datos operativos que IMPULSA sí gestiona desde la base de datos.

Campos:

- `id uuid pk`
- `email text`
- `nombre text`
- `telefono text`
- `avatar_url text`
- `estado text default 'activo' check ('invitado', 'activo', 'bloqueado')`
- `ultimo_acceso_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `tienda`

Representa el negocio cliente de IMPULSA.

Campos:

- `id uuid pk`
- `owner_id uuid` referencia a `usuario(id)`
- `nombre text not null`
- `slug text unique not null`
- `rubro text`
- `descripcion text`
- `ciudad text default 'Cobija'`
- `departamento text default 'Pando'`
- `pais text default 'Bolivia'`
- `telefono_whatsapp text`
- `logo_url text`
- `color_primario text default '#0B1F3A'`
- `plan text default 'free' check ('free', 'pro', 'demo')`
- `activo boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `tienda_usuario`

Vincula usuarios con tiendas. Sirve para saber qué usuarios pertenecen a una tienda, aunque sus permisos reales se definan por roles.

Campos:

- `id uuid pk`
- `tienda_id uuid not null` referencia a `tienda(id)`
- `usuario_id uuid not null` referencia a `usuario(id)`
- `cargo text`
- `estado text default 'activo' check ('invitado', 'activo', 'suspendido')`
- `invitado_por_id uuid null` referencia a `usuario(id)`
- `joined_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Restricción: `unique (tienda_id, usuario_id)`.

## Usuarios, roles y permisos

El modelo separa dos alcances:

- `plataforma`: roles de la startup IMPULSA para administrar tiendas, planes, soporte y operación interna.
- `tienda`: roles del negocio cliente para usar POS, caja, inventario, catálogo, Haru y reportes.

### `rol`

Rol asignable a un usuario. Puede ser un rol de plataforma o un rol de una tienda específica.

Campos:

- `id uuid pk`
- `tienda_id uuid null` referencia a `tienda(id)`
- `alcance text not null check ('plataforma', 'tienda')`
- `codigo text not null`
- `nombre text not null`
- `descripcion text`
- `sistema boolean default false`
- `activo boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Reglas:

- Si `alcance = 'plataforma'`, `tienda_id` debe ser `null`.
- Si `alcance = 'tienda'`, `tienda_id` puede ser `null` para roles plantilla o tener valor para roles personalizados de una tienda.
- `sistema = true` protege roles base contra borrado accidental.

Roles base sugeridos:

- Plataforma: `super_admin`, `soporte`, `comercial`, `investigador`.
- Tienda: `propietario`, `administrador`, `cajero`, `inventario`, `consulta`.

### `permiso`

Catálogo de permisos disponibles en la aplicación.

Campos:

- `id uuid pk`
- `codigo text unique not null`
- `modulo text not null`
- `accion text not null`
- `alcance text not null check ('plataforma', 'tienda')`
- `descripcion text`
- `activo boolean default true`
- `created_at timestamptz default now()`

Permisos base sugeridos:

- Plataforma: `plataforma.tienda.ver`, `plataforma.tienda.gestionar`, `plataforma.usuario.gestionar`, `plataforma.soporte.acceder`, `plataforma.reporte.ver`.
- Tienda/POS: `pos.vender`, `pos.descuento.aplicar`, `caja.abrir`, `caja.cerrar`, `caja.movimiento.crear`.
- Tienda/operación: `producto.ver`, `producto.gestionar`, `compra.gestionar`, `cliente.gestionar`, `proveedor.gestionar`.
- Tienda/core: `haru.usar`, `calculo_precio.usar`, `reporte.ver`, `configuracion.gestionar`.

### `rol_permiso`

Relación entre roles y permisos.

Campos:

- `id uuid pk`
- `rol_id uuid not null` referencia a `rol(id)`
- `permiso_id uuid not null` referencia a `permiso(id)`
- `created_at timestamptz default now()`

Restricción: `unique (rol_id, permiso_id)`.

### `usuario_rol`

Asignación de roles a usuarios. Permite que un usuario sea administrador de plataforma y también miembro de una tienda, sin duplicar cuentas.

Campos:

- `id uuid pk`
- `usuario_id uuid not null` referencia a `usuario(id)`
- `rol_id uuid not null` referencia a `rol(id)`
- `tienda_id uuid null` referencia a `tienda(id)`
- `asignado_por_id uuid null` referencia a `usuario(id)`
- `created_at timestamptz default now()`

Reglas:

- Para roles de plataforma, `tienda_id` debe ser `null`.
- Para roles de tienda, `tienda_id` debe tener valor.
- Un rol de tienda solo debe asignarse si existe una fila activa en `tienda_usuario`.
- Restricción: `unique (usuario_id, rol_id, tienda_id)`.

## Catálogo y operación comercial

### `categoria`

Agrupa productos/servicios por tienda.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `nombre text not null`
- `descripcion text`
- `icono text`
- `orden integer default 0`
- `activo boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Restricción: `unique (tienda_id, nombre)`.

### `producto`

Producto, servicio o combo vendido por el negocio.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `categoria_id uuid null`
- `sku text`
- `codigo_barras text`
- `nombre text not null`
- `descripcion text`
- `tipo text default 'producto' check ('producto', 'servicio', 'combo')`
- `unidad text default 'unidad'`
- `costo_unitario numeric(12,2) default 0`
- `precio_venta numeric(12,2) default 0`
- `stock_actual numeric(12,2) default 0`
- `stock_minimo numeric(12,2) default 0`
- `precio_variable boolean default false`
- `orden_catalogo integer default 0`
- `imagen_url text`
- `visible_catalogo boolean default false`
- `visible_pos boolean default true`
- `activo boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Restricciones:

- `unique (tienda_id, sku)` cuando `sku is not null`
- `unique (tienda_id, codigo_barras)` cuando `codigo_barras is not null`

### `combo_componente`

Composición de productos cuando `producto.tipo = 'combo'`. Se usa “componente” en vez de “item” para mantener el modelo en español y describir mejor que cada fila es un producto que forma parte del combo.

Campos:

- `id uuid pk`
- `combo_id uuid not null` referencia a `producto(id)`
- `producto_id uuid not null` referencia a `producto(id)`
- `cantidad numeric(12,2) not null default 1`
- `created_at timestamptz default now()`

Restricción: `unique (combo_id, producto_id)`.

### `cliente`

Registro básico para ventas, historial y pedidos.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `nombre text not null`
- `telefono text`
- `email text`
- `notas text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `proveedor`

Fuente de compras y reposición.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `nombre text not null`
- `telefono text`
- `email text`
- `notas text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

## POS, compras y caja

### Sobre el carrito del POS

El carrito que se ve en la interfaz del POS normalmente no necesita tabla propia para el MVP. Mientras el usuario está vendiendo, el carrito puede vivir como estado del frontend. Cuando se cobra, se persiste como:

- `venta`: cabecera de la operación.
- `venta_item`: líneas vendidas.
- `pago`: uno o varios cobros asociados a la venta.
- `caja_movimiento`: impacto confirmado en caja o cuenta.
- `inventario_movimiento`: salida de inventario cuando aplica.

Solo convendría una tabla `carrito` si se quisieran guardar carritos abandonados, ventas suspendidas, sincronización offline o múltiples cajas trabajando sobre borradores compartidos. Eso queda fuera del MVP.

### `venta`

Venta comercial. No es lo mismo que ingreso: una venta puede estar pendiente, parcialmente pagada o pagada con varios pagos.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `cliente_id uuid null`
- `numero text`
- `caja_sesion_id uuid null`
- `canal text default 'pos' check ('pos', 'catalogo_whatsapp', 'manual')`
- `estado text default 'pendiente' check ('cotizacion', 'pendiente', 'parcial', 'pagada', 'anulada')`
- `fecha timestamptz default now()`
- `subtotal numeric(12,2) default 0`
- `descuento numeric(12,2) default 0`
- `total numeric(12,2) default 0`
- `notas text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Restricción: `unique (tienda_id, numero)` cuando `numero is not null`.

### `venta_item`

Línea de una venta. Cada fila congela el producto, servicio o combo vendido, con precio y costo del momento para que el histórico no cambie cuando se edite el catálogo.

Campos:

- `id uuid pk`
- `venta_id uuid not null`
- `producto_id uuid null`
- `producto_variante_id uuid null`
- `nombre_producto text not null`
- `tipo_producto text check ('producto', 'servicio', 'combo')`
- `cantidad numeric(12,2) not null default 1`
- `costo_unitario numeric(12,2) default 0`
- `precio_unitario numeric(12,2) not null default 0`
- `descuento numeric(12,2) default 0`
- `subtotal numeric(12,2) not null default 0`
- `created_at timestamptz default now()`

### `pago`

Pago recibido o realizado. Permite cuotas, pagos mixtos y pagos pendientes. Una venta de Bs. 1.000 puede tener tres pagos: efectivo, QR y transferencia.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `venta_id uuid null`
- `compra_id uuid null`
- `caja_sesion_id uuid null`
- `cliente_id uuid null`
- `proveedor_id uuid null`
- `usuario_id uuid null`
- `tipo text check ('ingreso', 'egreso')`
- `metodo text check ('efectivo', 'qr', 'transferencia', 'tarjeta', 'otro')`
- `estado text default 'confirmado' check ('pendiente', 'confirmado', 'anulado')`
- `monto numeric(12,2) default 0`
- `referencia text`
- `fecha timestamptz default now()`
- `fecha_vencimiento date`
- `notas text`

Regla operativa:

- Pago confirmado de venta genera `caja_movimiento` tipo `ingreso`.
- Pago confirmado de compra o gasto genera `caja_movimiento` tipo `egreso`.
- Pago pendiente no afecta caja hasta confirmarse.

### `caja_sesion`

Apertura y cierre simple de caja para el flujo POS.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `usuario_id uuid null`
- `estado text default 'abierta' check ('abierta', 'cerrada')`
- `saldo_inicial numeric(12,2) default 0`
- `saldo_esperado numeric(12,2) default 0`
- `saldo_contado numeric(12,2)`
- `diferencia numeric(12,2)`
- `abierta_at timestamptz default now()`
- `cerrada_at timestamptz`
- `notas text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Fórmula:

```text
saldo_esperado = saldo_inicial + ingresos_confirmados - egresos_confirmados
diferencia = saldo_contado - saldo_esperado
```

### `compra`

Entrada de productos, costos y proveedores.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `proveedor_id uuid null`
- `usuario_id uuid null`
- `numero text`
- `estado text default 'recibida' check ('borrador', 'recibida', 'anulada')`
- `estado_pago text default 'pendiente' check ('pendiente', 'parcial', 'pagada')`
- `subtotal numeric(12,2) default 0`
- `descuento numeric(12,2) default 0`
- `fecha date default current_date`
- `total numeric(12,2) default 0`
- `notas text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `compra_item`

Línea de detalle de una compra. Cada fila representa un producto recibido y su costo al momento de la entrada.

Campos:

- `id uuid pk`
- `compra_id uuid not null`
- `producto_id uuid null`
- `producto_variante_id uuid null`
- `nombre_producto text not null`
- `cantidad numeric(12,2) not null default 1`
- `costo_unitario numeric(12,2) not null default 0`
- `subtotal numeric(12,2) not null default 0`
- `created_at timestamptz default now()`

### `caja_movimiento`

Movimiento simple de caja. No cubre contabilidad completa; sirve para turnos, ingresos, egresos, gastos y conciliación.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `caja_sesion_id uuid null`
- `pago_id uuid null`
- `venta_id uuid null`
- `compra_id uuid null`
- `usuario_id uuid null`
- `proveedor_id uuid null`
- `cliente_id uuid null`
- `tipo text not null check ('ingreso', 'egreso')`
- `categoria text default 'otro'`
- `concepto text not null`
- `monto numeric(12,2) not null default 0`
- `metodo text check ('efectivo', 'qr', 'transferencia', 'tarjeta', 'otro')`
- `estado text default 'confirmado' check ('pendiente', 'confirmado', 'anulado')`
- `fecha timestamptz default now()`
- `created_at timestamptz default now()`

### `inventario_ajuste`

Ajuste manual compatible con la pantalla actual de stock. Sirve para recuentos, daños, devoluciones y correcciones.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `producto_id uuid not null`
- `producto_variante_id uuid null`
- `usuario_id uuid null`
- `tipo text check ('sumar', 'restar', 'fijar')`
- `motivo text check ('compra_recibida', 'venta', 'producto_daniado', 'devolucion', 'recuento', 'traslado', 'otro')`
- `sucursal text default 'Matriz'`
- `cantidad numeric(12,2) default 0`
- `stock_anterior numeric(12,2) default 0`
- `stock_nuevo numeric(12,2) default 0`
- `notas text`
- `created_at timestamptz default now()`

### `inventario_movimiento`

Kardex simple para ventas, compras, devoluciones y ajustes. Es el histórico analítico de inventario.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `producto_id uuid not null`
- `tipo text not null check ('entrada', 'salida', 'ajuste')`
- `producto_variante_id uuid null`
- `usuario_id uuid null`
- `venta_id uuid null`
- `compra_id uuid null`
- `ajuste_id uuid null`
- `origen text not null check ('venta', 'compra', 'manual', 'devolucion')`
- `cantidad numeric(12,2) not null`
- `stock_anterior numeric(12,2)`
- `stock_nuevo numeric(12,2)`
- `costo_unitario numeric(12,2)`
- `notas text`
- `created_at timestamptz default now()`

## Precio, rentabilidad y análisis

### `precio_historial`

Historial de cambios de costo/precio.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `producto_id uuid not null`
- `costo_anterior numeric(12,2)`
- `costo_nuevo numeric(12,2)`
- `precio_anterior numeric(12,2)`
- `precio_nuevo numeric(12,2)`
- `motivo text`
- `created_at timestamptz default now()`

### `calculo_precio`

Resultado guardado de la calculadora de rentabilidad.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `producto_id uuid null`
- `nombre_producto text`
- `costo_unitario numeric(12,2) default 0`
- `costo_fijo_prorrateado numeric(12,2) default 0`
- `otros_costos numeric(12,2) default 0`
- `margen_deseado numeric(5,2) default 0`
- `precio_recomendado numeric(12,2) default 0`
- `ganancia_estimada numeric(12,2) default 0`
- `notas text`
- `created_at timestamptz default now()`

### `diagnostico`

Diagnóstico empresarial breve para alimentar recomendaciones de Haru IA.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `rubro text`
- `canal_venta_principal text`
- `nivel_digital text check ('bajo', 'medio', 'alto')`
- `problema_principal text`
- `objetivo_principal text`
- `resultado jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`

## Haru IA

### `haru_conversacion`

Agrupa conversaciones con Haru. Permite retomar una sesion de chat sin perder el historial.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `usuario_id uuid null`
- `titulo text default 'Nueva conversación'`
- `contexto jsonb default '{}'::jsonb`
- `origen text default 'burbuja_chat'`
- `estado text default 'abierta' check ('abierta', 'cerrada', 'archivada')`
- `last_message_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `haru_mensaje`

Mensaje de usuario o respuesta de Haru.

Campos:

- `id uuid pk`
- `conversacion_id uuid not null`
- `rol text not null check ('user', 'assistant', 'system')`
- `contenido text not null`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`

### `haru_chat_config`

Configuracion por tienda de la burbuja de chat.

Campos:

- `id uuid pk`
- `tienda_id uuid not null`
- `nombre_asistente text default 'Haru IA'`
- `saludo text`
- `avatar_url text default '/haru-chat.png'`
- `prompts jsonb`
- `activo boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

## Catálogo público y tracción

El catálogo público no requiere una tabla separada al inicio. Se resuelve con:

- `tienda.slug`
- `producto.visible_catalogo`
- `producto.activo`
- `tienda.telefono_whatsapp`

Ruta sugerida: `/tienda/[slug]`.

## Reportes de ingresos y gastos

Los submódulos visuales de ingresos y gastos no necesitan tablas principales propias en el MVP. Se calculan desde operaciones reales:

- Ingresos confirmados: `pago.tipo = 'ingreso' and pago.estado = 'confirmado'` más `caja_movimiento.tipo = 'ingreso'` para registros manuales sin venta.
- Cobros pendientes: `pago.tipo = 'ingreso' and pago.estado = 'pendiente'` o ventas con `estado in ('pendiente', 'parcial')`.
- Gastos confirmados: `caja_movimiento.tipo = 'egreso' and estado = 'confirmado'`.
- Pagos por pagar: `pago.tipo = 'egreso' and pago.estado = 'pendiente'` o compras con `estado_pago in ('pendiente', 'parcial')`.
- Top clientes: ventas/pagos agrupados por `cliente_id`.
- Top proveedores: compras, pagos o egresos agrupados por `proveedor_id`.
- Categorías de gasto: `caja_movimiento.categoria`.

Regla de diseño: `venta.total` documenta la operación comercial, `pago.monto` documenta el cobro o pago, y `caja_movimiento.monto` documenta el impacto en caja/cuenta. Los reportes se calculan desde esas fuentes, no desde tablas duplicadas de `ingreso` o `gasto`.

## RLS recomendado

Función base para pertenencia a tienda:

```sql
create or replace function is_miembro_tienda(tienda_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from tienda_usuario tu
    where tu.tienda_id = tienda_uuid
      and tu.usuario_id = auth.uid()
      and tu.estado = 'activo'
  );
$$;
```

Política base:

- `usuario`: el usuario ve su propio perfil; administradores de plataforma pueden gestionar usuarios.
- `tienda_usuario`: miembros activos ven su membresía; administradores de tienda pueden gestionar miembros.
- `tienda`: visible si `owner_id = auth.uid()` o `is_miembro_tienda(id)`.
- Tablas con `tienda_id`: `using (is_miembro_tienda(tienda_id))`.
- Tablas hijas sin `tienda_id` se aíslan por su padre.
- Catálogo público: permitir `select` de `producto` activo y visible, unido a `tienda` activa.
- Roles de plataforma: solo usuarios con permiso `plataforma.usuario.gestionar` o `plataforma.tienda.gestionar`.
- Roles de tienda: solo usuarios con permiso `configuracion.gestionar` dentro de su tienda.

Funciones auxiliares recomendadas:

```sql
create or replace function has_permiso(permiso_codigo text, tienda_uuid uuid default null)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from usuario_rol ur
    join rol r on r.id = ur.rol_id and r.activo = true
    join rol_permiso rp on rp.rol_id = r.id
    join permiso p on p.id = rp.permiso_id and p.activo = true
    where ur.usuario_id = auth.uid()
      and p.codigo = permiso_codigo
      and (
        (r.alcance = 'plataforma' and ur.tienda_id is null)
        or
        (r.alcance = 'tienda' and ur.tienda_id = tienda_uuid)
      )
  );
$$;
```

## Índices mínimos

- `tienda(slug)`
- `usuario(email)`
- `tienda_usuario(tienda_id, usuario_id)`
- `rol(tienda_id, alcance, codigo)`
- `permiso(codigo)`
- `rol_permiso(rol_id, permiso_id)`
- `usuario_rol(usuario_id, tienda_id)`
- `categoria(tienda_id, orden)`
- `producto(tienda_id, nombre)`
- `producto(tienda_id, visible_pos, activo, orden_catalogo)`
- `producto(tienda_id, visible_catalogo, activo)`
- `venta(tienda_id, fecha desc)`
- `compra(tienda_id, fecha desc)`
- `caja_sesion(tienda_id, estado, abierta_at desc)`
- `caja_movimiento(tienda_id, fecha desc)`
- `inventario_ajuste(tienda_id, created_at desc)`
- `inventario_ajuste(producto_id, created_at desc)`
- `inventario_movimiento(tienda_id, created_at desc)`
- `inventario_movimiento(producto_id, created_at desc)`
- `haru_conversacion(tienda_id, estado, last_message_at desc, created_at desc)`
- `haru_mensaje(conversacion_id, created_at)`
- `haru_chat_config(tienda_id, activo)`

## Resumen técnico

El modelo se organiza alrededor de `tienda` como unidad tenant. `usuario` extiende la cuenta operativa del sistema, `tienda_usuario` define pertenencia a negocios, y `rol` + `permiso` + `rol_permiso` + `usuario_rol` permiten administrar accesos tanto para la startup IMPULSA como para cada tienda. El módulo POS genera ventas, pagos, compras, movimientos de inventario y caja, pero se mantiene acotado. El carrito del POS se maneja en la interfaz y se convierte en `venta` + `venta_item` al cobrar. Los mockups de ingresos y gastos son reportes calculados desde `pago` y `caja_movimiento`, no módulos contables duplicados. La calculadora y Haru IA tienen tablas propias porque son parte de la propuesta de valor de IMPULSA. El catálogo público se resuelve con columnas en `tienda` y `producto`, evitando complejidad prematura. El diseño usa PostgreSQL, UUID, auditoría temporal básica y datos históricos congelados en líneas de venta/compra para análisis posterior.
