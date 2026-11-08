-- Demo orders: a real trip through the pipeline for training and testing,
-- without touching money or stock. Flagged so every money view can ignore them.
alter table orders add column if not exists is_demo boolean not null default false;
create index if not exists orders_demo_idx on orders (is_demo) where is_demo;

-- Money views must never count a demo.
create or replace view daily_sales as
  select (paid_at at time zone 'Asia/Kolkata')::date as day,
         count(*) as orders,
         sum(subtotal_paise - discount_paise) as net_sales_paise,
         sum(gst_paise) as gst_paise,
         sum(total_paise) as gross_paise
  from orders
  where status not in ('pending_payment', 'payment_failed', 'cancelled')
    and not is_demo
  group by 1;

-- Where the kitchen is, for rider directions. Editable in the back office.
insert into settings (key, value)
values ('kitchen_location', '{"address": "Bhagyaraj House, near Hotel Hillock, Mount Abu, Rajasthan 307501", "lat": null, "lng": null}'::jsonb)
on conflict (key) do nothing;
