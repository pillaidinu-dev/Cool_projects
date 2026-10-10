# Create AI Agents Championship — Ideas & Plan

Exploration of agent ideas for Dubai's **Create AI Agents Championship** (launched Oct 2026 by the
Dubai Chamber of Digital Economy), plus a plan to get from idea to submission.

## The competition at a glance

| | |
|---|---|
| **Categories** | Best Societal AI Agent · Best Personal AI Agent · Best Business AI Agent · Best Youth AI Agent (under 21 at registration) |
| **Prizes** | AED 2.5M+ pool — AED 550K per category winner, AED 1M for "AI Agent of the Year" (the programme page quotes USD figures that don't match; confirm there) |
| **Entry** | Free, open worldwide, individuals or teams, technical or non-technical |
| **Submit** | AI-agent prototype + pitch deck + demo video |
| **Deadline** | Registration closes **Dec 2026** per the press release, **Jan 2027** per the programme timeline — treat December as the real deadline |
| **Final** | 12 finalists present a **fully working agent live on stage** to a jury, investors and industry decision-makers |
| **Judging** | No public rubric. The programme stresses how the agent reasons and acts, customer need, business potential and measurable impact |
| **Register** | https://www.dubaichamberdigital.com/en/create-ai-agents |

**What this means for idea choice:** the judges want an *agent* (it reasons, uses tools, and takes
actions), not a chatbot. They want a real, measurable problem, and something that can actually run
live on stage. Every idea below is scored against that.

---

## Idea longlist

Scoring is 1–5 on **Impact** (size and severity of the problem), **Dubai fit** (ties to local
priorities such as the D33 agenda, 2040 Urban Master Plan and food and water security, while still
scaling globally), **Build** (can one person or a small team ship a working agent by the final), and
**Demo** (can a non-technical jury see it work in 3 minutes).

| # | Idea | Category | What the agent *does* | Impact | Dubai fit | Build | Demo | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | **HeatGuard** | Societal | Watches heat and humidity per worksite, schedules water and shade breaks, sends voice alerts to outdoor workers in their own language, and escalates to supervisors when a worker doesn't check in | 5 | 5 | 4 | 5 | **19** |
| 2 | **Newcomer Navigator** | Personal / Societal | Builds a personalised arrival checklist (visa → Emirates ID → tenancy registration → bank → school), pre-fills documents, tracks deadlines and answers in 10+ languages | 4 | 5 | 4 | 4 | **17** |
| 3 | **SME Compliance & Ops Copilot** | Business | For micro-businesses: tracks trade-licence renewal, VAT and corporate-tax dates, reads invoices, plans stock and pricing, and logs sales by chat or voice (extends `stall/`) | 4 | 4 | 4 | 4 | **16** |
| 4 | **FoodLoop** | Societal | Hotels and restaurants report surplus food; the agent matches it to food banks or charities by distance and capacity, books pickup and reports kg saved and CO₂ avoided | 4 | 4 | 3 | 4 | **15** |
| 5 | **FloodWatch Neighbours** | Societal | During extreme weather (think April 2024's record rains), collects resident reports, maps flooded roads, reroutes people and checks in on registered vulnerable residents | 5 | 4 | 2 | 4 | **15** |
| 6 | **Tenant Advocate** | Personal | Reads a tenancy contract, checks a proposed rent increase against the official rental index, drafts the renewal or dispute letter and sets reminders | 3 | 5 | 3 | 4 | **15** |
| 7 | **Home Energy & Water Coach** | Personal | Reads utility bills and smart-thermostat data, finds waste, schedules the AC, tracks savings | 3 | 4 | 3 | 3 | **13** |
| 8 | **Remit Safe** | Personal / Societal | For low-income workers: compares remittance fees and rates, flags scam messages, builds a savings plan by voice | 4 | 4 | 3 | 3 | **14** |
| 9 | **Commute Copilot** | Personal | Plans Metro/tram/bus/taxi trips, reroutes on disruption, handles toll and parking reminders | 3 | 4 | 2 | 3 | **12** |
| 10 | **PlanSync Concierge** | Personal | Suggests, books and coordinates real-world meetups (extends `client/` + `server/`) | 2 | 2 | 4 | 4 | **12** |

> Best Youth AI Agent is only open to people under 21. Skip it unless a younger team member leads the entry.

---

## Shortlist: top 3

### 1. HeatGuard — *recommended*

**Problem.** Outdoor workers in construction, delivery, landscaping and security face dangerous heat
for months every year. The UAE's midday-break rule covers set hours, but the actual risk changes
hour by hour with humidity, sun and workload. Supervisors managing dozens of people can't watch
everyone. The same problem is spreading worldwide (India, Gulf, southern Europe, US Sun Belt), so
it scales well beyond Dubai.

**Why it wins.** It's easy to grasp and emotionally strong. Impact is measurable (heat incidents,
missed check-ins, break compliance). It suits a live demo: you can show a heat spike triggering
voice alerts and an escalation on stage.

**Agent loop.**
1. *Perceive*: pull hourly temperature, humidity and UV per site (Open-Meteo, free API), then compute
   a heat-stress index (WBGT estimate).
2. *Reason*: combine that with each crew's shift, task intensity and last check-in to decide the risk
   level and the break and water schedule.
3. *Act*: send WhatsApp or Telegram voice notes in the worker's language (Hindi, Urdu, Malayalam,
   Bengali, Tagalog, Arabic, English). Ask "reply 1 if OK". Escalate missed check-ins to the
   supervisor and log everything.
4. *Report*: a daily compliance and incident dashboard for the employer.

**Tools the LLM calls:** `get_site_weather`, `compute_heat_index`, `get_crew_roster`,
`send_voice_alert`, `record_checkin`, `escalate_to_supervisor`, `log_event`.

**Validation needed.** Talk to 3–5 site supervisors or safety officers, and ideally get one pilot
crew (even 10 workers for a week) for real numbers in the deck.

### 2. Newcomer Navigator

**Problem.** Dubai adds a large number of new residents every year from 200+ nationalities. Getting
set up (visa, medical test, Emirates ID, tenancy registration, utilities, bank, school) is
confusing, out of order, and expensive when a deadline is missed. Cities worldwide have the same
problem.

**Agent loop.** Short interview (nationality, visa type, family, employer) → builds a dependency
graph of steps → tracks documents and deadlines → drafts forms and emails → nudges on WhatsApp →
answers questions using retrieval over **official public sources only**, with citations.

**Risk.** It must never look like an official government service, and it needs careful handling of
personal data. Content goes stale, so it needs a source-refresh job.

### 3. SME Compliance & Ops Copilot

**Problem.** Micro-businesses (market stalls, cafeterias, home businesses, freelancers) miss
licence renewals and tax deadlines and run stock on gut feel. The UAE's 2023 corporate-tax regime
added new obligations.

**Agent loop.** The owner sends invoice photos, voice notes ("sold 30 idly, 12 rose milk") and bank
exports → the agent extracts and books them → forecasts stock and suggests prices → keeps a
compliance calendar and drafts filings for an accountant to review.

**Edge.** Reuses the sales and projection logic already in `stall/`, and has the clearest business
model (subscription per business).

---

## Recommendation

Go with **HeatGuard** for the **Societal** category. It scores highest, is the most Dubai-specific
while still global, and makes the strongest live demo. Keep **Newcomer Navigator** as the backup if
supervisor interviews show HeatGuard has no pull.

---

## Plan to submission

Target: **submit by 30 Nov 2026**, ahead of the earliest deadline reading.

| When | Milestone | Output |
|---|---|---|
| **This week** (by 17 Oct) | Register on the programme page. Lock the idea. Read the official terms and FAQ, especially IP ownership, team size and data rules | Registration confirmation |
| **Oct 17 – 26** | Problem validation: 5+ interviews (supervisors, safety officers, workers). Collect 2–3 quotes and one statistic you can cite | Interview notes, problem statement |
| **Oct 27 – Nov 9** | **Prototype v1**: weather → risk → message loop for one site with simulated crews, plus a supervisor dashboard | Working agent in this repo |
| **Nov 10 – 20** | **Prototype v2**: real messaging (Telegram first, then WhatsApp Business), multilingual voice, escalation, logs. A mini pilot if possible | Pilot data |
| **Nov 21 – 27** | Pitch deck (problem → agent → demo → impact → business model → roadmap) and a 2–3 min demo video | `deck.pdf`, `demo.mp4` |
| **Nov 28 – 30** | Polish, test with someone non-technical, **submit** | Submission |
| **If shortlisted** | Harden for the live final: offline fallback, scripted demo data, real pilot metrics, partner letters | Stage-ready agent |

### Proposed tech stack

- **Agent brain:** Claude via the Claude API (tool use) or the Claude Agent SDK
- **Backend:** Node/Express (same as `server/`) or Python FastAPI; SQLite → Postgres
- **Messaging:** Telegram Bot API for the prototype, WhatsApp Business Platform for the pilot
- **Voice:** text-to-speech for multilingual voice notes; speech-to-text for replies
- **Data:** Open-Meteo for weather; site and crew roster in the database
- **Hosting:** Render (a `render.yaml` already exists in this repo)

### Deliverables checklist

- [ ] Registered on dubaichamberdigital.com/en/create-ai-agents
- [ ] Official terms read (IP, team, data, eligibility)
- [ ] 5+ validation interviews
- [ ] Working prototype (agent reasons + calls tools + takes actions) — v1 in [`heatguard/`](../heatguard/README.md)
- [ ] Pitch deck
- [ ] Demo video (2–3 min)
- [ ] Submitted before 30 Nov 2026

## Sources

- [Business Wire press release](https://www.businesswire.com/news/home/20261008883373/en/Dubai-Launches-Global-Create-AI-Agents-Championship-with-Prize-Pool-Exceeding-AED-2.5-Million)
- [Dubai Media Office announcement](https://mediaoffice.ae/en/news/2026/october/07-10/hamdan-bin-mohammed-launches-create-ai-agents-championship)
- [Programme page — Dubai Chamber of Digital Economy](https://www.dubaichamberdigital.com/en/create-ai-agents)
- [Entrepreneur Middle East](https://mena.entrepreneur.com/business-news/sheikh-hamdan-launches-create-ai-agents-championship-with-aed2-5-million-plus-prize-pool)
- [tbreak guide](https://tbreak.com/create-ai-agents-championship-dubai/) · [OBGulf guide](https://obgulf.com/insights/create-ai-agents-championship-dubai-guide)
