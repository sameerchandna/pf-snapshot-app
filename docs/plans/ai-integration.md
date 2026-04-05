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
