-- More than one photo on a spend (the slip, the item, the UPI screen), and
-- added later as well as at entry. The first photo stays in file_path; the
-- rest live here.
create table if not exists spend_photos (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references expenses (id) on delete cascade,
  vendor_bill_id uuid references vendor_bills (id) on delete cascade,
  file_path text not null,
  created_by uuid references staff_users (id),
  created_at timestamptz not null default now(),
  check ((expense_id is null) <> (vendor_bill_id is null))
);
create index if not exists spend_photos_expense_idx on spend_photos (expense_id) where expense_id is not null;
create index if not exists spend_photos_bill_idx on spend_photos (vendor_bill_id) where vendor_bill_id is not null;

-- The handwritten daily book: a photo of each day's page, kept by date.
create table if not exists daybook_pages (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  file_path text not null,
  note text,
  created_by uuid references staff_users (id),
  created_at timestamptz not null default now()
);
create index if not exists daybook_pages_day_idx on daybook_pages (day desc, created_at);
