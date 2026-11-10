-- The real handles. They were editable from /admin/menu all along but had
-- never been filled, so the wall showed three dead grey buttons.
--
-- Merged rather than replaced, so anything already set by hand survives.
update settings
set value = value || '{"instagram": "abuandbeyond", "google_review": "https://g.page/r/CYsz75HyCeNREAI/review", "whatsapp": "+918628910887"}'::jsonb
where key = 'social_links';

insert into settings (key, value)
values ('social_links', '{"instagram": "abuandbeyond", "google_review": "https://g.page/r/CYsz75HyCeNREAI/review", "whatsapp": "+918628910887", "email": null}'::jsonb)
on conflict (key) do nothing;
