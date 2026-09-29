import { logger } from '@/lib/logger';
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { setDefaultAddress } from "@/services/address.service";

const setDefaultAddressSchema = z.object({
  addressId: z.string().min(1, "ID do endereço é obrigatório"),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => null);
    const parsed = setDefaultAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // IDOR Mitigation (SEC-003): Usa estritamente o userId da sessão autorizada do servidor
    const updatedUser = await setDefaultAddress(auth.user.id, parsed.data.addressId);

    return NextResponse.json(
      {
        message: "Endereço padrão atualizado com sucesso",
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error('Default address update failed', error, { action: 'SET_DEFAULT_ADDRESS_ERROR' });
    const denied = error instanceof Error && error.message === 'Endereço não encontrado ou acesso não autorizado';
    return NextResponse.json(
      { error: denied ? "Endereço não encontrado ou acesso não autorizado" : "Erro ao definir endereço padrão" },
      { status: denied ? 400 : 500 }
    );
  }
}
