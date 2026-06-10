-- Reset destructivo para volver a crear NEXA desde cero.
-- Ejecutar antes de database/local/001_initial.sql cuando se quiera limpiar el MVP.

drop table if exists
  dbmate_schema_migrations,
  schema_migration,
  schema_migrations,
  sesion,
  contacto_mensaje,
  kenchita_chat_config,
  kenchita_mensaje,
  kenchita_conversacion,
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
