-- Reset destructivo para volver a crear IMPULSA desde cero.
-- Ejecutar antes de database/local/001_initial.sql cuando se quiera limpiar el MVP.

do $$
declare
  legacy_table text;
begin
  foreach legacy_table in array array[
    'ken' || 'chita_chat_config',
    'ken' || 'chita_mensaje',
    'ken' || 'chita_conversacion'
  ]
  loop
    execute format('drop table if exists %I cascade', legacy_table);
  end loop;
end $$;

drop table if exists
  dbmate_schema_migrations,
  schema_migration,
  schema_migrations,
  sesion,
  contacto_mensaje,
  haru_chat_config,
  haru_mensaje,
  haru_conversacion,
  diagnostico,
  calculo_precio,
  precio_historial,
  inventario_movimiento,
  inventario_ajuste,
  caja_movimiento,
  pago,
  compra_item,
  compra,
  venta_item,
  venta,
  caja_sesion,
  combo_item,
  producto_variante,
  producto,
  categoria,
  proveedor,
  cliente,
  catalogo_plantilla_producto,
  catalogo_plantilla_categoria,
  catalogo_plantilla,
  rol_permiso,
  permiso,
  usuario_rol,
  rol,
  tienda_usuario,
  tienda,
  usuario
cascade;

drop function if exists current_tienda_id() cascade;
drop function if exists is_miembro_tienda(uuid) cascade;
drop function if exists has_permiso(text, uuid) cascade;
drop function if exists aplicar_catalogo_plantilla(uuid, text, boolean) cascade;
