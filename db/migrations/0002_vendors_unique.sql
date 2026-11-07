-- Vendors are matched by name (case-insensitive) from the accounts forms.
create unique index if not exists vendors_name_lower_idx on vendors (lower(name));
