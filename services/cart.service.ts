import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type CartErrorCode =
  | 'VALIDATION_ERROR'
  | 'CART_NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'PRODUCT_NOT_AVAILABLE'
  | 'PRODUCT_VARIANT_REQUIRED'
  | 'INSUFFICIENT_STOCK'
  | 'CART_TENANT_CONFLICT'
  | 'CHECKOUT_CART_NOT_FOUND'
  | 'CHECKOUT_CART_STATE_CONFLICT'

export class CartError extends Error {
  constructor(
    message: string,
    public readonly code: CartErrorCode,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = 'CartError'
  }
}

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new CartError('Quantidade deve ser um inteiro entre 1 e 99.', 'VALIDATION_ERROR', 422)
  }
}

async function lockUserCart(
  tx: Prisma.TransactionClient,
  userID: string,
  lojaID: string
) {
  const users = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userID} AND "lojaID" = ${lojaID}
    FOR UPDATE
  `)

  if (users.length !== 1) {
    throw new CartError('Usuário não pertence à loja ativa.', 'CART_TENANT_CONFLICT', 403)
  }
}

async function getActiveCart(
  tx: Prisma.TransactionClient,
  userID: string,
  includeItems = false
) {
  const cart = await tx.cart.findFirst({
    where: { userID, status: 'ACTIVE' },
    ...(includeItems
      ? {
          include: {
            items: {
              include: { product: { select: { lojaID: true } } },
            },
          },
        }
      : {}),
  })

  if (!cart) {
    throw new CartError('Carrinho ativo não encontrado.', 'CART_NOT_FOUND', 404)
  }
  return cart
}

export async function getCart(userID: string, lojaID?: string) {
  const cart = await prisma.cart.findFirst({
    where: { userID, status: 'ACTIVE' },
    include: {
      items: {
        include: {
          product: {
            select: {
              lojaID: true,
              loja: { select: { slug: true } },
            },
          },
        },
      },
    },
  })

  if (!cart) return null
  if (lojaID && cart.items.some((item) => item.product.lojaID !== lojaID)) {
    throw new CartError(
      'O carrinho contém itens incompatíveis com a loja ativa.',
      'CART_TENANT_CONFLICT',
      409
    )
  }

  return {
    ...cart,
    shippingCost: cart.shippingCost ? Number(cart.shippingCost) : null,
    items: cart.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  }
}

export async function addToCart(
  userID: string,
  lojaID: string,
  data: {
    productID: string
    variantID?: string | null
    quantity: number
  }
) {
  assertQuantity(data.quantity)

  return prisma.$transaction(async (tx) => {
    // Serializa criações/incrementos do mesmo usuário entre processos e réplicas.
    await lockUserCart(tx, userID, lojaID)

    const variant = data.variantID
      ? await tx.productVariants.findFirst({
          where: {
            id: data.variantID,
            ProductID: data.productID,
            product: { lojaID },
          },
          include: { product: true },
        })
      : await tx.productVariants.findFirst({
          where: { ProductID: data.productID, product: { lojaID } },
          include: { product: true },
          orderBy: { createdAt: 'asc' },
        })

    if (!variant) {
      const product = await tx.product.findFirst({
        where: { id: data.productID, lojaID },
        select: { id: true },
      })
      if (!product) {
        throw new CartError('Produto não disponível nesta loja.', 'PRODUCT_NOT_AVAILABLE', 404)
      }
      throw new CartError(
        'O produto não possui uma variante comprável cadastrada.',
        'PRODUCT_VARIANT_REQUIRED',
        409
      )
    }

    const effectiveStock = Math.min(variant.stock, variant.product.stock)
    if (effectiveStock < data.quantity) {
      throw new CartError('Estoque insuficiente.', 'INSUFFICIENT_STOCK', 409)
    }

    let activeCart = await tx.cart.findFirst({
      where: { userID, status: 'ACTIVE' },
      include: {
        items: {
          include: { product: { select: { lojaID: true } } },
        },
      },
    })

    if (!activeCart) {
      activeCart = await tx.cart.create({
        data: { userID, status: 'ACTIVE' },
        include: {
          items: {
            include: { product: { select: { lojaID: true } } },
          },
        },
      })
    }

    if (activeCart.items.some((item) => item.product.lojaID !== lojaID)) {
      throw new CartError(
        'O carrinho ativo pertence a outra loja. Limpe-o antes de continuar.',
        'CART_TENANT_CONFLICT',
        409
      )
    }

    const existingItem = activeCart.items.find((item) => item.variantID === variant.id)
    const nextQuantity = (existingItem?.quantity ?? 0) + data.quantity
    if (effectiveStock < nextQuantity) {
      throw new CartError('Estoque insuficiente para esta quantidade.', 'INSUFFICIENT_STOCK', 409)
    }

    const snapshot = {
      quantity: nextQuantity,
      color: variant.color,
      size: variant.size,
      price: variant.product.price,
      productName: variant.product.name,
      imageUrl: variant.product.imageUrl,
    }

    if (existingItem) {
      return tx.cartItem.update({
        where: { id: existingItem.id },
        data: snapshot,
      })
    }

    return tx.cartItem.create({
      data: {
        cartID: activeCart.id,
        productID: data.productID,
        variantID: variant.id,
        ...snapshot,
      },
    })
  })
}

export async function updateCartItemQuantity(
  userID: string,
  lojaID: string,
  variantID: string,
  quantity: number
) {
  assertQuantity(quantity)

  return prisma.$transaction(async (tx) => {
    await lockUserCart(tx, userID, lojaID)
    const variant = await tx.productVariants.findFirst({
      where: { id: variantID, product: { lojaID } },
      include: { product: { select: { stock: true } } },
    })
    if (!variant) {
      throw new CartError('Variante não encontrada nesta loja.', 'PRODUCT_NOT_AVAILABLE', 404)
    }
    if (Math.min(variant.stock, variant.product.stock) < quantity) {
      throw new CartError('Estoque insuficiente.', 'INSUFFICIENT_STOCK', 409)
    }

    const cart = await getActiveCart(tx, userID)
    const existingItem = await tx.cartItem.findFirst({
      where: { cartID: cart.id, variantID },
    })
    if (!existingItem) {
      throw new CartError('Item não encontrado no carrinho.', 'ITEM_NOT_FOUND', 404)
    }

    return tx.cartItem.update({ where: { id: existingItem.id }, data: { quantity } })
  })
}

export async function removeFromCart(userID: string, lojaID: string, variantID: string) {
  return prisma.$transaction(async (tx) => {
    await lockUserCart(tx, userID, lojaID)
    const cart = await getActiveCart(tx, userID)
    const existingItem = await tx.cartItem.findFirst({
      where: { cartID: cart.id, variantID },
      include: { product: { select: { lojaID: true } } },
    })
    if (!existingItem || existingItem.product.lojaID !== lojaID) {
      throw new CartError('Item não encontrado no carrinho.', 'ITEM_NOT_FOUND', 404)
    }
    return tx.cartItem.delete({ where: { id: existingItem.id } })
  })
}

/**
 * Conclui exatamente o carrinho ligado ao pedido. Sobras adicionadas enquanto o
 * gateway processava são copiadas para um novo carrinho ativo. O status do
 * carrinho de origem funciona como marcador idempotente para retries.
 */
export async function completeCheckoutCart(orderID: string, userID: string, lojaID: string) {
  return prisma.$transaction(async (tx) => {
    await lockUserCart(tx, userID, lojaID)

    const order = await tx.order.findFirst({
      where: { id: orderID, userID, lojaID },
      select: {
        sourceCartID: true,
        items: { select: { productVariantsId: true, quantity: true } },
      },
    })
    if (!order) {
      throw new CartError(
        'Pedido ou carrinho de origem não encontrado.',
        'CHECKOUT_CART_NOT_FOUND',
        404
      )
    }
    if (!order.sourceCartID) return null

    const sourceCart = await tx.cart.findFirst({
      where: { id: order.sourceCartID, userID },
      include: {
        items: { include: { product: { select: { lojaID: true } } } },
      },
    })
    if (!sourceCart || sourceCart.items.some((item) => item.product.lojaID !== lojaID)) {
      throw new CartError(
        'Carrinho de origem incompatível com o usuário ou a loja.',
        'CHECKOUT_CART_NOT_FOUND',
        404
      )
    }
    if (sourceCart.status === 'COMPLETED') return null
    if (sourceCart.status !== 'ACTIVE') {
      throw new CartError(
        'O carrinho de origem não pode ser concluído neste estado.',
        'CHECKOUT_CART_STATE_CONFLICT',
        409
      )
    }

    const purchasedByVariant = new Map<string, number>()
    for (const item of order.items) {
      if (!item.productVariantsId) {
        throw new CartError(
          'O pedido não preservou a variante necessária para reconciliar o carrinho.',
          'CHECKOUT_CART_STATE_CONFLICT',
          409
        )
      }
      purchasedByVariant.set(
        item.productVariantsId,
        (purchasedByVariant.get(item.productVariantsId) ?? 0) + item.quantity
      )
    }

    const remainingItems = sourceCart.items.flatMap((item) => {
      const remainingQuantity = item.quantity - (purchasedByVariant.get(item.variantID) ?? 0)
      if (remainingQuantity <= 0) return []
      return [{
        productID: item.productID,
        variantID: item.variantID,
        quantity: remainingQuantity,
        productName: item.productName,
        price: item.price,
        color: item.color,
        size: item.size,
        imageUrl: item.imageUrl,
      }]
    })

    const nextCart = remainingItems.length > 0
      ? await tx.cart.create({
          data: {
            userID,
            status: 'ACTIVE',
            items: { create: remainingItems },
          },
        })
      : null

    await tx.cart.update({
      where: { id: sourceCart.id },
      data: { status: 'COMPLETED' },
    })

    return nextCart
  })
}
