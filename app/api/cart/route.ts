import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import * as cartService from "@/services/cart.service";
import { z } from "zod";
import { logger } from "@/lib/logger";

const addToCartSchema = z.object({
  productID: z.string().uuid("ID do produto inválido"),
  variantID: z.string().uuid("ID da variação inválido").optional().nullable(),
  quantity: z.number().int().min(1, "Quantidade mínima é 1").max(99, "Quantidade máxima é 99"),
});

const updateCartSchema = z.object({
  variantID: z.string().uuid("ID da variação inválido"),
  quantity: z.number().int().min(1, "Quantidade mínima é 1").max(99, "Quantidade máxima é 99"),
});

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const cart = await cartService.getCart(auth.user.id);
    return NextResponse.json(cart || { items: [] }, { status: 200 });
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

    const body = await req.json().catch(() => null);
    const parsed = addToCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await cartService.addToCart(auth.user.id, parsed.data);
    const cart = await cartService.getCart(auth.user.id);
    return NextResponse.json(cart || { items: [] }, { status: 201 });
  } catch (error: any) {
    logger.error("Erro ao adicionar item ao carrinho", error, {
      action: "CART_POST_ERROR",
    });
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null);
    const parsed = updateCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await cartService.updateCartItemQuantity(
      auth.user.id,
      parsed.data.variantID,
      parsed.data.quantity
    );

    const cart = await cartService.getCart(auth.user.id);
    return NextResponse.json(cart || { items: [] }, { status: 200 });
  } catch (error: any) {
    logger.error("Erro ao atualizar quantidade no carrinho", error, {
      action: "CART_PATCH_ERROR",
    });
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    let variantID = searchParams.get("variantID");

    if (!variantID) {
      const body = await req.json().catch(() => null);
      if (body?.variantID) {
        variantID = body.variantID;
      }
    }

    if (!variantID) {
      return NextResponse.json({ error: "variantID is required" }, { status: 400 });
    }

    await cartService.removeFromCart(auth.user.id, variantID);
    const cart = await cartService.getCart(auth.user.id);
    return NextResponse.json(cart || { items: [] }, { status: 200 });
  } catch (error: any) {
    logger.error("Erro ao remover item do carrinho", error, {
      action: "CART_DELETE_ERROR",
    });
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
