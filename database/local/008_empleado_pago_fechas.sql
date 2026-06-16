-- migrate:up

-- Pago por horas a nivel de empleado: cada persona puede tener su propio valor
-- por hora (si es null, el cálculo cae al valor de la tienda). Además se
-- registran las fechas de ingreso y baja para ordenar el ciclo laboral.

alter table empleado add column if not exists valor_hora numeric(12, 2);
alter table empleado add column if not exists fecha_alta date;
alter table empleado add column if not exists fecha_baja date;

alter table empleado
  add constraint empleado_valor_hora_no_negativo
  check (valor_hora is null or valor_hora >= 0);

-- Fecha de ingreso: se respeta el created_at de los empleados existentes; los
-- nuevos toman el día de hoy por defecto.
update empleado set fecha_alta = created_at::date where fecha_alta is null;
alter table empleado alter column fecha_alta set default current_date;

-- Fecha de baja para los empleados ya inactivos (aproximada a su última edición).
update empleado set fecha_baja = updated_at::date where activo = false and fecha_baja is null;

-- migrate:down

alter table empleado alter column fecha_alta drop default;
alter table empleado drop constraint if exists empleado_valor_hora_no_negativo;
alter table empleado drop column if exists fecha_baja;
alter table empleado drop column if exists fecha_alta;
alter table empleado drop column if exists valor_hora;
