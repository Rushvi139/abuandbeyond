-- Recipe photos come in two kinds: the prep (mise en place, bases, each
-- stage) and the finished dish (how it must look when it leaves). Photos
-- already added count as the finished dish.
alter table recipe_photos add column if not exists kind text not null default 'final';
do $$ begin
  alter table recipe_photos add constraint recipe_photos_kind_check check (kind in ('prep', 'final'));
exception when duplicate_object then null; end $$;
