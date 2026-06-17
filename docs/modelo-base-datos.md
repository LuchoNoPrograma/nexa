# Modelo tecnico de base de datos NEXA

Este documento describe el modelo vigente del MVP. La fuente de verdad para
crear o actualizar la base es `database/local/*`, ejecutada con `dbmate` desde
`npm run db:migrate`.

## Decision de arquitectura

- Base unica PostgreSQL multi-tenant.
- Supabase puede usarse como PostgreSQL gestionado, no como Auth/RLS.
- La autenticacion del MVP vive en la app: `usuario.password_hash` y `sesion`.
- El aislamiento por tienda se aplica en endpoints server usando la sesion
  activa y `session.storeId`.
- Cuando se migre a Supabase Auth/RLS, se debe crear una migracion nueva y
  explicita; no mezclarla con el flujo actual.

## Fuente de verdad

Archivos vigentes:

- `database/local/001_initial.sql`: modelo base consolidado para el MVP.
- `database/local/002_catalog_templates.sql`: plantillas de catalogo por rubro.
- `database/reset.sql`: utilitario destructivo para limpiar local antes de
  volver a correr migraciones.
- `database/demo_abarrotes_seed.sql`: seed manual opcional para la tienda demo.

## Criterios de diseno

- Tablas en singular y `snake_case`.
- TypeScript en `camelCase`.
- `tienda` es la unidad tenant.
- Toda tabla privada de negocio lleva `tienda_id`, salvo tablas hijas que se
  aislan por su padre.
- El POS es soporte operativo para generar datos, no el producto principal.
- Haru IA, calculadora, catalogo publico y analisis son el nucleo del MVP.
- No crear tablas contables paralelas si `venta`, `pago` y `caja_movimiento`
  cubren el caso.
- No modelar facturacion legal, pasarela, contabilidad completa ni
  multisucursal avanzada en el MVP.

## Nucleo multi-tenant

### `usuario`

Cuenta operativa del MVP.

Campos clave:

- `id`
- `email`
- `nombre`
- `password_hash`
- `telefono`
- `ci`
- `estado`
- `ultimo_acceso_at`
- timestamps

Reglas:

- `email` puede ser null para registro publico por celular.
- `telefono` tiene indice unico parcial cuando no es null.
- La contrasena nunca se guarda en claro.

### `sesion`

Sesion HTTP propia de la app.

Campos clave:

- `usuario_id`
- `token_hash`
- `user_agent`
- `ip`
- `expires_at`
- `revoked_at`
- `last_seen_at`

Reglas:

- El token real vive en cookie HTTP only.
- La base solo guarda `token_hash`.

### `tienda`

Negocio o microempresa cliente.

Campos clave:

- `owner_id`
- `nombre`
- `slug`
- `rubro`
- `descripcion`
- `ciudad`, `departamento`, `pais`
- `telefono_whatsapp`
- `color_primario`
- `margen_default`
- `plan`
- `onboarding_diagnostico`
- `activo`

Reglas:

- `slug` identifica catalogo publico.
- `telefono_whatsapp` se usa para pedidos por WhatsApp.
- `onboarding_diagnostico` controla el primer diagnostico.

### `tienda_usuario`

Membresia de usuarios en tiendas.

Campos clave:

- `tienda_id`
- `usuario_id`
- `cargo`
- `estado`
- `joined_at`

Regla: `unique (tienda_id, usuario_id)`.

## Roles y permisos

### `rol`

Define roles de plataforma o tienda.

Alcances:

- `plataforma`: administracion de NEXA.
- `tienda`: operacion del negocio.

Roles base:

- Plataforma: `super_admin`, `soporte`, `comercial`, `investigador`.
- Tienda: `propietario`, `administrador`, `cajero`, `inventario`, `consulta`.

### `permiso`, `rol_permiso`, `usuario_rol`

Modelo RBAC simple.

Reglas:

- `permiso.codigo` es unico.
- `usuario_rol.tienda_id = null` para roles de plataforma.
- `usuario_rol.tienda_id` con valor para roles de tienda.
- El backend calcula permisos efectivos desde la sesion activa.

## Catalogo

### `categoria`

Agrupa productos, servicios y combos por tienda.

Campos clave:

- `tienda_id`
- `nombre`
- `descripcion`
- `icono`
- `orden`
- `activo`

Regla: `unique (tienda_id, nombre)`.

### `producto`

Unidad vendible: producto fisico, servicio o combo.

Campos clave:

- `tienda_id`
- `categoria_id`
- `sku`
- `codigo_barras`
- `nombre`
- `descripcion`
- `tipo`: `producto`, `servicio`, `combo`
- `tipo_costeo`: `reventa`, `produccion`, `servicio`
- `unidad`
- `costo_unitario`
- `precio_venta`
- `stock_actual`
- `stock_minimo`
- `stock_maximo`
- `margen_minimo`
- `orden_catalogo`
- `imagen_url`
- `icono`
- `visible_catalogo`
- `visible_pos`
- `activo`

Reglas:

- `visible_pos` controla si aparece en venta interna.
- `visible_catalogo` queda para catalogo publico.
- `sku` y `codigo_barras` son unicos por tienda cuando existen.

### `producto_variante`

Variantes simples de un producto.

Campos clave:

- `producto_id`
- `nombre`
- `sku`
- `codigo_barras`
- `costo_unitario`
- `precio_venta`
- `stock_actual`
- `orden`
- `activo`

### `combo_item`

Composicion de combos.

Campos clave:

- `combo_id`
- `producto_id`
- `cantidad`

Reglas:

- `unique (combo_id, producto_id)`.
- `combo_id <> producto_id`.

## POS, ventas, pagos y caja

### `caja_sesion`

Apertura y cierre de caja.

Campos clave:

- `tienda_id`
- `usuario_id`
- `empleado_id`
- `estado`: `abierta`, `cerrada`
- `saldo_inicial`
- `saldo_esperado`
- `saldo_contado`
- `diferencia`
- `abierta_at`
- `cerrada_at`

Regla: solo una caja abierta por tienda.

### `venta`

Documento comercial.

Campos clave:

- `tienda_id`
- `cliente_id`
- `usuario_id`
- `caja_sesion_id`
- `numero`
- `canal`: `pos`, `catalogo_whatsapp`, `manual`
- `estado`: `cotizacion`, `pendiente`, `parcial`, `pagada`, `anulada`
- `subtotal`
- `descuento`
- `total`
- `fecha`
- `fecha_vencimiento`

Regla: `venta.total` representa la operacion comercial, no necesariamente dinero
cobrado.

### `venta_item`

Lineas congeladas de venta.

Campos clave:

- `venta_id`
- `producto_id`
- `producto_variante_id`
- `nombre_producto`
- `tipo_producto`
- `cantidad`
- `costo_unitario`
- `precio_unitario`
- `descuento`
- `subtotal`

### `pago`

Dinero cobrado o pagado.

Campos clave:

- `tienda_id`
- `venta_id`
- `compra_id`
- `caja_sesion_id`
- `cliente_id`
- `proveedor_id`
- `usuario_id`
- `tipo`: `ingreso`, `egreso`
- `metodo`: `efectivo`, `qr`, `transferencia`, `tarjeta`, `otro`
- `estado`: `pendiente`, `confirmado`, `anulado`
- `monto`
- `referencia`
- `fecha`
- `fecha_vencimiento`

Regla: los reportes financieros parten de `pago` y `caja_movimiento`.

### `caja_movimiento`

Impacto real en caja o cuenta.

Campos clave:

- `tienda_id`
- `caja_sesion_id`
- `pago_id`
- `venta_id`
- `compra_id`
- `usuario_id`
- `proveedor_id`
- `cliente_id`
- `tipo`
- `categoria`
- `concepto`
- `metodo`
- `monto`
- `estado`
- `fecha`

Regla: no crear tablas `ingreso` o `gasto`; se calculan desde esta tabla y
`pago`.

## Compras e inventario

### `compra`

Entrada de productos y costos.

Campos clave:

- `tienda_id`
- `proveedor_id`
- `usuario_id`
- `numero`
- `estado`: `borrador`, `recibida`, `anulada`
- `estado_pago`: `pendiente`, `parcial`, `pagada`
- `subtotal`
- `descuento`
- `total`
- `fecha`

### `compra_item`

Detalle congelado de compra.

Campos clave:

- `compra_id`
- `producto_id`
- `producto_variante_id`
- `nombre_producto`
- `cantidad`
- `costo_unitario`
- `subtotal`

### `inventario_ajuste`

Ajuste manual o tecnico de stock.

Campos clave:

- `tienda_id`
- `producto_id`
- `producto_variante_id`
- `usuario_id`
- `tipo`: `sumar`, `restar`, `fijar`
- `motivo`
- `sucursal`
- `cantidad`
- `stock_anterior`
- `stock_nuevo`

### `inventario_movimiento`

Kardex simple.

Campos clave:

- `tienda_id`
- `producto_id`
- `producto_variante_id`
- `usuario_id`
- `venta_id`
- `compra_id`
- `ajuste_id`
- `tipo`: `entrada`, `salida`, `ajuste`
- `origen`: `venta`, `compra`, `manual`, `devolucion`
- `cantidad`
- `stock_anterior`
- `stock_nuevo`
- `costo_unitario`

## Precio, diagnostico y Haru IA

### `precio_historial`

Historial de cambios de costo/precio.

### `calculo_precio`

Resultado guardado de calculadora de rentabilidad.

Campos clave:

- `costo_unitario`
- `costo_fijo_prorrateado`
- `otros_costos`
- `margen_deseado`
- `precio_recomendado`
- `ganancia_estimada`

### `diagnostico`

Diagnostico empresarial inicial.

Campos clave:

- `tienda_id`
- `usuario_id`
- `rubro`
- `canal_venta_principal`
- `problema_principal`
- `objetivo_principal`
- scores por area
- `resultado`
- `completado_at`

### `haru_conversacion`, `haru_mensaje`, `haru_chat_config`

Persisten historial, resumen/contexto y configuracion de Haru IA por tienda.

Reglas:

- `haru_mensaje` cuelga de `haru_conversacion`.
- Haru puede funcionar con fallback local si no existe `GEMINI_API_KEY`.
- La key de Gemini vive solo en server.

## Marketing y contacto

### `marketing_publicacion`

Borradores generados para publicaciones comerciales.

### `contacto_mensaje`

Mensajes publicos desde landing/contacto.

## Personal y costo laboral

### `empleado`

Trabajador de tienda. No necesariamente tiene login.

Campos clave:

- `tienda_id`
- `usuario_id`
- `numero`
- `nombre`
- `celular`
- `fecha_nacimiento`
- `direccion`
- `puesto`
- `valor_hora`
- `fecha_alta`
- `fecha_baja`
- `activo`

Si el empleado tiene acceso al sistema, `empleado.usuario_id` apunta a
`usuario`; su identificador de login por CI vive en `usuario.ci`.

### `nomina_config`, `turno_laboral`, `empleado_horario`, `empleado_turno`

Soporte de planificacion y costo laboral estimado. No es nomina legal.

## Plantillas de catalogo

### `catalogo_plantilla`, `catalogo_plantilla_categoria`, `catalogo_plantilla_producto`

Catalogos sugeridos por rubro para acelerar onboarding.

Funcion:

```sql
aplicar_catalogo_plantilla(tienda_uuid, plantilla_codigo, incluir_productos)
```

Plantilla inicial: `minimarket_abarrotes`.

## Flujo recomendado

1. Crear/actualizar schema con `npm run db:migrate`.
2. La app crea admin demo y tienda demo desde `server/utils/db.ts` si existen
   credenciales `NEXA_SUPER_ADMIN_EMAIL` y `NEXA_SUPER_ADMIN_PASSWORD`.
3. El registro publico crea `usuario`, `tienda`, `tienda_usuario`,
   `usuario_rol`, `nomina_config`, `empleado`, `caja_sesion` y `sesion`.
4. Las operaciones de venta crean `venta`, `venta_item`, `pago`,
   `caja_movimiento` e `inventario_movimiento` segun corresponda.

## Evolucion futura a Supabase Auth/RLS

Cuando se decida usar Supabase Auth:

- Migrar `usuario.id` para referenciar `auth.users(id)` o crear una tabla puente.
- Reemplazar sesiones propias por Supabase session.
- Crear funciones `is_miembro_tienda()` y `has_permiso()` compatibles con
  `auth.uid()`.
- Activar RLS por tabla.
- Mantener `tienda_id` como criterio de aislamiento.
- Hacerlo en una migracion nueva, probada y documentada.
