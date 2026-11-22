-- The owner's personal numbers come off the site (22 Nov 2026): the WhatsApp /
-- call number saved in Admin → Contact & social becomes the business number,
-- but only if it is still one of the two personal ones (or empty). Anything
-- else the owner has typed since is left alone.
update settings
set value = jsonb_set(value::jsonb, '{whatsapp}', '"+919462612045"')
where key = 'social_links'
  and (coalesce(value->>'whatsapp', '') = ''
       or regexp_replace(value->>'whatsapp', '\D', '', 'g') in ('918628910887', '8628910887', '919099720300', '9099720300'));
