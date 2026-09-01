import prisma from "@/lib/prisma";
import { sanitizeUser, SafeUserDTO } from "@/lib/utils/dto-sanitizer";

export async function updateUserRole(
  targetId: string,
  actorId: string,
  newRole: "ADMIN" | "CUSTOMER"
): Promise<SafeUserDTO> {
  const [targetUser, actorUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: targetId } }),
    prisma.user.findUnique({ where: { id: actorId } }),
  ]);

  if (!targetUser) {
    throw new Error("USER_NOT_FOUND");
  }

  if (!actorUser) {
    throw new Error("ACTOR_NOT_FOUND");
  }

  // Cross-Tenant Guard (Finding TEN-001): Um admin NÃO pode alterar papéis de usuários de outra loja
  if (targetUser.lojaID !== actorUser.lojaID) {
    throw new Error("USER_NOT_FOUND");
  }

  if (actorId === targetId) {
    throw new Error("CANNOT_CHANGE_OWN_ROLE");
  }

  if (targetUser.status === "BLOCKED") {
    throw new Error("USER_BLOCKED");
  }

  if (targetUser.role === newRole) {
    throw new Error("ROLE_ALREADY_SET");
  }

  // Tenant-Scoped Last Admin Check: Verifica se é o último admin da loja específica
  if (newRole === "CUSTOMER" && targetUser.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", lojaID: actorUser.lojaID },
    });

    if (adminCount <= 1) {
      throw new Error("LAST_ADMIN");
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: targetId },
      data: { role: newRole },
    });

    await tx.auditLog.create({
      data: {
        action: "ROLE_CHANGED",
        targetId,
        actorId,
        entity: "USER",
        entityId: targetId,
        metadata: {
          previousRole: targetUser.role,
          newRole,
          lojaID: actorUser.lojaID,
        },
      },
    });

    return sanitizeUser(updatedUser);
  });

  return result;
}
