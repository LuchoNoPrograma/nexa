# Deploy demo: Vercel + Supabase

Esta version de NEXA usa Nuxt server API con `pg`, no es un sitio estatico. Para produccion demo usa `npm run build`, no `npm run generate`.

## 1. Supabase

1. Crea un proyecto en Supabase.
2. Copia la connection string tipo Transaction pooler.
3. Puedes ejecutar las migraciones desde tu maquina para probar:

```bash
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require" npm run db:migrate
```

El proyecto usa `dbmate`. `dbmate` crea su tabla `schema_migrations` y registra cada archivo aplicado. Si lo corres otra vez, salta las migraciones ya aplicadas.

En local, `npm run dev` tambien ejecuta `dbmate` antes de levantar Nuxt. En Vercel no se deben ejecutar migraciones dentro del build: el build debe quedar solo para compilar Nuxt.

```bash
npm run build
```

Para demo, este backend usa las tablas `usuario`, `tienda`, `producto`, etc. La fuente de verdad es `database/local/*`; no hay migraciones SQL separadas para Supabase.

## 2. Vercel

Configura el proyecto como Nuxt normal:

- Build command: `npm run build`
- Output directory: dejar vacio / automatico
- No usar `npm run generate`

Variables de entorno recomendadas:

```env
DATABASE_URL=postgresql://...
NEXA_SUPER_ADMIN_EMAIL=admin@nexa.bo
NEXA_SUPER_ADMIN_PASSWORD=pon-una-clave-larga
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash
```

Notas:

- Ejecuta `npm run db:migrate` desde tu maquina cuando necesites aplicar cambios de base de datos. No lo pongas como Build Command en Vercel.
- `GEMINI_API_KEY` no debe llevar prefijo `NUXT_PUBLIC_`; solo se usa en endpoints `server/api`.
- Si `GEMINI_API_KEY` no existe, Haru responde con fallback local para no romper la demo.
- Si configuras `NEXA_SUPER_ADMIN_EMAIL` y `NEXA_SUPER_ADMIN_PASSWORD`, la app crea/actualiza el usuario admin demo, la tienda demo y productos base en la primera peticion.
- La conexion SSL y el pool pequeno para Vercel se detectan automaticamente cuando `DATABASE_URL` es de Supabase.
- Cambia `NEXA_SUPER_ADMIN_PASSWORD` antes de compartir la demo.

## 3. Primer acceso

Despues del deploy:

1. Abre `/login`.
2. Entra con `NEXA_SUPER_ADMIN_EMAIL` y `NEXA_SUPER_ADMIN_PASSWORD`.
3. Entra a `/pos/inicio` o `/pos`.

Si ves error 500 en login, revisa:

- Que `DATABASE_URL` sea de Supabase y tenga password correcto.
- Que los SQL locales se ejecutaron sin errores.
- Que `NEXA_SUPER_ADMIN_EMAIL` y `NEXA_SUPER_ADMIN_PASSWORD` existan.
