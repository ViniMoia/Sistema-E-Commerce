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

  let createdCount = 0;
  // Criar em lotes para performance
  const batchSize = 50;
  for (let i = 0; i < productsWithoutVariants.length; i += batchSize) {
    const batch = productsWithoutVariants.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((prod) =>
        prisma.productVariants.create({
          data: {
            ProductID: prod.id,
            size: "Único",
            color: "Padrão",
            stock: prod.stock >= 0 ? prod.stock : 0,
          },
        })
      )
    );
    createdCount += batch.length;
    console.log(`Progresso: ${createdCount} / ${productsWithoutVariants.length} variantes criadas.`);
  }

  console.log("Migração concluída com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro na migração de variantes padrão:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
