import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { LoginInput } from "@/lib/validators/auth";
import { sanitizeUser, SafeUserDTO } from "@/lib/utils/dto-sanitizer";
import { cleanDigits } from "@/lib/validators/cpf-cnpj";
import { createHash, randomBytes } from "crypto";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("dummy-password-for-timing-only", 10);

function hashRecoveryToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  cpfCnpj?: string;
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
      cpfCnpj: data.cpfCnpj ? cleanDigits(data.cpfCnpj) : null,
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

  if (user.addresses && user.addresses.length > 0) {
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

  // Uma comparação bcrypt válida ocorre para todos os resultados e a resposta
  // não distingue conta inexistente, bloqueada, pendente ou senha incorreta.
  const isValidPassword = await bcrypt.compare(password, user?.password || DUMMY_PASSWORD_HASH);
  if (!user || user.status !== "ACTIVE" || !isValidPassword) {
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

export async function requestPasswordReset(data: {
  email: string;
  lojaID: string;
  originUrl: string;
}): Promise<{ success: boolean }> {
  const normalizedEmail = data.email.toLowerCase().trim();

  // 1. Busca usuário delimitado pelo tenant da loja ativa
  const user = await prisma.user.findUnique({
    where: {
      email_lojaID: {
        email: normalizedEmail,
        lojaID: data.lojaID,
      },
    },
    include: {
      loja: true,
    },
  });

  // 2. Defesa Anti-Enumeração (OWASP ASVS / CWE-640)
  // Se o usuário não existir nesta loja, simula pequena latência e retorna sucesso indistinguível.
  if (!user || user.status === "BLOCKED") {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { success: true };
  }

  // 3. Geração de Token Criptograficamente Seguro (CSPRNG com 256 bits de entropia)
  const resetToken = randomBytes(32).toString("hex");
  const resetTokenHash = hashRecoveryToken(resetToken);
  // 4. Expiração rígida de 1 hora
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

  // 5. Atualização atômica no banco de dados
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: resetTokenHash,
      resetTokenExpires,
    },
  });

  // 6. Montagem da URL de redefinição
  let configuredOrigin: URL;
  try {
    configuredOrigin = new URL(data.originUrl);
  } catch {
    throw new AuthError("Origem canônica inválida para recuperação de senha.");
  }
  const isLocalDevelopment =
    process.env.NODE_ENV !== "production" &&
    configuredOrigin.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(configuredOrigin.hostname);
  if (configuredOrigin.protocol !== "https:" && !isLocalDevelopment) {
    throw new AuthError("Origem canônica inválida para recuperação de senha.");
  }
  const resetUrl = `${configuredOrigin.origin}/reset-password?token=${resetToken}`;

  // 7. Envio do e-mail transacional
  const { emailService } = await import("@/lib/email");
  await emailService.sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    storeName: user.loja?.name || "Continental",
  });

  return { success: true };
}

export async function resetPassword(data: {
  token: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const { token, newPassword } = data;

  if (!token || typeof token !== "string" || token.trim().length < 10) {
    throw new AuthError("Token de recuperação inválido ou inexistente.");
  }

  if (!newPassword || newPassword.length < 8) {
    throw new AuthError("A nova senha deve ter no mínimo 8 caracteres.");
  }

  const normalizedToken = token.trim();
  const resetTokenHash = hashRecoveryToken(normalizedToken);

  // 1. Localiza usuário com token válido e não expirado
  const user = await prisma.user.findFirst({
    where: {
      resetToken: resetTokenHash,
      resetTokenExpires: {
        gt: new Date(),
      },
      status: "ACTIVE",
    },
  });

  if (!user) {
    throw new AuthError("Token de recuperação inválido ou expirado.");
  }

  // 2. Gera novo hash com salt 10
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 3. Atualização atômica (transação): redefine senha, invalida token e revoga sessões antigas
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.user.updateMany({
      where: {
        id: user.id,
        resetToken: resetTokenHash,
        resetTokenExpires: { gt: new Date() },
        status: "ACTIVE",
      },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
    if (consumed.count !== 1) {
      throw new AuthError("Token de recuperação inválido ou expirado.");
    }

    // Revoga todas as sessões anteriores para proteção contra hijacking
    await tx.session.deleteMany({
      where: { userId: user.id },
    });
  });

  return {
    success: true,
    message: "Senha redefinida com sucesso. Você já pode fazer login com sua nova senha.",
  };
}

