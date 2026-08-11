import prisma from "@/lib/prisma";

export class CartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartError";
  }
}

async function getOrCreateActiveCart(userID: string) {
  let cart = await prisma.cart.findFirst({
    where: { userID, status: "ACTIVE" },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userID, status: "ACTIVE" },
    });
  }
  return cart;
}

async function getActiveCart(userID: string) {
  const cart = await prisma.cart.findFirst({
    where: { userID, status: "ACTIVE" },
  });
  if (!cart) throw new CartError("Cart not found");
  return cart;
}

export async function getCart(userID: string) {
  return await prisma.cart.findFirst({
    where: {
      userID,
      status: "ACTIVE",
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              lojaID: true,
              loja: { select: { slug: true } }
            }
          }
        }
      },
    },
  });
}

export async function addToCart(
  userID: string,
  data: {
    productID: string;
    variantID: string;
    quantity: number;
  }
) {
  // Fetch product and variant details to prevent client-side manipulation
  const variant = await prisma.productVariants.findUnique({
    where: { id: data.variantID },
    include: { product: true },
  });

  if (!variant || variant.ProductID !== data.productID) {
    throw new CartError("Invalid product or variant");
  }

  if (variant.stock < data.quantity) {
    throw new CartError("Insufficient stock");
  }

  const cart = await prisma.cart.findFirst({
    where: { userID, status: "ACTIVE" },
    include: {
      items: {
        include: {
          product: { select: { lojaID: true } }
        }
      }
    }
  });

  let activeCart;

  if (cart) {
    activeCart = cart;
    // Check if the cart has items from a different store
    if (activeCart.items.length > 0) {
      const existingLojaID = activeCart.items[0].product.lojaID;
      if (existingLojaID !== variant.product.lojaID) {
        throw new CartError("Você só pode adicionar produtos de uma única loja por pedido. Limpe o carrinho atual para trocar de loja.");
      }
    }
  } else {
    activeCart = await prisma.cart.create({
      data: { userID, status: "ACTIVE" },
      include: {
        items: {
          include: {
            product: { select: { lojaID: true } }
          }
        }
      }
    });
  }

  // 2. Verificar se o item (variante) já existe no carrinho
  const existingItem = activeCart.items.find(item => item.variantID === data.variantID);

  if (existingItem) {
    const newQuantity = existingItem.quantity + data.quantity;
    if (variant.stock < newQuantity) {
      throw new CartError("Insufficient stock for this quantity");
    }

    // 3a. Se existir, apenas incrementa a quantidade
    return await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: newQuantity,
      },
    });
  }

  // 3b. Se não existir, cria o novo item no carrinho
  return await prisma.cartItem.create({
    data: {
      cartID: activeCart.id,
      productID: data.productID,
      variantID: data.variantID,
      quantity: data.quantity,
      color: variant.color,
      size: variant.size,
      price: variant.product.price,
      productName: variant.product.name,
      imageUrl: variant.product.imageUrl,
    },
  });
}

export async function updateCartItemQuantity(
  userID: string,
  variantID: string,
  quantity: number
) {
  // Check stock
  const variant = await prisma.productVariants.findUnique({
    where: { id: variantID },
  });

  if (!variant) {
    throw new CartError("Variant not found");
  }

  if (variant.stock < quantity) {
    throw new CartError("Insufficient stock");
  }

  const cart = await getActiveCart(userID);

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartID: cart.id,
      variantID,
    },
  });

  if (!existingItem) {
    throw new CartError("Item not found in cart");
  }

  return await prisma.cartItem.update({
    where: { id: existingItem.id },
    data: { quantity },
  });
}

export async function removeFromCart(userID: string, variantID: string) {
  const cart = await getActiveCart(userID);

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartID: cart.id,
      variantID,
    },
  });

  if (!existingItem) {
    throw new CartError("Item not found in cart");
  }

  return await prisma.cartItem.delete({
    where: { id: existingItem.id },
  });
}
