-- migrate:up

-- Datos de contacto + número monótono por tienda para empleados, y login por CI.
-- El número de empleado nunca se reutiliza: si un empleado deja el trabajo (baja
-- lógica), su número queda "consumido" y el siguiente parte del máximo + 1.

alter table empleado add column if not exists numero integer;
alter table empleado add column if not exists celular text;
alter table empleado add column if not exists fecha_nacimiento date;
alter table empleado add column if not exists direccion text;

-- Backfill: numera los empleados existentes por tienda según su orden actual.
with ranked as (
  select id, row_number() over (partition by tienda_id order by orden, created_at) as rn
  from empleado
)
update empleado e
set numero = ranked.rn
from ranked
where ranked.id = e.id and e.numero is null;

create index if not exists empleado_numero_idx on empleado (tienda_id, numero);

-- Login por carnet de identidad (CI): el correo deja de ser obligatorio para que
-- un empleado pueda iniciar sesión solo con su CI y una contraseña.
alter table usuario add column if not exists ci text;
alter table usuario alter column email drop not null;
create unique index if not exists usuario_ci_unique on usuario (ci) where ci is not null;

-- migrate:down

drop index if exists usuario_ci_unique;
alter table usuario drop column if exists ci;
drop index if exists empleado_numero_idx;
alter table empleado drop column if exists direccion;
alter table empleado drop column if exists fecha_nacimiento;
alter table empleado drop column if exists celular;
alter table empleado drop column if exists numero;
