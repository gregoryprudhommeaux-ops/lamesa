export function isSoftDeleted(row: { deletedAt?: string | null }): boolean {
  return Boolean(row.deletedAt && String(row.deletedAt).trim());
}

export function withoutSoftDeleted<T extends { deletedAt?: string | null }>(
  rows: T[],
): T[] {
  return rows.filter((r) => !isSoftDeleted(r));
}
