-- migrate:up

-- OAuth: una cuenta externa se identifica por (proveedor, sub). El `sub` es el
-- identificador estable que entrega el proveedor (no cambia aunque cambie el correo).
alter table usuario
  add column if not exists oauth_provider text,
  add column if not exists oauth_sub text;

-- Los usuarios creados con OAuth no tienen contraseña local, por eso el hash
-- deja de ser obligatorio. El login normal por correo/CI/celular sigue igual:
-- esos usuarios siempre traen password_hash.
alter table usuario
  alter column password_hash drop not null;

-- Integridad: el par proveedor+sub es único (no se pueden vincular dos cuentas
-- NEXA al mismo Google). El índice parcial ignora las filas sin OAuth.
create unique index if not exists usuario_oauth_idx
  on usuario (oauth_provider, oauth_sub)
  where oauth_provider is not null;

-- Salvaguarda: toda cuenta debe poder autenticarse de alguna forma, sea con
-- contraseña local o con un proveedor OAuth. Evita filas "huérfanas" sin acceso.
alter table usuario
  add constraint usuario_metodo_auth_chk
  check (
    password_hash is not null
    or (oauth_provider is not null and oauth_sub is not null)
  );

-- migrate:down

alter table usuario drop constraint if exists usuario_metodo_auth_chk;
drop index if exists usuario_oauth_idx;
-- No se revierte password_hash a NOT NULL: romperia a los usuarios que solo
-- tienen OAuth. La columna queda nullable, que es inocuo para el login normal.
alter table usuario
  drop column if exists oauth_sub,
  drop column if exists oauth_provider;
