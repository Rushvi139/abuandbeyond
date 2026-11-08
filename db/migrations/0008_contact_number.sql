-- The kitchen's public number, for the call and WhatsApp buttons on Help.
-- Only fills a blank: anything set in the back office wins.
update settings
set value = jsonb_set(coalesce(value, '{}'::jsonb), '{whatsapp}', '"+918628910887"', true)
where key = 'social_links'
  and (value->>'whatsapp') is null;

insert into settings (key, value)
values ('social_links', '{"instagram": null, "google_review": null, "whatsapp": "+918628910887", "email": null}'::jsonb)
on conflict (key) do nothing;
