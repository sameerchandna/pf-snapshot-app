// Pure function: generates plain-English explanation paragraphs for the projection chart.
// Takes engine inputs + summary and produces a narrative of each chart phase.
// No UI logic — rendering is handled by the caller.

import { initLoan } from '../engines/loanEngine';
import type { ProjectionEngineInputs, ProjectionSeriesPoint, ProjectionSummary } from '../engines/projectionEngine';
import { formatCurrencyCompact } from '../ui/formatters';

export type ExplanationParagraph = {
  heading: string;
  body: string;
  kind?: 'warning';
};

export function generateChartExplanation(
  inputs: ProjectionEngineInputs,
  summary: ProjectionSummary,
  netMonthlyIncome: number,
  totalMonthlyExpenses: number,
  series: ProjectionSeriesPoint[],
): ExplanationParagraph[] {
  const { currentAge, retirementAge, endAge } = inputs;
  const paragraphs: ExplanationParagraph[] = [];

  // --- Compute helpers ---

  // Monthly mortgage P&I from the first loan liability
  const loanLiability = inputs.liabilitiesToday.find(
    l => l.kind === 'loan' && typeof l.remainingTermYears === 'number' && l.remainingTermYears >= 1,
  );
  const mortgageMonthlyPayment = loanLiability
    ? initLoan({
        balance: loanLiability.balance,
        annualInterestRatePct: loanLiability.annualInterestRatePct ?? 0,
        remainingTermYears: loanLiability.remainingTermYears!,
      }).monthlyPayment
    : 0;

  const mortgagePayoffAge = loanLiability
    ? Math.round(currentAge + (loanLiability.remainingTermYears ?? 0))
    : null;

  // Locked assets and their unlock ages
  const lockedAssets = inputs.assetsToday.filter(
    a => a.availability?.type === 'locked' && typeof a.availability.unlockAge === 'number',
  );
  const earliestUnlockAge = lockedAssets.length > 0
    ? Math.min(...lockedAssets.map(a => a.availability!.unlockAge!))
    : null;

  // Liquid assets (available immediately at retirement)
  const liquidAtRetirement = inputs.assetsToday.filter(
    a => !a.availability || a.availability.type === 'immediate',
  );

  // Total post-retirement monthly withdrawal
  const totalWithdrawalMonthly = (inputs.monthlyExpensesReal ?? 0) + mortgageMonthlyPayment;
  const annualDraw = totalWithdrawalMonthly * 12;

  // Pre-retirement surplus
  const surplusMonthly = netMonthlyIncome - totalMonthlyExpenses - mortgageMonthlyPayment;

  // Total starting assets today
  const totalAssetsToday = inputs.assetsToday.reduce(
    (sum, a) => sum + (Number.isFinite(a.balance) ? a.balance : 0), 0,
  );

  // Assets at retirement from series (closest point at or just before retirementAge)
  const retirementPoint = series.reduce<ProjectionSeriesPoint | null>((best, pt) => {
    if (pt.age <= retirementAge) {
      return best === null || pt.age > best.age ? pt : best;
    }
    return best;
  }, null);
  const assetsAtRetirement = retirementPoint?.assets ?? totalAssetsToday;

  // Per-asset totals for liquid group, grown to retirement age
  const yearsToRetirement = retirementAge - currentAge;
  const totalLiquidBalanceGrown = liquidAtRetirement.reduce((sum, a) => {
    const bal = Number.isFinite(a.balance) ? a.balance : 0;
    const rate = (a.annualGrowthRatePct ?? 0) / 100;
    return sum + bal * Math.pow(1 + rate, yearsToRetirement);
  }, 0);

  // Rough years the liquid pot covers at current withdrawal rate (simple division, no growth)
  const liquidYears = annualDraw > 0 && totalLiquidBalanceGrown > 0
    ? Math.round(totalLiquidBalanceGrown / annualDraw)
    : null;

  // Years of retirement horizon (retirement to end age)
  const retirementYears = endAge - retirementAge;

  // --- Paragraph 1: Pre-retirement growth ---
  if (retirementAge > currentAge) {
    const uniqueRates = [...new Set(
      inputs.assetsToday
        .map(a => a.annualGrowthRatePct ?? 0)
        .filter(r => r > 0),
    )];
    const rateText = uniqueRates.length === 1
      ? `${uniqueRates[0]}% per year`
      : uniqueRates.length > 1
        ? `${Math.min(...uniqueRates)}–${Math.max(...uniqueRates)}% per year`
        : 'their own rates';

    const growthYears = retirementAge - currentAge;
    paragraphs.push({
      heading: `Age ${currentAge}–${retirementAge}: growth phase`,
      body: `Over the next ${growthYears} years your assets compound at ${rateText}, growing from ${formatCurrencyCompact(totalAssetsToday)} today to around ${formatCurrencyCompact(assetsAtRetirement)} by retirement. During this time your income covers all your expenses, so nothing is drawn from your investments.\n`,
    });
  }

  // --- Paragraph 2: The retirement switch ---
  if (retirementAge <= endAge) {
    const expensesText = formatCurrencyCompact(inputs.monthlyExpensesReal ?? 0);
    const mortgageText = mortgageMonthlyPayment > 0
      ? ` plus ${formatCurrencyCompact(mortgageMonthlyPayment)}/month on your mortgage`
      : '';
    const totalText = formatCurrencyCompact(totalWithdrawalMonthly);

    paragraphs.push({
      heading: `Age ${retirementAge}: living off your investments`,
      body: `When you stop working, your income stops too. From here you draw ${expensesText}/month in living expenses${mortgageText} — ${totalText}/month in total (${formatCurrencyCompact(annualDraw)}/year) — straight from your investments. Your ${formatCurrencyCompact(assetsAtRetirement)} pot needs to fund ${retirementYears} years of retirement.\n`,
    });
  }

  // --- Paragraph 3: Per-asset breakdown of what's available ---
  if (retirementAge <= endAge && (liquidAtRetirement.length > 0 || lockedAssets.length > 0)) {
    const parts: string[] = [];

    // Liquid assets — show grown value at retirement
    for (const asset of liquidAtRetirement) {
      const bal = Number.isFinite(asset.balance) ? asset.balance : 0;
      const rate = (asset.annualGrowthRatePct ?? 0) / 100;
      const grownBal = bal * Math.pow(1 + rate, yearsToRetirement);
      const assetYears = annualDraw > 0 && grownBal > 0 ? Math.round(grownBal / annualDraw) : null;
      const yearsClause = assetYears !== null ? `, which would last around ${assetYears} year${assetYears === 1 ? '' : 's'} at your withdrawal rate` : '';
      parts.push(`your ${asset.name} (${formatCurrencyCompact(grownBal)}) can be drawn from straight away${yearsClause}`);
    }

    // Combined liquid total if multiple
    if (liquidAtRetirement.length > 1 && liquidYears !== null) {
      parts.push(`giving you a total accessible pot of ${formatCurrencyCompact(totalLiquidBalanceGrown)} — around ${liquidYears} year${liquidYears === 1 ? '' : 's'} of withdrawals`);
    }

    // Locked assets — show grown value at retirement age
    for (const asset of lockedAssets) {
      const bal = Number.isFinite(asset.balance) ? asset.balance : 0;
      const rate = (asset.annualGrowthRatePct ?? 0) / 100;
      const grownBal = bal * Math.pow(1 + rate, yearsToRetirement);
      const unlockAge = asset.availability!.unlockAge!;
      parts.push(`your ${asset.name} (${formatCurrencyCompact(grownBal)}) unlocks at age ${unlockAge} and cannot be touched yet, but keeps growing in the background`);
    }

    // Join into one flowing sentence
    let body = '';
    if (parts.length === 1) {
      body = `At retirement, ${parts[0]}.\n`;
    } else {
      const last = parts[parts.length - 1];
      const rest = parts.slice(0, -1).join(', ');
      body = `At retirement, ${rest}, while ${last}.\n`;
    }

    paragraphs.push({
      heading: 'Your investments at retirement',
      body,
    });
  }

  // --- Paragraph 4: Depletion risk warning ---
  if (summary.depletionAge !== undefined) {
    const depAge = Math.round(summary.depletionAge);

    if (earliestUnlockAge === null) {
      // All assets deplete, no locked pension coming
      paragraphs.push({
        kind: 'warning',
        heading: `⚠ Risk: investments run out at age ${depAge}`,
        body: `Based on this projection, your investments are fully depleted by age ${depAge}. After this point there is no investment income to cover your expenses of ${formatCurrencyCompact(totalWithdrawalMonthly)}/month. Retirement at age ${retirementAge} may not be sustainable without additional income — consider working longer, saving more, or spending less.\n`,
      });
    } else if (summary.depletionAge < earliestUnlockAge) {
      // Liquid runs out before pension unlocks — gap
      paragraphs.push({
        kind: 'warning',
        heading: `⚠ Risk: funding gap at age ${depAge}`,
        body: `Your accessible investments run out around age ${depAge}, but your pension doesn't unlock until age ${earliestUnlockAge}. During this gap, retirement cannot be sustained without other income — your expenses of ${formatCurrencyCompact(totalWithdrawalMonthly)}/month cannot be covered. Consider bridging this gap with other savings, a part-time income, or retiring later.\n`,
      });
    } else {
      // All assets eventually deplete (after pension unlock)
      paragraphs.push({
        kind: 'warning',
        heading: `⚠ Risk: investments run out at age ${depAge}`,
        body: `Even after your pension unlocks, all your investments are projected to be fully depleted by age ${depAge}. After this point your expenses of ${formatCurrencyCompact(totalWithdrawalMonthly)}/month cannot be covered by investments. Consider increasing contributions, reducing spending in retirement, or planning for state pension or other income.\n`,
      });
    }
  }

  // --- Paragraph 5: Pension (or other locked asset) unlock ---
  if (earliestUnlockAge !== null && earliestUnlockAge <= endAge) {
    const unlockingAssets = lockedAssets.filter(a => a.availability!.unlockAge === earliestUnlockAge);
    const stillLockedAssets = lockedAssets.filter(a => a.availability!.unlockAge! > earliestUnlockAge);
    const unlockingNames = unlockingAssets.map(a => a.name).join(', ');
    const unlockingBalance = unlockingAssets.reduce(
      (sum, a) => sum + (Number.isFinite(a.balance) ? a.balance : 0), 0,
    );

    // Compound each unlocking asset to its unlock age
    const yearsToUnlock = earliestUnlockAge - currentAge;
    const unlockingGrownValue = unlockingAssets.reduce((sum, a) => {
      const bal = Number.isFinite(a.balance) ? a.balance : 0;
      const rate = (a.annualGrowthRatePct ?? 0) / 100;
      return sum + bal * Math.pow(1 + rate, yearsToUnlock);
    }, 0);

    // Total assets from series at unlock age (closest point at or just before)
    const unlockPoint = series.reduce<ProjectionSeriesPoint | null>((best, pt) => {
      if (pt.age <= earliestUnlockAge) {
        return best === null || pt.age > best.age ? pt : best;
      }
      return best;
    }, null);
    const seriesAssetsAtUnlock = unlockPoint?.assets ?? 0;

    // Still-locked assets' grown value at unlock age (not yet available)
    const grownStillLocked = stillLockedAssets.reduce((sum, a) => {
      const bal = Number.isFinite(a.balance) ? a.balance : 0;
      const rate = (a.annualGrowthRatePct ?? 0) / 100;
      return sum + bal * Math.pow(1 + rate, yearsToUnlock);
    }, 0);

    // Liquid remaining at unlock = total series assets minus all locked grown values, floor at 0
    const grownAllLocked = unlockingGrownValue + grownStillLocked;
    const liquidRemainingAtUnlock = Math.max(0, seriesAssetsAtUnlock - grownAllLocked);

    // Combined pot available = liquid remaining + unlocking pension grown value
    const combinedAtUnlock = Math.max(0, liquidRemainingAtUnlock + unlockingGrownValue);
    const combinedYears = annualDraw > 0 && combinedAtUnlock > 0
      ? Math.round(combinedAtUnlock / annualDraw)
      : null;

    // Build body
    const grownClause = `It started at ${formatCurrencyCompact(unlockingBalance)} and has grown to around ${formatCurrencyCompact(unlockingGrownValue)} by this point.`;
    const liquidClause = liquidRemainingAtUnlock > 0
      ? ` Combined with the ${formatCurrencyCompact(liquidRemainingAtUnlock)} still remaining in your other investments, you have around ${formatCurrencyCompact(combinedAtUnlock)} available${combinedYears !== null ? ` — enough for roughly ${combinedYears} more year${combinedYears === 1 ? '' : 's'} of withdrawals` : ''}.`
      : ` Your other investments have been fully drawn down by this point, so the ${formatCurrencyCompact(unlockingGrownValue)} pension is your only remaining pot${combinedYears !== null ? ` — enough for roughly ${combinedYears} more year${combinedYears === 1 ? '' : 's'} of withdrawals` : ''}.`;

    paragraphs.push({
      heading: `Age ${earliestUnlockAge}: ${unlockingNames} unlocks`,
      body: `At age ${earliestUnlockAge}, your ${unlockingNames} becomes available to draw from. ${grownClause}${liquidClause}\n`,
    });
  }

  // --- Paragraph 6: Mortgage payoff ---
  if (mortgagePayoffAge !== null && mortgagePayoffAge <= endAge) {
    const before = formatCurrencyCompact(totalWithdrawalMonthly);
    const after = formatCurrencyCompact(inputs.monthlyExpensesReal ?? 0);
    const yearsFromNow = mortgagePayoffAge - currentAge;

    paragraphs.push({
      heading: `Age ${mortgagePayoffAge}: mortgage paid off`,
      body: `In ${yearsFromNow} years your mortgage is fully paid off. Your monthly withdrawals drop from ${before}/month to ${after}/month — just living expenses from that point. This noticeably slows how quickly your investments deplete.\n`,
    });
  }

  // --- Paragraph 7: Pre-retirement surplus note ---
  if (surplusMonthly >= 100) {
    paragraphs.push({
      kind: 'warning',
      heading: '⚠ Spare income not tracked',
      body: `You have an estimated ${formatCurrencyCompact(surplusMonthly)}/month left over after expenses while you're working. This projection doesn't automatically add that to your investments — the pre-retirement growth comes purely from your existing balances compounding. To include it, add a regular contribution to an asset in the Snapshot.\n`,
    });
  }

  return paragraphs;
}
