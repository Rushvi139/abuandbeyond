-- One kitchen, one address.
--
-- Settings said "Bhagyaraj House, near Hotel Hillock" while the legal pages
-- said "Adarsh Colony, behind Hotel Hillock". This row is what rider
-- navigation starts from, so the two disagreeing is a wrong turn waiting to
-- happen. Adarsh Colony is the one, confirmed by the owner.
--
-- lat/lng stay as they are: a pin should be dropped on the spot, not guessed
-- from an address, and a wrong pin is worse than none.
update settings
set value = jsonb_set(value, '{address}',
  '"Adarsh Colony, behind Hotel Hillock, Mount Abu, Sirohi, Rajasthan 307501"'::jsonb)
where key = 'kitchen_location';
