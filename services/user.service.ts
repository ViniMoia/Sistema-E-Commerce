import prisma from "@/lib/prisma";
import { sanitizeUser, SafeUserDTO } from "@/lib/utils/dto-sanitizer";

export async function updateUserRole(
  targetId: string,
  actorId: string,
  newRole: "ADMIN" | "CUSTOMER",
  lojaID?: string,
): Promise<SafeUserDTO> {
  return changeUserEligibility(targetId, actorId, { kind: 'ROLE', role: newRole }, lojaID);
}

/** Internal adapter; no public block/unblock/delete/transfer endpoints are added. */
export async function updateUserStatus(targetId: string, actorId: string, status: 'ACTIVE' | 'BLOCKED', lojaID?: string) {
  return changeUserEligibility(targetId, actorId, { kind: 'STATUS', status }, lojaID);
}

type EligibilityChange = { kind: 'ROLE'; role: 'ADMIN' | 'CUSTOMER' } | { kind: 'STATUS'; status: 'ACTIVE' | 'BLOCKED' };

/** All eligibility writers use store -> ordered users -> audit/session locks. */
export async function changeUserEligibility(targetId: string, actorId: string, change: EligibilityChange, expectedLojaID?: string): Promise<SafeUserDTO> {
  // Deletion and tenant transfer are deliberately unsupported: linked commerce
  // and audit data cannot be deleted/reassigned through an eligibility patch.
  if (!change || (change.kind !== 'ROLE' && change.kind !== 'STATUS') ||
      (change.kind === 'ROLE' && !['ADMIN', 'CUSTOMER'].includes(change.role)) ||
      (change.kind === 'STATUS' && !['ACTIVE', 'BLOCKED'].includes(change.status))) throw new Error('INVALID_ELIGIBILITY_CHANGE');
  const hint = await prisma.user.findUnique({ where: { id: actorId }, select: { lojaID: true } });
  if (!hint) throw new Error('UNAUTHORIZED');
  const lojaID = expectedLojaID ?? hint.lojaID;
  return prisma.$transaction(async tx => {
    const stores = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Loja" WHERE id = ${lojaID} FOR UPDATE`;
    if (stores.length !== 1) throw new Error('USER_NOT_FOUND');
    await tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${actorId}, ${targetId}) ORDER BY id FOR UPDATE`;
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor || actor.status !== 'ACTIVE') throw new Error('UNAUTHORIZED');
    if (actor.role !== 'ADMIN' || actor.lojaID !== lojaID) throw new Error('FORBIDDEN');
    const target = await tx.user.findUnique({ where: { id: targetId } });
    if (!target || target.lojaID !== lojaID) throw new Error('USER_NOT_FOUND');
    if (actorId === targetId) throw new Error(change.kind === 'ROLE' ? 'CANNOT_CHANGE_OWN_ROLE' : 'CANNOT_CHANGE_OWN_STATUS');
    if (change.kind === 'ROLE' && target.status !== 'ACTIVE') throw new Error('USER_BLOCKED');
    if (change.kind === 'ROLE' ? target.role === change.role : target.status === change.status) {
      throw new Error(change.kind === 'ROLE' ? 'ROLE_ALREADY_SET' : 'STATUS_ALREADY_SET');
    }
    const removesAdmin = target.role === 'ADMIN' && target.status === 'ACTIVE' &&
      ((change.kind === 'ROLE' && change.role !== 'ADMIN') || (change.kind === 'STATUS' && change.status !== 'ACTIVE'));
    if (removesAdmin && await tx.user.count({ where: { lojaID, role: 'ADMIN', status: 'ACTIVE' } }) <= 1) throw new Error('LAST_ADMIN');
    const updated = await tx.user.update({ where: { id: targetId },
      data: change.kind === 'ROLE' ? { role: change.role } : { status: change.status } });
    if (change.kind === 'ROLE' || change.status === 'BLOCKED') {
      await tx.session.deleteMany({ where: { userId: targetId } });
    }
    if (change.kind === 'STATUS' && change.status === 'BLOCKED') {
      await tx.user.update({ where: { id: targetId }, data: { resetToken: null, resetTokenExpires: null } });
    }
    await tx.auditLog.create({ data: { action: change.kind === 'ROLE' ? 'ROLE_CHANGED' : 'USER_STATUS_CHANGED',
      targetId, actorId, actorType: 'USER', entity: 'USER', entityId: targetId,
      previousValue: { role: target.role, status: target.status }, newValue: { role: updated.role, status: updated.status },
      metadata: { lojaID, previousRole: target.role, newRole: updated.role, previousStatus: target.status, newStatus: updated.status } } });
    return sanitizeUser(updated);
  });
}
