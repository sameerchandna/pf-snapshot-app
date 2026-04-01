/**
 * Centralized numeric formatting utilities.
 *
 * All currency and percentage formatting should use these functions.
 * This ensures consistent formatting behavior across the app.
 */

import { UI_TOLERANCE } from '../constants';

/**
 * Format currency in full format (no sign, no compact notation).
 * Example: £1,234,567
 *
 * @param value - The numeric value to format
 * @returns Formatted currency string
 */
export function formatCurrencyFull(value: number): string {
  return `£${Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format currency in full format with sign (negative shows "-", positive no sign).
 * Example: £1,234,567 or -£1,234,567
 *
 * @param value - The numeric value to format
 * @returns Formatted currency string with sign for negative values
 */
export function formatCurrencyFullSigned(value: number): string {
  const sign = value >= 0 ? '' : '-';
  return `${sign}£${Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format currency in full format with always-visible sign (+ or -).
 * Example: +£1,234,567 or -£1,234,567 or +£0
 *
 * @param value - The numeric value to format
 * @returns Formatted currency string with always-visible sign
 */
export function formatCurrencyFullAlwaysSigned(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}£${Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format currency in compact format (no sign, uses K/M notation).
 * Example: £1.2m, £234k, £1,234
 *
 * @param value - The numeric value to format
 * @returns Formatted currency string in compact notation
 */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `£${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `£${Math.round(abs / 1_000)}k`;
  return formatCurrencyFull(value);
}

/**
 * Format currency in compact format with sign (shows "—" for zero, uses K/M notation).
 * Example: +£1.2m, -£234k, — (for zero)
 *
 * @param value - The numeric value to format
 * @returns Formatted currency string in compact notation with sign, or "—" for zero
 */
export function formatCurrencyCompactSigned(value: number): string {
  if (Math.abs(value) < UI_TOLERANCE) return '—';
  const sign = value >= 0 ? '+' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}£${Math.round(abs / 1_000)}k`;
  return formatCurrencyFullSigned(value);
}

/**
 * Format a decimal year duration as "Xy Ym" (e.g. 8.777 → "8y 8m").
 * Values under 1 year are shown as months only (e.g. 0.5 → "6m").
 * Whole years with no remaining months show as "Xy" (e.g. 3.0 → "3y").
 *
 * @param decimalYears - Duration in fractional years
 * @returns Formatted string like "8y 7m", "3y", or "6m"
 */
export function formatYearsMonths(decimalYears: number): string {
  const totalMonths = Math.round(Math.abs(decimalYears) * 12);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}

/**
 * Format percentage value.
 *
 * @param value - The numeric percentage value (e.g., 1.5 for 1.5%)
 * @param options - Formatting options
 * @param options.decimals - Number of decimal places (default: 0 for round numbers)
 * @param options.handleUndefined - Return value for undefined/invalid values (default: '0%')
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number | undefined,
  options?: {
    decimals?: number;
    handleUndefined?: string;
  }
): string {
  const decimals = options?.decimals ?? 0;
  const handleUndefined = options?.handleUndefined ?? '0%';

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return handleUndefined;
  }

  return `${value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}%`;
}
