-- Seed demo para una tienda de abarrotes en Cobija.
-- Requiere que database/local/002_catalog_templates.sql ya haya creado
-- la plantilla `minimarket_abarrotes` y la funcion aplicar_catalogo_plantilla.
--
-- Uso local:
--   psql "$DATABASE_URL" -f database/demo_abarrotes_seed.sql
--
-- Por defecto aplica a la tienda demo de IMPULSA.

select aplicar_catalogo_plantilla(id, 'minimarket_abarrotes', true)
from tienda
where slug = 'tienda-demo-impulsa'
  and activo = true
limit 1;
