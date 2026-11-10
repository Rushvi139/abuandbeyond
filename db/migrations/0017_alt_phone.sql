-- A second number to try when the first one doesn't ring.
--
-- Mount Abu has real dead spots — inside the older hotels, down towards
-- Gaumukh, anywhere on the far side of the ridge. A rider standing at a gate
-- with one unreachable number is the single most common way a delivery goes
-- wrong here, and the guest is usually with someone whose phone does work.
alter table orders add column if not exists alt_phone text;
