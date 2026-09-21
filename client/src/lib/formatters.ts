/**
 * Formats token amount with at least 3 decimal places
 * e.g., 0 -> "0.000", 1.257 -> "1.257", 10.5 -> "10.500"
 */
export function formatTokens(amount: number | undefined | null, decimals = 3): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return (0).toFixed(decimals);
  }
  // Ensure decimal places
  const fixed = amount.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join('.');
}

export function formatMultiplier(mult: number | undefined | null): string {
  if (mult === undefined || mult === null || isNaN(mult)) {
    return '1.00x';
  }
  return `${mult.toFixed(2)}x`;
}
