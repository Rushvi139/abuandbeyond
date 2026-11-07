-- Reviews and the public wall. One review per delivered order.
-- Media sits in the private `wall-uploads` bucket until staff approve it.

create type moderation_status as enum ('pending', 'approved', 'rejected');
create type media_kind as enum ('image', 'video');

create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders (id),
  customer_id uuid not null references customers (id),
  rating int not null check (rating between 1 and 5),
  tags text[] not null default '{}',          -- hot_fresh, on_time, packaging, portion, value
  body text,                                   -- shown as written; never edited by staff
  instagram_handle text,
  consent_to_feature boolean not null default false,
  hidden boolean not null default false,       -- only for abuse / spam
  hidden_reason text,
  created_at timestamptz not null default now()
);

create table review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  kind media_kind not null,
  storage_path text not null,                  -- wall-uploads/<review id>/<file>
  duration_seconds int check (duration_seconds is null or duration_seconds <= 60),
  bytes bigint check (bytes <= 52428800),
  status moderation_status not null default 'pending',
  moderated_by uuid references profiles (id),
  moderated_at timestamptz,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

-- only a delivered order can be reviewed
create or replace function check_review_order() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from orders where id = new.order_id and status = 'delivered') then
    raise exception 'only delivered orders can be reviewed';
  end if;
  return new;
end $$;
create trigger reviews_delivered_only before insert on reviews for each row execute function check_review_order();

-- at most 4 images or 1 video per review
create or replace function check_review_media_limit() returns trigger language plpgsql as $$
declare n_img int; n_vid int;
begin
  select count(*) filter (where kind = 'image'), count(*) filter (where kind = 'video')
    into n_img, n_vid from review_media where review_id = new.review_id;
  if (new.kind = 'image' and (n_img >= 4 or n_vid > 0)) or (new.kind = 'video' and (n_vid >= 1 or n_img > 0)) then
    raise exception 'a review can have up to 4 photos or 1 video';
  end if;
  return new;
end $$;
create trigger review_media_limit before insert on review_media for each row execute function check_review_media_limit();

create view wall_summary with (security_invoker = true) as
  select round(avg(rating)::numeric, 1) as avg_rating, count(*) as review_count
  from reviews where not hidden;

alter table reviews enable row level security;
alter table review_media enable row level security;

-- public reads: visible reviews, approved media of consenting customers.
-- Inserts happen through the server (service role) after order-code + phone checks.
create policy "public visible reviews" on reviews for select using (not hidden);
create policy "public approved media" on review_media for select using (
  status = 'approved' and exists (select 1 from reviews r where r.id = review_id and r.consent_to_feature and not r.hidden)
);
create policy "staff moderate reviews" on reviews for update using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "staff read all media" on review_media for select using (has_role('{owner,manager}'));
create policy "staff moderate media" on review_media for update using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));

insert into storage.buckets (id, name, public) values ('wall-uploads', 'wall-uploads', false)
  on conflict (id) do nothing;

insert into settings (key, value) values
  ('social_links', '{"instagram": null, "google_review": null, "whatsapp": null}')
  on conflict (key) do nothing;
