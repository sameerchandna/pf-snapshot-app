# PF App — System Definition

This repository implements a local, education-first personal finance application.

The system allows individuals to model their current financial position, explore forward-looking projections, and understand the drivers of financial outcomes through observation rather than optimisation or advice.

All functionality is designed to support clarity, internal consistency, and financial intuition.

---

## What the System Does

### Snapshot (Current Financial State)
- Captures a user's current financial position, including income, expenses, assets, liabilities, and cash flow.
- Supports manual entry and management of financial items.
- Computes derived values such as net worth, monthly surplus, deductions, and remaining cash.
- Allows items to be toggled active or inactive without deletion.
- Displays observational insights describing the structure of the current state.

### Projection (Forward Simulation)
- Simulates future financial outcomes based on the current Snapshot and projection assumptions.
- Projects assets, liabilities, and net worth over time.
- Presents results through charts and age-based views.
- Explains outcomes using attribution breakdowns that describe contributing factors.

### Scenarios
- Allows creation of scenarios that modify monthly flows applied to projections.
- Supports reversible, comparative analysis between baseline and scenario outcomes.
- Includes ephemeral "Quick What-If" scenarios that are not persisted.
- Only one scenario may be active at a time.

### Profiles
- Supports multiple local profiles on a single device.
- Each profile maintains isolated snapshot, projection, scenario, and settings data.
- Profiles can be created, renamed, reset, switched, and deleted (with safeguards).

### Data Management
- All data is stored locally on the device.
- No backend services, authentication, or cloud sync exist.
- Persistence and data migration are handled automatically.

### Meaningful User Data (Entry Surface Only)
For the purposes of the Entry / Launch screen, a user is considered to 'have data'
only when the active snapshot contains at least one active non-SYSTEM asset or
at least one active liability.
This definition is used exclusively to determine default entry mode and Entry
empty-state messaging. It does not affect snapshot validity, projection logic,
scenarios, or persistence behavior.

---

## What the System Does Not Do

### Product Boundaries
- It is not a budgeting app.
- It is not a portfolio optimiser.
- It is not a robo-advisor.
- It does not provide financial advice, recommendations, or optimisation.
- It is not a bank replacement.
- It is not gamified.

### Functional Constraints
- No account aggregation or external data feeds.
- No household or shared financial modelling.
- No collaboration or profile sharing.
- No cross-profile comparison.
- No prescriptive insights, nudging, ranking, or "what you should do" logic.
- No stock (lump-sum) scenarios (flow-based scenarios only).
- No custom schedules beyond monthly flows.

---

## Intended User

The system is designed for individuals who want to understand the structure and consequences of their financial decisions.

Typical users:
- Are comfortable with manual data entry.
- Prefer observational, neutral tools over advice-driven products.
- Want to explore "what-if" scenarios without being told what to do.
- Seek to build intuition about income, expenses, assets, liabilities, and time.

The system prioritises explanation and transparency over automation or optimisation.
