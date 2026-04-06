# Plan: Income Reduction Scenario ("What if my income stopped or reduced?")

## Context
The `income-changes` template exists in `domain/scenario/templates.ts` (line 163) but is disabled. This plan implements it as `INCOME_CHANGE` — a scenario where the user drags a **£/year take-home income slider** centred on their current income. Moving it down means less money in → contributions scale down. Moving it up means more coming in → contributions scale up proportionally. Expenses are **unchanged**.

---

## How the scenario works

- **Slider**: Annual take-home income in £/year, defaulting to `sum(netIncomeItems.monthlyAmount) × 12`, range ±£100,000, step £10,000
- **Effect on projection**: compute monthly delta then scale all `assetContributionsMonthly` proportionally:
  ```
  baselineMonthly = sum(netIncomeItems.monthlyAmount)
  reductionMonthly = baselineMonthly − (sliderValue / 12)   ← positive = less income, negative = more
  totalContribs = sum of all assetContributionsMonthly
  ratio = max(0, 1 − reductionMonthly / totalContribs)
  each contribution × ratio     (clamped to 0 if reductionMonthly ≥ totalContribs)
  ```
- **Expenses unchanged** — the projection's `monthlyExpensesReal` is not touched
- **Narrative**: shows annual income change, contribution impact, net worth delta at dragged age, and emergency fund runway (liquid assets ÷ monthly expenses)

---

## Files to modify (6 files)

### 1. `domain/scenario/types.ts`
- Add `'INCOME_CHANGE'` to `ScenarioKind` union (line 25)
- Add new interface after `MortgageWhatIfScenario`:
  ```ts
  export interface IncomeChangeScenario extends ScenarioBase {
    kind: 'INCOME_CHANGE';
    reductionMonthly: number; // monthly income delta (positive = income dropped, negative = income rose)
  }
  ```
- Add `IncomeChangeScenario` to `Scenario` union (line 84)

### 2. `domain/scenario/delta.ts`
- Add `incomeChangeDelta?: number` to `ProjectionInputDelta` (after `liabilityTermOverrides`)
- Import `IncomeChangeScenario` from `./types`
- Add new `if` block in `scenarioToDelta` before the exhaustive check:
  ```ts
  if (s.kind === 'INCOME_CHANGE') {
    const ir = s as IncomeChangeScenario;
    return { incomeChangeDelta: ir.reductionMonthly };
  }
  ```

### 3. `domain/scenario/validation.ts`
- Add `'INCOME_CHANGE'` to `isScenarioKind` check
- Add `isScenario` kind-specific branch for `INCOME_CHANGE`:
  ```ts
  if (obj.kind === 'INCOME_CHANGE') {
    if (typeof obj.reductionMonthly !== 'number' || !Number.isFinite(obj.reductionMonthly)) {
      return false;
    }
    return true;
  }
  ```
- Add `validateScenario` kind-specific branch for `INCOME_CHANGE`:
  ```ts
  if (s.kind === 'INCOME_CHANGE') {
    const ir = s as IncomeChangeScenario;
    if (typeof ir.reductionMonthly !== 'number' || !Number.isFinite(ir.reductionMonthly)) {
      errors.push('IncomeChangeScenario reductionMonthly must be a finite number');
    }
  }
  ```
- Add `'INCOME_CHANGE'` to the no-target guard in `isScenarioTargetValid` (line 288), alongside `CHANGE_RETIREMENT_AGE` and `REDUCE_EXPENSES`:
  ```ts
  if (scenario.kind === 'CHANGE_RETIREMENT_AGE' || scenario.kind === 'REDUCE_EXPENSES' || scenario.kind === 'INCOME_CHANGE') {
    return true;
  }
  ```

### 4. `projection/applyScenarioToInputs.ts`
After the `mergedAssetContributions` sort (around line 339), apply proportional scaling when `incomeChangeDelta` is set. Note: `reductionMonthly` can be negative (income rise → ratio > 1 → contributions scale up).
```ts
const scaledAssetContributions = (() => {
  if (delta.incomeChangeDelta === undefined) {
    return mergedAssetContributions;
  }
  const totalContribs = mergedAssetContributions.reduce((s, c) => s + c.amountMonthly, 0);
  if (totalContribs <= 0) return mergedAssetContributions;
  const ratio = Math.max(0, 1 - delta.incomeChangeDelta / totalContribs);
  return mergedAssetContributions.map(c => ({ ...c, amountMonthly: c.amountMonthly * ratio }));
})();
```
Use `scaledAssetContributions` instead of `mergedAssetContributions` in the final `scenarioInputs` construction.

### 5. `domain/scenario/templates.ts`
Update the `income-changes` entry (lines 163–172):
```ts
{
  id: 'income-changes',
  question: 'What if my income stopped or reduced?',
  description: 'Lost your job or went part-time? See how long you could keep things afloat.',
  scenarioKind: 'INCOME_CHANGE',
  icon: 'ChartLineDown',
  category: 'events',
  targetSelector: null,
  defaults: {
    amountMonthly: 30000, // placeholder; overridden dynamically from snapshot income in screen
    min: 0,
    max: 130000,
    step: 10000,
  },
  enabled: true,
}
```

### 6. `screens/ScenarioExplorerScreen.tsx`

**Compute dynamic defaults for INCOME_CHANGE** — insert before `const defaults = template?.defaults;` (around line 589):
```ts
// INCOME_CHANGE: override defaults dynamically from snapshot net income
const baselineAnnualIncome = template?.scenarioKind === 'INCOME_CHANGE'
  ? state.netIncomeItems.reduce((s: number, i: { monthlyAmount: number }) => s + i.monthlyAmount, 0) * 12
  : 0;
const effectiveDefaults = template?.scenarioKind === 'INCOME_CHANGE'
  ? {
      amountMonthly: baselineAnnualIncome,
      min: Math.max(0, baselineAnnualIncome - 100000),
      max: baselineAnnualIncome + 100000,
      step: 10000,
    }
  : template?.defaults ?? null;
```
Then change `const defaults = template?.defaults;` → `const defaults = effectiveDefaults;`

**`formatSliderValue`** — add before the `return` fallback:
```ts
if (scenarioKind === 'INCOME_CHANGE') return `${formatCurrencyCompact(value)}/yr`;
```

**`getSliderSectionTitle`** (around line 497):
```ts
if (scenarioKind === 'INCOME_CHANGE') return 'Annual take-home income';
```

**`recomputeScenario` switch** (around line 697):
```ts
case 'INCOME_CHANGE': {
  const baselineMonthly = state.netIncomeItems.reduce((s: number, i: { monthlyAmount: number }) => s + i.monthlyAmount, 0);
  scenario = {
    id: '__preview__',
    name: 'Preview',
    kind: 'INCOME_CHANGE',
    reductionMonthly: baselineMonthly - amount / 12,
  };
  break;
}
```

**`handleSave` switch** (around line 885):
```ts
case 'INCOME_CHANGE': {
  const baselineMonthly = state.netIncomeItems.reduce((s: number, i: { monthlyAmount: number }) => s + i.monthlyAmount, 0);
  const reductionMonthly = baselineMonthly - sliderValue / 12;
  const changeLabel = reductionMonthly >= 0
    ? `Income −${formatCurrencyCompact(reductionMonthly * 12)}/yr`
    : `Income +${formatCurrencyCompact(Math.abs(reductionMonthly) * 12)}/yr`;
  newScenario = {
    id: generateId(),
    name: changeLabel,
    kind: 'INCOME_CHANGE',
    reductionMonthly,
  };
  break;
}
```

**`SCENARIO_IMPACT_TEXT`** (around line 464):
```ts
'income-changes': 'When take-home income drops, less goes into your savings each month. Your assets keep compounding on what\'s already there — but the inflow shrinks or stops. The longer it lasts, the wider the gap.',
```

**`buildNarrative` params type** — add:
```ts
baselineAnnualIncome?: number;
totalBaselineContributionsMonthly?: number;
```

**`buildNarrative` call site** (line ~1206) — add to the params object:
```ts
baselineAnnualIncome,
totalBaselineContributionsMonthly: baselineInputs.assetContributionsMonthly.reduce((s, c) => s + c.amountMonthly, 0),
```

**`buildNarrative` switch — new `INCOME_CHANGE` case** (before `default`):
```ts
case 'INCOME_CHANGE': {
  const newAnnual = params.sliderValue;
  const baseline = params.baselineAnnualIncome ?? 0;
  const annualDelta = newAnnual - baseline; // negative = income dropped, positive = income rose
  const monthlyDelta = annualDelta / 12;
  const totalContribs = params.totalBaselineContributionsMonthly ?? 0;
  const reductionMonthly = -monthlyDelta; // positive when income dropped
  const effectiveDrop = Math.min(reductionMonthly, totalContribs);
  const isFullStop = reductionMonthly >= totalContribs && totalContribs > 0;
  const isIncrease = annualDelta > 0;
  const monthlyExpenses = params.monthlyExpensesRetirement ?? 0;
  const liquid = params.liquidAssetsNow ?? 0;
  const runwayMonths = monthlyExpenses > 0 && liquid > 0 ? Math.floor(liquid / monthlyExpenses) : null;
  const paras: string[] = [];

  if (baseline <= 0) {
    paras.push(`No net income is set up — add income items to your snapshot to use this scenario.`);
  } else if (isIncrease) {
    const pctGain = Math.round((annualDelta / baseline) * 100);
    paras.push(
      `**${c(annualDelta)}/yr** more take-home income — that's **${pctGain}%** above your baseline. Contributions scale up proportionally.`,
    );
  } else if (isFullStop) {
    paras.push(
      `A drop to **${c(newAnnual)}/yr** wipes out all **${c(totalContribs)}/mo** going into savings. ` +
      `Your assets keep compounding on the existing balance, but no new money goes in pre-retirement.`,
    );
  } else if (totalContribs <= 0) {
    paras.push(`No monthly contributions are set up — this scenario has no effect on your projection. Add contributions to an asset to see the impact.`);
  } else {
    const pctLost = Math.round((effectiveDrop / totalContribs) * 100);
    paras.push(
      `**${c(-annualDelta)}/yr** less take-home income means **${c(effectiveDrop)}/mo** less going into savings — about **${pctLost}%** of your current contributions.`,
    );
  }

  if (yearsIn > 0 && (totalContribs > 0 || isIncrease)) {
    paras.push(
      `At **${selectedAge}** your net worth is **${c(scenarioAtAge.netWorth)}** vs **${c(baselineAtAge.netWorth)}** in your baseline — **${sgn(nwDelta)}**.`,
    );
  }

  if (runwayMonths !== null && !isIncrease) {
    if (runwayMonths < 3) {
      paras.push(
        `**Emergency buffer: ~${runwayMonths} month${runwayMonths !== 1 ? 's' : ''}**. ` +
        `Liquid assets of **${c(liquid)}** cover less than 3 months at **${c(monthlyExpenses)}/mo** in expenses.`,
      );
    } else if (runwayMonths < 12) {
      paras.push(
        `Liquid assets of **${c(liquid)}** give roughly **${runwayMonths} months** of runway at **${c(monthlyExpenses)}/mo** in expenses.`,
      );
    } else {
      const runwayYears = (runwayMonths / 12).toFixed(1);
      paras.push(
        `Liquid assets of **${c(liquid)}** cover roughly **${runwayYears} years** of expenses at **${c(monthlyExpenses)}/mo**.`,
      );
    }
  }

  const status: NarrativeResult['status'] =
    isIncrease
      ? 'ok'
      : runwayMonths !== null && runwayMonths < 3
        ? 'critical'
        : runwayMonths !== null && runwayMonths < 6
          ? 'concern'
          : nwDelta < 0 ? 'concern' : 'ok';

  const statusText =
    isIncrease
      ? 'Income up — contributions scale with it'
      : runwayMonths !== null && runwayMonths < 3
        ? 'Critical — under 3 months liquid buffer'
        : runwayMonths !== null && runwayMonths < 6
          ? `~${runwayMonths}mo liquid buffer — limited cover`
          : isFullStop
            ? 'Contributions stopped — coasting on existing balance'
            : 'Manageable — monitor long-run impact';

  return { paragraphs: paras, status, statusText };
}
```

---

## Notes & boundaries
- **Gross vs net**: slider represents take-home annual income; no gross/NI/pension assumptions
- **Expenses**: untouched — user still owes the same bills
- **Income increase**: allowed (ratio > 1 → contributions scale up proportionally)
- **No income set up**: narrative handles gracefully
- **No contributions set up**: narrative handles gracefully with an explanatory paragraph

---

## Verification
1. Navigate to What If tab → "What if my income stopped or reduced?" should be enabled
2. ScenarioExplorerScreen loads with a single £/yr slider centred on snapshot income, range ±£5K
3. Drag slider to 0 (or below total contributions threshold) → contributions go to zero, chart diverges maximally
4. Drag slider above baseline → contributions scale up, chart shows higher net worth
5. Drag slider to a small drop → contributions reduce proportionally, smaller divergence
6. Drag chart cursor right → narrative updates with net worth delta and liquid runway
7. Save the scenario → persists and returns to previous screen
8. No TypeScript errors — `never` exhaustive check in `delta.ts` still compiles
