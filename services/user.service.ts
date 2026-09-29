import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sanitizeUser, SafeUserDTO } from "@/lib/utils/dto-sanitizer";

const MAX_SERIALIZABLE_ATTEMPTS = 3;

function isSerializableConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

export async function updateUserRole(
  targetId: string,
  actorId: string,
  newRole: "ADMIN" | "CUSTOMER"
): Promise<SafeUserDTO> {
  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [targetUser, actorUser] = await Promise.all([
          tx.user.findUnique({ where: { id: targetId } }),
          tx.user.findUnique({ where: { id: actorId } }),
        ]);

        if (!targetUser) throw new Error("USER_NOT_FOUND");
        if (!actorUser) throw new Error("ACTOR_NOT_FOUND");
        if (actorUser.role !== "ADMIN" || actorUser.status !== "ACTIVE") {
          throw new Error("ACTOR_NOT_AUTHORIZED");
        }

        // Não revelar a existência de usuários de outro tenant.
        if (targetUser.lojaID !== actorUser.lojaID) {
          throw new Error("USER_NOT_FOUND");
        }
        if (actorId === targetId) throw new Error("CANNOT_CHANGE_OWN_ROLE");
        if (targetUser.status === "BLOCKED") throw new Error("USER_BLOCKED");
        if (targetUser.role === newRole) throw new Error("ROLE_ALREADY_SET");

        if (newRole === "CUSTOMER" && targetUser.role === "ADMIN") {
          const activeAdminCount = await tx.user.count({
            where: {
              role: "ADMIN",
              status: "ACTIVE",
              lojaID: actorUser.lojaID,
            },
          });
          if (activeAdminCount <= 1) throw new Error("LAST_ADMIN");
        }

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
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (isSerializableConflict(error) && attempt < MAX_SERIALIZABLE_ATTEMPTS) continue;
      throw error;
    }
  }

  throw new Error("ROLE_UPDATE_CONFLICT");
}
