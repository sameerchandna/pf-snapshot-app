// Pure generator functions for goal-seeking question explanations (Phase 16).
// Returns ExplanationParagraph[] — same type as generateChartExplanation.
// No UI logic — rendering is handled by the caller.

import type { ProjectionEngineInputs, ProjectionSummary } from '../engines/projectionEngine';
import type { AssetItem } from '../types';
import type { ExplanationParagraph } from './generateChartExplanation';
import type { EarliestRetirementResult } from './backSolve';
import type { BridgeGapProblem, LongevityGapProblem } from './detectProblems';
import { formatCurrencyCompact, formatYearsMonths } from '../ui/formatters';

/**
 * Generates a narrative explanation for the "earliest retirement age" question.
 *
 * Handles three scenarios:
 * 1. Current plan is gap-free → show how much earlier you could retire
 * 2. Current plan has gaps → explain each gap and the minimum age to fix it
 * 3. No viable age found → explain why and suggest next steps
 */
export function generateEarliestRetirementExplanation(
  inputs: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
  result: EarliestRetirementResult,
): ExplanationParagraph[] {
  const { retirementAge, currentAge, monthlyExpensesReal } = inputs;
  const { earliestAge, currentProblems, bridgeGapMinAge, longevityGapMinAge } = result;
  const paragraphs: ExplanationParagraph[] = [];

  const monthlyDraw = monthlyExpensesReal ?? 0;
  const annualDraw = monthlyDraw * 12;

  const lockedAssets = assetsWithAvailability.filter(
    a =>
      a.isActive !== false &&
      a.availability?.type === 'locked' &&
      typeof a.availability.unlockAge === 'number',
  );

  const bridgeProblem = currentProblems.find(p => p.kind === 'BRIDGE_GAP') as BridgeGapProblem | undefined;
  const longevityProblem = currentProblems.find(p => p.kind === 'LONGEVITY_GAP') as LongevityGapProblem | undefined;
  const hasCurrentGaps = currentProblems.length > 0;

  // ── Case: current plan has no gaps — show how much earlier you could retire ──
  if (!hasCurrentGaps) {
    if (earliestAge === null || earliestAge >= retirementAge) {
      paragraphs.push({
        heading: `Current plan: age ${retirementAge}`,
        body: `Your retirement plan at age ${retirementAge} is already at its earliest viable point. Retiring sooner would create a funding shortfall with your current savings and assets.\n`,
      });
      return paragraphs;
    }

    const yearsSaved = retirementAge - earliestAge;
    paragraphs.push({
      heading: `Earliest retirement: age ${earliestAge}`,
      body: `Based on your current savings and assets, you could retire ${yearsSaved} year${yearsSaved === 1 ? '' : 's'} earlier than planned — at age ${earliestAge} instead of ${retirementAge}.\n`,
    });

    // How it works
    const yearsToEarliest = earliestAge - currentAge;
    const liquidAtEarliest = inputs.assetsToday
      .filter(a => !a.availability || a.availability.type === 'immediate')
      .reduce((sum, a) => {
        const bal = Number.isFinite(a.balance) ? a.balance : 0;
        const rate = (a.annualGrowthRatePct ?? 0) / 100;
        return sum + bal * Math.pow(1 + rate, yearsToEarliest);
      }, 0);

    const earliestLockedUnlock =
      lockedAssets.length > 0
        ? Math.min(...lockedAssets.map(a => a.availability!.unlockAge as number))
        : null;

    if (earliestLockedUnlock !== null) {
      const gapYears = earliestLockedUnlock - earliestAge;
      const liquidYears =
        annualDraw > 0 && liquidAtEarliest > 0 ? Math.round(liquidAtEarliest / annualDraw) : null;
      const coverText =
        liquidYears !== null
          ? ` At ${formatCurrencyCompact(monthlyDraw)}/month that covers roughly ${liquidYears} year${liquidYears === 1 ? '' : 's'} — just enough to bridge the ${formatYearsMonths(gapYears)} gap until your ${lockedAssets[0]?.name ?? 'pension'} unlocks at age ${earliestLockedUnlock}.`
          : '';
      paragraphs.push({
        heading: 'How it works',
        body: `By age ${earliestAge} your liquid savings are projected to reach around ${formatCurrencyCompact(liquidAtEarliest)}.${coverText}\n`,
      });
    } else {
      const liquidYears =
        annualDraw > 0 && liquidAtEarliest > 0 ? Math.round(liquidAtEarliest / annualDraw) : null;
      paragraphs.push({
        heading: 'How it works',
        body: `By age ${earliestAge} your portfolio is projected to be around ${formatCurrencyCompact(liquidAtEarliest)}${liquidYears !== null ? `, covering roughly ${liquidYears} year${liquidYears === 1 ? '' : 's'} of withdrawals at ${formatCurrencyCompact(monthlyDraw)}/month` : ''}.\n`,
      });
    }

    const lo = Math.max(50, currentAge + 5);
    if (earliestAge > lo + 2) {
      paragraphs.push({
        heading: 'What would push it earlier',
        body: `Increasing monthly savings, achieving higher investment returns, or spending less in retirement are the most effective levers. Use the What If scenarios to explore each.\n`,
      });
    } else {
      paragraphs.push({
        kind: 'warning',
        heading: '⚠ Tight margin',
        body: `Age ${earliestAge} is close to the theoretical minimum — your liquid assets barely cover the pre-pension gap. A small drop in returns or rise in expenses could push this age back.\n`,
      });
    }

    return paragraphs;
  }

  // ── Case: current plan has gaps — explain each gap and what retirement age fixes it ──

  // Para 1: Overview of current gaps
  const gapNames = [
    bridgeProblem ? 'a bridge gap' : null,
    longevityProblem ? 'a longevity gap' : null,
  ].filter(Boolean).join(' and ');

  paragraphs.push({
    kind: 'warning',
    heading: `Current plan (age ${retirementAge}) has funding gaps`,
    body: `Your current retirement age of ${retirementAge} creates ${gapNames}. The analysis below shows what retirement age would be needed to resolve each.\n`,
  });

  // Para 2: Bridge gap detail
  if (bridgeProblem) {
    const fixText =
      bridgeGapMinAge !== null
        ? `Retiring at age ${bridgeGapMinAge} or later closes this gap — by then your liquid savings are large enough to bridge the ${formatYearsMonths(bridgeProblem.gapYears)} window.`
        : `This gap cannot be closed by delaying retirement alone within a realistic range — consider investing more or reducing expenses.`;

    paragraphs.push({
      heading: `Bridge gap (ages ${bridgeProblem.liquidDepletionAge}–${bridgeProblem.lockedUnlockAge})`,
      body: `Your liquid assets run out at age ${bridgeProblem.liquidDepletionAge}, but your ${bridgeProblem.bridgeAssetName} doesn't unlock until age ${bridgeProblem.lockedUnlockAge} — a ${formatYearsMonths(bridgeProblem.gapYears)} window with no accessible funds. ${fixText}\n`,
    });
  }

  // Para 3: Longevity gap detail
  if (longevityProblem) {
    const fixText =
      longevityGapMinAge !== null
        ? `Retiring at age ${longevityGapMinAge} or later means your portfolio lasts to age ${inputs.endAge} — more years of contributions and less time drawing down assets.`
        : `This shortfall cannot be closed by delaying retirement alone within a realistic range — consider investing more or reducing expenses.`;

    paragraphs.push({
      heading: `Longevity gap (${formatYearsMonths(longevityProblem.shortfallYears)} short)`,
      body: `All your assets — including locked ones — deplete at age ${Math.round(longevityProblem.depletionAge)}, leaving a ${formatYearsMonths(longevityProblem.shortfallYears)} shortfall before your projection end at age ${longevityProblem.endAge}. ${fixText}\n`,
    });
  }

  // Para 4: Combined answer
  if (earliestAge !== null) {
    const laterThanPlanned = earliestAge > retirementAge;
    paragraphs.push({
      heading: `Earliest gap-free retirement: age ${earliestAge}`,
      body: laterThanPlanned
        ? `To resolve all gaps, you would need to delay retirement ${earliestAge - retirementAge} year${earliestAge - retirementAge === 1 ? '' : 's'} — to age ${earliestAge}. This gives your savings more time to grow and shortens how long they need to last.\n`
        : `Age ${earliestAge} is the earliest age at which all funding gaps are resolved.\n`,
    });
  } else {
    paragraphs.push({
      kind: 'warning',
      heading: 'Cannot be resolved by retirement age alone',
      body: `No retirement age within a realistic range fully resolves all the gaps. To fix this, consider the What If scenarios: investing more each month or reducing planned expenses can close the shortfall regardless of retirement age.\n`,
    });
  }

  return paragraphs;
}

/**
 * Generates a narrative explanation for the "how long will assets last?" question.
 *
 * @param inputs                  Baseline projection inputs
 * @param assetsWithAvailability  Full asset list with availability metadata
 * @param summary                 Baseline projection summary (provides depletionAge)
 */
export function generateAssetsLongevityExplanation(
  inputs: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
  summary: ProjectionSummary,
): ExplanationParagraph[] {
  const { retirementAge, currentAge, endAge, monthlyExpensesReal } = inputs;
  const paragraphs: ExplanationParagraph[] = [];

  const monthlyDraw = monthlyExpensesReal ?? 0;
  const annualDraw = monthlyDraw * 12;

  const depletionAge = summary.depletionAge;

  // Locked assets (for context)
  const lockedAssets = assetsWithAvailability.filter(
    a =>
      a.isActive !== false &&
      a.availability?.type === 'locked' &&
      typeof a.availability.unlockAge === 'number',
  );

  // Liquid assets, projected to retirement (compound growth approximation)
  const yearsToRetirement = retirementAge - currentAge;
  const liquidAtRetirement = inputs.assetsToday
    .filter(a => !a.availability || a.availability.type === 'immediate')
    .reduce((sum, a) => {
      const bal = Number.isFinite(a.balance) ? a.balance : 0;
      const rate = (a.annualGrowthRatePct ?? 0) / 100;
      return sum + bal * Math.pow(1 + rate, yearsToRetirement);
    }, 0);

  // --- Para 1: Result ---
  if (depletionAge === undefined) {
    paragraphs.push({
      heading: `Assets last beyond age ${endAge}`,
      body: `Based on your current plan, your assets are projected to outlast your full projection period. You are not at risk of running out of money before age ${endAge}.\n`,
    });
  } else {
    const depAge = Math.round(depletionAge);
    const shortfall = endAge - depAge;
    paragraphs.push({
      kind: 'warning',
      heading: `Assets run out at age ${depAge}`,
      body: `Based on your current plan, your assets are projected to be fully depleted around age ${depAge} — ${shortfall} year${shortfall === 1 ? '' : 's'} before your projection end at age ${endAge}.\n`,
    });
  }

  // --- Para 2: During retirement (withdrawal context) ---
  if (monthlyDraw > 0 && retirementAge <= endAge) {
    const liquidYears =
      annualDraw > 0 && liquidAtRetirement > 0
        ? Math.round(liquidAtRetirement / annualDraw)
        : null;
    const yearsText =
      liquidYears !== null
        ? ` At that rate, your liquid savings alone would last about ${liquidYears} year${liquidYears === 1 ? '' : 's'} before any pension kicks in.`
        : '';

    paragraphs.push({
      heading: 'During retirement',
      body: `From age ${retirementAge} you draw ${formatCurrencyCompact(monthlyDraw)}/month from your investments. Your liquid assets are projected to be around ${formatCurrencyCompact(liquidAtRetirement)} at retirement.${yearsText}\n`,
    });
  }

  // --- Para 3: Locked assets (pensions) ---
  if (lockedAssets.length > 0) {
    const descriptions = lockedAssets.map(a => {
      const unlockAge = a.availability!.unlockAge as number;
      const bal = Number.isFinite(a.balance) ? a.balance : 0;
      const rate = (a.annualGrowthRatePct ?? 0) / 100;
      const yearsToUnlock = unlockAge - currentAge;
      const grownBal = bal * Math.pow(1 + rate, yearsToUnlock);
      return `your ${a.name} unlocks at age ${unlockAge} (~${formatCurrencyCompact(grownBal)})`;
    });
    const listText =
      descriptions.length === 1
        ? descriptions[0]
        : descriptions.slice(0, -1).join(', ') + ' and ' + descriptions[descriptions.length - 1];

    paragraphs.push({
      heading: 'Locked assets',
      body: `In addition to your liquid savings, ${listText}. Once available, these extend how long your portfolio lasts.\n`,
    });
  }

  // --- Para 4: Actionable advice for meaningful shortfall ---
  if (depletionAge !== undefined) {
    const shortfall = endAge - Math.round(depletionAge);
    if (shortfall > 5) {
      paragraphs.push({
        heading: 'What would help',
        body: `A ${shortfall}-year gap is significant. Investing more each month, spending less in retirement, or targeting higher returns on your assets are the most effective levers. Use the What If scenarios to explore each.\n`,
      });
    }
  }

  return paragraphs;
}
