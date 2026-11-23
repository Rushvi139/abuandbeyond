-- The owner's personal numbers come off the site (22 Nov 2026): the WhatsApp /
-- call number saved in Admin → Contact & social becomes the business number,
-- but only if it is still one of the two personal ones (or empty). Anything
-- else the owner has typed since is left alone.
--
-- Saves from Admin were storing settings as a quoted JSON string rather than
-- an object (postgres.js stringified an already-stringified value), so first
-- turn any such string back into the object it holds.
update settings
set value = (value #>> '{}')::jsonb
where jsonb_typeof(value) = 'string'
  and (value #>> '{}') ~ '^\s*[\{\[]';

update settings
set value = jsonb_set(value::jsonb, '{whatsapp}', '"+919462612045"')
where key = 'social_links'
  and (coalesce(value->>'whatsapp', '') = ''
       or regexp_replace(value->>'whatsapp', '\D', '', 'g') in ('918628910887', '8628910887', '919099720300', '9099720300'));
