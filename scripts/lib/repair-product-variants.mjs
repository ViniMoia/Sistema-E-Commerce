import { Prisma } from "@prisma/client";

export const PRODUCT_ID = "6a6e98eb-98c3-4ba2-aede-a357d43893cf";
export const PRIMARY_ID = "eed23950-87e7-41b8-927a-6c5f2c75f026";
export const DUPLICATE_ID = "7276b8e0-9d62-4a25-b8cb-9e024f8f1abe";

export async function repairVariants(prisma, saveBackup) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT id FROM "Product" WHERE id = $1 FOR UPDATE', PRODUCT_ID);
    const variants = await tx.productVariants.findMany({
      where: { ProductID: PRODUCT_ID }, orderBy: { createdAt: "asc" },
    });
    if (variants.some(v => 'inventoryVersion' in v || 'retiredAt' in v || 'unavailableStock' in v)) {
      throw new Error('Saneamento legado incompatível com revisões/retiradas/reservas: validar manutenção WF-18 antes de aplicar.');
    }
    const primary = variants.find((v) => v.id === PRIMARY_ID);
    const duplicate = variants.find((v) => v.id === DUPLICATE_ID);
    if (!primary) throw new Error("Variante primária não encontrada.");
    if (variants.some((v) => ![PRIMARY_ID, DUPLICATE_ID].includes(v.id))) {
      throw new Error("Variantes inesperadas: saneamento interrompido.");
    }
    const neutral = (value) => ["unico", "padrao", "default"].includes(
      value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    );
    if (variants.some((v) => !neutral(v.size) || !neutral(v.color))) {
      throw new Error("As variantes não são neutras: saneamento interrompido.");
    }
    if (!duplicate && primary.size === "Único" && primary.color === "Padrão") {
      return { changed: false, primaryId: PRIMARY_ID };
    }
    const cartItems = await tx.cartItem.findMany({
      where: { variantID: { in: [PRIMARY_ID, DUPLICATE_ID] } },
    });
    const orderItems = await tx.orderItem.findMany({
      where: { productVariantsId: { in: [PRIMARY_ID, DUPLICATE_ID] } },
    });
    await saveBackup({ productId: PRODUCT_ID, variants, cartItems, orderItems });
    for (const item of cartItems.filter((i) => i.variantID === DUPLICATE_ID)) {
      const collision = cartItems.find((i) => i.cartID === item.cartID && i.variantID === PRIMARY_ID);
      if (collision) {
        await tx.cartItem.update({
          where: { id: collision.id }, data: { quantity: { increment: item.quantity } },
        });
        await tx.cartItem.delete({ where: { id: item.id } });
      } else {
        await tx.cartItem.update({ where: { id: item.id }, data: { variantID: PRIMARY_ID } });
      }
    }
    // Preserva os snapshots históricos (nome, tamanho, cor e preço) dos pedidos.
    await tx.orderItem.updateMany({
      where: { productVariantsId: DUPLICATE_ID }, data: { productVariantsId: PRIMARY_ID },
    });
    if (duplicate) await tx.productVariants.delete({ where: { id: DUPLICATE_ID } });
    await tx.productVariants.update({
      where: { id: PRIMARY_ID }, data: { size: "Único", color: "Padrão" },
    });
    await tx.cartItem.updateMany({
      where: { variantID: PRIMARY_ID }, data: { size: "Único", color: "Padrão" },
    });
    return {
      changed: true, primaryId: PRIMARY_ID,
      movedCartItems: cartItems.filter((i) => i.variantID === DUPLICATE_ID).length,
      movedOrderItems: orderItems.filter((i) => i.productVariantsId === DUPLICATE_ID).length,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
