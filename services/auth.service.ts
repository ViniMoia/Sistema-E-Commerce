import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { LoginInput } from "@/lib/validators/auth";
import { sanitizeUser, SafeUserDTO } from "@/lib/utils/dto-sanitizer";

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatarImageUrl?: string;
  lojaID: string;
  address?: {
    cep: string;
    state: string;
    city: string;
    district: string;
    street: string;
    number: string;
    complement?: string;
  };
}): Promise<SafeUserDTO> {
  const normalizedEmail = data.email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: {
      email_lojaID: {
        email: normalizedEmail,
        lojaID: data.lojaID,
      },
    },
  });

  if (existingUser) {
    throw new Error("Email já existente para esta loja");
  }

  const loja = await prisma.loja.findUnique({ where: { id: data.lojaID } });
  if (!loja) {
    throw new Error("Loja não encontrada");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: normalizedEmail,
      password: hashedPassword,
      phone: data.phone,
      lojaID: loja.id,
      role: "CUSTOMER",
      status: "ACTIVE",
      ...(data.address
        ? {
            addresses: {
              create: {
                ...data.address,
              },
            },
          }
        : {}),
    },
    include: {
      addresses: true,
    },
  });

  if (user.addresses.length > 0) {
    const defaultAddress = user.addresses[0];
    await prisma.user.update({
      where: { id: user.id },
      data: {
        defaultAddressId: defaultAddress.id,
      },
    });
  }

  return sanitizeUser(user);
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function loginUser(data: LoginInput & { lojaID: string }) {
  const { email, password, lojaID } = data;

  // 1. Normalização
  const normalizedEmail = email.toLowerCase().trim();

  // 2. Buscar usuário pela chave composta
  const user = await prisma.user.findUnique({
    where: {
      email_lojaID: {
        email: normalizedEmail,
        lojaID,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      role: true,
      status: true,
      lojaID: true,
    },
  });

  // 3. Mitigação de enumeração de usuário (tempo constante para usuário inexistente)
  if (!user) {
    await bcrypt.compare(password, "$2b$10$invalidhashforsimulationlongenough");
    throw new AuthError("Credenciais inválidas");
  }

  // 4. Regras de negócio
  if (user.status === "BLOCKED") {
    throw new AuthError("Usuário bloqueado");
  }

  // 5. Comparação segura de senha
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    throw new AuthError("Credenciais inválidas");
  }

  // 6. Retorno sanitizado (NUNCA retornar password)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    lojaID: user.lojaID,
  };
}
