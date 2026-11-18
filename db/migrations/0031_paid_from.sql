-- Which of our accounts money went out of: HDFC bank, Saraspur bank (where UPI
-- and QR payments land), or the cash taken in from orders. Nullable, because
-- entries made before this have no answer until someone tags them on the
-- Bank & cash screen.
alter table expenses add column if not exists paid_from text
  check (paid_from in ('hdfc', 'saraspur', 'cash'));
alter table vendor_payments add column if not exists paid_from text
  check (paid_from in ('hdfc', 'saraspur', 'cash'));
