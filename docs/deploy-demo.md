# Deploy the demo on Vercel

The app runs fully in demo mode with no environment variables at all: six fictional samples (three nonprofits, an architecture and engineering firm, a university lab, a student), recorded agent runs replayed through the live code, real Grants.gov and SAM.gov notices, a real VA solicitation, and real private foundations from IRS Form 990-PF filings. No key is needed and nothing calls a paid service.

These are the steps you take yourself. They take about ten minutes.

## How the demo runs on Vercel

Vercel runs the app as serverless functions, and a function's memory does not last from one request to the next. So with no keys, the demo does not keep anything on the server:

- Each visitor's sample workspaces live in their own browser (localStorage; sessionStorage, then memory for the tab, if the browser refuses). A reload, a new tab, or a request served by a different instance changes nothing. Two visitors never see each other's changes.
- The recorded runs play back in the browser, at the pace they took live, and the progress feed reads them there.
- Pages render in the browser from that saved state. The server sends the page shells and does only work that keeps nothing: reading an uploaded PDF or Word file into text, and fetching a solicitation link.

Setting a model key or the Supabase keys turns this off; the app then runs on the server as usual (see "Turning on the real product later").

## Plan

The Hobby plan is free. Vercel says it is for "non-commercial, personal use only" ([Vercel docs](https://vercel.com/docs/plans/hobby)); an investor demo for a company may count as commercial, so read the terms and use Pro if it does. Nothing else in these steps changes between the two.

## Steps

1. **Push to GitHub.** From the repo, on `main`:

   ```
   git push origin main
   ```

2. **Create a Vercel account** at https://vercel.com/signup and connect GitHub when it asks. Grant it access to this repository only.

3. **Import the project.** In the Vercel dashboard choose **Add New**, then **Project**, and import this repository. Vercel detects Next.js; keep its defaults:
   - framework preset **Next.js**
   - build command `next build`, output handled by Vercel
   - production branch `main`
   - no environment variables

   Click **Deploy**.

4. **Wait for the first deploy.** The build takes three to six minutes. Open the `vercel.app` address it shows. You should see the marketing site; `/onboarding` starts the demo with a sample, and `/inbox` opens the sample workspace.

5. **Check it in two minutes:**
   - `/onboarding`: choose Nonprofit and paste any address. Anything other than the sample sites gets a plain "the demo cannot read this site" and a choice of sample. Pick Second Furrow Food Network and watch it read the site, find facts, search, and score.
   - Draft a letter from one of the first three matches. It writes paragraph by paragraph and asks two or three questions; answer one and the paragraph is rewritten to cite your answer. Reload the page: the answer is still there.
   - Switch to the sample firm in the sidebar, open Bids, choose **Add an RFP**, then **Use the sample notice**: the compliance matrix, go/no-go, the draft, and the SF 330 come from the real VA notice.
   - The small "Demo data" tag in the sidebar explains what is real and what is replayed.

6. **Optional: your own domain.** In the project's **Settings**, **Domains**, add a domain you own and follow the DNS steps. Vercel issues the certificate. Set `NEXT_PUBLIC_SITE_URL` to that address under **Settings**, **Environment Variables** so the sitemap and social cards use it (without it the app uses Vercel's production address, which is fine), then redeploy.

## Updating it

Every push to `main` deploys to production; pushes to other branches get their own preview address. Visitors keep their saved demo across deploys. When a deploy changes the shape of the saved state, the version number in `src/lib/services/demo-session.ts` goes up and visitors start again from the samples.

## What the demo does not do

- It never calls an AI model. Setup, matching, and letters replay recorded runs for the six samples; other sites are not read. Full proposals are recorded for one sample application (Riverbend's Meridian draft). The firm's sample bid replays a real VA notice; an RFP a visitor uploads is read by plain rules, and its cover letter and approach start as an outline because there is no model. SAM.gov shows a recorded search.
- It sends no email and posts nothing. Reminder emails, the weekly digest, and invites show what would be sent and when. It connects no Google or Microsoft account.
- What a visitor does stays in their browser. Clearing site data, or a private window closing, starts them over from the samples. The calendar feed link serves the samples' dates, since a calendar app cannot read a visitor's browser.
- Vercel limits an upload to 4.5 MB. A larger solicitation gets a plain message asking for the main document on its own.

## Turning on the real product later

Nothing in the code changes. Add keys under **Settings**, **Environment Variables** (see `docs/setup.md`), then redeploy: `GEMINI_API_KEY` makes the agents run live; the Supabase keys add sign-in and storage and switch off demo mode. The first time you do, run the five SQL files in `supabase/migrations` in order. `SAM_GOV_API_KEY` (free) turns on live SAM.gov search for firms. With a model key and no Supabase, demo state lives in server memory, which suits one long-running server (local development), not serverless.
