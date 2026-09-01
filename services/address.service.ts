import prisma from "@/lib/prisma";
import { sanitizeUser, SafeUserDTO } from "@/lib/utils/dto-sanitizer";

export async function setDefaultAddress(userId: string, addressId: string): Promise<SafeUserDTO> {
  const address = await prisma.address.findUnique({
    where: { id: addressId },
  });

  // IDOR Defense (SEC-003): Address must exist and belong strictly to the authenticated user
  if (!address || address.userID !== userId) {
    throw new Error("Endereço não encontrado ou acesso não autorizado");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      defaultAddressId: addressId,
    },
  });

  return sanitizeUser(updatedUser);
}
