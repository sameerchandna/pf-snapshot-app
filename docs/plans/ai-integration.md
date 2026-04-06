# AI Integration Plan

## Context

The app is a local-only personal finance tool with a strong deterministic engine (projection, scenarios, attribution) but no AI layer. The goal is to add AI that wraps around the existing engine — parsing natural language into `SnapshotState`, interpreting projection results in plain English, and suggesting high-leverage scenarios. This lowers the barrier to entry (users don't need financial literacy to fill forms) and makes outputs actionable.

**Key decisions made:**
- **Provider**: Claude API (primary), with a provider-agnostic abstraction layer
- **Backend**: Supabase Edge Function as a thin proxy (holds the API key)
- **Entry point**: AI button in each `ScreenHeader` (top-right), context-aware
- **UX**: Full-screen chat for onboarding/snapshot input; bottom sheet for interpretation/insights
- **Engine unchanged**: AI never touches `projectionEngine.ts` or core invariants

---

## Phase 1: Infrastructure

Build the foundational AI service layer and backend proxy.

### 1a. Supabase Edge Function (backend proxy)

Create a new `supabase/` directory at project root (or a separate repo — your call).

- Single edge function: `POST /ai` that accepts `{ messages, model?, maxTokens?, responseFormat? }`
- Holds the Anthropic API key as a Supabase secret
- Forwards to Anthropic Messages API, streams or returns the response
- Basic rate limiting (per-device, via a device ID header)
- No auth for MVP (add later if needed)

### 1b. AI service layer (`ai/` directory)

```
ai/
  aiClient.ts            -- fetch wrapper: calls the Supabase edge function
  aiProvider.ts          -- provider-agnostic interface (AIMessage, AIResponse types)
  aiConfig.ts            -- model IDs, token budgets, temperature defaults
  anonymize.ts           -- strips item names from SnapshotState before sending
  prompts/
    onboarding.ts        -- system prompt + schema for snapshot parsing
    interpreter.ts       -- system prompt for projection interpretation
    scenarioGen.ts       -- system prompt for scenario suggestions
  parsers/
    parseSnapshotFromAI.ts   -- AI JSON → coerceSnapshotState() pipeline
    parseScenarioFromAI.ts   -- AI JSON → Scenario type validation
  hooks/
    useAIChat.ts         -- multi-turn chat state (messages, loading, error, retry)
    useAIInterpreter.ts  -- one-shot interpretation call
    useAIScenarios.ts    -- scenario suggestion call
  context/
    AIContext.tsx         -- provides AI availability, active mode, screen context
```

**Key file: `aiClient.ts`** — the only file that knows about the network transport. Single function:
```ts
callAI(params: { messages: AIMessage[]; model?: string; maxTokens?: number; responseFormat?: 'json' | 'text' }): Promise<AIResponse>
```

**Key file: `aiProvider.ts`** — abstracts provider differences:
```ts
type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type AIResponse = { content: string; usage: { inputTokens: number; outputTokens: number } }
```

To switch providers later, only `aiClient.ts` changes (different endpoint/headers/body format).

**Key file: `anonymize.ts`** — before sending data to AI:
- Replace custom item names with generic labels ("Income 1", "Expense 1", etc.)
- Keep: amounts, group names, ages, rates, structural data
- Never send: profile names, device IDs

### 1c. Dependencies to add

- `expo-secure-store` — for any local secrets/tokens if needed later
- No AI SDK (raw fetch to our own proxy)

**Critical files to reuse:**
- `domain/domainValidation.ts` — `coerceSnapshotState()` validates all AI output
- `types.ts` — `SnapshotState` shape defines the JSON schema for AI structured outputs
- `context/SnapshotContext.tsx` — all AI-parsed data flows through existing setters

---

## Phase 2: Context-Aware AI Button

### 2a. AI button in ScreenHeader

Modify `components/ScreenHeader.tsx` to accept an optional AI action button (top-right). The button's behavior depends on which screen the user is on:

| Screen context | AI mode | UX |
|---|---|---|
| Snapshot tab (detail screens) | **Onboarding/Input** | Full-screen chat → parses into SnapshotState |
| Projection results | **Interpreter** | Bottom sheet → plain-English summary |
| WhatIf / Explore | **Scenario suggester** | Bottom sheet → suggested scenarios |

### 2b. AIContext provider

Wrap the app in an `AIContext` that tracks:
- Current screen context (which tab/screen the user is on)
- AI availability (is the proxy reachable?)
- Active AI mode (derived from screen context)

### 2c. Chat components (`components/chat/`)

```
components/chat/
  AIChatScreen.tsx          -- full-screen conversational UI (onboarding)
  AIBottomSheet.tsx         -- slide-up panel for interpretation/suggestions
  ChatMessageBubble.tsx     -- message bubble (user vs AI)
  ChatInputBar.tsx          -- text input + send, fixed to bottom
  ChatSuggestionChips.tsx   -- pre-built prompt starters
  SnapshotPreviewCard.tsx   -- shows parsed data for user confirmation
  ScenarioSuggestionCard.tsx -- tappable AI-suggested scenario
```

All components use `theme.typography.*`, `theme.colors.*`, `theme.radius.*`, `spacing.*` — no hardcoded values.

---

## Phase 3: AI as Interpreter (build first — lowest risk)

**Why first:** Read-only, no state mutation, exercises the full pipeline, validates anonymization.

### What it does
After the projection runs, user taps the AI button on the Projection screen → bottom sheet slides up with a plain-English summary.

### Data sent to AI
- Anonymized snapshot summary (totals only: income, expenses, assets, liabilities, net worth)
- `InterpretationResult` from `insights/interpretProjection.ts` (headline, trajectory, key moments, FI progress, goal assessments)
- `ProjectionSummary` (end values, depletion age, totals)

### Prompt design (`prompts/interpreter.ts`)
- System: "You are a financial narrator. Turn structured projection data into a 2-3 paragraph plain-English summary. Be observational, never prescriptive. Do not give financial advice."
- User message: the anonymized data as JSON
- Output: plain text (no structured output needed)

### Files to modify
- `screens/ProjectionResultsScreen.tsx` — pass AI button handler to ScreenHeader

### Files to create
- `ai/prompts/interpreter.ts`
- `ai/hooks/useAIInterpreter.ts`
- `components/chat/AIBottomSheet.tsx`

---

## Phase 4: Conversational Onboarding (highest value)

### What it does
User taps AI button on any Snapshot detail screen → full-screen chat opens. User describes their finances in natural language → AI parses into structured data → user confirms → data merges into SnapshotContext.

### Conversation flow
1. AI greets with context-aware prompt (e.g., on Assets screen: "Tell me about your savings and investments")
2. User types naturally: "I have 15k in savings, 8k in a stocks ISA, and my house is worth about 350k"
3. AI returns structured JSON matching `SnapshotState` sub-schema
4. `parseSnapshotFromAI()` runs `coerceSnapshotState()` as safety net
5. `SnapshotPreviewCard` shows what was understood — user confirms or corrects
6. On confirm, data flows through existing SnapshotContext setters (same path as manual entry)

### Prompt design (`prompts/onboarding.ts`)
- System prompt includes: the exact JSON schema (derived from `types.ts`), valid group IDs, item structure rules
- Few-shot examples: natural language → JSON
- Instruction to ask clarifying questions if ambiguous
- Context-aware: prompt varies by which detail screen triggered the chat

### Safety: AI output → SnapshotContext
```
AI JSON → JSON.parse() → coerceSnapshotState() → SnapshotPreviewCard (user confirms) → individual setters
```

The user always confirms before data is written. `coerceSnapshotState()` silently drops invalid items. `parseSnapshotFromAI` counts dropped items and surfaces warnings.

### Files to create
- `screens/AIChatScreen.tsx` — added to each tab's stack navigator
- `ai/prompts/onboarding.ts`
- `ai/parsers/parseSnapshotFromAI.ts`
- `ai/hooks/useAIChat.ts`
- `components/chat/ChatMessageBubble.tsx`, `ChatInputBar.tsx`, `ChatSuggestionChips.tsx`, `SnapshotPreviewCard.tsx`

### Files to modify
- `navigation.tsx` — add `AIChatScreen` to each stack
- `components/ScreenHeader.tsx` — add AI button support

---

## Phase 5: AI Scenario Generator

### What it does
User taps AI button on WhatIf/Explore screens → bottom sheet shows 2-3 AI-suggested scenarios based on their financial data. Tapping a suggestion navigates to `ScenarioExplorerScreen` with pre-filled parameters.

### Data sent to AI
- Anonymized snapshot summary
- Current monthly surplus
- Available scenario template types (from `domain/scenario/templates.ts`)

### Prompt design (`prompts/scenarioGen.ts`)
- Constrained to suggest scenarios that map to existing `ScenarioKind` values
- Returns JSON array: `[{ kind, targetId, amountMonthly, rationale }]`
- `parseScenarioFromAI()` validates against `Scenario` union type

### Files to create
- `ai/prompts/scenarioGen.ts`
- `ai/parsers/parseScenarioFromAI.ts`
- `ai/hooks/useAIScenarios.ts`
- `components/chat/ScenarioSuggestionCard.tsx`

### Files to modify
- `screens/WhatIfPickerScreen.tsx` — AI button handler

---

## Build Order

| Order | Phase | Risk | Value | Effort |
|-------|-------|------|-------|--------|
| 1 | Phase 1: Infrastructure | Low | Foundational | Medium |
| 2 | Phase 2: AI button + chat components | Low | UX foundation | Medium |
| 3 | Phase 3: Interpreter | Low (read-only) | Medium | Small |
| 4 | Phase 4: Onboarding | Medium (writes state) | Highest | Large |
| 5 | Phase 5: Scenario generator | Low | Medium | Small |

Phase 3 is built before Phase 4 even though Phase 4 has higher value — because Phase 3 validates the entire pipeline (proxy, client, prompts, UI) with zero risk to user data.

---

## Verification

- **Phase 1**: Make a successful API call through the Supabase proxy and get a Claude response back in the app
- **Phase 3**: On the Projection screen, tap AI button → see a coherent plain-English summary in the bottom sheet
- **Phase 4**: Describe a financial situation in chat → see a preview card with correctly parsed data → confirm → verify data appears in the Snapshot tab's detail screens
- **Phase 5**: On Explore tab, tap AI button → see relevant scenario suggestions → tap one → verify it opens ScenarioExplorer with correct pre-filled values

---

## Invariants Preserved

- Snapshot is only mutated via SnapshotContext setters (Phase 4 uses the same setters as manual entry)
- Projection engine is never called or modified by AI code
- Scenarios are created through existing `saveScenario` flow
- All AI output passes through `coerceSnapshotState()` before touching state
- User always confirms before AI-parsed data is written


# Updates from Claude chat for review of above plan:

Claude AI:
The plan is solid in structure and the build order (interpreter before onboarding) is correctly risk-sequenced. But there are real problems you should address before building.
What's actually good

Provider-agnostic abstraction (aiClient.ts) is the right call — you're not locked in
coerceSnapshotState() as the validation gate is smart reuse
Phase 3 before Phase 4 is the right sequence

Problems worth calling out
1. The "no auth for MVP" decision is dismissive of a real risk. Rate limiting via a device ID header is trivially bypassed. Anyone can hit your Supabase proxy with rotating headers and rack up your Anthropic bill. "Add later" often means "never" until you get stung. At minimum, add a simple shared secret header — it takes 20 minutes and filters out casual abuse.
2. Phase 4 (onboarding) failure modes aren't adequately handled. The plan treats coerceSnapshotState() as a catch-all safety net. It's not — it catches type errors, not semantic errors. A user says "I have a £50k pension" and the AI parses £500k. User skims the preview card, taps confirm, and now their 30-year projection is completely wrong. This is a trust-destroying bug. You need explicit value highlighting in SnapshotPreviewCard with amounts displayed prominently, and probably a diff view against whatever was there before.
3. The AI interpreter (Phase 3) has a positioning conflict with your brand. Your core differentiation is "show, don't advise." A plain-English AI summary of projection results will almost inevitably drift prescriptive — even with a careful prompt. "Your savings will be depleted by age 67" reads differently from "You should save more." But "you're on track to run out of money before state pension age" is only one sentence away from implicit advice. You need to decide exactly where that line is before writing the prompt, not leave it to a runtime instruction.
4. The repo structure is already diverged from the plan. The plan assumes files in ai/, components/chat/, etc. Your repo has projectionEngine.ts, SnapshotContext.tsx, and most core files at root level, not in organised subdirectories. When you implement the plan, you'll be adding clean structure on top of existing structural debt. That's fine, but acknowledge it — don't pretend the plan and reality are aligned.
5. Streaming is undecided and that matters. "Streams or returns" needs a decision now. A chat UI with non-streaming responses feels broken above ~200 tokens. Streaming through Supabase Edge Functions is doable but adds implementation complexity. Pick one and design for it.
One structural suggestion: Phase 1 creates 10+ files before a single user sees any value. As a solo developer, you'd ship faster if Phase 1 was minimal: just aiClient.ts + the Supabase function + a single hardcoded test call. Don't build the full abstraction layer until Phase 3 forces you to.

Me:
ill go with what you recommend, but honesty at this time  i really just want the onboarding to be simpler - even as i test.. want to say "Income is 50k" (AI should check if net income or gross if not specfied for eg.   Say "Add expense for netflix",  mortage has changed to 3.5%  etc.

AI response:

Good instinct — and it's actually a better architecture than what the plan describes. What you're describing is **incremental mutations**, not full state parsing. That's simpler to build, simpler to test, and more reliable.

Here's the concrete shift:

**The plan's approach (wrong for now):**
User describes everything → AI outputs full `SnapshotState` JSON → user confirms blob → apply

**What you actually want:**
User sends one instruction → AI identifies intent + extracts minimal data → AI asks one clarifying question if needed → apply single setter

---

**The three operation types you need:**

```
ADD    → "income is 50k", "add netflix expense"
UPDATE → "mortgage changed to 3.5%", "my salary went up to 60k"  
DELETE → "remove the netflix expense"
```

AI output is a small typed delta, not full state:

```ts
type AIIntent =
  | { op: 'add';    section: 'income'|'expense'|'asset'|'liability'; label: string; amount: number; frequency?: 'monthly'|'annual' }
  | { op: 'update'; itemId: string; field: 'amount'|'rate'|'label'; value: number|string }
  | { op: 'clarify'; question: string }  // AI isn't sure — asks before acting
```

When AI returns `clarify`, you show the question in the chat and wait. No state touched until you have a clean intent.

---

**The gross/net question is a good example of how clarify works:**

User: "income is 50k"
AI returns: `{ op: 'clarify', question: 'Is that £50k gross (before tax) or net (take-home)?' }`
User: "net"
AI returns: `{ op: 'add', section: 'income', label: 'Salary', amount: 50000, frequency: 'annual' }`

---

**Minimum to build for this:**

1. Supabase Edge Function — thin proxy, just forwards to Claude
2. `aiClient.ts` — single `callAI()` function
3. `prompts/onboarding.ts` — system prompt that knows your `SnapshotState` schema and outputs only `AIIntent` JSON
4. `parseIntent.ts` — parses + validates the JSON delta
5. `AIChatScreen.tsx` — basic chat UI, message bubbles, input bar
6. Intent → setter mapping (the `op: 'add'` calls your existing `addIncomeItem` etc.)

That's it. No `SnapshotPreviewCard`, no full state confirmation flow, no `coerceSnapshotState()` needed at this stage — because you're applying one small validated delta at a time, the risk is contained.

---

**One thing to decide before writing the prompt:** does your `SnapshotState` use monthly or annual amounts internally? The AI needs to know which unit to output, otherwise you'll get 4x/12x errors that are hard to spot.

What does your `types.ts` use?

ME: Monthly, but i want users to be able tp say add a water bill for £600. if no time given AI should check (montly, quarterly, semi, annual etc.). If user says $1000 annual then it shoud save montly.

Good. So the rule is simple: **always store monthly, AI handles the conversion.**

The frequency clarification belongs in the `clarify` flow:

```
User: "add water bill £600"
AI:   { op: 'clarify', question: 'How often is that £600? Monthly, quarterly, or annual?' }
User: "quarterly"
AI:   { op: 'add', section: 'expense', label: 'Water', amountMonthly: 50 }
```

```
User: "add water bill £600 annual"
AI:   { op: 'add', section: 'expense', label: 'Water', amountMonthly: 50 }  // no clarify needed
```

The AI does the division before returning the intent. The app never sees "£600 quarterly" — it only ever receives `amountMonthly`.

---

**The frequency conversion table the AI needs in its system prompt:**

```
monthly      → ÷ 1
quarterly    → ÷ 3
semi-annual  → ÷ 6
annual       → ÷ 12
weekly       → × 52 ÷ 12
```

Also handle currency: if user says `$1000`, AI should flag it — either ask "did you mean £?" or convert using a fixed assumption. Don't silently accept dollars. UK app, flag it explicitly.

---

**The `AIIntent` type updated:**

```ts
type AIIntent =
  | { op: 'add';     section: 'income'|'expense'|'asset'|'liability'; label: string; amountMonthly: number }
  | { op: 'update';  itemId: string; field: 'amount'|'rate'|'label'; value: number|string }
  | { op: 'delete';  itemId: string }
  | { op: 'clarify'; question: string }
```

Note `amountMonthly` — not `amount`. Makes the unit unambiguous in the type itself. Your setter takes monthly, this matches exactly.

---

Ready to write the system prompt and the Supabase edge function? That's the logical next step — get a working call end-to-end before building any UI.

Create a Supabase Edge Function at supabase/functions/ai/index.ts. It should:

Accept POST requests with { messages, systemPrompt } in the body
Forward to Anthropic Messages API using claude-sonnet-4-20250514, max_tokens 1000
Hold the Anthropic API key as Deno.env.get('ANTHROPIC_API_KEY')
Add a simple shared secret check: request must include header x-app-secret matching Deno.env.get('APP_SECRET')
Return the AI response content as { content: string }
Return structured errors on failure
No streaming for now

Also create ai/aiClient.ts that exports a single callAI({ messages, systemPrompt }) function which POSTs to the edge function URL (from an env/config constant) with the shared secret header. Returns string (the content).
Reference the existing types.ts for context on what SnapshotState looks like — the AI layer will need to understand this structure in later steps.