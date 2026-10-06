import { createRequire } from "node:module";
import { PRODUCT_ID } from "./lib/repair-product-variants.mjs";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const normalize = (s) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function audit() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, productVariants: {
      include: { _count: { select: { cartItem: true, orderItems: true } } },
    } },
  });
  const duplicates = products.filter((p) => new Set(p.productVariants.map(
    (v) => JSON.stringify([normalize(v.size), normalize(v.color)])
  )).size < p.productVariants.length);
  return {
    productCount: products.length,
    duplicateProductCount: duplicates.length,
    productsWithoutVariants: products.filter((p) => !p.productVariants.length).length,
    duplicates,
    affected: products.find((p) => p.id === PRODUCT_ID),
  };
}

try {
  console.log(JSON.stringify({ before: await audit() }, null, 2));
  if (apply) {
    throw new Error("Aplicação do saneamento legado desativada: o procedimento não trata revisões, retiradas e reservas. WF-18 deve validar backup e manutenção antes de reabilitá-lo.");
  } else {
    console.log("Auditoria somente leitura. Saneamento legado permanece bloqueado até WF-18.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha no saneamento.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
