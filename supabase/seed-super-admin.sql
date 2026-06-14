-- Ejecutar despues de crear el usuario en Supabase Auth:
-- email: admin@nexa.bo
-- password sugerido para dev: NexaAdmin2026!
--
-- Este script no guarda contrasenas en tablas publicas. Solo crea el perfil,
-- una tienda demo y asigna roles para entrar al POS.

do $$
declare
  super_admin_email text := 'admin@nexa.bo';
  super_admin_id uuid;
  tienda_demo_id uuid;
  rol_super_admin_id uuid;
  rol_propietario_id uuid;
begin
  select id
  into super_admin_id
  from auth.users
  where lower(email) = lower(super_admin_email)
  limit 1;

  if super_admin_id is null then
    raise exception 'Primero crea el usuario % en Supabase Auth y vuelve a ejecutar este seed.', super_admin_email;
  end if;

  insert into usuario (id, email, nombre, estado, ultimo_acceso_at)
  values (super_admin_id, super_admin_email, 'Super Admin NEXA', 'activo', now())
  on conflict (id) do update
  set
    email = excluded.email,
    nombre = excluded.nombre,
    estado = 'activo',
    updated_at = now();

  insert into tienda (owner_id, nombre, slug, rubro, descripcion, ciudad, departamento, pais, plan, activo)
  values (
    super_admin_id,
    'Tienda Demo NEXA',
    'tienda-demo-nexa',
    'Abarrotes',
    'Tienda base de abarrotes bolivianos para probar el punto de venta de NEXA.',
    'Cobija',
    'Pando',
    'Bolivia',
    'demo',
    true
  )
  on conflict (slug) do update
  set
    owner_id = excluded.owner_id,
    nombre = excluded.nombre,
    rubro = excluded.rubro,
    descripcion = excluded.descripcion,
    plan = excluded.plan,
    activo = true,
    updated_at = now()
  returning id into tienda_demo_id;

  insert into tienda_usuario (tienda_id, usuario_id, cargo, estado, joined_at)
  values (tienda_demo_id, super_admin_id, 'Propietario', 'activo', now())
  on conflict (tienda_id, usuario_id) do update
  set
    cargo = excluded.cargo,
    estado = 'activo',
    joined_at = coalesce(tienda_usuario.joined_at, now()),
    updated_at = now();

  select id into rol_super_admin_id
  from rol
  where alcance = 'plataforma'
    and codigo = 'super_admin'
    and tienda_id is null
  limit 1;

  select id into rol_propietario_id
  from rol
  where alcance = 'tienda'
    and codigo = 'propietario'
    and tienda_id is null
  limit 1;

  if rol_super_admin_id is null or rol_propietario_id is null then
    raise exception 'Ejecuta primero la migracion inicial para crear roles base.';
  end if;

  insert into usuario_rol (usuario_id, rol_id, tienda_id)
  values (super_admin_id, rol_super_admin_id, null)
  on conflict do nothing;

  insert into usuario_rol (usuario_id, rol_id, tienda_id)
  values (super_admin_id, rol_propietario_id, tienda_demo_id)
  on conflict do nothing;

  perform aplicar_catalogo_plantilla(tienda_demo_id, 'minimarket_abarrotes', true);
end $$;
