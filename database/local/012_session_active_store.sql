-- migrate:up

-- La tienda activa pertenece a la sesion, no al orden accidental de los joins.
-- Esto prepara el modelo para un selector de tienda sin mezclar permisos.
alter table sesion
  add column if not exists tienda_id uuid references tienda(id) on delete set null;

update sesion s
set tienda_id = (
  select tu.tienda_id
  from tienda_usuario tu
  where tu.usuario_id = s.usuario_id and tu.estado = 'activo'
  order by tu.created_at asc
  limit 1
)
where s.tienda_id is null;

create index if not exists sesion_tienda_idx on sesion (tienda_id, expires_at desc);

-- migrate:down

drop index if exists sesion_tienda_idx;
alter table sesion drop column if exists tienda_id;
