# Base de datos NEXA

## Fuente de verdad

La fuente de verdad del esquema actual es:

```bash
database/local
```

Los comandos oficiales son:

```bash
npm run db:migrate
npm run db:rollback
npm run db:status
```

`dbmate` registra los cambios en `schema_migrations`. No aplicar archivos SQL a
mano salvo que sean utilitarios documentados abajo.

## Migraciones

- `001_initial.sql`: base consolidada del MVP.
- `002_catalog_templates.sql`: plantillas de catalogo por rubro.
- `003_finanzas_costeo.sql`: tipo de negocio y desglose opcional de costos.
- `004_marketing_contacto_publico.sql`: contacto y ubicacion publica para marketing.
Regla durante el MVP inicial: como la base se puede reiniciar, `001_initial.sql`
puede mantenerse consolidada y limpia. Cuando haya datos reales que conservar,
las nuevas columnas/tablas deben ir en migraciones nuevas.

## Utilitarios fuera de migracion

- `reset.sql`: borra tablas NEXA para reconstruir una base local desde cero.
  Ejecutar solo en desarrollo.
- `demo_abarrotes_seed.sql`: seed manual opcional para una tienda demo existente.

## Supabase

Supabase se usa actualmente como PostgreSQL gestionado. Para desplegar:

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
```

No existe un set SQL separado para Supabase. Se usa el mismo `database/local`.
