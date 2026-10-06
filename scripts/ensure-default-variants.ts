import prisma from "../lib/prisma";

async function main() {
  console.log("Iniciando verificação de produtos sem variantes...");

  const productsWithoutVariants = await prisma.product.findMany({
    where: {
      productVariants: {
        none: {},
      },
    },
    select: {
      id: true,
      name: true,
      stock: true,
    },
  });

  console.log(`Encontrados ${productsWithoutVariants.length} produtos sem variantes.`);

  if (productsWithoutVariants.length === 0) {
    console.log("Todos os produtos já possuem ao menos uma variante.");
    return;
  }

  console.log(productsWithoutVariants.map(({ id }) => id));
  console.log("Auditoria somente leitura. Criação automática desativada: saneamento exige backup, auditoria dos vínculos e plano de manutenção WF-18.");
}

main()
  .catch((e) => {
    console.error("Erro na migração de variantes padrão:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
