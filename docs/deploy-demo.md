# Deploy the demo for free

The app runs fully in demo mode with no environment variables at all: three sample organizations, recorded agent runs replayed through the live code, real Grants.gov notices, and real private foundations from IRS Form 990-PF filings. Nothing costs money to run, and no key is needed.

These are the steps you take yourself. They take about ten minutes.

## Where to host it

Use **Render's free web service**. The demo keeps each visitor's sample workspaces in the memory of one running server, and Render runs exactly one long-lived Node process, which is what that needs.

- Free web services sleep after 15 minutes without traffic and take about a minute to wake on the next visit ([Render docs](https://render.com/docs/free)). Open the link yourself a minute before you share it or before a meeting.
- Each workspace gets 750 free instance hours a month, enough to keep one service up all month.
- Render says free instances are not for production apps. A demo is fine; when real organizations sign up, move to a paid instance.

Why not Vercel's free plan: Vercel's Hobby plan is for "non-commercial, personal use only" ([Vercel docs](https://vercel.com/docs/plans/hobby)), and an investor demo for a company is commercial. Vercel also may serve one visitor's requests from different instances, which would reset the demo's in-memory sample workspace mid-visit. If you later move to Vercel Pro with a database, both problems go away.

## Steps

1. **Push the branch to GitHub.** From the repo:

   ```
   git push origin feat/complete-demo
   ```

2. **Create a Render account** at https://dashboard.render.com and connect your GitHub account when it asks. Grant it access to this repository only.

3. **Create the service from the blueprint.** In the Render dashboard choose **New**, then **Blueprint**. Pick this repository and the `feat/complete-demo` branch (or `main` once you merge). Render reads `render.yaml` at the repo root, which defines one free Node web service named `firstlight-demo` with:
   - build command `npm ci && npm run build`
   - start command `npm start`
   - Node 22 (from `.node-version`)
   - no environment variables

   Click **Apply**. If Render asks for a payment method, the free plan still costs nothing; you can decline or add one, your choice.

   If you would rather not use a blueprint: **New**, **Web Service**, pick the repo and branch, runtime **Node**, build command `npm ci && npm run build`, start command `npm start`, instance type **Free**, and leave environment variables empty.

4. **Wait for the first deploy.** The build takes three to six minutes. When the log says the service is live, open the `onrender.com` address it shows. You should see the marketing site; `/onboarding` starts the demo with a sample organization, and `/inbox` opens the sample workspace.

5. **Check it in two minutes:**
   - `/onboarding`: paste any address. Anything other than the three sample sites gets a plain "the demo cannot read this site" and a choice of sample. Pick Second Furrow Food Network and watch it read the site, find facts, search, and score.
   - Draft a letter from one of the first three matches. It writes paragraph by paragraph and asks two or three questions; answer one and the paragraph is rewritten to cite your answer.
   - The small "Demo data" tag in the sidebar explains what is real and what is replayed.

6. **Optional: your own domain.** In the service's **Settings**, **Custom Domains**, add a domain you own and follow the DNS steps. Render issues the certificate. Set `NEXT_PUBLIC_SITE_URL` to that address under **Environment** so links in the sitemap use it (without it the app uses Render's address, which is fine).

7. **Optional: keep it awake.** A free uptime monitor that loads the home page every 10 minutes keeps the service from sleeping. One always-on service uses about 744 of the 750 free hours a month.

## Updating it

`autoDeploy` is on in `render.yaml`: every push to the branch Render watches redeploys the demo. A redeploy restarts the server, which resets everyone's demo session to the samples; that is expected.

## What the demo does not do

- It never calls an AI model. Setup, matching, and letters replay recorded runs for the three sample organizations; other sites are not read. Full proposals are recorded for one sample application (Riverbend's Meridian draft).
- It sends no email and posts nothing. Reminder emails, the weekly digest, and invites show what would be sent and when.
- Data lives in server memory per visitor and resets after 12 quiet hours or on a redeploy.

## Turning on the real product later

Nothing in the code changes. Add keys as environment variables on the same service (see `docs/setup.md`): `GEMINI_API_KEY` makes the agents run live; the Supabase keys add sign-in and storage and switch off demo mode. The first time you do, run the four SQL files in `supabase/migrations` in order.
