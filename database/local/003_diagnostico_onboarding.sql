-- migrate:up

-- Diagnóstico rápido NEXA: extendemos la tabla `diagnostico` con los headline
-- metrics consultables y agregamos el estado de onboarding en `tienda`.
-- El detalle (respuestas, problemas, recomendaciones) vive en `diagnostico.resultado` (jsonb).

alter table diagnostico
  add column if not exists usuario_id uuid references usuario(id) on delete set null,
  add column if not exists salud_general smallint,
  add column if not exists nivel text check (nivel in ('bajo', 'medio', 'alto')),
  add column if not exists score_ventas smallint,
  add column if not exists score_finanzas smallint,
  add column if not exists score_marketing smallint,
  add column if not exists score_inventario smallint,
  add column if not exists completado_at timestamptz;

alter table tienda
  add column if not exists onboarding_diagnostico text not null default 'pendiente'
    check (onboarding_diagnostico in ('pendiente', 'completado', 'omitido'));

-- migrate:down

alter table diagnostico
  drop column if exists usuario_id,
  drop column if exists salud_general,
  drop column if exists nivel,
  drop column if exists score_ventas,
  drop column if exists score_finanzas,
  drop column if exists score_marketing,
  drop column if exists score_inventario,
  drop column if exists completado_at;

alter table tienda
  drop column if exists onboarding_diagnostico;
