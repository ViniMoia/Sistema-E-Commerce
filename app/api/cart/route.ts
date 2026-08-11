import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import * as cartService from "@/services/cart.service";
import { z } from "zod";

const addToCartSchema = z.object({
  productID: z.string(),
  variantID: z.string(),
  quantity: z.number().int().min(1).max(99),
});

const updateCartSchema = z.object({
  variantID: z.string(),
  quantity: z.number().int().min(1).max(99),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cart = await cartService.getCart(user.id);
    return NextResponse.json(cart || { items: [] }, { status: 200 });
  } catch (error) {
    console.error("[CART_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = addToCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await cartService.addToCart(user.id, parsed.data);
    const cart = await cartService.getCart(user.id);
    return NextResponse.json(cart || { items: [] }, { status: 201 });
  } catch (error: any) {
    console.error("[CART_POST_ERROR]", error);
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await cartService.updateCartItemQuantity(
      user.id,
      parsed.data.variantID,
      parsed.data.quantity
    );

    const cart = await cartService.getCart(user.id);
    return NextResponse.json(cart || { items: [] }, { status: 200 });
  } catch (error: any) {
    console.error("[CART_PATCH_ERROR]", error);
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Attempt to extract variantID from URL params or body
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

    await cartService.removeFromCart(user.id, variantID);
    const cart = await cartService.getCart(user.id);
    return NextResponse.json(cart || { items: [] }, { status: 200 });
  } catch (error: any) {
    console.error("[CART_DELETE_ERROR]", error);
    if (error instanceof cartService.CartError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
