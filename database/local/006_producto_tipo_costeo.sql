-- migrate:up

alter table producto
  add column if not exists tipo_costeo text not null default 'reventa'
  check (tipo_costeo in ('reventa', 'produccion', 'servicio'));

update producto
set tipo_costeo = case
  when tipo = 'servicio' then 'servicio'
  when tipo = 'combo' then 'produccion'
  else 'reventa'
end
where tipo_costeo is null or tipo_costeo = 'reventa';

-- migrate:down

alter table producto drop column if exists tipo_costeo;
