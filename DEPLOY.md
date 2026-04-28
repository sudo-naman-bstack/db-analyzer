# Deploying to Vercel

These steps must be done by a human (not automatable from the agent).

## 1. Push to GitHub

```bash
git remote add origin <your-github-url>
git push -u origin main
```

## 2. Create Vercel project

- Go to https://vercel.com/new
- Import the GitHub repo
- Framework: Next.js (auto-detected)
- Plan: Hobby (free tier is sufficient)
- Click "Deploy"

## 3. Provision Vercel Postgres

- In the project's **Storage** tab → "Create Database" → Postgres
- Vercel auto-injects `POSTGRES_URL` as an env var

## 4. Set environment variables

In **Settings → Environment Variables**, add:

- `JIRA_BASE_URL` = `https://browserstack.atlassian.net`
- `JIRA_EMAIL` = your-email@browserstack.com
- `JIRA_API_TOKEN` = (create at https://id.atlassian.com/manage-profile/security/api-tokens)
- `JIRA_REPORTER_ACCOUNT_ID` = `5efb524c3404690bae83acd1`
- `JIRA_PROJECT_KEY` = `TM`
- `GEMINI_API_KEY` = (create at https://aistudio.google.com/apikey)
- `CRON_SECRET` = (any random string — generate with `openssl rand -hex 32`)
- `APP_PASSWORD` = (the password your team will use to sign in — keep it strong)
- `TIMEZONE` = `Asia/Kolkata`

`POSTGRES_URL` is auto-injected by Vercel once you provision the database in step 3 — don't set it manually.

After adding env vars, **redeploy** the project (Deployments → ... → Redeploy) so the app picks them up.

## 5. App-level password (Hobby plan)

Vercel's built-in Password Protection is Pro-only. Instead, this dashboard ships with its own login:

- The `APP_PASSWORD` env var (set in step 4) is the shared password.
- Anyone visiting the dashboard hits a `/login` screen and signs in.
- Successful login sets an HTTP-only signed cookie; the cookie lasts 30 days.
- A "Sign out" link in the top nav clears the cookie.

Share the password with your director offline (Slack DM, 1Password, etc.). Treat `APP_PASSWORD` like any other secret — rotate by updating the env var in Vercel and redeploying.

## 6. Apply DB schema

After the first deployment, push the Drizzle schema to the production DB:

```bash
# Pull production env vars locally
vercel env pull .env.production.local
# Run the migration
POSTGRES_URL="$(grep POSTGRES_URL .env.production.local | cut -d '=' -f2- | tr -d '"')" npm run db:push
```

Alternative: paste the contents of `drizzle/0000_<name>.sql` into the Vercel Postgres console (Storage → Query).

## 7. Trigger first refresh

Visit the deployed URL, log in with the password, click **Refresh now** on the Overview page. The dashboard should populate with all dealblocker tickets.

## 8. Verify cron

Vercel **Hobby** plan caps cron jobs to **once per day**. `vercel.json` is set to `30 2 * * *` UTC = 8:00 AM IST daily.

- **Vercel Dashboard → Crons** tab — should show `/api/refresh` scheduled at that time
- Check `refresh_runs` table in Postgres to see history of cron-triggered runs

### Want more frequent refreshes than once per day?

Two free options:
- **Use the "Refresh now" button** on the Overview page — refreshes on demand whenever you visit.
- **Enable the GitHub Actions workflow** at `.github/workflows/refresh.yml.example`. Rename it to `refresh.yml`, add `DASHBOARD_URL` and (if password protection is on) `VERCEL_BYPASS` secrets in your repo settings, and it will hit `/api/refresh?trigger=manual` every 30 minutes from GitHub's runners. Free for private repos within the 2,000-min/month allowance — well under what this would consume.

## 9. Share with Director

Send the URL + password.
