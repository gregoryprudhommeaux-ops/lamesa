/** One manual payment reminder per participation.
 * Skips anyone already stamped OR who declared a SPEI transfer (awaiting admin confirm).
 */
export function splitPaymentRelanceBatch<
  T extends {
    paymentRelanceSentAt?: string | null;
    paymentDeclaredAt?: string | null;
  },
>(rows: T[]): { toSend: T[]; alreadySent: T[]; declared: T[] } {
  const toSend: T[] = [];
  const alreadySent: T[] = [];
  const declared: T[] = [];
  for (const row of rows) {
    if (String(row.paymentDeclaredAt ?? "").trim()) declared.push(row);
    else if (String(row.paymentRelanceSentAt ?? "").trim()) alreadySent.push(row);
    else toSend.push(row);
  }
  return { toSend, alreadySent, declared };
}
