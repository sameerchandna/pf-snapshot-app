# PF Snapshot — Brand & Product Strategy
*Living document. Updated: April 2026*

---

## 1. The App — What It Is

**Repo:** https://github.com/sameerchandna/pf-snapshot-app
**Stack:** React Native / Expo, TypeScript, 100% local (no server, no auth — see §6)
**Status:** MVP in development, pre-launch

### What it does
A personal finance projection app. Users input their current financial snapshot — income, expenses, assets, liabilities — and the app projects forward in time, modelling scenarios (investing vs debt paydown) so users can see what their financial future actually looks like based on their own numbers.

### Core data model
- Income items (gross, pension, net)
- Expense items (grouped)
- Assets (with growth rates, availability — immediate/locked/illiquid)
- Liabilities (standard + loan/mortgage templates with amortisation)
- Asset contributions & liability reductions
- Projection inputs (current age, end age, inflation)
- Scenarios: `FLOW_INVESTING` | `FLOW_DEBT_PAYDOWN`
- Multi-profile support with migration

### Technical observations
- Well-structured for a solo AI-assisted build — proper domain separation, theme system, projection engine, loan engine
- Using Cursor IDE + Claude for development
- EAS build setup (Expo Application Services) — App Store deployment ready
- Areas to watch: no branching strategy (master-only), `debug/` folder in root is a smell, no tests visible

---

## 2. The Founder

- ~20 years in banking/finance
- Solo developer using AI (Claude/Cursor) to build
- UK-based (app uses £)
- Currently: hobby project → **ambition: make this the main thing long-term (3–5 year horizon)**

### The core story (brand asset)
*"I spent 20 years in finance and still didn't understand my own money."*
This is the hook. It's counterintuitive, credible, and rare. It earns trust immediately because it disarms the "finance bro" assumption. It is the foundation of all content.

---

## 3. Target User

**Primary:** Working professionals, age 35–50, UK
- Earns well, has a pension, likely owns property (mortgage)
- Has a portfolio of assets and liabilities
- Vaguely anxious they're not doing enough
- Finds YNAB too granular, financial advisors too expensive/intimidating
- The gap: wants to know "am I on track?" without paying £200/hr

**Platform implication:** This person lives on **LinkedIn**, not Instagram. Instagram is low priority.

---

## 4. Positioning

**Single positioning statement:**
> *"Understand your financial future — using your own numbers, not generic advice."*

### What this brand is NOT
- Not selling alpha or secret strategies
- Not a financial advisor or regulated service
- Not another generic "here's how compound interest works" channel
- Not guru-led

### What this brand IS
- Clarity over complexity
- Your numbers, not averages
- Education through demonstration, not instruction
- Accessible version of what financial advisors charge for

---

## 5. Brand Architecture

Three pillars that feed each other:

```
[ YouTube / Articles ]  →  drives traffic & builds trust
        ↓
    [ The App ]  →  proves the concept with real numbers
        ↓
[ Email List / Community ]  →  owns the audience long-term
```

The app is the core product. Content is the acquisition engine. They are the same thing — every content piece should demonstrate the app.

---

## 6. App Architecture Decision — Local vs Server

### Current state
Fully local. No backend, no auth, no user accounts. Data lives on device only.

### Should you change this for MVP?

**No. Do not change it for MVP.**

Reasons:
- Adding auth + backend is a significant scope increase that will delay launch
- Local-only is actually a **selling point** for your target user: privacy-conscious professionals don't want their financial data on a server they can't control
- YNAB, early Copilot, and many finance apps launched local-first
- You can always add cloud sync later as a premium feature

### How to frame it in marketing
"Your data stays on your device. Always." — this is a feature, not a limitation.

### When you WILL need a server (post-MVP)
- Cross-device sync (user wants app on iPhone + iPad)
- Web version
- Community/social features
- Premium subscription management
- Push notifications for milestone alerts

None of these are MVP requirements. Build them when users ask for them.

---

## 7. Content Strategy

### Platform Priority (in order)
1. **YouTube** — primary channel. Search-based, compounds over time, highest leverage for your audience
2. **LinkedIn** — distribution for articles, brand building with target demographic
3. **Medium / Substack** — article home, built-in discovery
4. **Instagram** — lowest priority, repurposed content only, do not produce original content here

### What You Need to Build (Capabilities)
1. **Landing page** — standalone site (not App Store), tells your story, captures emails, exists before launch
2. **Content format** — decide once: talking head + screen demo, ~8–12 min, consistent structure. Then repeat.
3. **SEO keyword list** — 20 specific questions your target user types into Google/YouTube. Every piece of content maps to one.

---

## 8. Content Roadmap by Phase

### Phase 0 — Pre-Launch (Now)
**One output only:** Publish origin story article on Medium or Substack.

> *"I worked in banking for 20 years and still had this blind spot about my own money"*

This earns credibility before the app exists publicly. Forces you to crystallise your positioning.

Do NOT start YouTube yet — you need the app to demonstrate.

---

### Phase 1 — Launch → 100 Active Users (Months 1–3)

**North star metric:** Weekly active users (not downloads)

**Content:** 2 YouTube videos only.

- **Video 1:** Your story. The finance professional who didn't understand his own money. Brand-defining. Spend real time on this.
- **Video 2:** Full app walkthrough on a realistic anonymised UK profile. "Here's what a financially healthy 42-year-old's snapshot looks like — and here's what's actually worrying." This is the video that drives downloads.

**Distribution:** LinkedIn primarily. Share videos, post article excerpts, engage in personal finance threads.

---

### Phase 2 — 100 → 1,000 Users (Months 3–12)

Now you have real user feedback. Content answers real questions.

**Cadence:** 1 YouTube video/month minimum.

**Video topics (search-intent driven):**
- "Should I pay off my mortgage or invest? — what the numbers actually show"
- "How much should I have saved by 40?"
- "What does inflation actually do to my retirement?"
- "Mortgage vs ISA — modelled on real numbers"
- "How to know if you're financially on track (without a financial advisor)"

Each video: one concept, demonstrated in the app, aimed at one search query.

**Also in Phase 2:**
- Build email list (simple, low pressure — just own your audience)
- Instagram: repurpose YouTube content only

---

### Phase 3 — 1,000+ Users

- Community layer
- Premium features / paid tier
- Potentially a course or structured programme
- Cannot plan this in detail now — let user behaviour guide it

---

## 9. Article Series Plan

**Article 0 (origin story — drafted):**
"I spent 20 years in finance — and still didn't understand my own money"
*Status: draft exists, needs tightening*

Key edits needed on draft:
- Cut the Einstein compound interest quote (overused cliché)
- Reduce one-line paragraph density — it becomes filler
- Strengthen the ending — current "if this helps one person" is underselling
- Add specific app CTA — what does a reader do on day one?

**Article 1:** Why Saving Alone Will Never Make You Rich
- Savings line vs investment line, same inputs, different outcomes
- Security vs growth — not enemies, different roles

**Article 2:** Why Investing Feels Hard (And Why That's Normal)
- Real market return data — up and down years
- Volatility ≠ failure. Cost of stepping out.

**Article 3:** The Quiet Power of Regular Investing
- Dollar-cost averaging on real numbers
- Volatile market + steady behaviour = long-term net worth trajectory

Each article uses the app, uses real numbers, teaches one idea, ends with clarity not instruction.

---

## 10. Key Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Backend for MVP | No — local only | Scope, privacy selling point, delay risk |
| Primary content channel | YouTube | Search-based, compounds, right audience |
| Primary social channel | LinkedIn | Target user lives there, not Instagram |
| First content piece | Origin story article | Earns credibility pre-launch |
| Brand positioning | Your numbers, not generic advice | Clear differentiator |
| Timeline expectation | 3–5 years to "main thing" | Realistic compounding curve |

---

## 11. Open Questions (To Resolve)

- [ ] Brand/app name — is "PF Snapshot" the public-facing name or working title?
- [ ] Landing page — domain, design, email capture tool
- [ ] YouTube channel name — personal name vs brand name
- [ ] SEO keyword list — needs to be built out
- [ ] Article 0 — final edits and publish target date
- [ ] App MVP — what is the exact definition of done before launch?

---

*This document should be shared at the start of every future session to maintain continuity.*