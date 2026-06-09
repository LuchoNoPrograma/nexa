-- migrate:up

alter table kenchita_conversacion
  add column if not exists resumen text,
  add column if not exists resumen_updated_at timestamptz,
  add column if not exists resumen_mensajes integer not null default 0;

-- migrate:down

alter table kenchita_conversacion
  drop column if exists resumen_mensajes,
  drop column if exists resumen_updated_at,
  drop column if exists resumen;
