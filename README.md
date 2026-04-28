# Dealblocker Dashboard

Internal dashboard for BrowserStack Test Management dealblocker tickets.

## Local dev

1. `cp .env.example .env.local` and fill in values.
2. `npm run dev`
3. Visit http://localhost:3000

## Deploy

Vercel project. Postgres + Cron + password protection configured in Vercel dashboard.

See `docs/superpowers/specs/2026-04-28-dealblocker-dashboard-design.md` for full design.
