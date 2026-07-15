# Copia local de Supabase

El comando siguiente crea un respaldo JSON privado y restaura los datos en una
base local separada llamada `nexa_supabase_snapshot`:

```bash
npm run db:clone:supabase
```

La base `nexa` habitual no se modifica. Los respaldos se guardan en
`database/backups/`, fuera de Git porque contienen datos reales.

Para iniciar NEXA con la copia:

```bash
npm run dev:snapshot
```

## Simular ventas guardadas en el equipo

1. Iniciar NEXA con la base de respaldo.
2. Ingresar y abrir el POS una vez con conexión para guardar el catálogo.
3. En las herramientas del navegador, cambiar la red a `Offline`.
4. Registrar ventas de prueba. Quedarán guardadas únicamente en ese navegador.
5. Restaurar la red. El POS intentará registrarlas al volver a abrirse; también
   se puede usar el botón `Reintentar`.

La copia de Supabase no incluye las ventas pendientes de los equipos reales:
esas ventas viven únicamente en el almacenamiento del navegador donde fueron
creadas. No borrar los datos de esos navegadores.
