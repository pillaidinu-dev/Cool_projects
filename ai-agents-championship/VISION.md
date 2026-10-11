# HeatGuard — the bigger vision

> **One line:** An AI safety officer for every outdoor worker. It predicts dangerous heat,
> replans the work around it, talks to each worker in their own language, and proves to
> employers, insurers and regulators that people were kept safe.

The prototype in [`heatguard/`](../heatguard/README.md) is the wedge: heat alerts and check-ins
for one site. This document is the company that wedge opens up.

---

## 1. Why this is a venture-scale problem

| Fact | Source |
|---|---|
| **2.4 billion** of the world's 3.4 billion workers are exposed to excessive heat at work, up from 65.5% to 70.9% of the workforce in two decades | ILO, *Ensuring safety and health at work in a changing climate* (2024) |
| Excessive heat causes about **22.85 million occupational injuries** and **18,970 deaths** a year | same report |
| Better workplace heat protection could save up to **US$361 billion** globally | ILO heatwave follow-up report |
| Heat stress will cost the equivalent of **80 million full-time jobs** and **US$2.4 trillion** a year by 2030 (136 million jobs if work is in the sun) | ILO, *Working on a Warmer Planet* (2019) |
| Construction and agriculture are the hardest hit; South Asia and West Africa lose ~5% of working hours | same report |

**The Gulf is the ideal launch market.** It has some of the harshest working heat on earth, a
huge outdoor migrant workforce, mandatory rules (the UAE midday break), very large construction
pipelines across the GCC, and governments that actively buy AI. If it works in Dubai in August,
it works anywhere.

**The problem is getting worse every year and moving north.** India, South-East Asia, southern
Europe and the US Sun Belt are all bringing in heat rules. That's a regulatory tailwind that
creates demand without us having to create it.

---

## 2. From alert app to platform: four layers

```
            ┌──────────────────────────────────────────────────────────────┐
  PROVE     │ Compliance & ESG reports · audit trail · insurer risk scores │
            ├──────────────────────────────────────────────────────────────┤
  ACT       │ Worker voice companion · supervisor app · shift replanning · │
            │ water/shade/cooling logistics · emergency dispatch           │
            ├──────────────────────────────────────────────────────────────┤
  REASON    │ Multi-agent brain + deterministic safety floor               │
            ├──────────────────────────────────────────────────────────────┤
  SENSE     │ Forecasts · on-site WBGT sensors · wearables · worker replies│
            └──────────────────────────────────────────────────────────────┘
```

### Sense: from weather to the individual
1. **Today:** public weather forecasts → estimated WBGT per crew.
2. **Next:** low-cost on-site WBGT sensors (a few per site) for measured, auditable readings.
3. **Then:** optional smart bands (heart rate, skin temperature, movement) for **personal**
   risk, not just site risk. Workers opt in; data stays theirs (see §8).
4. **Always:** the worker's own voice. "I feel dizzy" in Malayalam is the most important sensor.

### Reason: a team of agents, not one bot
This is what makes it a true *AI agent* entry and not a dashboard:

| Agent | Job | Example |
|---|---|---|
| **Planner** | Plans tomorrow's work around tomorrow's heat | "Thursday hits 46 °C at 13:00. Move the concrete pour to 04:30, put facade work on the shaded north side after 11:00, and order 2 extra cooling stations." |
| **Site guardian** | Runs the live loop (the current prototype) | Raises plans, sends alerts, chases check-ins, escalates |
| **Worker companion** | Two-way voice conversation in 10+ languages over WhatsApp | Answers "can I take a break now?", explains symptoms, collects how people feel |
| **Logistics** | Water, shade, cooling vests, rest-area capacity | "Crew C3 will need 180 L of water today; rest tent B is over capacity at 13:00." |
| **Compliance** | Writes the evidence | Weekly midday-break compliance report, incident timeline, ISO 45001 evidence pack |

All of them sit on top of the same **deterministic safety floor**, so the AI can only ever make
protection stricter. This is the answer to "what if the AI is wrong?", which every investor
and safety director will ask.

### Act: where the value lands
- **Workers:** voice notes in their own language, a reason to trust the system, faster help.
- **Supervisors:** one screen per site, with fewer, better alerts.
- **Project managers:** heat-aware schedules that protect people *and* keep the project on time.
- **Head office:** a live map of every site, crew and incident across the company.

### Prove: the part companies pay for
- Automatic compliance evidence (midday break, rest cycles, water, training).
- Incident reconstruction: what the heat was, what was sent, who responded, when.
- **ESG and social-sustainability reporting**: worker welfare is a growing requirement from
  lenders, developers and sovereign clients.
- Risk scores that **insurers** can price.

---

## 3. Who pays (customer segments)

| Segment | Pain | Why they buy |
|---|---|---|
| **Main contractors & subcontractors** | Incidents, lost hours, fines, reputation | Fewer incidents, proof of compliance, heat-aware scheduling |
| **Developers & giga-project owners** | Worker welfare scrutiny on flagship projects | Mandate it across all subcontractors; one dashboard for the whole project |
| **Insurers** (workers' comp, health, contractor all-risk) | Can't see or price heat risk | Data partnership, premium discounts for insured users, fewer claims |
| **Government / labour ministries / municipalities** | Enforcing heat rules across thousands of sites | City-wide heat early warning plus a compliance view (a B2G contract) |
| **Delivery & ride platforms** | Riders working all day in the heat | Rider safety nudges and route/break planning |
| **Agriculture, utilities, oil & gas, ports, events** | Field crews in remote heat | The same platform with different templates |
| **Indoor hot workplaces** (kitchens, laundries, warehouses, foundries) | Year-round heat | Removes the seasonality of the business |

**Go-to-market:** land with 2–3 Dubai contractors → reference case → developers mandate it on
their subcontractors (one sale, many sites) → insurer partnership brings distribution → GCC
expansion → India / South-East Asia, where the workforce is far bigger.

---

## 4. Business model (hypotheses to validate)

| Stream | Model | Notes |
|---|---|---|
| **SaaS per worker** | Monthly fee per active outdoor worker | Price must be tested in pilots; anchor against the cost of one heat incident |
| **Enterprise / project licence** | Annual per project or company | For developers mandating it across subcontractors |
| **Hardware-as-a-service** | Lease WBGT sensors and bands | Higher revenue per site and stickier, but margins need care |
| **Compliance & ESG module** | Premium add-on | Reports for regulators, lenders and clients |
| **Insurance data partnerships** | Revenue share or data licence | Anonymised, aggregated, worker-consented only |
| **Government contracts** | City/national heat-safety programmes | Long sales cycles but large and defensible |

**ROI story for a contractor:** one serious heat incident costs medical care, lost time, an
investigation, possible fines, reputational damage and project delay. HeatGuard pays for itself
if it prevents even one a year on a mid-size site. Replanning heavy work to cooler hours also
*recovers* productive hours otherwise lost to the heat.

---

## 5. The moat

1. **Data:** a growing dataset that links heat exposure, worker signals, responses and
   incidents. Nobody has this at scale, and every site makes the risk models better.
2. **Language and trust:** reviewed safety content and voice in the languages migrant workers
   actually speak, plus a design workers trust because it's on their side.
3. **Workflow lock-in:** once schedules, compliance reports and insurers run through it, it's
   hard to rip out.
4. **Regulatory alignment:** built around Gulf heat rules first, with others added as they
   arrive.
5. **Network effects:** benchmarks across sites ("your site is in the worst 10% for missed
   check-ins") that only exist with many customers.

---

## 6. Impact metrics (what we measure from the first pilot)

- Heat-related incidents and near-misses per 1,000 worker-days (vs. before / vs. control crew)
- Check-in response rate and time to respond to an unwell report
- Rest cycles and water breaks actually taken vs. planned
- Hours of heavy work moved out of peak heat
- Worker trust score (short monthly voice survey)
- Supervisor time spent on heat management

These double as **the championship's "measurable impact"** and **the investor deck's traction
slide**.

---

## 7. Roadmap

| When | Milestone |
|---|---|
| **Oct–Nov 2026 (submission)** | Prototype v2: WhatsApp/Telegram on real phones, Planner agent with forecast replanning, multi-site command centre, auto-generated compliance report, worker voice replies. Pitch deck + demo video. |
| **Dec 2026 – Grand Final** | Pilot with 1–2 contractors (50–200 workers). Because Dubai is cooler in winter, also pilot **year-round hot indoor sites** (kitchens, laundries, warehouses) and **replay last summer's weather** through the system to show what it would have done. |
| **2027 H1** | First paying customers in Dubai/UAE; on-site WBGT sensors; an insurer partnership; Arabic/Urdu/Hindi/Malayalam/Bengali/Tagalog/Nepali/Sinhala reviewed content. |
| **2027 H2** | Ready for summer peak at scale; developer-wide deployments; expand across the GCC. |
| **2028+** | India and South-East Asia; wearables; multi-hazard (dust storms, air quality, flooding, UV); government early-warning contracts. |

---

## 8. Risks and how we answer them

| Risk | Answer |
|---|---|
| **"It's surveillance."** | Worker-first design: opt-in wearables, data minimisation, workers can see their own data, no use for performance management. Compliant with UAE data-protection law. This is also a selling point. |
| **"What if the AI gets it wrong?"** | A deterministic safety floor the AI can't override; it is decision support, not medical diagnosis; human escalation for anything serious. |
| **Seasonality** | Southern hemisphere markets, year-round indoor heat, multi-hazard expansion, and compliance reporting that's needed all year. |
| **Hardware cost** | Software-first with forecast-based estimates; sensors optional and leased. |
| **Slow enterprise sales** | Developer mandates and insurer distribution sell one-to-many. |
| **Translation accuracy** | Native-speaker review and worker feedback loops; templates, not free text, for safety instructions. |

---

## 9. What this means for the championship

- **Category:** still **Best Societal AI Agent**. The multi-agent platform and business model
  also make it a strong **AI Agent of the Year** contender (the AED 1M prize).
- **Pitch arc:** a worker collapses on a site (human story) → the scale (ILO numbers) → live
  demo (heat spike → replanned shift → worker voice → escalation → compliance report) →
  pilot results → business model → ask.
- **The demo must show more than alerts.** Next build priority:
  1. **Planner agent:** "plan tomorrow" from the forecast, with a before/after schedule ✅ built
  2. **Multi-site command centre:** a map of all sites and live risk ✅ built
  3. **Compliance report:** a one-click PDF of the day ✅ built
  4. **Real phones:** a WhatsApp or Telegram voice note arriving on stage
  5. **Wearable simulation:** one worker's heart rate rising triggers a personal alert

## Sources

- [ILO — More workers than ever are losing the fight against heat stress](https://www.ilo.org/resource/news/more-workers-ever-are-losing-fight-against-heat-stress)
- [WAM — Climate change creates a "cocktail" of hazards for 70% of workers (ILO 2024)](https://www.wam.ae/en/article/b2s9qn8-climate-change-creates-‘cocktail’-serious-health)
- [Down To Earth — ILO flags risk of excessive heat to 2.4 billion workers](https://www.downtoearth.org.in/news/climate-change/ilo-flags-risk-of-excessive-heat-to-2-4-billion-workers-globally-indian-workers-among-those-at-high-risk-95750)
- [ILO — Heat stress productivity loss equivalent to 80 million jobs](https://www.ilo.org/resource/news/increase-heat-stress-predicted-bring-productivity-loss-equivalent-80)
- [HR Reporter — 80 million full-time jobs affected by 2030](https://www.hrreporter.com/workplace-health-and-wellness/40503-heat-stress-from-climate-change-to-have-massive-im/)
