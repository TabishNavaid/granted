-- A private bucket for compact public-registry shards (IRS exempt organization records split by EIN prefix).
-- Lookups read one small file by EIN, so the 1.9 million row registry never sits in the database.
insert into storage.buckets (id, name, public) values ('registry', 'registry', false)
on conflict (id) do nothing;
-- No storage policies: only the service role (server and ingestion) reads or writes it.
