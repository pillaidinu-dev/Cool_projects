# HeatGuard — demo video script

**Length:** 2:45 (aim for 2:30–3:00; check the portal for the official limit)
**Format:** screen recording of https://heatguard-7jg3.onrender.com with your voice-over, plus 2–3 deck slides
**Voice-over:** about 400 words; read at a calm pace (~150 words a minute)
**Mode:** rules-only works for everything below. Lines marked **[Claude]** are optional extras if you
record with the API key on.

---

## Before you record

**Set up (5 minutes before)**
- [ ] Open the site and wait for it to wake up (the free plan sleeps; the first load can take a minute).
- [ ] Press **Reset** in the top bar. This clears old alerts, check-ins and the compliance record.
- [ ] Check the speed is **20× demo**.
- [ ] Browser at **1920×1080**, zoom 100%, full screen (F11), bookmarks bar hidden, notifications off.
- [ ] Turn your computer's sound on and pick a system voice for the languages if you want voice
      playback on the recording (Chrome on Windows/Mac has Hindi and Arabic voices; others vary).
- [ ] Have the deck open in another tab on slide 1 (cover), slide 3 (the crisis) and slide 6 (how the agent works).

**Recording tips**
- Record each scene as a **separate clip** and join them afterwards. The live system runs in real
  time, so you can cut out waiting and re-take a scene without starting over.
- Record the voice-over **separately** afterwards, over the edited video. It's much easier than
  talking while clicking.
- Move the mouse slowly and pause for a second on everything you want the viewer to read.
- Free tools: OBS Studio or Loom (recording), CapCut or Clipchamp (editing, captions).
- Add **burned-in captions**: judges often watch without sound.

**Timing at 20× demo speed** (useful while recording)
| What happens | How long to wait |
|---|---|
| Risk changes after you click a weather button | 2–4 seconds |
| First check-ins after a heat spike | about 45 seconds |
| A check-in nobody answers becomes a missed check-in and is escalated | about 30 seconds after it's sent |
| Plan tomorrow finishes (rules-only) | 1–2 seconds |

---

## The script

### Scene 1 — Hook (0:00–0:15)
**Screen:** Deck slide 1 (cover), then slide 2 (the "Imagine" story).
**Voice-over:**
> "It's 1:40 in the afternoon, 45 degrees, on a Dubai construction site. A steel fixer starts to feel
> dizzy. Their supervisor is managing forty people, and the safety notice is in a language they
> don't read."

**Caption:** *An illustrative scenario*

### Scene 2 — The problem (0:15–0:30)
**Screen:** Deck slide 3 (the four ILO numbers).
**Voice-over:**
> "This isn't rare. The International Labour Organization estimates 2.4 billion workers are exposed
> to excessive heat, with nearly 19,000 deaths a year. And it's getting worse every summer."

**Caption:** *Source: ILO (2024)*

### Scene 3 — The command centre (0:30–0:55)
**Screen:** The app opens on **Command centre**. Weather is *Hot afternoon*.
1. Pause on the map and the totals (1 second).
2. Click **Heat spike** in the top bar. Wait for the pins to turn red and purple and the totals to jump (3 seconds).
3. Hover over a coastal pin (Dubai Creek or Jebel Ali), then over Al Ain.

**Voice-over:**
> "This is HeatGuard, an AI safety officer for every outdoor worker. Head office sees every site on
> one map. When a heat spike hits, every site reacts, and here's something an ordinary weather alert
> gets wrong: humid coastal sites can be more dangerous than hotter inland ones, because humidity
> drives heat stress."

**Caption:** *1 live site + 7 demo sites*

### Scene 4 — Workers in their own language (0:55–1:20)
**Screen:**
1. Click the **Mixed-use Block 4 (Al Quoz)** row, then **Open live site**.
2. Pause on the crews at Danger/Extreme with their new work/rest schedules.
3. On the right, the **Worker phone**: pick **Ramesh Kumar (हिन्दी)**. Tick **Read new messages aloud**
   or press 🔊 on the latest message so the Hindi voice plays.
4. Switch to **Ahmed Saleh (العربية)** for one second to show Arabic.

**Voice-over:**
> "On site, HeatGuard works out the heat stress for every crew. The moment risk rises it tightens
> each crew's water and rest schedule, and tells every worker — in Hindi, Urdu, Malayalam, Tamil, Bengali,
> Tagalog or Arabic, with a voice note for anyone who doesn't read."

### Scene 5 — A worker feels unwell (1:20–1:45)
**Screen:** (wait about 45 seconds off-camera after the heat spike, until check-ins arrive)
1. On the phone, pick **Joel Santos (Tagalog)**. Show the check-in message.
2. Press **2 · Unwell**.
3. Point to the **critical** alert in **Supervisor alerts**, and the first-aid message on Joel's phone.
4. Point to a **missed check-in** alert for a worker you didn't answer for (it appears about 30
   seconds after a check-in goes unanswered).
5. In the crew list, press **Checked** next to Joel.

**Voice-over:**
> "Every worker gets a regular check-in: reply 1 if you're OK, 2 if you're not. Joel replies 2. In
> seconds the supervisor gets a critical alert, and Joel gets first-aid guidance in Tagalog. Anyone
> who doesn't answer is escalated too. Nobody falls through the cracks."

**[Claude]** Instead of pressing 2, type *"sir my head is spinning"*. Say: *"Even a free-text reply
is understood and escalated."*

### Scene 6 — How it decides (1:45–1:55)
**Screen:** Deck slide 6 (the agent loop and the safety-floor banner).
**Voice-over:**
> "Under the hood, an AI agent decides what to do, on top of a safety floor of fixed rules. The AI
> can make protection stricter, but never weaker. If the model is ever wrong or offline, the rules
> still act."

### Scene 7 — Planning tomorrow (1:55–2:20)
**Screen:**
1. Click the **Plan tomorrow** tab. Choose **Summer heatwave (45 °C)** and press **Plan tomorrow**.
2. Pause on the numbers at the top: work stopped 91.5 → 0, tasks not finished 4 → 0.
3. Scroll to the two timelines: the usual 07:00 plan full of grey "work stopped" hatching, then the
   HeatGuard plan with the concrete pour at 03:00.
4. Press **Send schedule to crews**.

**Voice-over:**
> "The Planner agent looks at tomorrow's forecast. With the usual seven o'clock start, a heatwave
> stops work for hours and four tasks don't finish. HeatGuard moves the concrete pour to 3 a.m. and
> the rest to the evening — every task done, and far less time in dangerous heat. One click tells
> every worker their hours, in their language."

**Caption:** *Demo scenario: 45 °C heatwave day*

### Scene 8 — Proof (2:20–2:35)
**Screen:** Click **Compliance report** in the top bar (opens a new tab). Pause on the green
**Compliant** badge, scroll slowly through the checks and the incident timeline (Joel's report,
alerted at +0 min, first aid sent, closed), and end on the signature lines.
**Voice-over:**
> "And at the end of the day, HeatGuard writes the proof: a signed compliance report showing every
> check, every incident and every action. That's what employers, clients and insurers pay for."

> If the badge says **Attention needed**, either Joel wasn't marked **Checked** or the schedule
> wasn't sent. Do those two things and refresh the report.

### Scene 9 — Close (2:35–2:45)
**Screen:** Back to the **Command centre**, or deck slide 17 (the ask).
**Voice-over:**
> "HeatGuard: predict the heat, replan the work, reach every worker, prove they were safe. Built in
> Dubai, for outdoor workers everywhere."

**Caption:** *HeatGuard · heatguard-7jg3.onrender.com · [your name]*

---

## A 60-second cut (if the portal asks for a short version)

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:08 | Deck slide 3 | "2.4 billion workers face dangerous heat at work." |
| 0:08–0:20 | Command centre → Heat spike | "HeatGuard is an AI safety officer for every outdoor worker. One map, every site, live heat risk." |
| 0:20–0:35 | Live site → phone → press 2 | "Workers get alerts and check-ins in their own language. Reply 2, and the supervisor knows in seconds." |
| 0:35–0:48 | Plan tomorrow → heatwave | "The Planner agent moves heavy work to cooler hours: every task done, far less danger." |
| 0:48–1:00 | Compliance report | "And every day ends with proof that people were kept safe. HeatGuard." |

---

## If something goes wrong while recording

| Problem | Fix |
|---|---|
| Site is slow to load | It's waking up. Wait a minute, then press **Reset**. |
| No check-ins on the phone yet | Wait about 45 seconds after the heat spike, or cut and come back. |
| Too many old alerts on screen | Press **Reset** and click **Heat spike** again. |
| No voice when pressing 🔊 | That browser has no voice for the language. Record in Chrome, or skip the audio and keep the text on screen. |
| Report says "Attention needed" | Mark the unwell worker **Checked** and press **Send schedule to crews**, then refresh. |
| Map background is blank | The map tiles need internet. Check your connection and reload. |

## Honesty checklist for the final cut
- [ ] The story in Scene 1 is captioned as an illustrative scenario.
- [ ] The ILO numbers show their source.
- [ ] The command centre is captioned "1 live site + 7 demo sites".
- [ ] The planner numbers are captioned as a demo scenario.
