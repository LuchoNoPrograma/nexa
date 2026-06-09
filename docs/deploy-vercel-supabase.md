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

En local, `npm run dev` tambien ejecuta `dbmate` antes de levantar Nuxt. En Vercel se ejecuta automaticamente antes del build porque `vercel.json` usa:

```bash
npm run db:migrate && npm run build
```

Para demo, este backend usa las tablas `usuario`, `tienda`, `producto`, etc. No uses por ahora las migraciones `supabase/migrations/*` para este deploy, porque tienen un modelo diferente basado en `auth.users`.

## 2. Vercel

Configura el proyecto como Nuxt normal:

- Build command: automatico desde `vercel.json`
- Output directory: dejar vacio / automatico
- No usar `npm run generate`

Variables de entorno recomendadas:

```env
DATABASE_URL=postgresql://...
NEXA_SUPER_ADMIN_EMAIL=admin@nexa.bo
NEXA_SUPER_ADMIN_PASSWORD=pon-una-clave-larga
```

Notas:

- En produccion no se ejecutan migraciones automaticas. Las tablas se crean manualmente en Supabase con los SQL locales.
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
