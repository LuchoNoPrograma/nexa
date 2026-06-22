-- migrate:up

alter table tienda
  add column if not exists direccion_publica text,
  add column if not exists marketing_contacto_confirmado boolean not null default false;

-- migrate:down

alter table tienda
  drop column if exists marketing_contacto_confirmado,
  drop column if exists direccion_publica;
