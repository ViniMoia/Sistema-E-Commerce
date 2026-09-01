import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { freightOrchestrator } from "@/services/freight";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lojaID, destinationCep, items } = body;

    if (!lojaID || !destinationCep) {
      return NextResponse.json(
        { success: false, error: "lojaID e destinationCep são obrigatórios" },
        { status: 400 }
      );
    }

    const result = await freightOrchestrator.calculate({
      lojaID,
      destinationCep,
      items: items || [],
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    console.error("[FREIGHT_PUBLIC_API_POST]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
