-- FundFellows is free. Billing is gone: no subscriptions, no plan tiers.
-- What remains is a monthly allowance of AI work per workspace (src/lib/usage/limits.ts),
-- counted from agent_runs by usage kind.

drop table if exists subscriptions;
drop type if exists plan_tier;

alter table agent_runs add column if not exists usage_kind text check (usage_kind in ('draft', 'assist'));
create index if not exists agent_runs_usage_idx on agent_runs (org_id, started_at desc) where usage_kind is not null;
