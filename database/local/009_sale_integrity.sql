-- migrate:up

-- La operacion del dispositivo es una clave de idempotencia, no el numero
-- visible de la venta. Separarlas evita confundir reintentos offline con folios.
alter table venta
  add column if not exists client_operation_id text;

create unique index if not exists venta_client_operation_unique
  on venta (tienda_id, client_operation_id)
  where client_operation_id is not null;

-- migrate:down

drop index if exists venta_client_operation_unique;
alter table venta drop column if exists client_operation_id;
