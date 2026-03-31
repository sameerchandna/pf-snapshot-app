# Product issues

> Honest assessment of current state, problems, and prioritised solutions.
Generated from codebase review of `github.com/sameerchandna/pf-snapshot-app`
> 

---

## Current State Summary

The projection engine is genuinely excellent — deterministic, inflation-adjusted, loan amortisation, scenario modelling. The **technical foundation is stronger than most fintech apps at this stage.**

The product layer on top of it is not yet a product. The gap is entirely the human layer — interpretation, emotion, onboarding.

---

## The 10 Problems

### Problem 1 — Onboarding will kill you

**What’s wrong:** Users must enter 20–30 fields before seeing any value. Income, expense groups, asset groups, liability groups, contributions, projection inputs. On mobile this feels like filing a tax return.

**Solution:**

- Deliver value in 3 inputs first: Age, Income, Savings Rate
- Show a compelling projection immediately
- Let users enrich data over time
- Progressive disclosure — unlock more inputs as trust is earned

**Priority: 🔴 Critical — fix before any marketing**

---

### Problem 2 — No emotional hook

**What’s wrong:** The app shows numbers. Numbers don’t change behaviour. Emotions do. There is no moment that makes a user feel something.

**Solution:**

- Add verdict states: “You’re on track ✅” / “You have a gap ⚠️” / “Action needed 🔴”
- Milestone celebrations: “You just crossed £100k net worth 🎉”
- Plain English summary at the top of every projection screen
- This is the interpretation layer — highest leverage feature to build next

**Priority: 🔴 Critical — the single biggest unlock**

---

### Problem 3 — Scenarios are too abstract

**What’s wrong:** `FLOW_INVESTING` and `FLOW_DEBT_PAYDOWN` are engineering concepts. Nobody thinks in these terms.

**Solution:**

- Rename and reframe scenarios as user questions:
    - “Should I overpay my mortgage or invest?”
    - “What if I go part time?”
    - “What if I stop working today?”
    - “What happens if I have a child in 2 years?”
- The engine already supports these — the front door needs redesigning
- Add preset life event scenarios as named templates

**Priority: 🟡 High — after interpretation layer**

---

### Problem 4 — No retention mechanism

**What’s wrong:** Nothing in the codebase gives a user a reason to return. The app is completely passive.

**Solution:**

- Weekly net worth snapshot notification
- “Your projection changed since last month” nudge
- Milestone tracking (debt free date, pension target, etc.)
- Monthly financial health score
- “You haven’t updated your snapshot in 30 days” reminder

**Priority: 🟡 High — needed before any growth push**

---

### Problem 5 — Multi-profile feature was premature

**What’s wrong:** Significant engineering effort went into profile migration, storage, switching. But the single-user retention problem isn’t solved yet.

**Solution:**

- Freeze profile feature development
- Redirect that effort to interpretation and retention
- Revisit profiles when you have couples/families as a specific use case

**Priority: ⚪ Deprioritise**

---

### Problem 6 — Data model doesn’t match user mental models

**What’s wrong:** Fields like `annualGrowthRatePct`, `availability: immediate | locked | illiquid`, `contributionType: preTax | postTax` are engineer thinking, not user thinking.

**Solution:**

- Add a friendly UI label layer on top of the data model
- Smart defaults and suggestions (“ISAs typically grow at 5-7% annually”)
- Plain English field descriptions
- “I don’t know” options that use sensible defaults
- The underlying types stay as-is — just make the UI speak human

**Priority: 🟡 High — part of onboarding fix**

---

### Problem 7 — No social proof or sharing mechanism

**What’s wrong:** No way for users to share results, milestones, or screenshots. Finance apps grow on word of mouth.

**Solution:**

- Shareable milestone cards (“I’ll be debt free by 2027 🎯”)
- Anonymous benchmark comparisons (“You’re saving more than 73% of people your age”)
- Export projection as a clean image or PDF
- “Show a friend” flow for the scenario comparison screen

**Priority: 🟠 Medium — build after core retention is solved**

---

### Problem 8 — Projection is a straight line

**What’s wrong:** Fixed growth rates, fixed contributions, fixed inflation. Life isn’t a straight line. Single projection builds false confidence.

**Solution:**

- Add best / base / worst case bands to the projection chart
- Simple stress test scenarios: “What if markets drop 20%?” “What if I lose my job for 6 months?”
- Probability-based language: “You have a high chance of reaching your target”
- Monte Carlo simulation (longer term — the engine could support this)

**Priority: 🟠 Medium — powerful differentiator when ready**

---

### Problem 9 — No definition of success

**What’s wrong:** A user sees a net worth projection to age 75 and doesn’t know if it’s good or bad. No targets, no benchmarks, no goals.

**Solution:**

- Ask for a retirement income target upfront (“How much do you want per year in retirement?”)
- Show a clear on-track / off-track status against that goal
- “You need £X more per month to hit your target”
- Benchmark against anonymised similar users (same age, income bracket)

**Priority: 🔴 Critical — required for interpretation layer to make sense**

---

### Problem 10 — [gpthelper.md](http://gpthelper.md/) is public in your repo

**What’s wrong:** Your AI planning strategy and internal thinking is visible to anyone who looks at your repo.

**Solution:**

- Delete or move `gpthelper.md` out of the repo
- Replace with `CLAUDE.md` (private context for Claude Code, not committed or gitignored)
- Or gitignore it if you want to keep it locally

**Priority: 🟢 Quick win — do this today**

---

## Prioritised Build Roadmap

### Sprint 1 — Make it feel alive (Interpretation Layer)

> Transforms the existing engine without rebuilding anything
> 
- [ ]  Add goal input: “How much do you want per year in retirement?”
- [ ]  Build `interpretProjection.ts` — takes `ProjectionSummary`, returns plain English verdicts
- [ ]  On-track / off-track status on main screen
- [ ]  Gap calculation: “You need £X more per month”
- [ ]  Debt-free date surfaced prominently

### Sprint 2 — Fix the front door (Onboarding)

> Reduces drop-off before first value moment
> 
- [ ]  3-input quick start flow (Age, Income, Savings Rate)
- [ ]  Instant projection shown before full data entry
- [ ]  Progressive data enrichment prompts
- [ ]  Smart defaults and plain English field labels

### Sprint 3 — Give them a reason to return (Retention)

> Without this, growth doesn’t compound
> 
- [ ]  Weekly net worth notification
- [ ]  Monthly financial health score
- [ ]  Milestone detection and celebration
- [ ]  “Your snapshot is out of date” nudge

### Sprint 4 — Make scenarios human (Scenario UX)

> Unlocks the engine’s full power for normal users
> 
- [ ]  Rename scenarios as user questions
- [ ]  Life event templates (baby, house purchase, job change, retirement)
- [ ]  Best / base / worst case projection bands
- [ ]  “What if I stop working today?” retirement scenario

### Sprint 5 — Growth mechanics

> Only worth building once retention is working
> 
- [ ]  Shareable milestone cards
- [ ]  Anonymous benchmarking
- [ ]  Export / share projection
- [ ]  Referral flow

---

## The Interpretation Layer — What to Build First

This is Sprint 1 in detail. The output of `projectionEngine.ts` already contains everything needed:

**Inputs available:**

- `endNetWorth` — projected net worth in today’s money
- `endAssets` / `endLiabilities` — breakdown
- `totalContributions` — what they’ve put in
- `totalPrincipalRepaid` — debt reduction progress
- `ProjectionSeriesPoint[]` — year by year trajectory

**Verdicts to generate:**

1. On-track status vs retirement goal
2. Debt-free age (when liabilities hit zero)
3. Net worth trajectory direction (growing / flat / declining)
4. Monthly gap to target
5. Biggest opportunity (invest more vs pay down debt)

**Where it lives:**
New file: `insights/interpretProjection.ts`
Pure function: `ProjectionSummary + ProjectionInputs → InterpretationResult`
Displayed on: projection results screen, home screen summary card

---

## The Brand Opportunity

> This section is about the business, not just the app.
> 

**The gap you’re filling:**

- Transactional apps (Monzo, YNAB): backward-looking, track spending
- Wealth management tools: forward-looking but expensive and inaccessible
- **PF Snapshot: forward-looking, accessible, models your financial future**

**Your unfair advantage:**

- Investment banking background in risk and collateral modelling
- You built the tool you wished existed for your own life
- Developer who understands financial modelling depth
- That combination is rare in consumer fintech

**The story:***“I work in financial risk at an investment bank and I built the tool I wished existed for my own financial life.”*

**Target user:**
Professionals in their 30s-40s. Good income. Mortgage. Pension they don’t fully understand. Vague anxiety about whether they’re on track. Want clarity, not advice.

---

## Next Actions (In Order)

1. **Today:** Delete / gitignore `gpthelper.md`
2. **This week:** Install WSL2 (`wsl --install` in PowerShell as Admin)
3. **First session:** Build `CLAUDE.md` from architecture docs + this audit
4. **Sprint 1:** Build interpretation layer with Claude Code
5. **Ongoing:** LinkedIn + YouTube content running in parallel from day one

---

*Document created: March 2026Based on codebase review of: [github.com/sameerchandna/pf-snapshot-app](http://github.com/sameerchandna/pf-snapshot-app)*