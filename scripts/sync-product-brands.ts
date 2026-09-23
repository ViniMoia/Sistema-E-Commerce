import prisma from "../lib/prisma";

const BRAND_RULES: Record<string, RegExp> = {
  autoamerica:
    /\b(AUTOAMERICA|AUTO AMERICA|AUTO ESPELHAMENTO|TRIPLE PASTE|HIGH SHINE|FOAM GLOSS|GOLD DUSTER|FAST CUT|AMERICA)\b/i,
  cadillac:
    /\b(CADILLAC|CADMIX|MONSTER CARNAUBA|BLACK MAGIC|HARD WAX|IRONLAC|ROX|MOTORLAC)\b/i,
  easytech:
    /\b(EASYTECH|EASY TECH|INSIGNIA|PLASTI COAT|QUARTZ 9H|FLOAT|ZAP|MELT|PLURI|BACTRON|BACTRAN)\b/i,
  ipc:
    /\b(IPC|ECOCLEAN|CARPET|LAVADORA DE ESTOFADOS|PW C22P|SANITIZADORA)\b/i,
  karcher:
    /\b(KARCHER|KÄRCHER|HD 585|K2|K3|K4|K5)\b/i,
  kers:
    /\b(KERS|POLITRIZ KERS|RED SHINE|PWR|NANO HÍBRIDA)\b/i,
  lincoln:
    /\b(LINCOLN|POLIDOR LINCOLN|BOINA LINCOLN|BRAZUCA|BOINA DE LÃ|MEGA POLIDOR|SUPER POLIDOR|DUPLA FACE|HI-GLOSS|LISTRAS VERDES)\b/i,
  meguiars:
    /\b(MEGUIAR|MEGUIARS|MEGUIAR\'S|GOLD CLASS|QUICK DETAILER MEGUIAR|ULTIMATE COMP)\b/i,
  nasiol:
    /\b(NASIOL|ZR53|METALCOAT)\b/i,
  nobrecar:
    /\b(NOBRECAR|NOBRE CAR|S7 CLEANER|S-7|X-CAM|OFF LEATHER|TOP FINISH|ULTRA LUSTRO)\b/i,
  protelim:
    /\b(PROTELIM|PROT CAR|MAGIC FLUID|PROTWASH|OXICLENE)\b/i,
  sandet:
    /\b(SANDET|METALSIL|SANVO)\b/i,
  "sigma-tools":
    /\b(SIGMA TOOLS|SIGMA|SGT|SGT-|ROTO ORBITAL SGT|PNEUMATICA)\b/i,
  soft99:
    /\b(SOFT99|SOFT 99|GLACO|FUSSO|KING OF GLOSS|DARK & BLACK|KIWAMI|IRON TERMINATOR|REIN HADA|TIRE BLACK)\b/i,
  sonax:
    /\b(SONAX|PROFILINE|CERAMIC SPRAY)\b/i,
  vonixx:
    /\b(VONIXX|ROOTZ|SINTRA|BLEND|NATIVE|DELET|ALUMAX|PRISMA|PRIZM|V-PLASTIC|V-LIGHT|V-PAINT|V-ENERGY|VERONA|V-FLOC|V-ECO|VEXUS|REVOX|CITRON|CARNAUBA EXPRESS|VINTEX|MAKKER|ACIDUS)\b/i,
  wap:
    /\b(WAP)\b/i,
  zacs:
    /\b(ZACS|D-CLEAN|D-RET|DISOLV)\b/i,
};

async function main() {
  console.log("=== SINCRONIZAÇÃO RELACIONAL DE MARCAS E PRODUTOS ===");

  const lojas = await prisma.loja.findMany();
  if (lojas.length === 0) {
    console.error("Nenhuma loja cadastrada encontrada.");
    return;
  }

  for (const loja of lojas) {
    console.log(`\nProcessando Loja: ${loja.name} (${loja.id})`);

    const brands = await prisma.brand.findMany({
      where: { lojaID: loja.id },
      select: { id: true, slug: true, name: true },
    });

    const brandMap = new Map<string, { id: string; name: string }>();
    for (const b of brands) {
      brandMap.set(b.slug, { id: b.id, name: b.name });
    }

    const products = await prisma.product.findMany({
      where: { lojaID: loja.id },
      select: { id: true, name: true, description: true, brandID: true },
    });

    console.log(`Analisando ${products.length} produtos da loja...`);

    let updatedCount = 0;
    const brandCounts: Record<string, number> = {};

    for (const product of products) {
      const text = `${product.name} ${product.description || ""}`;

      let matchedBrandSlug: string | null = null;
      for (const [slug, regex] of Object.entries(BRAND_RULES)) {
        if (regex.test(text)) {
          matchedBrandSlug = slug;
          break;
        }
      }

      if (matchedBrandSlug && brandMap.has(matchedBrandSlug)) {
        const brandInfo = brandMap.get(matchedBrandSlug)!;
        brandCounts[brandInfo.name] = (brandCounts[brandInfo.name] || 0) + 1;

        if (product.brandID !== brandInfo.id) {
          await prisma.product.update({
            where: { id: product.id },
            data: { brandID: brandInfo.id },
          });
          updatedCount++;
        }
      }
    }

    console.log(`✓ Produtos atualizados com novo brandID: ${updatedCount}`);
    console.log("\nDistribuição de produtos vinculados por marca no banco:");
    for (const [brandName, count] of Object.entries(brandCounts)) {
      console.log(`  - ${brandName}: ${count} produtos`);
    }
  }

  console.log("\nSincronização concluída com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro na sincronização de marcas:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
