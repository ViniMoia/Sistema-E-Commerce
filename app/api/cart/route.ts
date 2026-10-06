import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import * as cartService from "@/services/cart.service";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getLojaFromHeaders } from '@/lib/tenant';
import { cartMutationSchema, cartAbsoluteMutationSchema } from '@/lib/commerce/cart-command';

async function cartTenant(user: { lojaID: string }) {
  const tenant = await getLojaFromHeaders();
  if (!tenant) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
  if (tenant.id !== user.lojaID) return NextResponse.json({ error: 'Sessão não autorizada para esta loja.' }, { status: 403 });
  return tenant.id;
}

const addToCartSchema = z.object({
  productID: z.string().uuid("ID do produto inválido"),
  variantID: z.string().uuid("ID da variação inválido").optional().nullable(),
  quantity: z.number().int().min(1, "Quantidade mínima é 1").max(99, "Quantidade máxima é 99"),
}).merge(cartMutationSchema);

const updateCartSchema = z.object({
  variantID: z.string().uuid("ID da variação inválido"),
  quantity: z.number().int().min(1, "Quantidade mínima é 1").max(99, "Quantidade máxima é 99"),
}).merge(cartAbsoluteMutationSchema);
const deleteCartSchema = cartAbsoluteMutationSchema.extend({ variantID: z.string().uuid('ID da variação inválido') });

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const lojaID = await cartTenant(auth.user);
    if (lojaID instanceof NextResponse) return lojaID;

    const cart = await cartService.getCart(auth.user.id, lojaID);
    return NextResponse.json(cart || { id: null, version: null, items: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("Erro ao obter carrinho do usuário", error, {
      action: "CART_GET_ERROR",
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const lojaID = await cartTenant(auth.user);
    if (lojaID instanceof NextResponse) return lojaID;

    const body = await req.json().catch(() => null);
    const parsed = addToCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const cart = await cartService.addToCart(auth.user.id, parsed.data, lojaID);
    return NextResponse.json(cart, { status: cart.replay ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    logger.error("Erro ao adicionar item ao carrinho", error, {
      action: "CART_POST_ERROR",
    });
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'CONFLICT' ? 409 : 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const lojaID = await cartTenant(auth.user);
    if (lojaID instanceof NextResponse) return lojaID;

    const body = await req.json().catch(() => null);
    const parsed = updateCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const cart = await cartService.updateCartItemQuantity(
      auth.user.id,
      parsed.data.variantID,
      parsed.data.quantity,
      lojaID,
      { commandId: parsed.data.commandId, cartId: parsed.data.cartId, expectedVersion: parsed.data.expectedVersion }
    );

    return NextResponse.json(cart, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    logger.error("Erro ao atualizar quantidade no carrinho", error, {
      action: "CART_PATCH_ERROR",
    });
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'CONFLICT' ? 409 : 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const lojaID = await cartTenant(auth.user);
    if (lojaID instanceof NextResponse) return lojaID;

    const { searchParams } = new URL(req.url);
    const body = searchParams.has('variantID') ? {
      ...Object.fromEntries(searchParams.entries()),
      expectedVersion: /^\d+$/.test(searchParams.get('expectedVersion') ?? '') ? Number(searchParams.get('expectedVersion')) : Number.NaN,
    } : await req.json().catch(() => null);
    const parsed = deleteCartSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    const { variantID, ...mutation } = parsed.data;
    const cart = await cartService.removeFromCart(auth.user.id, variantID, lojaID, mutation);
    return NextResponse.json(cart, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    logger.error("Erro ao remover item do carrinho", error, {
      action: "CART_DELETE_ERROR",
    });
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'CONFLICT' ? 409 : 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
