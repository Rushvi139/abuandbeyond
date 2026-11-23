-- Same repair as the top of 0035, for databases where 0035 ran before that
-- repair was added: a setting saved as a quoted JSON string becomes the
-- object it holds. Safe to run any number of times.
update settings
set value = (value #>> '{}')::jsonb
where jsonb_typeof(value) = 'string'
  and (value #>> '{}') ~ '^\s*[\{\[]';
