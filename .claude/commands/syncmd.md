---
name: syncmd
description: Audit all docs/ markdown files against actual code and report what is stale or missing
user_invocable: true
---

# /syncmd — Sync docs with code

Audit the project's markdown docs against the actual codebase. Do NOT make code changes — only update docs/ files if discrepancies are found.

## Step 1 — Read all docs

Read these files in full:
- `docs/CODEBASE_MAP.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/INVARIANTS.md`
- `docs/SYSTEM.md`

## Step 2 — Audit each doc against code

### CODEBASE_MAP.md
Check every claim in the map against the actual filesystem and code:
- Run `git ls-files` to get the full file list
- For every screen listed: confirm the file exists in `screens/`
- For every component listed: confirm it exists in `components/`
- For every engine listed: confirm it exists in `engines/`
- For every key type listed: grep `types.ts` to confirm the type still exists with that name
- For every key function listed: grep for the function name in the relevant file
- Check the Folder Structure section matches actual directories
- Flag any screens, components, engines, or types that exist in code but are NOT in the map

### ARCHITECTURE.md
- Verify the data flow description matches actual context files and engine calls
- Check that any named files/functions in the architecture doc still exist

### ROADMAP.md
- Compare completed phases against git log to verify they are actually done
- Flag any phases marked complete that seem inconsistent with the code
- Check if any new screens/features exist in code that aren't in the roadmap

### INVARIANTS.md
- Flag any invariants that reference types, fields, or functions that no longer exist

### SYSTEM.md
- Flag any feature descriptions that contradict what's currently in the codebase

## Step 3 — Report findings

Produce a concise report with three sections:

**Stale entries** — things mentioned in docs that no longer exist in code  
**Missing entries** — things in code that are not documented  
**Correct** — a brief summary of what is still accurate

## Step 4 — Update docs

For each stale or missing entry found:
- Update the relevant doc file to reflect current reality
- Do NOT add speculation or future plans — only document what currently exists
- After all updates, summarize what changed
