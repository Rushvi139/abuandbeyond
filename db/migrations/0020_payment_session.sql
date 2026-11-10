-- Keep the payment session and the account it belongs to.
--
-- Two gaps this closes:
--
--  * A guest who closed the tab mid-payment had no way back. The session is
--    what Cashfree's checkout opens against, so holding it lets us put a
--    "Pay now" button on their own order page and hand them the link again.
--  * A sandbox order and a live one looked identical here. After the switch
--    to production keys, an order's gateway_order_id may belong to an account
--    we can no longer query, and nothing in the row said so.

alter table orders add column if not exists payment_session_id text;
alter table orders add column if not exists gateway_env text;

do $$ begin
  alter table orders add constraint orders_gateway_env_check
    check (gateway_env is null or gateway_env in ('sandbox', 'production'));
exception when duplicate_object then null; end $$;

-- Everything taken before this migration was taken in sandbox: the switch to
-- production keys has not happened yet, so this is a statement of fact, not a
-- guess.
update orders set gateway_env = 'sandbox' where gateway_order_id is not null and gateway_env is null;
