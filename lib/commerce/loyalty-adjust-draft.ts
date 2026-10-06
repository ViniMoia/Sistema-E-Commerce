export type LoyaltyAdjustmentDraft = { userID: string; points: number; description: string; expiresAt?: string | null };
export type PendingLoyaltyAdjustment = { fingerprint: string; commandId: string };
/** Preserve the command on uncertain response; clear only after confirmed success
 * or rejection. A changed draft is a different intended adjustment. */
export function prepareLoyaltyAdjustment(draft: LoyaltyAdjustmentDraft, pending: PendingLoyaltyAdjustment | null, createId: () => string) {
  const body = { userID: draft.userID.trim(), points: Number(draft.points), description: draft.description.trim(), expiresAt: draft.expiresAt ?? null };
  const fingerprint = JSON.stringify(body);
  const identity = pending?.fingerprint === fingerprint ? pending : { fingerprint, commandId: createId() };
  return { pending: identity, body: { ...body, commandId: identity.commandId } };
}
