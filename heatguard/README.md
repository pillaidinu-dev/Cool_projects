# HeatGuard

An AI agent that protects outdoor workers from heat stress. Entry prototype for the Dubai
**Create AI Agents Championship** (Best Societal AI Agent). See
[`../ai-agents-championship/PLAN.md`](../ai-agents-championship/PLAN.md) for the plan.

![HeatGuard dashboard](docs/dashboard.png)

## What it does

1. **Perceives.** Pulls site weather (Open-Meteo) and estimates heat stress (WBGT) for each
   crew, adjusted for how heavy their work is.
2. **Reasons.** When something changes (risk level moves, a worker misses a check-in, a worker
   says they feel unwell or sends a message), Claude inspects the site and decides what to do.
3. **Acts.** Sets each crew's water and work/rest schedule, sends alerts to workers in their
   own language (Hindi, Urdu, Malayalam, Bengali, Tagalog, Arabic, English) with voice
   playback, asks workers to check in ("reply 1 if OK, 2 if unwell"), and escalates to the
   supervisor.
4. **Guarantees a safety floor.** A deterministic rules engine runs every tick. Whatever the
   model does, or if it's unreachable, every crew has at least the standard protective plan,
   every worker knows the current level, and every missed check-in or unwell report reaches the
   supervisor. The agent can make the response **stricter**, never weaker.

It also follows the UAE midday break (no outdoor work 12:30–15:00, 15 June – 15 September).

### Design choices worth pitching

- **The LLM decides, templates speak.** Claude picks which pre-translated message to send. It
  never writes free text to workers, so safety instructions stay consistent and reviewed.
- **Event-driven reasoning.** Routine work (reminders, timeouts) is plain code. Claude is only
  called when something needs judgement, which keeps it cheap and fast.
- **Free-text understanding.** A worker can reply "sir head is spinning" or reply in Hindi;
  Claude reads it and escalates as critical. Without the agent, free text goes to a human.

## Run it

```bash
cd heatguard
npm install
npm start                       # http://localhost:4200
```

It runs with the **rules engine only** until you give it Claude credentials:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

| Env var | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Turns on the Claude agent |
| `HEATGUARD_MODEL` | `claude-opus-5-5` | Model for the agent |
| `HEATGUARD_AGENT` | – | Set to `rules` to force rules-only mode |
| `PORT` | `4200` | |

The agent uses server-side refusal fallbacks (`fallbacks: "default"`), so if the model ever
declines a request the API retries it on a fallback model. If everything fails, the rules
engine still acts.

## Demo script (about 3 minutes)

1. Start on **Cool morning**. Everyone is Normal/Caution. Open a worker's phone on the right.
2. Click **Heat spike**. Crews jump to Danger/Extreme. Workers get the new schedule in their
   language; tick "Read new messages aloud" to hear it.
3. At **20× demo** speed, check-ins arrive about every 45 seconds. Reply **1** for some workers
   and ignore others. After about 30 seconds, missed check-ins escalate to the supervisor.
4. On a worker's phone, type something like *"feeling dizzy"* (with Claude enabled). The agent
   sends first-aid guidance and raises a **critical** alert. Or press **2 · Unwell**.
5. Click **Checked** on the supervisor side to close the loop.

## How it's built

```
src/heat.js      WBGT estimate (Stull wet-bulb + globe temp), risk levels, floor plans, midday rule
src/weather.js   Open-Meteo, a simulated Dubai profile as fallback, demo scenarios
src/i18n.js      Worker message templates in 7 languages
src/store.js     In-memory site state, outbox, supervisor alerts
src/agent.js     Claude tool-use loop: get_site_status, set_crew_plan, send_worker_message, escalate_to_supervisor
src/monitor.js   Tick loop: perceive → detect events → Claude → safety floor → routine check-ins
src/server.js    Express API + static dashboard
public/          Supervisor dashboard + worker phone simulator (no build step)
```

```bash
npm test   # heat maths, translations, and the safety floor end to end
```

## Limits (prototype)

- WBGT is **estimated** from weather data. A real deployment should use on-site WBGT meters.
- Risk thresholds loosely follow ACGIH / ISO 7243 action limits for acclimatised workers. They
  need review by an occupational health professional.
- Translations are drafts. Have native speakers check them before a pilot.
- State is in memory and messages go to the on-screen phone simulator.

## Next steps

- Telegram bot, then WhatsApp Business, for real phones; text-to-speech voice notes
- Speech-to-text so workers can reply by voice
- Persistence (SQLite → Postgres), multiple sites, supervisor login
- Daily compliance report (breaks taken, check-in rate, incidents) for employers
- Pilot with one crew to get real numbers for the pitch deck
