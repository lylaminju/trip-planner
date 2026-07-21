-- Country codes (CLDR/ISO region codes, e.g. {JP}) captured when a trip's
-- destination is picked from Google search. Used to restrict the trip's later
-- place searches to its destination country so generic queries (e.g. "ferry
-- terminal") stop returning unrelated foreign results. Stored as an array so a
-- future multi-country trip can hold several codes without a schema change.
-- Null/empty means no restriction.
alter table trips add column if not exists destination_country_codes text[];
