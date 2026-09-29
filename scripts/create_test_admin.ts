import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

async function main() {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("Bootstrap administrativo desabilitado. Defina ALLOW_ADMIN_BOOTSTRAP=true explicitamente.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Este bootstrap local não pode ser executado em produção.");
  }

  const lojaID = requiredEnvironmentVariable("BOOTSTRAP_LOJA_ID");
  const adminEmail = requiredEnvironmentVariable("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const rawPassword = requiredEnvironmentVariable("BOOTSTRAP_ADMIN_PASSWORD");
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Administrador local";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL inválido.");
  }
  if (rawPassword.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
  }

  const loja = await prisma.loja.findUnique({
    where: { id: lojaID },
    select: { id: true },
  });
  if (!loja) throw new Error("Loja informada não existe.");

  const existing = await prisma.user.findUnique({
    where: { email_lojaID: { email: adminEmail, lojaID } },
    select: { id: true },
  });
  if (existing) {
    throw new Error("A conta informada já existe; o bootstrap se recusa a alterar senha, status ou papel.");
  }

  const created = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: await bcrypt.hash(rawPassword, 12),
      role: "ADMIN",
      status: "ACTIVE",
      lojaID,
    },
    select: { id: true, lojaID: true, role: true },
  });

  // Não registrar e-mail nem senha. O operador já os forneceu por canal local.
  console.log("Bootstrap administrativo concluído.", created);
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Falha desconhecida no bootstrap administrativo.";
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
