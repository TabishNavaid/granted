# Background work

FundFellows runs two kinds of background work, and they live in different places on purpose.

## Long work a person starts (in the app, on Vercel)

Reading a website, finding matches, reading a long RFP into a compliance matrix, and drafting a letter, a full proposal, a bid response, a research proposal, or an essay can each take one to three minutes. None of it holds a request open.

1. The browser makes a job id and calls `services.jobs.start` with the step it wants (`src/lib/progress-client.ts`, `runLong`).
2. The server writes a row to the `jobs` table (migration 0011), answers at once, and runs the step with `after()` in the same function, as the person who started it (`src/lib/jobs/runner.ts`). Row level security limits the step to that person's workspace, exactly as if they had clicked it.
3. Progress (the steps and the live feed) is written to the row at most once a second, with a heartbeat every 20 seconds. The browser polls `/api/progress/<id>`, which reads the row, so it does not matter which server instance answers.
4. When the step finishes, its result is stored on the row and the browser picks it up.

Each step is built to finish in about two minutes. The function may run for five (`maxDuration = 300` in `src/app/layout.tsx`, the ceiling on Vercel's Hobby plan with fluid compute; Pro allows more). If an instance is recycled mid-step, the heartbeat stops, and the sweeper (`/api/cron/jobs`, called every ten minutes by `.github/workflows/sweep-jobs.yml` with `CRON_SECRET`) starts the step again. After three tries the job is marked failed with a plain message.

Why not a hosted queue: it would add an account, a key, and a bill before the first user. Postgres plus `after()` covers the workload and keeps every job visible in the database. If drafting ever needs more than five minutes per step, move `runStoredJob` behind a queue such as Inngest or Trigger.dev; the job row and the polling stay the same.

The zero-key demo never uses this: its steps run in the visitor's own tab.

## Scheduled work

| Work | Where | Why |
| --- | --- | --- |
| Opportunity database ingestion (daily, hourly, weekly) | GitHub Actions (`.github/workflows/ingest-*.yml`) | Downloads of hundreds of megabytes and runs of many minutes do not belong in a web function. |
| Restarting stalled jobs | GitHub Actions every ten minutes, calling `/api/cron/jobs` | Vercel's Hobby plan runs cron jobs once a day at most. |
| Weekly digest and deadline reminders | Vercel Cron, calling `/api/cron/digest` and `/api/cron/reminders` | Light: a few queries and a batch of emails. |
