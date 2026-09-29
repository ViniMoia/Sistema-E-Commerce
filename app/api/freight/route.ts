import { logger } from '@/lib/logger'
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getLojaFromHeaders } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lojaID = searchParams.get("lojaID");
    const cityName = searchParams.get("cityName");

    const tenant = await getLojaFromHeaders();
    if (!tenant || (lojaID && lojaID !== tenant.id)) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    if (!cityName || cityName.length > 100) {
      return NextResponse.json(
        { error: "lojaID e cityName são obrigatórios" },
        { status: 400 }
      );
    }

    const rule = await prisma.freightRule.findFirst({
      where: {
        lojaID: tenant.id,
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
    logger.error("[FREIGHT_PUBLIC_API_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { success: false, error: "Endpoint substituído por /api/freight/calculate." },
    { status: 410 }
  );
}
