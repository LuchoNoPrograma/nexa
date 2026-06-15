-- migrate:up

-- Marketing: publicaciones sugeridas por Naru (Haru IA).
-- Cada fila es una publicación lista para redes generada a partir de un producto
-- real del inventario. Se persiste para NO volver a consumir IA cada vez que el
-- usuario entra al módulo: la IA solo se llama al pulsar "generar".

create table if not exists marketing_publicacion (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references tienda(id) on delete cascade,
  usuario_id uuid references usuario(id) on delete set null,
  producto_id uuid references producto(id) on delete set null,
  producto_nombre text,
  titulo text not null,
  texto text not null,
  hashtags jsonb not null default '[]'::jsonb,
  idea_video text,
  mejor_hora text,
  audiencia text,
  objetivo text,
  impacto smallint not null default 4 check (impacto between 1 and 5),
  imagen_url text,
  estado text not null default 'sugerida' check (estado in ('sugerida', 'publicada', 'descartada')),
  publicado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_publicacion_tienda_idx
  on marketing_publicacion (tienda_id, estado, created_at desc);

-- migrate:down

drop table if exists marketing_publicacion;
