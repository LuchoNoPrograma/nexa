# Stores de NEXA

Arquitectura usada para que el POS no se sienta lento:

- Un store por dominio de datos compartidos: `session`, `catalog`, `cash`.
- Las pantallas leen el estado cacheado al instante cuando ya existe.
- Las acciones `load*` deduplican peticiones simultaneas con `pendingRequest`.
- Los datos tienen TTL corto para evitar refetch en cada navegacion.
- Los botones manuales y las escrituras usan `force: true` para traer datos frescos.
- Ventas mantiene fallback offline para catalogo y caja mantiene estado local de caja.

Regla practica: las vistas no deben llamar `$fetch` para datos compartidos del POS.
Primero crear o extender un store y exponer una accion clara.
