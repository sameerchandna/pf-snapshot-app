# Negative Surplus Fix — Test Specification

**Date:** 2024  
**Status:** Test specification for negative surplus fix implementation

---

## Test Cases

### 1. Selector Behavior Tests

#### Test 1.1: `selectMonthlySurplus()` preserves negative values
**Setup:**
- Snapshot with negative monthly surplus (e.g., availableCash = 1000, assetContributions = 1500, liabilityReduction = 500)
- Expected monthlySurplus = 1000 - 1500 - 500 = -1000

**Assert:**
- `selectMonthlySurplus(state)` returns -1000 (not clamped to 0)

#### Test 1.2: `selectMonthlySurplusWithScenario()` preserves negative baseline
**Setup:**
- Baseline monthlySurplus = -500
- Active scenario: FLOW_TO_ASSET with amountMonthly = 200

**Assert:**
- `selectMonthlySurplusWithScenario(state, scenario)` returns -700 (not clamped to 0)
- Formula: -500 - 200 = -700

#### Test 1.3: `selectMonthlySurplusWithScenario()` preserves negative adjusted value
**Setup:**
- Baseline monthlySurplus = 100
- Active scenario: FLOW_TO_ASSET with amountMonthly = 300

**Assert:**
- `selectMonthlySurplusWithScenario(state, scenario)` returns -200 (not clamped to 0)
- Formula: 100 - 300 = -200

#### Test 1.4: `selectMonthlySurplusWithScenario()` works with positive values
**Setup:**
- Baseline monthlySurplus = 1000
- Active scenario: FLOW_TO_ASSET with amountMonthly = 200

**Assert:**
- `selectMonthlySurplusWithScenario(state, scenario)` returns 800
- Formula: 1000 - 200 = 800

---

### 2. Attribution Behavior Tests

#### Test 2.1: Attribution `monthlySurplus` preserves negative values
**Setup:**
- Snapshot with netSurplus = 1000, postTaxContributions = 1200, mortgageOverpayments = 500
- Expected monthlySurplus = 1000 - 1200 - 500 = -700

**Assert:**
- Attribution's computed `monthlySurplus` is -700 (not clamped to 0)
- Formula: netSurplus - allocationsTotal = 1000 - 1700 = -700

---

### 3. Scenario Gating Tests

#### Test 3.1: Scenario creation disabled when baseline surplus < -UI_TOLERANCE
**Setup:**
- Baseline monthlySurplus = -100 (less than -UI_TOLERANCE = -0.01)

**Assert:**
- "Create Scenario" button in ScenarioManagementScreen is disabled
- Button has disabled styling (opacity 0.5)
- Banner message displayed: "Monthly surplus is negative (-£100). Reduce allocations or expenses before running what-ifs."

#### Test 3.2: Scenario activation disabled when baseline surplus < -UI_TOLERANCE
**Setup:**
- Baseline monthlySurplus = -50
- Existing saved scenarios available

**Assert:**
- All scenario activation buttons (radio dots) in ScenarioManagementScreen are disabled
- Baseline activation button is disabled
- Buttons have disabled styling (opacity 0.5)

#### Test 3.3: Scenario creation/activation enabled when baseline surplus >= -UI_TOLERANCE
**Setup:**
- Baseline monthlySurplus = 0 (exactly at boundary)

**Assert:**
- "Create Scenario" button is enabled
- Scenario activation buttons are enabled
- No banner message displayed

#### Test 3.4: Scenario editing allowed even when baseline surplus < -UI_TOLERANCE
**Setup:**
- Baseline monthlySurplus = -100
- Existing scenario available for editing

**Assert:**
- Scenario can be opened for editing
- Scenario can be saved (but not auto-activated)
- Banner message displayed explaining the situation

#### Test 3.5: Quick What-If disabled when baseline surplus < -UI_TOLERANCE
**Setup:**
- Baseline monthlySurplus = -50

**Assert:**
- Quick What-If toggle button in ProjectionResultsScreen is disabled
- Button has disabled styling (opacity 0.5)
- Banner message displayed

#### Test 3.6: Scenario selector disabled when baseline surplus < -UI_TOLERANCE
**Setup:**
- Baseline monthlySurplus = -50

**Assert:**
- Scenario selector button in ProjectionResultsScreen is disabled
- Scenario selector modal shows disabled options
- Banner message displayed in modal

---

### 4. UI Display Tests

#### Test 4.1: Negative surplus displayed correctly
**Setup:**
- Monthly surplus = -500

**Assert:**
- `formatCurrencyFullSigned(-500)` displays "-£500"
- No positive "available cash" appears when surplus < 0

#### Test 4.2: Banner message formatting
**Setup:**
- Baseline monthlySurplus = -1234.56

**Assert:**
- Banner message: "Monthly surplus is negative (-£1,235). Reduce allocations or expenses before running what-ifs."
- Currency formatted with `formatCurrencyFullSigned()`

---

## Manual Test Checklist

When implementing these tests, verify:

- [ ] Negative values propagate through all selectors without clamping
- [ ] Attribution layer shows negative monthlySurplus without clamping
- [ ] Scenario creation is blocked when surplus < -UI_TOLERANCE
- [ ] Scenario activation is blocked when surplus < -UI_TOLERANCE
- [ ] Quick What-If is blocked when surplus < -UI_TOLERANCE
- [ ] Scenario editing is allowed even when surplus < -UI_TOLERANCE
- [ ] Banner messages appear with correct formatting
- [ ] Disabled controls have appropriate visual styling
- [ ] No snapshot mutation occurs
- [ ] No SYSTEM_CASH mutation occurs
- [ ] All Flow vs Stock invariants preserved

---

## Implementation Notes

These tests can be implemented using:
- Jest + React Native Testing Library (if test framework is added)
- Manual verification checklist (current state)
- Integration tests in a test environment

The key invariants to verify:
1. Negative surplus values are never clamped to 0 in computation
2. Gating logic correctly blocks scenario actions when surplus < -UI_TOLERANCE
3. UI correctly displays negative values and disabled states
4. No state mutations occur (read-only gating)
