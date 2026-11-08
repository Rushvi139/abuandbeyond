-- Banners can now run as a slim ribbon across the very top of the site,
-- as well as the big cards on the menu.
alter table banners add column if not exists placement text not null default 'card';
alter table banners add column if not exists motif text not null default 'none';
alter table banners add column if not exists cta_label text;

do $$ begin
  alter table banners add constraint banners_placement_check check (placement in ('card', 'ribbon'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table banners add constraint banners_motif_check check (motif in ('none', 'lights', 'paws'));
exception when duplicate_object then null; end $$;
