import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lojaID = searchParams.get("lojaID");
    const cityName = searchParams.get("cityName");

    if (!lojaID || !cityName) {
      return NextResponse.json(
        { error: "lojaID e cityName são obrigatórios" },
        { status: 400 }
      );
    }

    const rule = await prisma.freightRule.findFirst({
      where: {
        lojaID,
        cityName: {
          equals: cityName,
          mode: "insensitive"
        }
      }
    });

    if (!rule) {
      return NextResponse.json({ value: null }, { status: 200 });
    }

    const value = (rule.value as Prisma.Decimal).toNumber();
    return NextResponse.json({ value }, { status: 200 });
  } catch (error) {
    console.error("[FREIGHT_PUBLIC_API_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
