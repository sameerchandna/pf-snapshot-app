// A2.1: One-time loan state derivation as-of "today"
//
// Purpose:
// Users may know an original loan contract (start date, original balance, original term),
// but not today's balance. We optionally derive today's state ONCE when the user taps
// Calculate, then discard history and store only "today state" in Snapshot.
//
// Rules:
// - Uses existing loanEngine step loop (no new formulas)
// - Full-month monthsBetween
// - If startDate is in the future -> ignore derivation (elapsedMonths = 0)
// - If elapsedMonths >= term -> balance=0, remainingTermMonths=0
// - Never allows negative balances

import { initLoan, stepLoanMonth } from './loanEngine';

export function monthsBetweenFullMonths(startDate: Date, today: Date): number {
  // Full months between two dates:
  // - count (year,month) difference
  // - subtract 1 if today's day-of-month is earlier than start day-of-month
  const start = new Date(startDate.getTime());
  const end = new Date(today.getTime());

  if (end.getTime() <= start.getTime()) return 0;

  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  let months = yearDiff * 12 + monthDiff;

  if (end.getDate() < start.getDate()) months -= 1;

  return Math.max(0, months);
}

export type DeriveLoanStateArgs = {
  originalBalance: number;
  annualRatePct: number;
  originalTermMonths: number; // integer months (expected multiple of 12 in our UI)
  startDate: Date;
  today: Date;
};

export type DerivedLoanState = {
  currentBalance: number;
  remainingTermMonths: number;
  monthlyPayment: number;
  currentMonthlyInterest: number;
  currentMonthlyPrincipal: number;
};

export function deriveLoanStateAsOfToday(args: DeriveLoanStateArgs): DerivedLoanState {
  const originalBalance = Number.isFinite(args.originalBalance) ? Math.max(0, args.originalBalance) : 0;
  const annualRatePct = Number.isFinite(args.annualRatePct) ? Math.max(0, args.annualRatePct) : 0;
  const originalTermMonths = Number.isFinite(args.originalTermMonths) ? Math.max(0, Math.floor(args.originalTermMonths)) : 0;

  // Future start date -> ignore derivation (treat as "today state" input).
  const elapsedMonths = monthsBetweenFullMonths(args.startDate, args.today);

  if (originalBalance <= 0 || originalTermMonths <= 0) {
    return {
      currentBalance: 0,
      remainingTermMonths: 0,
      monthlyPayment: 0,
      currentMonthlyInterest: 0,
      currentMonthlyPrincipal: 0,
    };
  }

  // UI uses integer years; originalTermMonths should be a multiple of 12.
  const originalTermYears = Math.max(0, Math.floor(originalTermMonths / 12));
  const init = initLoan({ balance: originalBalance, annualInterestRatePct: annualRatePct, remainingTermYears: originalTermYears });

  if (elapsedMonths >= originalTermMonths) {
    return {
      currentBalance: 0,
      remainingTermMonths: 0,
      monthlyPayment: init.monthlyPayment,
      currentMonthlyInterest: 0,
      currentMonthlyPrincipal: 0,
    };
  }

  let balance = originalBalance;

  // Step forward month-by-month using the loan engine.
  for (let i = 0; i < elapsedMonths; i++) {
    if (balance <= 0) break;
    const m = stepLoanMonth({ balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
    balance = m.newBalance;
  }

  const remainingTermMonths = Math.max(0, originalTermMonths - elapsedMonths);

  const currentMonth = balance > 0
    ? stepLoanMonth({ balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate })
    : { interest: 0, principal: 0, newBalance: 0 };

  return {
    currentBalance: Math.max(0, balance),
    remainingTermMonths: balance <= 0 ? 0 : remainingTermMonths,
    monthlyPayment: init.monthlyPayment,
    currentMonthlyInterest: currentMonth.interest,
    currentMonthlyPrincipal: currentMonth.principal,
  };
}


