-- Kitchen force-open override and UPI QR settings
insert into settings (key, value) values
  ('kitchen_override', 'false'),
  ('upi_id', '"rushvikhambhu-1@okhdfcbank"')
on conflict (key) do nothing;
