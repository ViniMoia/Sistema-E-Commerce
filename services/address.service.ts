import prisma from "@/lib/prisma"

export async function setDefaultAddress(userId: string, addressId: string) {
  const address = await prisma.address.findUnique({
    where: { id: addressId }
  })

  if (!address || address.userID !== userId) {
    throw new Error("Endereço inválido")
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      defaultAddressId: addressId
    }
  })
}

