-- Staff can sign in with a username instead of a phone number.
-- Stored lowercase; phone and email still work for anyone who has them.
alter table staff_users add column if not exists username text;

create unique index if not exists staff_users_username_key on staff_users (lower(username)) where username is not null;

-- The original table demanded a phone or an email; a username is now enough.
alter table staff_users drop constraint if exists staff_users_check;
alter table staff_users add constraint staff_users_identifier_check
  check (phone is not null or email is not null or username is not null);
