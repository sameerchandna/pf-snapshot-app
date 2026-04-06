import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VictoryChart, VictoryLine, VictoryAxis } from 'victory-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import Icon from '../components/Icon';
import SketchBackground from '../components/SketchBackground';
import SketchCard from '../components/SketchCard';
import Divider from '../components/Divider';
import SectionCard from '../components/SectionCard';
import Button from '../components/Button';
import { useSnapshot } from '../context/SnapshotContext';
import { getTemplateById } from '../domain/scenario/templates';
import type { SliderConfig } from '../domain/scenario/templates';
import type { Scenario } from '../domain/scenario/types';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { applyScenarioToProjectionInputs } from '../projection/applyScenarioToInputs';
import { computeProjectionSeries } from '../engines/projectionEngine';
import type { ProjectionSeriesPoint } from '../engines/projectionEngine';
import { selectMonthlySurplus, selectSnapshotExpenses } from '../engines/selectors';
import { saveScenario, setActiveScenarioId } from '../scenarioState';
import { formatCurrencyCompact, formatCurrencyCompactSigned } from '../ui/formatters';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { typography, radius } from '../ui/theme/theme';
import CustomSlider from '../components/CustomSlider';

// ─── Series analysis helpers ──────────────────────────────────────────────────

function findPayoffAge(series: ProjectionSeriesPoint[]): number | null {
  for (const p of series) {
    if (p.liabilities <= 0) return Math.round(p.age);
  }
  return null;
}

function findDepletionAge(series: ProjectionSeriesPoint[]): number | null {
  let hadPositive = false;
  for (const p of series) {
    if (p.netWorth > 0) hadPositive = true;
    if (hadPositive && p.netWorth <= 0) return Math.round(p.age);
  }
  return null;
}

function calcMonthlyPayment(balance: number, annualRatePct: number, termYears: number): number {
  if (balance <= 0 || termYears <= 0) return 0;
  const r = (annualRatePct / 100) / 12;
  const n = termYears * 12;
  if (r <= 0) return balance / n;
  return (balance * r) / (1 - Math.pow(1 + r, -n));
}

function calcMortgageInterest(balance: number, annualRatePct: number, termYears: number): number {
  if (balance <= 0 || termYears <= 0) return 0;
  const r = (annualRatePct / 100) / 12;
  const n = termYears * 12;
  if (r <= 0) return 0;
  const monthly = (balance * r) / (1 - Math.pow(1 + r, -n));
  return Math.max(0, monthly * n - balance);
}

function findInflectionAge(
  baselineSeries: ProjectionSeriesPoint[],
  scenarioSeries: ProjectionSeriesPoint[],
  annualContributionEquiv: number,
  fromAge: number,
): number | null {
  for (let i = 1; i < Math.min(baselineSeries.length, scenarioSeries.length); i++) {
    if (scenarioSeries[i].age < fromAge) continue;
    const prevDelta = scenarioSeries[i - 1].assets - baselineSeries[i - 1].assets;
    const currDelta = scenarioSeries[i].assets - baselineSeries[i].assets;
    if (currDelta - prevDelta >= annualContributionEquiv) {
      return Math.round(scenarioSeries[i].age);
    }
  }
  return null;
}

// ─── Bold text renderer ───────────────────────────────────────────────────────

function renderBoldText(text: string, style: object | object[]): React.ReactElement {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <Text key={i} style={{ fontWeight: '600' as const }}>{part}</Text>
          : part,
      )}
    </Text>
  );
}

// ─── Narrative builder ─────────────────────────────────────────────────────────

type NarrativeResult = {
  paragraphs: string[];
  status: 'ok' | 'concern' | 'critical';
  statusText: string;
};

function buildNarrative(params: {
  scenarioKind: import('../domain/scenario/types').ScenarioKind | null;
  currentAge: number;
  selectedAge: number;
  baselineRetirementAge: number;
  sliderValue: number;
  sliderValues: Record<string, number>;
  baselineAtAge: ProjectionSeriesPoint;
  scenarioAtAge: ProjectionSeriesPoint;
  baselineSeries: ProjectionSeriesPoint[];
  scenarioSeries: ProjectionSeriesPoint[];
  originalLiability?: { balance: number; annualInterestRatePct?: number; remainingTermYears?: number };
  liquidAssetsNow?: number;
  lockedUnlockAges?: number[];
  monthlyExpensesRetirement?: number;
  portfolioWeightedGrowthRate?: number;
  baselineAnnualIncome?: number;
  totalBaselineContributionsMonthly?: number;
  totalMonthlyOutgoings?: number;
}): NarrativeResult {
  const { currentAge, selectedAge, baselineAtAge, scenarioAtAge, baselineSeries, scenarioSeries } = params;
  const c = formatCurrencyCompact;
  const sgn = formatCurrencyCompactSigned;
  const yearsIn = Math.max(0, selectedAge - currentAge);
  const nwDelta = scenarioAtAge.netWorth - baselineAtAge.netWorth;
  const assDelta = scenarioAtAge.assets - baselineAtAge.assets;

  switch (params.scenarioKind) {

    case 'SAVINGS_WHAT_IF': {
      const contrib = params.sliderValues.contribution ?? 100;
      const rate = params.sliderValues.growthRate ?? 8;
      const directContribs = contrib * 12 * yearsIn;
      const compoundPortion = Math.max(0, assDelta - directContribs);
      const compoundPct = assDelta > 100 ? Math.round((compoundPortion / assDelta) * 100) : 0;
      const inflectionAge = findInflectionAge(baselineSeries, scenarioSeries, contrib * 12, currentAge);
      const paras: string[] = [];

      if (yearsIn <= 0) {
        paras.push(
          `You're about to add **${c(contrib)}/mo** at **${rate}% annual growth**. Drag the cursor right to see how it builds over time.`,
        );
      } else {
        paras.push(
          `**${yearsIn} year${yearsIn !== 1 ? 's' : ''}** of **${c(contrib)}/mo** extra at **${rate}% growth**. ` +
          `At **${selectedAge}** your assets are **${sgn(assDelta)}** vs baseline.`,
        );
        if (compoundPortion > 200 && compoundPct > 5) {
          paras.push(
            `**${c(directContribs)}** of that came from direct contributions — the other **${c(compoundPortion)}** (${compoundPct}%) is compounding doing the work.`,
          );
        }
        if (inflectionAge !== null && inflectionAge <= selectedAge) {
          paras.push(
            `Compounding overtook your monthly contributions around **age ${inflectionAge}** — that's when growth on the existing pot started outearning the new money going in each month.`,
          );
        } else if (inflectionAge !== null) {
          paras.push(
            `Compounding hasn't overtaken your direct contributions yet. That crossover is on track for around **age ${inflectionAge}**.`,
          );
        }
        paras.push(
          `Net worth at **${selectedAge}**: **${c(scenarioAtAge.netWorth)}** vs **${c(baselineAtAge.netWorth)}** in your baseline.`,
        );
      }

      const isLowRate = rate < 3;
      return {
        paragraphs: paras,
        status: isLowRate ? 'concern' : 'ok',
        statusText: isLowRate
          ? 'Low growth rate — may not keep pace with inflation'
          : nwDelta > 0 ? 'Looking good' : 'No material impact yet',
      };
    }

    case 'MORTGAGE_WHAT_IF': {
      const overpay = params.sliderValues.overpayment ?? 0;
      const scenarioRate = params.sliderValues.interestRate ?? 4.5;
      const scenarioTerm = Math.round(params.sliderValues.remainingTerm ?? 25);
      const origRate = params.originalLiability?.annualInterestRatePct ?? scenarioRate;
      const origTerm = params.originalLiability?.remainingTermYears ?? scenarioTerm;
      const origBalance = params.originalLiability?.balance ?? 0;

      const baselinePayoffAge = findPayoffAge(baselineSeries);
      const scenarioPayoffAge = findPayoffAge(scenarioSeries);
      const yearsSaved =
        baselinePayoffAge != null && scenarioPayoffAge != null
          ? baselinePayoffAge - scenarioPayoffAge
          : null;

      const baseInterest = origBalance > 0 ? calcMortgageInterest(origBalance, origRate, origTerm) : null;
      const effTerm = scenarioPayoffAge != null ? scenarioPayoffAge - currentAge : scenarioTerm;
      const scenInterest = origBalance > 0 ? calcMortgageInterest(origBalance, scenarioRate, effTerm) : null;
      const interestSaved = baseInterest != null && scenInterest != null ? baseInterest - scenInterest : null;

      const rateChanged = Math.abs(scenarioRate - origRate) >= 0.1;
      const rateUp = scenarioRate > origRate;
      const origMonthly = origBalance > 0 ? calcMonthlyPayment(origBalance, origRate, origTerm) : null;
      const scenarioMonthly = origBalance > 0 ? calcMonthlyPayment(origBalance, scenarioRate, scenarioTerm) : null;
      const paymentDelta = origMonthly != null && scenarioMonthly != null ? scenarioMonthly - origMonthly : null;
      const liabDelta = scenarioAtAge.liabilities - baselineAtAge.liabilities;
      const paras: string[] = [];

      if (scenarioAtAge.liabilities <= 0 && scenarioPayoffAge != null) {
        paras.push(
          `At **${selectedAge}** your mortgage is already cleared — paid off at **${scenarioPayoffAge}**. ` +
          `In your baseline you'd still owe **${c(baselineAtAge.liabilities)}** at this age.`,
        );
      } else {
        paras.push(
          `At **${selectedAge}** your balance is **${c(scenarioAtAge.liabilities)}** vs **${c(baselineAtAge.liabilities)}** in your baseline — ` +
          `**${c(Math.abs(liabDelta))}** ${liabDelta < 0 ? 'less' : 'more'} outstanding.`,
        );
      }

      if (yearsSaved != null && yearsSaved !== 0 && scenarioPayoffAge != null && baselinePayoffAge != null) {
        if (yearsSaved > 0) {
          paras.push(
            `You're on track to clear it at **${scenarioPayoffAge}** instead of **${baselinePayoffAge}** — **${yearsSaved} year${yearsSaved !== 1 ? 's' : ''} earlier**.`,
          );
        } else {
          paras.push(
            `The mortgage now runs to **${scenarioPayoffAge}** — **${Math.abs(yearsSaved)} year${Math.abs(yearsSaved) !== 1 ? 's' : ''} longer** than your original payoff of **${baselinePayoffAge}**.`,
          );
        }
      }

      if (rateChanged) {
        const paymentLine = paymentDelta != null && Math.abs(paymentDelta) >= 5
          ? rateUp
            ? ` Your monthly payment rises from **${c(origMonthly!)}** to **${c(scenarioMonthly!)}** — **${c(paymentDelta)} more** each month.`
            : ` Your monthly payment drops from **${c(origMonthly!)}** to **${c(scenarioMonthly!)}** — **${c(Math.abs(paymentDelta))} less** each month.`
          : '';
        if (rateUp) {
          paras.push(
            `At **${scenarioRate}%** (up from **${origRate}%**), more of each payment goes to interest rather than principal — that's what stretches the term and drives up the total cost.${paymentLine}`,
          );
        } else {
          paras.push(
            `Dropping from **${origRate}%** to **${scenarioRate}%** means less of each payment is eaten by interest — you reduce the principal faster from day one.${paymentLine}`,
          );
        }
      }

      if (interestSaved != null && Math.abs(interestSaved) > 500) {
        if (interestSaved > 0) {
          paras.push(`Total interest over the life of the mortgage: roughly **${c(interestSaved)}** saved vs your current terms.`);
        } else {
          paras.push(`Total interest over the life of the mortgage increases by roughly **${c(Math.abs(interestSaved))}** compared to your current terms.`);
        }
      }

      if (overpay > 0 && rateChanged && rateUp) {
        paras.push(`The **${c(overpay)}/mo** overpayment is partially offsetting the rate rise — without it the payoff would be even later.`);
      } else if (overpay > 0 && !rateUp) {
        paras.push(`Combined with the lower rate, **${c(overpay)}/mo** in overpayments means both levers are working in the same direction.`);
      }

      const isConcern = (yearsSaved != null && yearsSaved < -2) || scenarioRate > origRate + 1.5;
      return {
        paragraphs: paras,
        status: isConcern ? 'concern' : 'ok',
        statusText: isConcern
          ? yearsSaved != null && yearsSaved < 0
            ? `Payoff pushed out ${Math.abs(yearsSaved)} years`
            : 'Rate significantly higher than current'
          : yearsSaved != null && yearsSaved > 0
            ? `${yearsSaved} year${yearsSaved !== 1 ? 's' : ''} earlier payoff`
            : 'On track',
      };
    }

    case 'CHANGE_RETIREMENT_AGE': {
      const retireAge = Math.round(params.sliderValue);
      const baseRetireAge = params.baselineRetirementAge;
      const yearsDiff = baseRetireAge - retireAge;
      const depletionAge = findDepletionAge(scenarioSeries);
      const baseDepletionAge = findDepletionAge(baselineSeries);
      const isPreRetirement = selectedAge < retireAge;
      const yearsRetired = isPreRetirement ? 0 : selectedAge - retireAge;
      const paras: string[] = [];

      if (yearsDiff > 0) {
        if (isPreRetirement) {
          paras.push(
            `Retiring at **${retireAge}** — **${yearsDiff} year${yearsDiff !== 1 ? 's' : ''} earlier** than your current plan of **${baseRetireAge}**. At **${selectedAge}** you're still in the accumulation phase, building your pot.`,
          );
        } else {
          paras.push(
            `You've been retired for **${yearsRetired} year${yearsRetired !== 1 ? 's' : ''}** in this scenario. ` +
            `Net worth at **${selectedAge}**: **${c(scenarioAtAge.netWorth)}** vs **${c(baselineAtAge.netWorth)}** — **${sgn(nwDelta)}** vs baseline.`,
          );
        }
        paras.push(
          `Retiring at **${retireAge}** instead of **${baseRetireAge}** means **${yearsDiff} fewer year${yearsDiff !== 1 ? 's' : ''}** of contributions and income, plus **${yearsDiff} more year${yearsDiff !== 1 ? 's' : ''}** drawing on your pot.`,
        );
        if (depletionAge != null) {
          paras.push(
            `At your current drawdown rate, this scenario projects net worth turning negative around **age ${depletionAge}**. That's within a realistic life expectancy — worth stress-testing your expected costs.`,
          );
        } else if (baseDepletionAge == null) {
          paras.push(
            `Your net worth stays positive through to the end of the projection in both scenarios — a good sign, though the gap between the two lines widens from **${retireAge}** onwards.`,
          );
        }
      } else if (yearsDiff < 0) {
        const extraYears = Math.abs(yearsDiff);
        paras.push(
          `Working until **${retireAge}** — **${extraYears} year${extraYears !== 1 ? 's' : ''} longer** than your current plan of **${baseRetireAge}**.`,
        );
        paras.push(
          `By **${selectedAge}** your net worth is **${sgn(nwDelta)}** vs baseline. Those extra working years add contributions and leave your pot untouched for longer.`,
        );
        if (depletionAge == null && baseDepletionAge != null) {
          paras.push(
            `In your baseline the pot runs out around **age ${baseDepletionAge}**. In this scenario it lasts through the full projection — the extra working years made the difference.`,
          );
        }
      } else {
        paras.push(`Retirement age matches your current plan (**${retireAge}**). Drag the slider to see what earlier or later retirement would mean.`);
      }

      // Growth vs drawdown (at selected age, post-retirement only)
      const annualExpenses = (params.monthlyExpensesRetirement ?? 0) * 12;
      const growthRate = params.portfolioWeightedGrowthRate ?? 0;
      const assetsAtSelectedAge = scenarioAtAge.assets;
      if (!isPreRetirement && annualExpenses > 0 && growthRate > 0 && assetsAtSelectedAge > 0) {
        const annualGrowth = assetsAtSelectedAge * (growthRate / 100);
        const drawdownRate = (annualExpenses / assetsAtSelectedAge) * 100;
        if (annualGrowth >= annualExpenses) {
          paras.push(
            `At **${growthRate.toFixed(1)}% growth (${c(annualGrowth)}/yr on ${c(assetsAtSelectedAge)})** against **${c(annualExpenses)}/yr** in retirement costs, your drawdown rate is **${drawdownRate.toFixed(1)}%** — growth is outpacing withdrawals.`,
          );
        } else {
          paras.push(
            `Portfolio grows at **${growthRate.toFixed(1)}% (${c(annualGrowth)}/yr on ${c(assetsAtSelectedAge)})** but retirement costs are **${c(annualExpenses)}/yr** — a **${drawdownRate.toFixed(1)}% drawdown rate**. The pot is shrinking in real terms each year.`,
          );
        }
      }

      // Liquid asset gap
      const liquidNow = params.liquidAssetsNow ?? 0;
      const liquidYears = annualExpenses > 0 && liquidNow > 0 ? liquidNow / annualExpenses : null;
      let liquidStatus: NarrativeResult['status'] = depletionAge != null ? 'concern' : 'ok';
      let liquidStatusText = depletionAge != null
        ? `Pot may deplete around age ${depletionAge}`
        : yearsDiff > 0
          ? 'Manageable — monitor drawdown'
          : 'Stronger position than baseline';

      if (liquidNow < 0) {
        paras.push(`Your liquid assets are **negative** — you're already overdrawn on accessible funds.`);
        liquidStatus = 'critical';
        liquidStatusText = 'Liquid assets depleted';
      } else {
        // Pension gap: if retiring before locked assets unlock, check if liquid assets bridge the gap
        const lockedUnlockAges = params.lockedUnlockAges ?? [];
        const retireAge = Math.round(params.sliderValue);
        const earliestUnlockAge = lockedUnlockAges.length > 0 ? Math.min(...lockedUnlockAges) : null;

        if (earliestUnlockAge !== null && retireAge < earliestUnlockAge && annualExpenses > 0) {
          const gapYears = earliestUnlockAge - retireAge;
          const liquidCoverageYears = liquidNow > 0 ? liquidNow / annualExpenses : 0;
          if (liquidCoverageYears < gapYears) {
            const shortfallYears = Math.round(gapYears - liquidCoverageYears);
            paras.push(
              `**Liquidity gap:** your pension is locked until **${earliestUnlockAge}** — a **${Math.round(gapYears)}-year gap** from retirement. ` +
              `Liquid assets of **${c(liquidNow)}** cover only ~**${Math.floor(liquidCoverageYears)} year${Math.floor(liquidCoverageYears) !== 1 ? 's' : ''}** at **${c(annualExpenses)}/yr**. ` +
              `That leaves roughly **${shortfallYears} year${shortfallYears !== 1 ? 's' : ''}** with no accessible funds — you need a plan to bridge this gap.`,
            );
            liquidStatus = 'critical';
            liquidStatusText = `Liquidity gap: ~${shortfallYears}yr before pension unlocks`;
          } else {
            paras.push(
              `Pension locked until **${earliestUnlockAge}** — a **${Math.round(gapYears)}-year gap** from retirement. ` +
              `Liquid assets of **${c(liquidNow)}** give ~**${Math.floor(liquidCoverageYears)} years** of coverage at **${c(annualExpenses)}/yr** — enough to bridge through to unlock.`,
            );
          }
        } else if (liquidYears !== null && liquidYears < 2) {
          paras.push(
            `Only **${c(liquidNow)}** of your assets is liquid (immediately accessible). At **${c(annualExpenses)}/yr** that's less than **2 years** of coverage — limited buffer if you need cash before other assets unlock.`,
          );
          liquidStatus = 'concern';
          liquidStatusText = 'Low liquid coverage';
        }
      }

      return {
        paragraphs: paras,
        status: liquidStatus,
        statusText: liquidStatusText,
      };
    }

    case 'REDUCE_EXPENSES': {
      const reduction = params.sliderValue;
      const directSavings = reduction * 12 * yearsIn;
      const compoundPortion = Math.max(0, assDelta - directSavings);
      const compoundPct = assDelta > 100 ? Math.round((compoundPortion / assDelta) * 100) : 0;
      const dailySaving = Math.round(reduction / 30);
      const inflectionAge = findInflectionAge(baselineSeries, scenarioSeries, reduction * 12, currentAge);
      const paras: string[] = [];

      if (yearsIn <= 0) {
        paras.push(
          `Cutting **${c(reduction)}/mo** — about **£${dailySaving}/day** — would free up **${c(reduction * 12)}/year** that accumulates in your assets over time.`,
        );
      } else {
        paras.push(
          `**${yearsIn} year${yearsIn !== 1 ? 's' : ''}** of spending **${c(reduction)}/mo** less — about **£${dailySaving}/day**. ` +
          `At **${selectedAge}** your assets are **${sgn(assDelta)}** vs baseline.`,
        );
        if (compoundPortion > 200 && compoundPct > 5) {
          paras.push(
            `**${c(directSavings)}** came from direct savings. The other **${c(compoundPortion)}** (${compoundPct}%) is those savings compounding quietly in the background.`,
          );
        }
        if (inflectionAge !== null && inflectionAge <= selectedAge) {
          paras.push(
            `Compounding overtook direct savings around **age ${inflectionAge}** — from there, the pot earns more each year than you're adding to it.`,
          );
        } else if (inflectionAge !== null) {
          paras.push(`That compounding crossover is on track for around **age ${inflectionAge}**.`);
        }
        paras.push(
          `Net worth at **${selectedAge}**: **${c(scenarioAtAge.netWorth)}** vs **${c(baselineAtAge.netWorth)}** in your baseline.`,
        );
      }

      return {
        paragraphs: paras,
        status: 'ok',
        statusText: nwDelta > 0 ? 'Clean win — no income or market risk' : 'No material impact yet',
      };
    }

    case 'INCOME_CHANGE': {
      const newAnnual = params.sliderValue;
      const newMonthly = newAnnual / 12;
      const baseline = params.baselineAnnualIncome ?? 0;
      const annualDelta = newAnnual - baseline; // negative = income dropped, positive = income rose
      const totalContribs = params.totalBaselineContributionsMonthly ?? 0;
      const reductionMonthly = -(annualDelta / 12); // positive when income dropped
      const effectiveDrop = Math.min(reductionMonthly, totalContribs);
      const isFullStop = reductionMonthly >= totalContribs && totalContribs > 0;
      const isIncrease = annualDelta > 0;
      const monthlyExpenses = params.monthlyExpensesRetirement ?? 0;
      const totalOutgoings = params.totalMonthlyOutgoings ?? monthlyExpenses;
      const liquid = params.liquidAssetsNow ?? 0;
      const runwayMonths = monthlyExpenses > 0 && liquid > 0 ? Math.floor(liquid / monthlyExpenses) : null;
      const canCoverExpenses = totalOutgoings <= 0 || newMonthly >= totalOutgoings;
      const monthlyShortfall = Math.max(0, totalOutgoings - newMonthly);
      const paras: string[] = [];

      if (baseline <= 0) {
        paras.push(`No net income is set up — add income items to your snapshot to use this scenario.`);
      } else if (isIncrease) {
        const pctGain = Math.round((annualDelta / baseline) * 100);
        paras.push(
          `**${c(annualDelta)}/yr** more take-home income — that's **${pctGain}%** above your baseline. ` +
          `New monthly take-home: **${c(newMonthly)}/mo**. Contributions scale up proportionally.`,
        );
      } else if (isFullStop) {
        paras.push(
          `A drop to **${c(newAnnual)}/yr** (**${c(newMonthly)}/mo**) wipes out all **${c(totalContribs)}/mo** going into savings. ` +
          `Your assets keep compounding on the existing balance, but no new money goes in pre-retirement.`,
        );
      } else if (totalContribs <= 0) {
        paras.push(
          `New monthly take-home: **${c(newMonthly)}/mo**. ` +
          `No monthly contributions are set up, so there's no saving impact — add contributions to an asset to see the full picture.`,
        );
      } else {
        const pctLost = Math.round((effectiveDrop / totalContribs) * 100);
        paras.push(
          `**${c(-annualDelta)}/yr** less take-home income — new monthly take-home: **${c(newMonthly)}/mo**. ` +
          `That's **${c(effectiveDrop)}/mo** less going into savings — about **${pctLost}%** of your current contributions.`,
        );
      }

      // Expense coverage warning (uses full outgoings including mortgage)
      if (baseline > 0 && !isIncrease && totalOutgoings > 0) {
        if (!canCoverExpenses) {
          paras.push(
            `**Warning:** **${c(newMonthly)}/mo** doesn't cover your **${c(totalOutgoings)}/mo** in outgoings (inc. mortgage) — ` +
            `a **${c(monthlyShortfall)}/mo** shortfall. You'd be drawing on savings or going into debt to cover the gap.`,
          );
        } else {
          paras.push(
            `**${c(newMonthly)}/mo** covers your **${c(totalOutgoings)}/mo** in outgoings (inc. mortgage), leaving **${c(newMonthly - totalOutgoings)}/mo** headroom.`,
          );
        }
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
          : !canCoverExpenses
            ? 'critical'
            : runwayMonths !== null && runwayMonths < 3
              ? 'critical'
              : runwayMonths !== null && runwayMonths < 6
                ? 'concern'
                : nwDelta < 0 ? 'concern' : 'ok';

      const statusText =
        isIncrease
          ? 'Income up — contributions scale with it'
          : !canCoverExpenses
            ? `Critical — ${c(monthlyShortfall)}/mo shortfall vs expenses`
            : runwayMonths !== null && runwayMonths < 3
              ? 'Critical — under 3 months liquid buffer'
              : runwayMonths !== null && runwayMonths < 6
                ? `~${runwayMonths}mo liquid buffer — limited cover`
                : isFullStop
                  ? 'Contributions stopped — coasting on existing balance'
                  : 'Manageable — monitor long-run impact';

      return { paragraphs: paras, status, statusText };
    }

    default:
      return {
        paragraphs: [
          `At age **${selectedAge}** — net worth **${c(scenarioAtAge.netWorth)}** vs **${c(baselineAtAge.netWorth)}** baseline (**${sgn(nwDelta)}**).`,
        ],
        status: nwDelta >= 0 ? 'ok' : 'concern',
        statusText: nwDelta >= 0 ? 'Looking good' : 'Worth checking',
      };
  }
}

const SCENARIO_IMPACT_TEXT: Record<string, string> = {
  'savings-what-if': 'Every extra bit you put into your savings and pension compounds over time. More contributions plus a decent growth rate = a bigger pot later.',
  'mortgage-what-if': 'Paying a little extra each month chips away at what you owe. Less interest, shorter term — and you own your home sooner. It all lifts your net worth over time.',
  'retire-at-age': 'Stop earlier and you\'re drawing on your savings and pension for longer — and topping them up for less time. Go later and the balance flips. Drag the slider to see how the timing changes your whole picture.',
  'spend-less': 'Reducing your monthly expenses means more left over each month. That surplus builds up in your assets over time — and the more you have saved, the longer it can cover your costs when you need it.',
  'income-reduces': 'When take-home income drops, less goes into your savings each month. Your assets keep compounding on what\'s already there — but the inflow shrinks or stops. The longer it lasts, the wider the gap.',
};

type RouteParams = {
  templateId: string;
  scenarioId?: string;
  /** Pre-fill slider with a specific value (e.g. from Problem Solver back-solve) */
  initialValue?: number;
  /** Pre-fill growth rate slider (SAVINGS_WHAT_IF) */
  initialGrowthRate?: number;
  /** Pre-select a specific target asset/loan */
  initialTargetId?: string;
  /** When navigated from another tab, back/discard returns here instead of goBack */
  returnToTab?: string;
};

function formatSliderValue(scenarioKind: string | null, value: number): string {
  if (scenarioKind === 'CHANGE_RETIREMENT_AGE') return `Age ${Math.round(value)}`;
  if (scenarioKind === 'CHANGE_ASSET_GROWTH_RATE') return `${value}%`;
  if (scenarioKind === 'INCOME_CHANGE') return `${formatCurrencyCompact(value)}/yr`;
  return `${formatCurrencyCompact(value)}/mo`;
}

function formatSliderConfigValue(format: SliderConfig['format'], value: number): string {
  if (format === 'age') return `Age ${Math.round(value)}`;
  if (format === 'percent') return `${value}%`;
  if (format === 'years') return `${Math.round(value)} yr`;
  return `${formatCurrencyCompact(value)}/mo`;
}

function getSliderSectionTitle(scenarioKind: string | null): string {
  if (scenarioKind === 'CHANGE_RETIREMENT_AGE') return 'Retire at age';
  if (scenarioKind === 'CHANGE_ASSET_GROWTH_RATE') return 'Annual growth rate';
  if (scenarioKind === 'REDUCE_EXPENSES') return 'Monthly reduction';
  if (scenarioKind === 'INCOME_CHANGE') return 'Annual take-home income';
  return 'Monthly amount';
}

type TargetItem = {
  id: string;
  name: string;
};

function buildTargetLabel(
  targetSelector: string | null,
  targetId: string,
  assets: import('../types').AssetItem[],
  liabilities: import('../types').LiabilityItem[],
): string {
  if (!targetId) return '';
  if (targetSelector === 'asset') {
    const a = assets.find(x => x.id === targetId);
    if (!a) return '';
    const parts: string[] = [a.name];
    if (typeof a.annualGrowthRatePct === 'number') parts.push(`${a.annualGrowthRatePct}%`);
    const avail = a.availability?.type;
    if (!avail || avail === 'immediate') parts.push('Liquid');
    else if (avail === 'locked') parts.push('Locked');
    else if (avail === 'illiquid') parts.push('Illiquid');
    return parts.join(' · ');
  }
  if (targetSelector === 'loan') {
    const l = liabilities.find(x => x.id === targetId);
    if (!l) return '';
    const parts: string[] = [l.name];
    if (typeof l.annualInterestRatePct === 'number') parts.push(`${l.annualInterestRatePct}%`);
    return parts.join(' · ');
  }
  return '';
}

function generateId(): string {
  return `scenario_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export default function ScenarioExplorerScreen() {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { templateId, initialValue, initialGrowthRate, initialTargetId, returnToTab } = route.params as RouteParams;
  const { state } = useSnapshot();

  const template = getTemplateById(templateId);

  // --- Baseline state ---
  const baselineInputs = useMemo(() => buildProjectionInputsFromState(state), [state]);
  const baselineSeries = useMemo(() => computeProjectionSeries(baselineInputs), [baselineInputs]);

  // --- Target selection ---
  const targets: TargetItem[] = useMemo(() => {
    if (!template) return [];
    if (template.targetSelector === 'asset') {
      return state.assets
        .filter(a => a.isActive !== false)
        .map(a => ({ id: a.id, name: a.name }));
    }
    if (template.targetSelector === 'loan') {
      return state.liabilities
        .filter(l => l.isActive !== false)
        .map(l => ({ id: l.id, name: l.name }));
    }
    return [];
  }, [template, state]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => initialTargetId ?? targets[0]?.id ?? '');
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);

  // Auto-select first target when targets load
  useEffect(() => {
    if (targets.length > 0 && !selectedTargetId) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets]);

  // Sync target when navigated with a new initialTargetId (screen may not remount)
  useEffect(() => {
    if (initialTargetId) {
      setSelectedTargetId(initialTargetId);
    }
  }, [initialTargetId]);

  // --- Slider ---
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
  const defaults = effectiveDefaults;
  const isMultiSlider = !!(template?.sliders && template.sliders.length > 0);

  // Single-slider state (legacy templates)
  const [sliderValue, setSliderValue] = useState<number>(initialValue ?? defaults?.amountMonthly ?? 100);

  // Multi-slider state (keyed by slider id)
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(() => {
    if (!template?.sliders) return {};
    const init: Record<string, number> = {};
    const initialAssetId = initialTargetId ?? state.assets.filter(a => a.isActive !== false)[0]?.id;
    const initialLiabilityId = initialTargetId ?? state.liabilities.filter(l => l.isActive !== false)[0]?.id;
    const initialLiability = state.liabilities.find(l => l.id === initialLiabilityId);
    for (const sc of template.sliders) {
      if (sc.id === 'contribution' && initialValue !== undefined) {
        init[sc.id] = initialValue;
      } else if (sc.id === 'overpayment' && initialValue !== undefined) {
        init[sc.id] = initialValue;
      } else if (sc.id === 'growthRate' && initialGrowthRate !== undefined) {
        init[sc.id] = initialGrowthRate;
      } else if (sc.id === 'growthRate' && template.scenarioKind === 'SAVINGS_WHAT_IF') {
        const asset = state.assets.find(a => a.id === initialAssetId);
        init[sc.id] = asset?.annualGrowthRatePct ?? sc.defaultValue;
      } else if (sc.id === 'interestRate' && template.scenarioKind === 'MORTGAGE_WHAT_IF') {
        init[sc.id] = initialLiability?.annualInterestRatePct ?? sc.defaultValue;
      } else if (sc.id === 'remainingTerm' && template.scenarioKind === 'MORTGAGE_WHAT_IF') {
        init[sc.id] = initialLiability?.remainingTermYears ?? sc.defaultValue;
      } else {
        init[sc.id] = sc.defaultValue;
      }
    }
    return init;
  });

  // Sync slider when navigated with a new initialValue (screen may not remount)
  useEffect(() => {
    if (initialValue !== undefined) {
      setSliderValue(initialValue);
      if (isMultiSlider) {
        setSliderValues(prev => ({ ...prev, contribution: initialValue }));
      }
    }
  }, [initialValue]);

  useEffect(() => {
    if (initialGrowthRate !== undefined && isMultiSlider) {
      setSliderValues(prev => ({ ...prev, growthRate: initialGrowthRate }));
    }
  }, [initialGrowthRate]);

  // Dynamic defaults for SAVINGS_WHAT_IF: sync growth rate slider to selected asset
  // Only when not navigated from Problem Fixer (which provides its own initialGrowthRate)
  useEffect(() => {
    if (template?.scenarioKind !== 'SAVINGS_WHAT_IF' || !selectedTargetId) return;
    if (initialGrowthRate !== undefined) return;
    const asset = state.assets.find(a => a.id === selectedTargetId);
    if (!asset) return;
    setSliderValues(prev => ({
      ...prev,
      growthRate: asset.annualGrowthRatePct ?? prev.growthRate,
    }));
  }, [selectedTargetId, template?.scenarioKind]);

  // Dynamic defaults for MORTGAGE_WHAT_IF: sync rate/term sliders to selected liability
  useEffect(() => {
    if (template?.scenarioKind !== 'MORTGAGE_WHAT_IF' || !selectedTargetId) return;
    const liability = state.liabilities.find(l => l.id === selectedTargetId);
    if (!liability) return;
    setSliderValues(prev => ({
      ...prev,
      interestRate: liability.annualInterestRatePct ?? prev.interestRate ?? 4.5,
      remainingTerm: liability.remainingTermYears ?? prev.remainingTerm ?? 25,
    }));
  }, [selectedTargetId, template?.scenarioKind]);

  // Affordability clamp: only for flow-type scenarios (FLOW_TO_ASSET / FLOW_TO_DEBT / SAVINGS_WHAT_IF contribution)
  const needsAffordabilityClamp = template?.scenarioKind === 'FLOW_TO_ASSET' || template?.scenarioKind === 'FLOW_TO_DEBT';
  const monthlySurplus = useMemo(() => selectMonthlySurplus(state), [state]);
  const effectiveMax = useMemo(() => {
    if (!defaults) return 1000;
    if (!needsAffordabilityClamp) return defaults.max;
    return Math.max(defaults.min, Math.min(defaults.max, Math.floor(monthlySurplus / (defaults.step)) * defaults.step));
  }, [defaults, monthlySurplus, needsAffordabilityClamp]);
  const isClamped = needsAffordabilityClamp && defaults ? effectiveMax < defaults.max : false;

  // Per-slider effective max (for multi-slider affordability clamping)
  const sliderEffectiveMax = useMemo(() => {
    if (!template?.sliders) return {};
    const result: Record<string, number> = {};
    for (const sc of template.sliders) {
      if (sc.affordabilityClamped) {
        result[sc.id] = Math.max(sc.min, Math.min(sc.max, Math.floor(monthlySurplus / sc.step) * sc.step));
      } else {
        result[sc.id] = sc.max;
      }
    }
    return result;
  }, [template?.sliders, monthlySurplus]);

  // --- Scenario projection (debounced) ---
  const [scenarioSeries, setScenarioSeries] = useState<ProjectionSeriesPoint[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recomputeScenario = useCallback(
    (amount: number, targetId: string, multiValues?: Record<string, number>) => {
      if (!template) return;

      let scenario: Scenario;
      switch (template.scenarioKind) {
        case 'FLOW_TO_ASSET':
          if (!targetId) return;
          scenario = { id: '__preview__', name: 'Preview', kind: 'FLOW_TO_ASSET', assetId: targetId, amountMonthly: amount };
          break;
        case 'FLOW_TO_DEBT':
          if (!targetId) return;
          scenario = { id: '__preview__', name: 'Preview', kind: 'FLOW_TO_DEBT', liabilityId: targetId, amountMonthly: amount };
          break;
        case 'CHANGE_RETIREMENT_AGE':
          scenario = { id: '__preview__', name: 'Preview', kind: 'CHANGE_RETIREMENT_AGE', retirementAge: Math.round(amount) };
          break;
        case 'REDUCE_EXPENSES':
          scenario = { id: '__preview__', name: 'Preview', kind: 'REDUCE_EXPENSES', reductionMonthly: amount };
          break;
        case 'CHANGE_ASSET_GROWTH_RATE':
          if (!targetId) return;
          scenario = { id: '__preview__', name: 'Preview', kind: 'CHANGE_ASSET_GROWTH_RATE', assetId: targetId, newAnnualGrowthRatePct: amount };
          break;
        case 'SAVINGS_WHAT_IF': {
          if (!targetId || !multiValues) return;
          scenario = {
            id: '__preview__', name: 'Preview', kind: 'SAVINGS_WHAT_IF',
            assetId: targetId,
            contributionMonthly: multiValues.contribution ?? 100,
            newAnnualGrowthRatePct: multiValues.growthRate ?? 8,
          };
          break;
        }
        case 'MORTGAGE_WHAT_IF': {
          if (!targetId || !multiValues) return;
          scenario = {
            id: '__preview__', name: 'Preview', kind: 'MORTGAGE_WHAT_IF',
            liabilityId: targetId,
            overpaymentMonthly: multiValues.overpayment ?? 0,
            newAnnualInterestRatePct: multiValues.interestRate ?? 4.5,
            newRemainingTermYears: Math.round(multiValues.remainingTerm ?? 25),
          };
          break;
        }
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
        default:
          return;
      }

      const scenarioInputs = applyScenarioToProjectionInputs(baselineInputs, scenario, state);
      setScenarioSeries(computeProjectionSeries(scenarioInputs));
    },
    [template, baselineInputs, state]
  );

  // Trigger on mount / target change / nav-param change (e.g. arriving from Problem Fixer)
  // We merge initialValue/initialGrowthRate directly here instead of relying on the slider-sync
  // effects, because those effects schedule a setState which hasn't committed yet when this effect
  // runs in the same render cycle.
  useEffect(() => {
    const needsTarget = template?.targetSelector !== null;
    if (!needsTarget || selectedTargetId) {
      const effectiveMultiValues: Record<string, number> | undefined = isMultiSlider
        ? {
            ...sliderValues,
            ...(initialValue !== undefined ? { contribution: initialValue } : {}),
            ...(initialGrowthRate !== undefined ? { growthRate: initialGrowthRate } : {}),
          }
        : undefined;
      recomputeScenario(
        initialValue ?? sliderValue,
        selectedTargetId,
        effectiveMultiValues,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTargetId, initialValue, initialGrowthRate, recomputeScenario]);

  const handleSliderChange = (value: number) => {
    const snapped = Math.round(value / (defaults?.step ?? 50)) * (defaults?.step ?? 50);
    setSliderValue(snapped);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      recomputeScenario(snapped, selectedTargetId);
    }, 300);
  };

  const handleMultiSliderChange = (sliderId: string, value: number, step: number) => {
    const snapped = Math.round(value / step) * step;
    const updated = { ...sliderValues, [sliderId]: snapped };
    setSliderValues(updated);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      recomputeScenario(0, selectedTargetId, updated);
    }, 300);
  };

  // --- Chart data ---
  const chartWidth = 380;
  const chartHeight = 240;
  const chartPadding = { top: 8, bottom: 48, left: 64, right: 16 } as const;

  // --- Age selection via chart drag ---
  const [selectedAge, setSelectedAge] = useState<number>(() => baselineInputs.endAge);

  // Sync selectedAge if endAge shrinks below it
  useEffect(() => {
    if (selectedAge > baselineInputs.endAge) {
      setSelectedAge(baselineInputs.endAge);
    }
  }, [baselineInputs.endAge, selectedAge]);

  const mapTouchXToAge = useCallback((
    touchX: number,
    width: number,
    padding: { left: number; right: number },
    currentAge: number,
    endAge: number
  ): number | null => {
    const plottableWidth = width - padding.left - padding.right;
    if (plottableWidth <= 0) return null;
    const touchXRelative = touchX - padding.left;
    const clampedX = Math.max(0, Math.min(plottableWidth, touchXRelative));
    const age = currentAge + (clampedX / plottableWidth) * (endAge - currentAge);
    return Math.max(currentAge, Math.min(endAge, Math.round(age)));
  }, []);

  const chartPanResponder = useMemo(() => {
    const currentAge = baselineInputs.currentAge;
    const endAge = baselineInputs.endAge;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
      onPanResponderGrant: (evt, gestureState) => {
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2) return;
        const mapped = mapTouchXToAge(evt.nativeEvent.locationX, chartWidth, chartPadding, currentAge, endAge);
        if (mapped !== null && mapped !== selectedAge) setSelectedAge(mapped);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2) return;
        const mapped = mapTouchXToAge(evt.nativeEvent.locationX, chartWidth, chartPadding, currentAge, endAge);
        if (mapped !== null && mapped !== selectedAge) setSelectedAge(mapped);
      },
    });
  }, [baselineInputs.currentAge, baselineInputs.endAge, selectedAge, mapTouchXToAge]);

  // --- Point lookups at selectedAge ---
  const baselineAtAge = useMemo(() => {
    const i = baselineSeries.findIndex(p => Math.floor(p.age) >= selectedAge);
    return i >= 0 ? baselineSeries[i] : baselineSeries[baselineSeries.length - 1];
  }, [selectedAge, baselineSeries]);

  const scenarioAtAge = useMemo(() => {
    if (scenarioSeries.length === 0) return null;
    const i = scenarioSeries.findIndex(p => Math.floor(p.age) >= selectedAge);
    return i >= 0 ? scenarioSeries[i] : scenarioSeries[scenarioSeries.length - 1];
  }, [selectedAge, scenarioSeries]);

  // --- Liquid assets & weighted growth rate (for CHANGE_RETIREMENT_AGE narrative) ---
  const liquidAssetsNow = useMemo(() => {
    return state.assets
      .filter(a => a.isActive !== false)
      .filter(a => !a.availability || a.availability.type === 'immediate')
      .reduce((sum, a) => sum + (a.balance ?? 0), 0);
  }, [state.assets]);

  const lockedAssetUnlockAges = useMemo(() => {
    return state.assets
      .filter(a => a.isActive !== false)
      .filter(a => a.availability?.type === 'locked' && typeof a.availability.unlockAge === 'number')
      .map(a => a.availability!.unlockAge as number);
  }, [state.assets]);

  const portfolioWeightedGrowthRate = useMemo(() => {
    const active = state.assets.filter(
      a => a.isActive !== false && typeof a.annualGrowthRatePct === 'number',
    );
    const totalBalance = active.reduce((sum, a) => sum + (a.balance ?? 0), 0);
    if (totalBalance <= 0) return 0;
    return active.reduce((sum, a) => sum + (a.annualGrowthRatePct! * (a.balance ?? 0)), 0) / totalBalance;
  }, [state.assets]);

  // --- Save ---
  const handleSave = async () => {
    if (!template) return;

    const targetName = targets.find(t => t.id === selectedTargetId)?.name ?? '';
    let newScenario: Scenario;

    switch (template.scenarioKind) {
      case 'FLOW_TO_ASSET':
        if (!selectedTargetId) return;
        newScenario = { id: generateId(), name: `${formatCurrencyCompact(sliderValue)}/mo to ${targetName}`, kind: 'FLOW_TO_ASSET', assetId: selectedTargetId, amountMonthly: sliderValue };
        break;
      case 'FLOW_TO_DEBT':
        if (!selectedTargetId) return;
        newScenario = { id: generateId(), name: `${formatCurrencyCompact(sliderValue)}/mo off ${targetName}`, kind: 'FLOW_TO_DEBT', liabilityId: selectedTargetId, amountMonthly: sliderValue };
        break;
      case 'CHANGE_RETIREMENT_AGE':
        newScenario = { id: generateId(), name: `Retire at ${Math.round(sliderValue)}`, kind: 'CHANGE_RETIREMENT_AGE', retirementAge: Math.round(sliderValue) };
        break;
      case 'REDUCE_EXPENSES':
        newScenario = { id: generateId(), name: `Spend ${formatCurrencyCompact(sliderValue)}/mo less`, kind: 'REDUCE_EXPENSES', reductionMonthly: sliderValue };
        break;
      case 'CHANGE_ASSET_GROWTH_RATE':
        if (!selectedTargetId) return;
        newScenario = { id: generateId(), name: `${targetName} at ${sliderValue}%`, kind: 'CHANGE_ASSET_GROWTH_RATE', assetId: selectedTargetId, newAnnualGrowthRatePct: sliderValue };
        break;
      case 'SAVINGS_WHAT_IF': {
        if (!selectedTargetId) return;
        const contrib = sliderValues.contribution ?? 100;
        const rate = sliderValues.growthRate ?? 8;
        newScenario = {
          id: generateId(),
          name: `${formatCurrencyCompact(contrib)}/mo to ${targetName} at ${rate}%`,
          kind: 'SAVINGS_WHAT_IF',
          assetId: selectedTargetId,
          contributionMonthly: contrib,
          newAnnualGrowthRatePct: rate,
        };
        break;
      }
      case 'MORTGAGE_WHAT_IF': {
        if (!selectedTargetId) return;
        const overpay = sliderValues.overpayment ?? 0;
        const rate = sliderValues.interestRate ?? 4.5;
        const term = Math.round(sliderValues.remainingTerm ?? 25);
        const parts: string[] = [];
        if (overpay > 0) parts.push(`${formatCurrencyCompact(overpay)}/mo`);
        parts.push(`${rate}%`);
        parts.push(`${term}yr`);
        newScenario = {
          id: generateId(),
          name: `${targetName} ${parts.join(', ')}`,
          kind: 'MORTGAGE_WHAT_IF',
          liabilityId: selectedTargetId,
          overpaymentMonthly: overpay,
          newAnnualInterestRatePct: rate,
          newRemainingTermYears: term,
        };
        break;
      }
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
      default:
        return;
    }

    await saveScenario(newScenario);
    await setActiveScenarioId(newScenario.id);
    if (returnToTab) {
      navigation.navigate(returnToTab);
    } else {
      navigation.goBack();
    }
  };

  const handleDiscard = () => {
    if (returnToTab) {
      navigation.navigate(returnToTab);
    } else {
      navigation.goBack();
    }
  };

  if (!template) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <SketchBackground color={palette.accent} style={{flex:1}}>
        <ScreenHeader title="What If" />
        <View style={styles.errorState}>
          <Text style={[theme.typography.body, { color: theme.colors.text.muted }]}>Template not found.</Text>
        </View>
        </SketchBackground>
      </SafeAreaView>
    );
  }

  const hasNoTargets = template.targetSelector !== null && targets.length === 0;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.accent} style={{flex:1}}>
      <ScreenHeader title={template.question} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Impact helper */}
        {SCENARIO_IMPACT_TEXT[template.id] ? (
          <View style={styles.impactHelper}>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center' }]}>
              {SCENARIO_IMPACT_TEXT[template.id]}
            </Text>
          </View>
        ) : null}

        {/* Empty state: no targets set up */}
        {hasNoTargets ? (
          <SectionCard>
            {template.targetSelector === 'asset' ? (
              <>
                <Text style={[theme.typography.bodyLarge, { color: theme.colors.text.primary, marginBottom: spacing.sm }]}>
                  No assets found
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginBottom: spacing.base }]}>
                  This scenario needs an investment or savings asset set up in your Snapshot. Add one to see how extra contributions would affect your net worth.
                </Text>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={() => navigation.navigate('SnapshotTab', { screen: 'AssetsDetail' })}
                >
                  Set up an asset
                </Button>
              </>
            ) : (
              <>
                <Text style={[theme.typography.bodyLarge, { color: theme.colors.text.primary, marginBottom: spacing.sm }]}>
                  No liabilities found
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginBottom: spacing.base }]}>
                  This scenario needs a mortgage or loan set up in your Snapshot. Add one to see how overpayments would affect your net worth.
                </Text>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={() => navigation.navigate('SnapshotTab', { screen: 'LiabilitiesDetail' })}
                >
                  Set up a liability
                </Button>
              </>
            )}
          </SectionCard>
        ) : null}

        {/* Controls: asset picker + sliders merged */}
        {!hasNoTargets ? (
          <SectionCard fillColor="transparent" style={{ marginBottom: spacing.sm }}>
            <View style={styles.controlsWrapper}>

              {/* Target selector */}
              {template.targetSelector !== null && targets.length > 0 ? (
                <View style={styles.targetSelectorRow}>
                  <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                    {template.targetSelector === 'asset' ? 'Which Asset' : 'Which Loan'}
                  </Text>
                  <Pressable
                    onPress={() => setTargetPickerOpen(true)}
                    style={styles.targetValueRow}
                    accessibilityRole="button"
                    accessibilityLabel={template.targetSelector === 'asset' ? 'Select asset' : 'Select loan'}
                  >
                    <Text
                      style={[theme.typography.body, { color: palette.accent, textDecorationLine: 'underline', flexShrink: 1 }]}
                      numberOfLines={1}
                    >
                      {buildTargetLabel(template.targetSelector, selectedTargetId, state.assets, state.liabilities)
                        || (template.targetSelector === 'asset' ? 'Select asset' : 'Select loan')}
                    </Text>
                    <Icon name="chevron-forward-outline" size="small" color={palette.accent} />
                  </Pressable>
                </View>
              ) : null}

              {/* Single slider */}
              {!isMultiSlider ? (
                <View>
                  <View style={styles.sliderLabelRow}>
                    <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                      {getSliderSectionTitle(template.scenarioKind)}
                    </Text>
                    <Text style={[theme.typography.body, { color: palette.accent }]}>
                      {formatSliderValue(template.scenarioKind, sliderValue)}
                    </Text>
                  </View>
                  <CustomSlider
                    min={defaults?.min ?? 50}
                    max={effectiveMax}
                    step={defaults?.step ?? 50}
                    value={sliderValue}
                    onValueChange={handleSliderChange}
                    trackColor={palette.accent}
                    thumbColor={theme.colors.bg.card}
                    trackBgColor={theme.colors.border.default}
                    showSteppers
                    stepperColor={theme.colors.text.primary}
                  />
                </View>
              ) : null}

              {/* Multi sliders */}
              {isMultiSlider ? template.sliders!.map(sc => {
                const val = sliderValues[sc.id] ?? sc.defaultValue;
                const max = sliderEffectiveMax[sc.id] ?? sc.max;
                const isSliderClamped = sc.affordabilityClamped && max < sc.max;
                const label = sc.id === 'contribution' ? 'Extra monthly contributions'
                            : sc.id === 'growthRate' ? 'Annual Growth Rate'
                            : sc.label;
                return (
                  <View key={sc.id}>
                    <View style={styles.sliderLabelRow}>
                      <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                        {label}
                      </Text>
                      <Text style={[theme.typography.body, { color: palette.accent }]}>
                        {formatSliderConfigValue(sc.format, val)}
                      </Text>
                    </View>
                    <CustomSlider
                      min={sc.min}
                      max={max}
                      step={sc.step}
                      value={val}
                      onValueChange={(v: number) => handleMultiSliderChange(sc.id, v, sc.step)}
                      trackColor={palette.accent}
                      thumbColor={theme.colors.bg.card}
                      trackBgColor={theme.colors.border.default}
                      showSteppers
                      stepperColor={theme.colors.text.primary}
                    />
                  </View>
                );
              }) : null}

            </View>
          </SectionCard>
        ) : null}

        {/* Mini projection chart */}
        {scenarioSeries.length > 0 ? (
          <SectionCard fillColor="transparent" style={{ marginBottom: spacing.sm }}>
            <SectionHeader title="What difference does it make?" />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: theme.colors.text.disabled }]} />
                <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>Baseline</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: palette.accent }]} />
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>Scenario</Text>
              </View>
            </View>

            <View style={styles.chartContainer}>
              <VictoryChart
                width={chartWidth}
                height={chartHeight}
                padding={chartPadding}
                domainPadding={{ y: [0, 40] }}
                style={{ background: { fill: theme.colors.bg.app } }}
              >
                <VictoryAxis
                  tickFormat={(age: number) => `${age}`}
                  style={{
                    axis: { stroke: theme.colors.border.default },
                    tickLabels: { fontSize: theme.typography.caption.fontSize, fill: theme.colors.text.muted, fontFamily: 'Virgil' },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickFormat={(v: number) => v < 0 ? `-${formatCurrencyCompact(v)}` : formatCurrencyCompact(v)}
                  style={{
                    axis: { stroke: theme.colors.border.default },
                    tickLabels: { fontSize: theme.typography.caption.fontSize, fill: theme.colors.text.muted, fontFamily: 'Virgil' },
                    grid: { stroke: theme.colors.border.subtle, strokeDasharray: '4,4' },
                  }}
                />
                {/* Baseline (muted) */}
                <VictoryLine
                  data={baselineSeries.map(p => ({ x: p.age, y: p.netWorth }))}
                  style={{ data: { stroke: theme.colors.text.disabled, strokeWidth: 1.5 } }}
                />
                {/* Scenario (accent) */}
                <VictoryLine
                  data={scenarioSeries.map(p => ({ x: p.age, y: p.netWorth }))}
                  style={{ data: { stroke: palette.accent, strokeWidth: 2 } }}
                />
                {/* Age cursor */}
                {(() => {
                  const allPoints = [...baselineSeries, ...scenarioSeries];
                  const allY = allPoints.map(p => p.netWorth);
                  const domainMin = Math.min(...allY);
                  const domainMax = Math.max(...allY);
                  const range = domainMax - domainMin;
                  const pad = range * 0.05;
                  return (
                    <VictoryLine
                      data={[
                        { x: selectedAge, y: domainMin + pad },
                        { x: selectedAge, y: domainMax - pad },
                      ]}
                      style={{
                        data: {
                          stroke: theme.colors.chart.markerLine,
                          strokeWidth: 1.0,
                          strokeDasharray: '2,2',
                          opacity: 0.72,
                        },
                      }}
                    />
                  );
                })()}
              </VictoryChart>
              {/* Transparent gesture overlay */}
              <View style={StyleSheet.absoluteFill} {...chartPanResponder.panHandlers} />
            </View>
          </SectionCard>
        ) : null}

        {/* Narrative panel */}
        {scenarioAtAge && baselineAtAge ? (() => {
          const narrative = buildNarrative({
            scenarioKind: template.scenarioKind,
            currentAge: baselineInputs.currentAge,
            selectedAge,
            baselineRetirementAge: baselineInputs.retirementAge,
            sliderValue,
            sliderValues,
            baselineAtAge,
            scenarioAtAge,
            baselineSeries,
            scenarioSeries,
            originalLiability: template.scenarioKind === 'MORTGAGE_WHAT_IF' && selectedTargetId
              ? state.liabilities.find(l => l.id === selectedTargetId)
              : undefined,
            liquidAssetsNow,
            lockedUnlockAges: lockedAssetUnlockAges,
            monthlyExpensesRetirement: baselineInputs.monthlyExpensesReal,
            portfolioWeightedGrowthRate,
            baselineAnnualIncome,
            totalBaselineContributionsMonthly: baselineInputs.assetContributionsMonthly.reduce((s, c) => s + c.amountMonthly, 0),
            totalMonthlyOutgoings: selectSnapshotExpenses(state),
          });
          return (
            <SectionCard fillColor="transparent">
              {narrative.paragraphs.map((para, i) => (
                <View key={i} style={i < narrative.paragraphs.length - 1 ? { marginBottom: spacing.base } : undefined}>
                  {renderBoldText(para, [theme.typography.body, { color: theme.colors.text.secondary }])}
                </View>
              ))}
              <View style={[styles.statusBadge, {
                backgroundColor: narrative.status === 'ok'
                  ? theme.colors.semantic.successBg
                  : narrative.status === 'critical'
                    ? theme.colors.semantic.errorBg
                    : theme.colors.semantic.warningBg,
                marginTop: spacing.xl,
              }]}>
                <Text style={[theme.typography.label, {
                  color: narrative.status === 'ok'
                    ? theme.colors.semantic.success
                    : narrative.status === 'critical'
                      ? theme.colors.semantic.error
                      : theme.colors.semantic.warning,
                }]}>
                  {narrative.statusText}
                </Text>
              </View>
            </SectionCard>
          );
        })() : null}

        {/* Bottom spacer for action bar */}
        <View style={styles.actionBarSpacer} />
      </ScrollView>

      {/* Fixed action bar */}
      {(() => {
        const isSaveDisabled = (template?.targetSelector !== null && !selectedTargetId) || (isMultiSlider ? (template?.scenarioKind === 'MORTGAGE_WHAT_IF' ? false : (sliderValues.contribution ?? 0) <= 0) : sliderValue <= 0);
        return (
          <View style={[styles.actionBar, { backgroundColor: theme.colors.bg.card, borderTopColor: theme.colors.border.default }]}>
            <Pressable onPress={handleDiscard} style={styles.actionButton} accessibilityRole="button">
              {({ pressed }) => (
                <SketchCard
                  borderColor={theme.colors.border.default}
                  fillColor={pressed ? theme.colors.bg.subtlePressed : theme.colors.bg.subtle}
                  style={styles.sketchButton}
                >
                  <Text style={[theme.typography.button, { color: theme.colors.text.secondary, textAlign: 'center' }]}>
                    Discard
                  </Text>
                </SketchCard>
              )}
            </Pressable>
            <Pressable onPress={handleSave} disabled={isSaveDisabled} style={styles.actionButton} accessibilityRole="button">
              {({ pressed }) => (
                <SketchCard
                  borderColor={isSaveDisabled ? theme.colors.border.subtle : palette.accent}
                  fillColor={isSaveDisabled ? theme.colors.bg.subtle : palette.accent}
                  fillOpacity={pressed ? 0.8 : 1}
                  style={styles.sketchButton}
                >
                  <Text style={[theme.typography.button, { color: isSaveDisabled ? theme.colors.text.disabled : '#ffffff', textAlign: 'center' }]}>
                    Save scenario
                  </Text>
                </SketchCard>
              )}
            </Pressable>
          </View>
        );
      })()}
      {/* Target picker modal */}
      {template.targetSelector !== null ? (
        <Modal transparent visible={targetPickerOpen} animationType="slide" onRequestClose={() => setTargetPickerOpen(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={[styles.modalBackdropFlex, { backgroundColor: theme.colors.overlay.scrim25 }]} onPress={() => setTargetPickerOpen(false)} />
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
                {template.targetSelector === 'asset' ? 'Select asset' : 'Select loan'}
              </Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
                {targets.map(target => (
                  <React.Fragment key={target.id}>
                    <Pressable
                      onPress={() => {
                        setSelectedTargetId(target.id);
                        recomputeScenario(sliderValue, target.id, isMultiSlider ? sliderValues : undefined);
                        setTargetPickerOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.modalOption,
                        { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' },
                      ]}
                    >
                      <Text style={[styles.modalOptionText, { color: theme.colors.text.primary }]}>{target.name}</Text>
                    </Pressable>
                    <Divider variant="subtle" />
                  </React.Fragment>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
      </SketchBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: layout.screenPadding,
    paddingTop: layout.screenPaddingTop,
    paddingBottom: layout.screenPaddingBottom,
  },
  impactHelper: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.base,
    marginBottom: spacing.base,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    paddingBottom: spacing.sm,
  },
  targetValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropFlex: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.modalPaddingTop,
    paddingBottom: layout.modalPaddingBottom,
    maxHeight: '70%',
  },
  modalTitle: {
    ...typography.sectionTitle,
    marginBottom: layout.inputPadding,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    paddingBottom: spacing.base,
  },
  modalOption: {
    paddingVertical: spacing.base,
  },
  modalOptionText: {
    ...typography.button,
  },
  controlsWrapper: {
    gap: spacing.base,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  clampWarning: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: spacing.base,
    marginHorizontal: -spacing.xl,
    marginBottom: -spacing.xl,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.base,
    marginBottom: -spacing.base,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1, // geometric: height / 2
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.small,
  },
  actionBarSpacer: {
    height: 80,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: layout.screenPadding,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        paddingBottom: spacing.xl,
      },
    }),
  },
  actionButton: {
    flex: 1,
  },
  sketchButton: {
    paddingVertical: layout.inputPadding,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
