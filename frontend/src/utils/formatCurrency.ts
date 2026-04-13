/**
 * Format an integer KRW amount as ₩1,000,000 (no decimals)
 */
export function formatCurrency(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}
