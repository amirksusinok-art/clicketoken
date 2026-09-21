/**
 * Formats token amount intelligently supporting micro-tokens (up to 5 decimals)
 * e.g., 0.00001 -> "0.00001", 0.002 -> "0.002", 10.5 -> "10.500"
 */
export function formatTokens(amount: number | undefined | null, decimals?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return (0).toFixed(decimals ?? 3);
  }

  let d = decimals;
  if (d === undefined) {
    if (Math.abs(amount) > 0 && Math.abs(amount) < 0.01) {
      d = 5;
    } else {
      d = 3;
    }
  }

  const fixed = amount.toFixed(d);
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
