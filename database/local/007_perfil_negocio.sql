-- migrate:up

alter table tienda
  add column if not exists perfil_negocio_confirmado boolean not null default true;

-- Las tiendas generadas automaticamente por OAuth deben completar su identidad.
update tienda t
set perfil_negocio_confirmado = false
from usuario u
where t.owner_id = u.id
  and u.oauth_provider = 'google'
  and t.nombre like 'Negocio de %';

-- migrate:down

alter table tienda drop column if exists perfil_negocio_confirmado;
