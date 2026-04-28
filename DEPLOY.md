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
- `TIMEZONE` = `Asia/Kolkata`

`POSTGRES_URL` is auto-injected by Vercel — don't set it manually.

## 5. Enable password protection

- **Settings → Deployment Protection** → toggle on **Password Protection**
- Set a shared password
- Share with Director

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

- **Vercel Dashboard → Crons** tab — should show `/api/refresh` running every 30 minutes
- Check `refresh_runs` table in Postgres to see history of cron-triggered runs

## 9. Share with Director

Send the URL + password.
