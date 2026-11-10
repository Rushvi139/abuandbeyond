-- Inbound WhatsApp: guest replies and Meta's delivery receipts.
--
-- Meta retries a webhook until it gets a 200, so the same message id can
-- arrive more than once; a unique id makes the second insert a no-op.
-- Receipts also move a sent row on to delivered / read.

create unique index if not exists whatsapp_messages_provider_id_idx
  on whatsapp_messages (provider_message_id) where provider_message_id is not null;

alter table whatsapp_messages drop constraint if exists whatsapp_messages_status_check;
alter table whatsapp_messages add constraint whatsapp_messages_status_check
  check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'received'));
