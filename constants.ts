/**
 * Application-wide constants.
 */

/**
 * Tolerance for attribution reconciliation checks.
 * 
 * Attribution math involves inflation discounting, loan amortisation, and multi-year
 * projections. Small rounding errors accumulate, so we use £1.00 tolerance to account
 * for legitimate numerical precision differences while catching real calculation errors.
 */
export const ATTRIBUTION_TOLERANCE = 1.0; // GBP

/**
 * Tolerance for UI display and scenario delta checks.
 * 
 * UI comparisons need tighter precision (£0.01) to distinguish meaningful differences
 * from rounding noise in displayed values. This ensures deltas and scenario comparisons
 * are accurate at the penny level.
 */
export const UI_TOLERANCE = 0.01; // GBP

/**
 * Tolerance for age (years) comparison checks.
 * 
 * Age comparisons use 0.01 years (~3.65 days) tolerance to account for floating-point
 * precision differences in projection series age calculations while ensuring age
 * alignment between baseline and scenario series.
 */
export const AGE_COMPARISON_TOLERANCE = 0.01; // Dimensionless (years)

