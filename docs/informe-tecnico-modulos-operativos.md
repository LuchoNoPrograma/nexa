# Informe tecnico de modulos operativos IMPULSA

## Objetivo

Este informe resume las decisiones tecnicas tomadas para que IMPULSA soporte negocios futuros de cualquier rubro que vendan productos, servicios o ambos.

IMPULSA no debe presentarse como un sistema de inventario puro. El inventario, POS, caja y compras son la base operativa que genera datos. Encima de esos datos se construyen los reportes, la calculadora de precios, Haru IA y el asesoramiento empresarial digital.

## Secuencia recomendada de implementacion

1. Catalogo e inventario.
2. Ventas y cobro.
3. Caja: apertura, movimientos y cierre.
4. Compras y reabastecimiento.
5. Reportes de ingresos y gastos.
6. Calculadora de rentabilidad.
7. Haru IA con contexto real del negocio.

Inventario es una base importante, pero no es la unica fuente. Para un negocio real, la verdad operativa nace de la relacion entre catalogo, ventas, pagos, caja y compras.

## Modelo conceptual

### Catalogo e inventario

- `producto`: puede ser `producto`, `servicio` o `combo`.
- `producto_variante`: talla, sabor, presentacion u otra variacion.
- `combo_item`: composicion de un combo.
- `inventario_ajuste`: ajuste manual visible para el usuario.
- `inventario_movimiento`: kardex tecnico para auditoria y reportes.

Los servicios no manejan stock. Los productos fisicos y combos pueden manejar stock segun la operacion del negocio.

### Ventas

- `venta`: documento comercial.
- `venta_item`: lineas vendidas con precio/costo congelado.

Una venta no equivale siempre a ingreso. Puede estar pendiente, parcial, pagada, anulada o ser cotizacion.

### Pagos

- `pago`: dinero cobrado o pagado.

Una venta puede tener multiples pagos:

- efectivo + QR
- cuota inicial + saldo pendiente
- transferencia pendiente de confirmacion

Estados recomendados:

- `pendiente`
- `confirmado`
- `anulado`

Solo los pagos confirmados deben alimentar caja e ingresos.

### Caja

- `caja_sesion`: apertura y cierre de turno.
- `caja_movimiento`: ingreso o egreso que impacta caja/cuenta.

Formula de cierre:

```text
saldo_esperado = saldo_inicial + ingresos_confirmados - egresos_confirmados
diferencia = saldo_contado - saldo_esperado
```

Caja responde: cuanto dinero deberia haber y si el cierre cuadra.

### Compras

- `compra`: documento de reabastecimiento.
- `compra_item`: productos recibidos y costo del momento.

Una compra recibida debe:

- registrar la compra
- subir stock
- registrar movimiento de inventario
- registrar egreso si se pago
- dejar pendiente si se adeuda al proveedor

## Reportes

### Ingresos

Ingresos es reporte, no tabla principal.

Fuente:

- `pago.tipo = 'ingreso'`
- `pago.estado = 'confirmado'`
- `caja_movimiento.tipo = 'ingreso'` para ingresos manuales sin venta

Indicadores:

- ingresos del periodo
- promedio diario
- ticket promedio
- cobros pendientes
- top clientes
- metodos de pago
- evolucion por fecha
- categorias/canales de origen

### Gastos

Gastos tambien es reporte.

Fuente:

- `caja_movimiento.tipo = 'egreso'`
- `caja_movimiento.estado = 'confirmado'`
- compras pagadas o pagos a proveedores

Indicadores:

- gastos del periodo
- categoria principal
- pagos pendientes
- top proveedores
- evolucion de gastos
- distribucion por categoria

## Regla de oro

No duplicar dinero.

- `venta.total`: valor comercial vendido.
- `pago.monto`: dinero cobrado o pagado.
- `caja_movimiento.monto`: impacto en caja o cuenta.
- reportes: calculados desde pagos y movimientos.

No crear tablas `ingreso` o `gasto` al inicio si `pago` y `caja_movimiento` ya cubren el caso.

## Estado actual despues del rediseño

La migracion consolidada esta en:

```text
database/local/001_initial.sql
```

SQL completo para Supabase:

```text
supabase/reset-and-bootstrap.sql
```

Documentacion base:

```text
docs/modelo-base-datos.md
```

## Prioridad inmediata

Pulir catalogo e inventario:

- separar productos, servicios y combos visualmente
- no valorizar servicios como inventario
- registrar ajustes de stock en `inventario_ajuste`
- registrar kardex en `inventario_movimiento`
- mantener costo, precio, margen y stock minimo
- preparar compras para reabastecimiento

Despues implementar:

- `POST /api/pos/sales`
- apertura/cierre de caja
- movimientos manuales de caja
- compras con ingreso de stock
- endpoints de reportes para mockups de ingresos y gastos

## Plantillas por rubro

El diagnostico inicial debe capturar el rubro del negocio. Con ese rubro se puede sugerir una plantilla de catalogo para acelerar la configuracion inicial de la tienda.

La migracion `database/local/002_catalog_templates.sql` crea:

- `catalogo_plantilla`: rubros o tipos de negocio disponibles.
- `catalogo_plantilla_categoria`: categorias sugeridas por rubro.
- `catalogo_plantilla_producto`: productos o servicios sugeridos por rubro.
- `aplicar_catalogo_plantilla(tienda_uuid, plantilla_codigo, incluir_productos)`: funcion para copiar una plantilla a una tienda.

Plantilla inicial:

- Codigo: `minimarket_abarrotes`
- Rubro: `abarrotes`
- Uso: tienda de barrio, minimarket o abarrotes.

Decision actual:

- Aplicar categorias por defecto a la tienda.
- No aplicar productos automaticamente, para evitar inventario falso.
- Los productos sugeridos quedan disponibles para una opcion explicita posterior.

Ejemplo:

```sql
select aplicar_catalogo_plantilla(
  'uuid-de-la-tienda',
  'minimarket_abarrotes',
  false
);
```
