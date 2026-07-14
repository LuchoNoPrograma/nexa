-- migrate:up

-- NOT VALID evita que una instalacion con datos historicos inconsistentes quede
-- bloqueada al migrar, pero PostgreSQL aplica las reglas a toda escritura nueva.
alter table producto
  add constraint producto_importes_no_negativos_chk
  check (
    costo_unitario >= 0
    and precio_venta >= 0
    and stock_actual >= 0
    and stock_minimo >= 0
    and (stock_maximo is null or stock_maximo >= 0)
  ) not valid;

alter table venta
  add constraint venta_totales_consistentes_chk
  check (
    subtotal >= 0
    and descuento >= 0
    and descuento <= subtotal
    and total = subtotal - descuento
  ) not valid;

alter table venta_item
  add constraint venta_item_importes_validos_chk
  check (cantidad > 0 and costo_unitario >= 0 and precio_unitario >= 0 and subtotal >= 0)
  not valid;

create unique index if not exists categoria_id_tienda_unique on categoria (id, tienda_id);
alter table producto
  add constraint producto_categoria_misma_tienda_fk
  foreign key (categoria_id, tienda_id) references categoria (id, tienda_id)
  not valid;

create unique index if not exists caja_sesion_id_tienda_unique on caja_sesion (id, tienda_id);
alter table venta
  add constraint venta_caja_misma_tienda_fk
  foreign key (caja_sesion_id, tienda_id) references caja_sesion (id, tienda_id)
  not valid;

-- migrate:down

alter table venta drop constraint if exists venta_caja_misma_tienda_fk;
drop index if exists caja_sesion_id_tienda_unique;
alter table producto drop constraint if exists producto_categoria_misma_tienda_fk;
drop index if exists categoria_id_tienda_unique;
alter table venta_item drop constraint if exists venta_item_importes_validos_chk;
alter table venta drop constraint if exists venta_totales_consistentes_chk;
alter table producto drop constraint if exists producto_importes_no_negativos_chk;
