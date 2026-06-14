-- Seed demo para una tienda de abarrotes en Cobija.
-- Requiere que database/local/002_catalog_templates.sql ya haya creado
-- la plantilla `minimarket_abarrotes` y la funcion aplicar_catalogo_plantilla.
--
-- Uso local:
--   psql "$DATABASE_URL" -f database/demo_abarrotes_seed.sql
--
-- Por defecto aplica a la tienda demo de NEXA.

select aplicar_catalogo_plantilla(id, 'minimarket_abarrotes', true)
from tienda
where slug = 'tienda-demo-nexa'
  and activo = true
limit 1;

insert into nomina_config (tienda_id, salario_minimo_mensual, horas_mensuales_referencia, semanas_por_mes)
select id, 3300, 240, 4.33
from tienda
where slug = 'tienda-demo-nexa'
  and activo = true
on conflict (tienda_id) do nothing;

with tienda_demo as (
  select id as tienda_id
  from tienda
  where slug = 'tienda-demo-nexa'
    and activo = true
  limit 1
),
empleado_base as (
  insert into empleado (tienda_id, nombre, puesto, color, orden)
  select tienda_id, 'Trabajador 1', 'Atención y caja', '#22c55e', 0
  from tienda_demo
  where not exists (
    select 1
    from empleado e
    where e.tienda_id = tienda_demo.tienda_id
      and e.activo = true
  )
  returning id, tienda_id
)
insert into empleado_horario (empleado_id, tienda_id, slots, horas_semanales)
select
  id,
  tienda_id,
  '[
    {"dia":1,"hora":14},{"dia":1,"hora":15},{"dia":1,"hora":16},{"dia":1,"hora":17},{"dia":1,"hora":18},{"dia":1,"hora":19},
    {"dia":2,"hora":14},{"dia":2,"hora":15},{"dia":2,"hora":16},{"dia":2,"hora":17},{"dia":2,"hora":18},{"dia":2,"hora":19},
    {"dia":3,"hora":14},{"dia":3,"hora":15},{"dia":3,"hora":16},{"dia":3,"hora":17},{"dia":3,"hora":18},{"dia":3,"hora":19},
    {"dia":4,"hora":14},{"dia":4,"hora":15},{"dia":4,"hora":16},{"dia":4,"hora":17},{"dia":4,"hora":18},{"dia":4,"hora":19},
    {"dia":5,"hora":14},{"dia":5,"hora":15},{"dia":5,"hora":16},{"dia":5,"hora":17},{"dia":5,"hora":18},{"dia":5,"hora":19}
  ]'::jsonb,
  30
from empleado_base
on conflict (empleado_id) do nothing;
