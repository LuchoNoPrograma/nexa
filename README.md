# IMPULSA

IMPULSA es un MVP academico para una plataforma web de asesoramiento empresarial digital dirigida a emprendimientos, microempresas y negocios de Cobija, Bolivia, con proyeccion nacional.

El proyecto no busca ser solo un sistema de inventario. El inventario, el POS y la caja son modulos de soporte para generar datos del negocio. La propuesta principal es ayudar a una tienda comun a entender su operacion, mejorar precios, vender mejor, ordenar su catalogo y recibir recomendaciones practicas con Haru IA.

## Enfoque del negocio

IMPULSA combina cuatro capas:

- Landing publica para explicar el proyecto, su valor social, economico, tecnico y academico.
- Soporte operativo tipo POS para registrar ventas, clientes, productos, servicios, compras, pagos, caja e inventario.
- Analisis de negocio para ver ingresos, gastos, rentabilidad, precios, clientes, proveedores y flujo de caja.
- Haru IA como asesor empresarial en espanol, contextualizado en Cobija y adaptable por rubro.

El usuario objetivo es una microempresa que vende productos, servicios o ambos: abarrotes, comida, ropa, belleza, ferreteria, consultoria, servicios tecnicos, emprendimientos familiares y negocios similares.

## Alcance MVP

Prioridades:

1. Landing profesional para presentacion y feria.
2. Modulo POS como base operativa.
3. Caja, ventas, pagos, compras, clientes, proveedores e inventario simple.
4. Reportes de ingresos y gastos calculados desde pagos y movimientos de caja.
5. Calculadora de precios y rentabilidad.
6. Haru IA para recomendaciones practicas.
7. Catalogo publico con pedido por WhatsApp, sin checkout ni pasarela.

Fuera de alcance:

- Facturacion legal.
- Pasarela de pago real.
- Contabilidad completa.
- Multi-sucursal avanzada.
- Integraciones bancarias.
- Seguridad empresarial avanzada.

## Modelo operativo

La arquitectura separa conceptos para evitar duplicar dinero:

- `venta`: documento comercial.
- `venta_item`: productos, servicios o combos vendidos.
- `pago`: dinero cobrado o pagado; soporta cuotas y pagos mixtos.
- `caja_sesion`: apertura y cierre de turno.
- `caja_movimiento`: impacto real en caja o cuenta.
- `compra` y `compra_item`: reabastecimiento y costos.
- `inventario_ajuste` e `inventario_movimiento`: historial de stock.

Los submodulos de Ingresos y Gastos son reportes:

- Ingresos: pagos confirmados y movimientos de ingreso.
- Gastos: egresos confirmados, compras pagadas y movimientos de salida.
- Pendientes: pagos o compras con estado pendiente/parcial.

## Stack

- Nuxt + TypeScript.
- PrimeVue + Tailwind CSS.
- `@primevue/nuxt-module`.
- `@primeuix/themes/aura`.
- Tailwind v4 con `@tailwindcss/vite` y `tailwindcss-primeui`.
- PostgreSQL local/Supabase futuro.
- Gemini desde endpoints `server/api/`.
- Deploy futuro en Vercel.

## Base de datos

La migracion principal esta en:

```bash
database/local/001_initial.sql
```

Para reiniciar la base local:

```bash
psql "$DATABASE_URL" -f database/reset.sql
npm run db:migrate
```

Para Supabase, ejecutar en el SQL Editor:

```bash
supabase/reset-and-bootstrap.sql
```

Documento tecnico:

```bash
docs/modelo-base-datos.md
```

## Desarrollo

Instalar dependencias:

```bash
npm install
```

Ejecutar migraciones:

```bash
npm run db:migrate
```

Servidor de desarrollo:

```bash
npm run dev
```

El comando `npm run dev` tambien ejecuta migraciones antes de iniciar Nuxt.
