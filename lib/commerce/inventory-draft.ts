export type InventoryDraft = {
  productId: string; variantId?: string; mode: 'ABSOLUTE' | 'DELTA' | 'REACTIVATE'; quantity: number; reason: string;
};
export type InventoryAttempt = {
  content: string;
  body: Omit<InventoryDraft, 'productId'> & { commandId: string; expectedVersion: number };
};

/** A changed server snapshot is not a changed administrative intent. Keep the
 * original request for an uncertain attempt, including its original revision. */
export function prepareInventoryAttempt(previous: InventoryAttempt | null, draft: InventoryDraft, version: number, newId: () => string): InventoryAttempt {
  const { productId, ...input } = draft;
  input.reason = input.reason.trim();
  const content = JSON.stringify([productId, input.variantId ?? null, input.mode, input.quantity, input.reason]);
  if (previous?.content === content) return previous;
  return { content, body: { ...input, expectedVersion: version, commandId: newId() } };
}
