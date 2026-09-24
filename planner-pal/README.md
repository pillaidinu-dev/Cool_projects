# Planner Pal 🗓️

A bright, friendly weekly planner built for middle schoolers — a grid of every day of the
week and every hour after school, so there's always room to write down what's next.

## Features

- **Week grid** — seven days across, hourly time slots (7 AM – 8 PM) down the side. Tap any
  empty slot to add a to-do.
- **Subjects with colors and emoji** — Homework 📚, Chores 🧹, Sports ⚽, Reading 📖,
  Family 👨‍👩‍👧, Fun 🎉, Other ⭐ — so a glance at the week shows what kind of day it is.
- **Reminders** — check "Remind me" on any to-do and Planner Pal will pop up a reminder
  (as a browser notification, plus an in-app banner as a fallback) when it's time.
- **Mark things done** — check a to-do off and it gets a strike-through instead of vanishing,
  so finishing something still feels good.
- **Prev / Next / Today** — flip between weeks; today's column is always highlighted.
- **Saves automatically** — everything is stored in the browser (`localStorage`), so closing
  the tab doesn't lose anything. No account, no sign-up.

## Stack

- **Frontend** (`client/`): React + Vite + Tailwind CSS v4. All planner data lives in the
  browser — there's no database and no API calls for to-dos.
- **Backend** (`server/`): a minimal Express server that just hosts the built client as static
  files, so it deploys the same way as the other projects in this repo.

## Running locally

```bash
cd planner-pal/client
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). That's it — no server or database
needed for local development.

To try the production build (client + the tiny static server together):

```bash
cd planner-pal/client && npm install && npm run build
cd ../server && npm install && npm start
```

Then open http://localhost:4200.

## Notes

- Reminders only fire while the tab is open (or, once you allow notifications, even if it's in
  the background) — Planner Pal doesn't have a backend to send reminders while your device is
  off or the browser is closed.
- Data is stored per-browser. Planning on a different device or browser starts a fresh planner.
