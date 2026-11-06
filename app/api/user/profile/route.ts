import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import prisma from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validators/customer.validators";
import { updateUserProfile } from "@/services/customer.service";
import { ok, err } from "@/lib/api-response";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return err("Não autorizado", 401, "UNAUTHORIZED");
  }

  let address = null;
  try {
    const foundAddress = await prisma.address.findFirst({
      where: { userID: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        cep: true,
        state: true,
        city: true,
        district: true,
        street: true,
        number: true,
        complement: true,
      },
    });
    if (foundAddress) {
      address = {
        cep: foundAddress.cep,
        state: foundAddress.state,
        city: foundAddress.city,
        neighborhood: foundAddress.district,
        street: foundAddress.street,
        number: foundAddress.number,
        complement: foundAddress.complement,
      };
    }
  } catch {}

  return ok({
    ...user,
    address,
  });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return err("Não autorizado", 401, "UNAUTHORIZED");
  }

  try {
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return err(errorMsg, 400, "VALIDATION_ERROR");
    }

    const updated = await updateUserProfile({
      userId: user.id,
      lojaID: user.lojaID,
      name: parsed.data.name,
      phone: parsed.data.phone,
      cpfCnpj: parsed.data.cpfCnpj,
    });

    revalidatePath("/profile");

    return ok(updated);
  } catch (error: any) {
    if (error?.message === "USER_NOT_FOUND") {
      return err("Usuário não encontrado", 404, "NOT_FOUND");
    }
    if (error?.message === "INVALID_CPF_CNPJ") {
      return err("CPF ou CNPJ inválido", 400, "INVALID_CPF_CNPJ");
    }
    if (error?.message === "CPF_ALREADY_IN_USE") {
      return err("Este CPF/CNPJ já está cadastrado em outra conta.", 409, "CPF_CONFLICT");
    }

    logger.error("Erro ao atualizar perfil do usuário", error, {
      action: "USER_PROFILE_PUT",
      userId: user.id,
      tenantId: user.lojaID,
    });
    return err("Erro ao atualizar perfil", 500, "INTERNAL_ERROR");
  }
}
