import prisma from "@/lib/prisma";

export async function updateUserRole(
  targetId: string,
  actorId: string,
  newRole: "ADMIN" | "CUSTOMER"
) {
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

  if (actorId === targetId) {
    throw new Error("CANNOT_CHANGE_OWN_ROLE");
  }

  if (targetUser.status === "BLOCKED") {
    throw new Error("USER_BLOCKED");
  }

  if (targetUser.role === newRole) {
    throw new Error("ROLE_ALREADY_SET");
  }

  if (newRole === "CUSTOMER" && targetUser.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN" },
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
        },
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  });

  return result;
}
