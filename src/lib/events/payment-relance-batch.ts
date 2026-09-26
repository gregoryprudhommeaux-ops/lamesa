/** One manual payment reminder per participation. A later blast skips anyone already stamped. */
export function splitPaymentRelanceBatch<T extends { paymentRelanceSentAt?: string | null }>(
  rows: T[],
): { toSend: T[]; alreadySent: T[] } {
  const toSend: T[] = [];
  const alreadySent: T[] = [];
  for (const row of rows) {
    if (String(row.paymentRelanceSentAt ?? "").trim()) alreadySent.push(row);
    else toSend.push(row);
  }
  return { toSend, alreadySent };
}
