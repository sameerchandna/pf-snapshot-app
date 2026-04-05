# PF Snapshot Website — Landing Page MVP
*Created: April 2026*

---

## Context

The app is pre-launch and needs a public-facing website to support brand building. Per the brand strategy, the landing page is a prerequisite for content marketing (YouTube, LinkedIn, articles) and email list building. This is a **separate repo**, built with **Next.js**, deployed on **Vercel**.

The MVP is a single-page landing site with this structure:
1. Positioning statement (1 sentence)
2. Who it's for
3. App Store download button
4. 3 app screenshots/visuals
5. Origin story (3 sentences + "read more" link)
6. Email capture ("Get updates + articles on personal finance")

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Repo | Separate from app repo | Clean separation, independent deploys |
| Stack | Next.js + TypeScript + Tailwind CSS | React-based (consistent with app), great SEO/SSG, extensible for blog later |
| Hosting | Vercel | Free tier, automatic deploys, perfect Next.js support |
| Email capture | Kit (ConvertKit) | Creator-friendly, free up to 10k subs, supports drip sequences |
| Domains | sameerchandna.com (primary), sameerchandna.co.uk | Personal brand domains |

---

## Step 1: Create the new repo & Next.js project

- Create a new directory (sibling to pf-snapshot-app): `pf-snapshot-website/`
- `npx create-next-app@latest` with TypeScript, Tailwind CSS, App Router
- Initialize git repo
- Set up basic project structure:

```
pf-snapshot-website/
├── app/
│   ├── layout.tsx          # Root layout, fonts, metadata
│   ├── page.tsx            # Landing page (all sections)
│   └── globals.css         # Tailwind + custom styles
├── components/
│   ├── Hero.tsx            # Positioning + who it's for + CTA
│   ├── AppShowcase.tsx     # 3 screenshots/visuals
│   ├── OriginStory.tsx     # 3-sentence story + read more
│   ├── EmailCapture.tsx    # Kit embed form
│   ├── Footer.tsx          # Footer
│   └── Navbar.tsx          # Simple top nav (logo + CTA)
├── public/
│   ├── screenshots/        # 3 app screenshots (placeholder initially)
│   └── logo.png            # App icon/logo
├── tailwind.config.ts
└── package.json
```

## Step 2: Brand tokens & design system

Carry over brand colors from the app theme:
- **Primary:** `#2F5BEA` (blue)
- **Brand tint:** `#e8f0ff`
- **Text:** dark grays
- **Success green:** `#22c55e` (for positive financial indicators)

Configure in `tailwind.config.ts` as custom colors. Clean, professional aesthetic — not flashy. Target audience is 35–50 professionals.

Font: Inter or similar clean sans-serif (Next.js default).

## Step 3: Build landing page sections

### 3a — Navbar
- App name/logo (left)
- "Download" CTA button (right)
- Minimal, sticky

### 3b — Hero section
- **Headline:** "Understand your financial future — using your own numbers, not generic advice."
- **Subtext:** Who it's for — 1-2 sentences about the target user (working professionals who want clarity without paying for a financial advisor)
- **CTA:** App Store download button (placeholder link initially — Apple badge styling)

### 3c — App Showcase
- 3 screenshot/visual slots
- Placeholder images initially (supply real screenshots before launch)
- Brief caption under each showing a key feature

### 3d — Origin Story
- 3 sentences max: the hook ("20 years in finance, didn't understand my own money"), what that led to, what the app does
- "Read more" link (points to Medium/Substack article once published, placeholder for now)

### 3e — Email Capture
- Heading: "Get updates + articles on personal finance"
- **Service: Kit (ConvertKit)** — create one form in Kit, embed on landing page
- Same Kit form link reused on LinkedIn, other channels
- For initial build: placeholder Kit embed section, easy to drop the real embed into

### 3f — Footer
- Copyright, minimal links

## Step 4: SEO & metadata

- Open Graph tags (title, description, image)
- `<title>`: "PF Snapshot — Understand Your Financial Future"
- Meta description aligned with positioning
- Favicon from existing app icon

## Step 5: Responsive design

- Mobile-first (many visitors will come from LinkedIn on phone)
- Breakpoints: mobile, tablet, desktop
- Screenshots section stacks vertically on mobile

## Step 6: Deploy setup

- Push to GitHub (new repo: `pf-snapshot-website`)
- Connect to Vercel for automatic deploys from `main`
- Configure domains: `sameerchandna.com` (primary) and `sameerchandna.co.uk` in Vercel dashboard

---

## What this plan does NOT include (future phases)

- Blog/articles section (add when origin story is published)
- Community features (Phase 3)
- Real app screenshots (supply before launch)
- App Store links (add when app is published)

---

## Verification

1. `npm run dev` — site runs locally on localhost:3000
2. All 6 sections render correctly
3. Responsive on mobile/tablet/desktop (check via browser dev tools)
4. Lighthouse score: aim for 90+ on performance & accessibility
5. Placeholder screenshots and links are clearly marked for replacement
