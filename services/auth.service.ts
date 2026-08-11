import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { LoginInput } from "@/lib/validators/auth";

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatarImageUrl?: string;
  lojaID: string;
  address: {
    cep: string;
    state: string;
    city: string;
    district: string;
    street: string;
    number: string;
    complement?: string;
  };
}) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email_lojaID: {
        email: data.email,
        lojaID: data.lojaID,
      },
    },
  });

  if (existingUser) {
    throw new Error("Email já existente");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  // Garantir que a Loja exista para evitar erro de Foreign Key constraint (P2003)
  let loja = await prisma.loja.findUnique({ where: { id: data.lojaID } });
  if (!loja) {
    // Se a loja passada não existir, procura a primeira ou cria uma mock para desenvolvimento
    loja = await prisma.loja.findFirst();
    if (!loja) {
      loja = await prisma.loja.create({
        data: {
          id: data.lojaID,
          name: "Loja Padrão",
          slug: "loja-padrao",
          description: "Loja Padrão",
          coverImageUrl: "https://via.placeholder.com/150",
        },
      });
    }
  }

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      phone: data.phone,
      lojaID: loja.id,

      addresses: {
        create: {
          ...data.address,
        },
      },
    },
    include: {
      addresses: true,
    },
  });

  const defaultAddress = user.addresses[0];

  await prisma.user.update({
    where: { id: user.id },
    data: {
      defaultAddressId: defaultAddress.id,
    },
  });

  return user;
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
      email: true,
      password: true,
      status: true,
    },
  });

  // 3. Mitigação de enumeração de usuário
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

  // 6. Retorno mínimo (NUNCA retornar password)
  return {
    id: user.id,
    email: user.email,
  };
}
