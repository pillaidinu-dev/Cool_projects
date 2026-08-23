# PlanSync

A dating app built around a different mechanic: no swiping on photos. You match with someone
only after you've actually met up and done something together.

1. **Host or join a plan.** Post a real activity (climbing, dinner, a trail run) with a time and
   location, or request to join someone else's.
2. **The host approves who comes.** No spam, no ghosting a stranger's inbox — just a small,
   accepted group.
3. **After the plan happens, both sides confirm attendance.** Once you *and* the other person
   both confirm you met, a match unlocks and you can chat.

## Stack

- **Backend** (`server/`): Express + `node:sqlite` (Node's built-in SQLite driver — no native
  build step), JWT auth.
- **Frontend** (`client/`): React + Vite + Tailwind CSS v4, React Router.

## Running locally

Two terminals:

```bash
# Terminal 1 — API on http://localhost:4000
cd server
npm install
npm run dev

# Terminal 2 — web app on http://localhost:5173 (proxies /api to the server)
cd client
npm install
npm run dev
```

Open http://localhost:5173. The database is seeded on first run with four demo users and a few
open plans — log in as any of them with password `password123`:

- maya@example.com (hosts a bouldering plan)
- leo@example.com (hosts a dinner + jazz plan)
- priya@example.com (hosts a trail run)
- sam@example.com (hosts board game night)

## Data model

- `users` — accounts
- `plans` — a hosted activity (title, activity type, location, time, capacity)
- `plan_joins` — join requests on a plan (`pending` / `accepted` / `declined`)
- `plan_attendance` — one row per person confirming they met a specific other person at a plan
- `matches` — created once two people have confirmed attendance with each other
- `messages` — chat between two matched users

## API overview

All routes are under `/api` and (except signup/login) require `Authorization: Bearer <token>`.

| Route | Purpose |
|---|---|
| `POST /auth/signup`, `POST /auth/login` | Create an account / get a token |
| `GET/PATCH /auth/me` | Read or update your profile |
| `POST /plans` | Host a new plan |
| `GET /plans` | Browse open plans (excludes your own) |
| `GET /plans/mine` \| `/plans/joined` | Plans you host / have been accepted into |
| `POST /plans/:id/join` | Request to join a plan |
| `GET /plans/:id/joins` | (host only) List join requests |
| `POST /plans/:id/joins/:joinId/respond` | (host only) Accept or decline a request |
| `POST /plans/:id/confirm-attendance` | Confirm you met a specific participant; creates a match once reciprocal |
| `GET /matches` | List your matches |
| `GET/POST /matches/:id/messages` | Read or send chat messages in a match |

## Deploying for private testing

The server can serve the built client itself, so the whole app runs as a single Docker
service — one URL, no separate frontend host, no CORS to configure.

**Render (recommended, no CLI needed):**

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the [Render dashboard](https://dashboard.render.com), click **New > Blueprint** and point it
   at this repo — it will pick up `render.yaml` and provision a free web service automatically,
   generating a `JWT_SECRET` for you.
3. Once deployed, Render gives you a public `https://plansync-xxxx.onrender.com` URL — share that
   with your testers.

This uses Render's **free** tier: the service spins down after 15 minutes of inactivity (cold
start on the next request), and the SQLite file is **not persisted across deploys/restarts** —
each restart reseeds the demo data. That's fine for testing the UI/UX, but real signups and
matches won't survive a redeploy. If you want data to persist, add a paid persistent disk in
Render mounted at `/app/server` (or swap SQLite for a managed Postgres instance) — ask me and
I can wire that up.

**Other platforms:** the root `Dockerfile` is platform-agnostic (`docker build -t plansync .`,
`docker run -p 4000:4000 plansync`), so this also deploys as-is to Fly.io, Railway, Google Cloud
Run, or any other Docker-based host — same persistence caveat applies unless you attach a volume.

## Notes

- `node:sqlite` is still experimental in Node — you'll see a one-line warning on server start.
  It's fine for this project; swap in `better-sqlite3` or Postgres if you want to harden it.
- Auth is a minimal JWT + bcrypt setup for demo purposes, not production-hardened (no rate
  limiting, password reset, email verification, etc).
