# Offline local

Esta carpeta contiene la infraestructura IndexedDB compartida por los módulos que deben operar con conexión intermitente.

## Regla de arquitectura

- `useOfflineDb.ts` solo abre IndexedDB y expone operaciones base.
- `useOfflineQueue.ts` maneja la cola genérica por `storeId`, `type` y `status`.
- Los módulos de negocio viven fuera de esta carpeta, por ejemplo `app/composables/pos/offline/`.

## Invariantes

- Toda operación de cola lleva `storeId` local para separar tiendas en el navegador.
- El servidor no debe confiar en `storeId` recibido del cliente; debe usar la tienda de la sesión.
- Toda operación sincronizable debe tener un id estable del cliente para reintentos idempotentes.
- El estado `sincronizando` se considera pendiente, porque el navegador puede cerrarse antes de terminar.

## Tipos reservados

- `pos.sale.create`
- `inventory.stock.adjust`
- `cash.movement.create`
- `finance.movement.create`

Solo `pos.sale.create` está implementado actualmente. Los demás tipos existen para que inventario, caja y finanzas usen la misma cola en vez de crear colas separadas.
