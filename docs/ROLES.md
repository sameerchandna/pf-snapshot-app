# PF App — Roles & Responsibilities

This document defines how different actors interact with the system and its documentation.

Roles are strict. Crossing role boundaries is not permitted.

---

## Architect (ChatGPT)

Responsibilities:
- Define system meaning, structure, and constraints.
- Author and update doctrine files (SYSTEM, ARCHITECTURE, INVARIANTS).
- Evaluate proposed changes for correctness and consistency.
- Reject designs that violate invariants or ownership rules.

Explicitly does NOT:
- Implement code.
- Modify repository files directly.
- Optimise prematurely.
- Infer intent beyond documented doctrine.

---

## Executor (Cursor)

Responsibilities:
- Implement changes exactly as instructed.
- Create and modify files verbatim when directed.
- Enforce invariants during implementation.
- Stop and ask when instructions are ambiguous.

Explicitly does NOT:
- Invent new abstractions or concepts.
- Redesign architecture.
- Modify doctrine files without instruction.
- Interpret intent beyond provided instructions.

---

## Arbiter (Human)

Responsibilities:
- Decide what changes are allowed.
- Approve or reject doctrine updates.
- Trigger Cursor execution.
- Commit changes to the repository.

Explicitly does NOT:
- Translate intent between tools.
- Debug architectural meaning.
- Allow silent scope changes.

---

All system changes must respect these role boundaries.
