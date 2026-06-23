-- migrate:up

alter table venta
  add column if not exists anulada_at timestamptz,
  add column if not exists anulada_por_id uuid references usuario(id) on delete set null,
  add column if not exists anulacion_motivo text;

create index if not exists venta_anulada_tienda_idx
  on venta (tienda_id, anulada_at desc)
  where estado = 'anulada';

-- migrate:down

drop index if exists venta_anulada_tienda_idx;

alter table venta
  drop column if exists anulacion_motivo,
  drop column if exists anulada_por_id,
  drop column if exists anulada_at;
