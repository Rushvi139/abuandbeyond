-- Makes the whatsapp_messages table from 0001 into a working outbox.
--
-- 0001 sketched the right shape — order, phone, direction, template, status,
-- attempts — but left out what a queue actually needs: which event a row is
-- for, when to try it next, the parameters to send, and a way to be sure one
-- event produces one message. Extending it keeps a single audit trail, and
-- keeps the 'in' direction that unit 13's inbound replies will use.
--
-- Messages are queued here rather than sent from the request that placed the
-- order. Meta being slow must not make ordering slow, Meta being down must
-- not make ordering fail, and a send that fails needs somewhere to wait.

alter table whatsapp_messages add column if not exists customer_id uuid references customers (id) on delete set null;
-- Which event this is: 'order_confirmed', 'out_for_delivery', …
alter table whatsapp_messages add column if not exists kind text;
-- The template parameters, exactly as posted — for support, and for audit.
alter table whatsapp_messages add column if not exists payload jsonb not null default '{}'::jsonb;
alter table whatsapp_messages add column if not exists send_after timestamptz not null default now();
alter table whatsapp_messages add column if not exists sent_at timestamptz;

do $$ begin
  alter table whatsapp_messages add constraint whatsapp_messages_status_check
    check (status in ('queued', 'sent', 'failed', 'skipped'));
exception when duplicate_object then null; end $$;

-- The dispatcher's query: the next few that are due.
create index if not exists whatsapp_messages_due_idx on whatsapp_messages (send_after)
  where status = 'queued';

-- One message per event per order. A repeated transition, a double-tapped
-- "Ready" or a webhook arriving twice must not message the guest twice.
create unique index if not exists whatsapp_messages_once_idx
  on whatsapp_messages (order_id, kind)
  where order_id is not null and kind is not null and direction = 'out';

create index if not exists whatsapp_messages_order_idx on whatsapp_messages (order_id, created_at desc);
