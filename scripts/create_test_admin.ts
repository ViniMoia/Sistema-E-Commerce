import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const lojas = await prisma.loja.findMany();
  console.log("Lojas encontradas:", lojas.map(l => ({ id: l.id, name: l.name, slug: l.slug })));

  if (lojas.length === 0) {
    throw new Error("Nenhuma loja encontrada no banco de dados.");
  }

  const activeLoja = lojas[0];

  const adminEmail = "dev.admin@continental.com.br";
  const rawPassword = "DevAdmin@2026#Continental";
  const adminName = "Desenvolvedor Admin Teste";

  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const existing = await prisma.user.findFirst({
    where: {
      email: adminEmail,
      lojaID: activeLoja.id,
    },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        status: "ACTIVE",
        password: hashedPassword,
        name: adminName,
      },
    });
    console.log("Conta admin atualizada com sucesso:", {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      loja: activeLoja.name,
    });
  } else {
    const created = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
        status: "ACTIVE",
        lojaID: activeLoja.id,
      },
    });
    console.log("Conta admin criada com sucesso:", {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      loja: activeLoja.name,
    });
  }

  console.log("SUCCESS_CREATION");
  console.log(`EMAIL=${adminEmail}`);
  console.log(`PASSWORD=${rawPassword}`);
}

main()
  .catch((e) => {
    console.error("Erro ao criar conta admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
