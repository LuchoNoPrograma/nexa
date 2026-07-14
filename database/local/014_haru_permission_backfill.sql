-- migrate:up

-- Haru era accesible antes de aplicar permisos en API/UI. Conservamos ese
-- comportamiento para todos los roles de tienda que ya existen.
insert into permiso (codigo, modulo, accion, alcance, descripcion)
values ('haru.usar', 'haru', 'usar', 'tienda', 'Usar Haru IA')
on conflict (codigo) do update
set modulo = excluded.modulo,
    accion = excluded.accion,
    alcance = excluded.alcance,
    descripcion = excluded.descripcion,
    activo = true;

insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
from rol r
join permiso p on p.codigo = 'haru.usar'
where r.alcance = 'tienda'
  and r.activo = true
on conflict (rol_id, permiso_id) do nothing;

-- migrate:down

-- Migracion de compatibilidad de datos: no se revocan permisos al revertir.
