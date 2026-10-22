-- Saved searches over the opportunity database for bids: NAICS codes, states, set-asides, and keywords.
-- A row with filters is a bid search; a row without is a keyword search of federal grants, as before.
alter table saved_searches add column if not exists filters jsonb;
