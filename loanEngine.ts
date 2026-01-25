// Pure loan amortisation engine (A2)
//
// - No UI knowledge
// - No persistence knowledge
// - Deterministic, side-effect free
//
// Spec (locked):
// - Payment computed once at start from (balance, annualRatePct, remainingTermYears)
// - Each month:
//   interest = balance * monthlyRate
//   principal = payment - interest
//   clamp principal to remainingBalance in final month
//   newBalance never negative (clamp to 0)

export type LoanInputs = {
  balance: number; // >= 0
  annualInterestRatePct: number; // >= 0 (percent)
  remainingTermYears: number; // integer >= 0
};

export type LoanInit = {
  monthlyPayment: number; // >= 0
  monthlyRate: number; // >= 0 (decimal)
  remainingMonths: number; // integer >= 0
};

export type LoanMonthResult = {
  interest: number; // >= 0
  principal: number; // >= 0
  newBalance: number; // >= 0
};

function pctToMonthlyRateDecimal(pct: number): number {
  const r = pct / 100;
  if (!Number.isFinite(r) || r <= 0) return 0;
  return r / 12;
}

export function initLoan(inputs: LoanInputs): LoanInit {
  const balance = Number.isFinite(inputs.balance) ? Math.max(0, inputs.balance) : 0;
  const remainingMonthsRaw = Number.isFinite(inputs.remainingTermYears) ? inputs.remainingTermYears * 12 : 0;
  const remainingMonths = Math.max(0, Math.floor(remainingMonthsRaw));
  const monthlyRate = pctToMonthlyRateDecimal(inputs.annualInterestRatePct);

  if (balance <= 0 || remainingMonths <= 0) {
    return { monthlyPayment: 0, monthlyRate, remainingMonths };
  }

  // Standard amortisation payment:
  // payment = P * r / (1 - (1 + r)^(-n))
  // If r == 0: payment = P / n
  if (monthlyRate === 0) {
    return { monthlyPayment: balance / remainingMonths, monthlyRate, remainingMonths };
  }

  const denom = 1 - Math.pow(1 + monthlyRate, -remainingMonths);
  const safeDenom = Number.isFinite(denom) && denom > 0 ? denom : 0;
  const monthlyPayment = safeDenom > 0 ? (balance * monthlyRate) / safeDenom : balance / remainingMonths;

  return { monthlyPayment, monthlyRate, remainingMonths };
}

export function stepLoanMonth(args: { balance: number; monthlyPayment: number; monthlyRate: number; extraPrincipal?: number }): LoanMonthResult {
  const balance = Number.isFinite(args.balance) ? Math.max(0, args.balance) : 0;
  const monthlyPayment = Number.isFinite(args.monthlyPayment) ? Math.max(0, args.monthlyPayment) : 0;
  const monthlyRate = Number.isFinite(args.monthlyRate) ? Math.max(0, args.monthlyRate) : 0;
  const extraPrincipal = args.extraPrincipal !== undefined && Number.isFinite(args.extraPrincipal) ? Math.max(0, args.extraPrincipal) : 0;

  // POST-PAYOFF BEHAVIOUR (loan lifecycle enforcement):
  // Once the loan balance reaches zero or below, the loan is inactive.
  // From that point onward, regardless of any inputs (monthlyPayment, extraPrincipal, etc.):
  // - Scheduled monthly payment is treated as 0 (ignored)
  // - Extra overpayment is treated as 0 (ignored)
  // - Interest is 0
  // - Principal is 0
  // - Balance remains at 0
  // - No loan-related cashflows or balance changes may occur after payoff.
  // This early return ensures the loan lifecycle is correct in isolation,
  // without relying on caller behaviour to stop processing after payoff.
  if (balance <= 0) {
    return { interest: 0, principal: 0, newBalance: 0 };
  }

  // ACTIVE LOAN BEHAVIOUR (balance > 0):
  // Interest is always calculated on the opening balance for the month.
  const interest = balance * monthlyRate;
  
  // Scheduled principal: payment minus interest, clamped to >= 0.
  // This represents the principal portion of the fixed monthly payment.
  const scheduledPrincipal = Math.max(0, monthlyPayment - interest);
  
  // Apply extra principal (overpayment) after scheduled principal.
  // Extra overpayments apply fully to principal reduction.
  const totalPrincipalRaw = scheduledPrincipal + extraPrincipal;
  
  // Clamp total principal to remaining balance to prevent negative balance.
  // This ensures the loan cannot go below zero, even with large overpayments.
  const principal = Math.min(totalPrincipalRaw, balance);
  const newBalance = Math.max(0, balance - principal);

  return { interest, principal, newBalance };
}


