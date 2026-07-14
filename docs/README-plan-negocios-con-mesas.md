# Plan NEXA para negocios con mesas y pedidos para llevar

## Objetivo

Extender el punto de venta de NEXA para restaurantes, cafeterias, heladerias,
bares y otros negocios que atienden en mesas, mostrador o mediante pedidos para
llevar.

La solucion debe registrar una venta desde que se abre el pedido hasta que se
cobra, identificarla con un numero diario y conservar indicaciones como
`sabor vainilla`, `sin cebolla` o `poco hielo`.

Este modulo sera opcional por tienda. Los negocios que no trabajan con mesas
deben continuar usando el POS actual sin pasos adicionales.

## Alcance del MVP

- Atencion en mesa, para llevar y mostrador.
- Configuracion simple de mesas y zonas.
- Apertura de una cuenta para una mesa.
- Pedidos abiertos a los que se pueden agregar productos.
- Nota general de la venta y nota especifica por producto.
- Numero correlativo de venta por tienda y dia.
- Ticket visible e imprimible desde el navegador.
- Cobro mediante el flujo existente de pagos y caja.
- Liberacion automatica de la mesa al cerrar o anular la venta.

Quedan fuera del MVP:

- Reservas y lista de espera.
- Delivery con seguimiento.
- Union y division avanzada de mesas o cuentas.
- Pantalla de cocina en tiempo real.
- Integracion nativa con impresoras termicas.
- Facturacion fiscal o legal.

## Tipos de servicio

| Tipo | Uso | Requiere mesa |
| --- | --- | --- |
| `mesa` | Consumo dentro del local | Si |
| `para_llevar` | Pedido preparado para retirar | No |
| `mostrador` | Venta directa y cobro inmediato | No |

`canal` y `tipo_servicio` son conceptos diferentes:

- `canal` indica donde se origino la venta: POS, catalogo de WhatsApp o registro manual.
- `tipo_servicio` indica como se entrega o consume el pedido.

## Flujo operativo

### Venta en mesa

1. El usuario abre la vista de mesas.
2. Selecciona una mesa libre.
3. El sistema crea una venta pendiente asociada a esa mesa.
4. Agrega productos y notas por producto.
5. Puede guardar y volver a abrir la cuenta durante la atencion.
6. Al cobrar, los pagos confirmados actualizan caja.
7. Cuando la venta queda pagada, la mesa vuelve a estar libre.

Ejemplo:

```text
Venta #027
Servicio: Mesa
Mesa: Mesa 1

1 x Milkshake       Bs 18,00
    Nota: Sabor vainilla

Nota general: Entregar con dos pajitas
```

### Pedido para llevar

1. El usuario selecciona `Para llevar`.
2. Agrega productos e indicaciones.
3. El sistema asigna el siguiente numero del dia.
4. El pedido puede quedar pendiente mientras se prepara o cobrarse de inmediato.
5. El ticket no muestra mesa.

### Venta de mostrador

Mantiene el flujo rapido del POS actual: agregar productos, cobrar y finalizar.
No requiere seleccionar mesa.

## Modelo de datos propuesto

La implementacion debe usar una nueva migracion. No se debe modificar una
migracion que ya haya sido aplicada en otros entornos.

### Configuracion de tienda

Agregar a `tienda`:

```sql
usa_mesas boolean not null default false
```

Cuando sea `false`, la navegacion no muestra el mapa de mesas y el POS conserva
el flujo actual.

### Mesa

```sql
create table mesa (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  nombre text not null,
  zona text,
  capacidad integer not null default 4 check (capacidad > 0),
  posicion_x integer not null default 0,
  posicion_y integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, nombre)
);
```

No se guarda un campo `ocupada`. La ocupacion se deriva de una venta pendiente
o parcial asociada con la mesa. Esto evita estados desincronizados.

### Extension de venta

Agregar a `venta`:

```sql
tipo_servicio text not null default 'mostrador'
  check (tipo_servicio in ('mesa', 'para_llevar', 'mostrador')),
mesa_id uuid references mesa(id) on delete set null,
numero_venta_dia integer,
fecha_operativa date not null default current_date,
numero_personas integer check (numero_personas is null or numero_personas > 0),
cerrada_at timestamptz
```

La columna existente `venta.notas` se usa para instrucciones generales. No se
debe crear otra columna que duplique ese concepto.

Reglas:

- Una venta `mesa` requiere `mesa_id`.
- Una venta `para_llevar` o `mostrador` no debe tener `mesa_id`.
- Una mesa solo puede tener una venta activa.
- El numero diario es unico por tienda y fecha operativa.

```sql
create unique index venta_numero_diario_unique
  on venta (tienda_id, fecha_operativa, numero_venta_dia)
  where numero_venta_dia is not null;

create unique index venta_activa_por_mesa_unique
  on venta (mesa_id)
  where mesa_id is not null and estado in ('pendiente', 'parcial');
```

### Nota por producto

Agregar a `venta_item`:

```sql
notas text
```

- `venta.notas`: indicacion que aplica a todo el pedido.
- `venta_item.notas`: preparacion o variante solicitada para una linea.

La nota se congela en la linea de venta. No debe depender de un producto o una
variante que pueda cambiar posteriormente.

### Contador diario

```sql
create table venta_contador_diario (
  tienda_id uuid not null references tienda(id) on delete cascade,
  fecha_operativa date not null,
  ultimo_numero integer not null default 0,
  primary key (tienda_id, fecha_operativa)
);
```

El servidor asigna el numero dentro de la misma transaccion que crea la venta.
Debe usar `insert ... on conflict ... do update` con `returning`, evitando que
dos cajas simultaneas reciban el mismo numero.

La fecha operativa se calcula con la zona horaria de la tienda. Para el MVP se
usa `America/La_Paz`. El numero almacenado es numerico; `#027` es solamente su
formato visual.

## Estados visuales de mesa

- `libre`: no existe venta activa.
- `ocupada`: existe una venta pendiente o parcial.
- `atencion_prolongada`: la venta supera un tiempo configurable.
- `inactiva`: la mesa fue deshabilitada.

Colores sugeridos:

- Verde o celeste: libre.
- Amarillo: ocupada.
- Rojo suave: atencion prolongada.
- Gris: inactiva.

El estado tambien debe mostrarse con texto o icono para no depender solo del
color.

## Interfaz del POS

### Selector inicial

Cuando `tienda.usa_mesas` sea verdadero, el POS muestra:

- Mesa.
- Para llevar.
- Mostrador.

Al elegir `Mesa`, se abre el mapa o listado. Los otros tipos abren el catalogo
directamente.

### Carrito y notas

Cada linea ofrece `Agregar nota`. La nota aparece debajo del nombre del producto
y puede editarse antes de cerrar la venta. La pantalla tambien incluye una
`Nota general del pedido` secundaria al flujo de cobro.

### Vista de mesas

Cada mesa muestra:

- Nombre y zona.
- Estado.
- Tiempo desde la apertura.
- Total acumulado.
- Numero de ticket activo.

En dispositivos moviles se utiliza una cuadricula o lista. El posicionamiento
libre de mesas puede quedar como mejora posterior.

## Ticket

El ticket del MVP se genera en HTML y usa la impresion del navegador. Debe
funcionar en ancho reducido y contener:

- Nombre del negocio.
- Numero diario de venta.
- Fecha y hora.
- Tipo de servicio y mesa, cuando corresponda.
- Productos, cantidades, precios y notas.
- Nota general.
- Subtotal, descuento y total.
- Pagos y cambio, cuando corresponda.

Las notas son operativas. No deben mostrarse en reportes publicos ni en el
catalogo.

## API y reglas del servidor

Endpoints previstos:

```text
GET    /api/pos/tables
POST   /api/pos/tables
PATCH  /api/pos/tables/:id
POST   /api/pos/sales
GET    /api/pos/sales/:id
PATCH  /api/pos/sales/:id/items
POST   /api/pos/sales/:id/payments
POST   /api/pos/sales/:id/cancel
```

El servidor valida:

- Mesa y venta pertenecen a la tienda autenticada.
- La mesa no tiene otra venta abierta.
- El tipo de servicio es coherente con `mesa_id`.
- El numero diario se genera en servidor.
- Una venta anulada no acepta nuevas lineas.
- Una venta pagada no se reabre sin una operacion explicita y auditada.

## Seguridad multi-tenant

`mesa` y `venta_contador_diario` deben tener RLS. Una tienda solo consulta y
modifica sus propios registros mediante `current_tienda_id()`.

Las consultas de ocupacion deben validar la pertenencia de mesa y venta. Un
`tienda_id` enviado por el cliente nunca es fuente de autorizacion.

## Fases de implementacion

### Fase 1: base de datos

- Crear la migracion.
- Agregar `mesa` y `venta_contador_diario`.
- Extender `tienda`, `venta` y `venta_item`.
- Crear restricciones, indices y politicas RLS.
- Implementar la asignacion atomica del numero diario.

### Fase 2: configuracion

- Agregar el interruptor `Usar mesas`.
- Crear mantenimiento simple de mesas, zonas y capacidad.
- Permitir desactivar mesas sin borrar historial.

### Fase 3: flujo POS

- Incorporar el selector de tipo de servicio.
- Implementar la vista de mesas.
- Permitir guardar y reabrir pedidos activos.
- Agregar notas generales y por producto.
- Mostrar numero diario y tiempo de atencion.

### Fase 4: cobro y ticket

- Integrar el pedido con pagos y caja existentes.
- Liberar la mesa al pagar o anular.
- Crear la plantilla imprimible.
- Verificar descuentos y pagos parciales.

### Fase 5: analisis

- Ventas por tipo de servicio.
- Ticket promedio por mesa y para llevar.
- Tiempo promedio de ocupacion.
- Productos mas vendidos.
- Horarios de mayor demanda.

## Criterios de aceptacion

- Un negocio sin mesas mantiene el flujo actual.
- Un negocio con mesas puede configurarlas y administrarlas.
- No se pueden abrir dos cuentas activas en una misma mesa.
- Se puede vender un milkshake en Mesa 1 con la nota `Sabor vainilla`.
- Se puede registrar el mismo producto para llevar sin seleccionar mesa.
- Cada venta recibe un numero diario unico y correlativo por tienda.
- El numero vuelve a comenzar al cambiar la fecha operativa.
- El ticket muestra servicio, mesa y notas correctamente.
- Al pagar o anular una cuenta, la mesa queda disponible.
- Ventas, pagos y movimientos de caja no duplican importes.
- Los datos permanecen aislados por tienda mediante RLS.

## Mejoras posteriores

- Modificadores rapidos: sabores, tamanos, extras y terminos de coccion.
- Estados de preparacion: pendiente, preparando, listo y entregado.
- Pantalla de cocina e impresion por area.
- Pedidos por QR desde la mesa.
- Cambio, union y division de mesas.
- Division de cuenta.
- Meseros y metricas por usuario.
- Reservas y lista de espera.

Los modificadores estructurados se agregaran cuando las notas libres ya no sean
suficientes. Para el MVP, una nota por linea resuelve el caso sin ampliar
innecesariamente el modelo.
