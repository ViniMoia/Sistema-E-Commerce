import prisma from "../lib/prisma";

const TAG_ENHANCED_REGEX: Record<string, RegExp> = {
  acessorios:
    /\b(APLICADOR|ESCOVA|PINCEL|MICROFIBRA|PULVERIZADOR|BORRIFADOR|SNOW FOAM|ADAPTADOR|FITA|LUVAS|ESPONJA|BALDE|GRELHA|PANO|CONECTOR|MANGUEIRA|ENGATE|BICO|CARRINHO|BANQUETA|BOQUILHA|SUPORTE|LANCETA|GATILHO|CANHAO|MEDIDOR|TOALHA|FITA CREPE|FRASCO|DILUIDOR|DISCO|PULVERIZACAO|PULVERIZADORA)\b/i,
  aspiradores:
    /\b(ASPIRADOR|ECOCLEAN|LITE 1200W|PO E AGUA|ASPIRACAO|BOCAL PARA ASPIRADOR)\b/i,
  boinas:
    /\b(BOINA|CORTE|REFINO|LUSTRO|ESPUMA|LÃ|INTERFACE|HEX|PIRAMIDAL|PRATO)\b/i,
  "ceras-e-selantes":
    /\b(CERA|SELANTE|GRAFENO|VITRIFICADOR|SIO2|COATING|ROOTZ|BLEND|NATIVE|CARNAUBA|GLAZE|PROTECAO CERAMICA|V-PAINT|PLASTICOAT|INSIGNIA|DIMENSION|CRISTALIZADOR|REVITALIZADOR|PROTECAO PINTURA|TITANIUM)\b/i,
  "cheirinho-para-carro":
    /\b(AROMATIZANTE|CHEIRINHO|ODORIZADOR|SPRAY OLFATIVO|FRAGRANCIA|ESSENCIA|PERFUME|LITTLE TREES|HOT ROD|CENTRAL SUL)\b/i,
  compressor:
    /\b(COMPRESSOR|PNEUMATICO|MANGUEIRA AR|CALIBRADOR|TORNADOR)\b/i,
  externo:
    /\b(PNEUS|PNEU|RODAS|RODA|LATARIA|VIDROS|VIDRO|CHASSI|MOTOR|ALUMAX|DESINCRUSTANTE|ACIDO|SHAMPOO|LAVA AUTOS|VERNIZ DE MOTOR|RESTAURADOR DE PLASTICOS|V-PLASTIC|DELET|D-RET|ACIDUS|AC2-PRO|ACID PRO|VEXUS|VINTRIX|VIDRY|ZMOL|BLACK MAGIC|BOLD|CLAYBAR|BARRA DESCONTAMINANTE|DESCONTAMINANTE|DESENGRAXANTE|PRETEADOR|REMOV|PICHE|ALCALINO|FERROSO|DESOXIDANTE|CHAMPION|DEMOLIDOR|PRISMA|CHUVA ACIDA|EMBLEMA|GRADE)\b/i,
  extratoras:
    /\b(EXTRATORA|LAVADORA DE ESTOFADOS|IPC CARPET|SANITIZADORA|LAVA ESTOFADOS|BOCAL EXTRATORA)\b/i,
  interno:
    /\b(COURO|PAINEL|PLASTICOS INTERNOS|ESTOFADOS|ESTOFADO|HIGIENIZADOR|APC|SINTRA|BACTRON|BACTRAN|FLOAT|PLURI|ARPUR|CLEAN-CAP|CLEAN-DEX|VERTEX|VERSE|DRESS|DISOLV|D-CLEAN|TECIDO|TECIDOS|CARPETE|TETO|ODOR)\b/i,
  "kit-de-produtos":
    /\b(KIT|COMBO|TRIO|CONJUNTO|PCT|PACK|JOGO|DUPLA)\b/i,
};

async function main() {
  console.log("Iniciando Etapa 1: Reformulação de Etiquetas e Enriquecimento Semântico no DB...");

  // 1. Remover tag fantasma AIRLESS da tabela CategoryTag se existir
  const deletedAirless = await prisma.categoryTag.deleteMany({
    where: { slug: "airless" },
  });
  console.log(`Tag 'airless' removida da tabela CategoryTag (${deletedAirless.count} registro deletado).`);

  // 2. Buscar todas as CategoryTags ativas restantes
  const activeCategoryTags = await prisma.categoryTag.findMany();
  const categoryTagMap = new Map<string, string>();
  activeCategoryTags.forEach((ct) => categoryTagMap.set(ct.slug, ct.id));

  // 3. Buscar todos os produtos
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, description: true },
  });

  console.log(`Processando categorização semântica para ${allProducts.length} produtos...`);

  let updatedCount = 0;
  const tagCounts: Record<string, number> = {};

  for (const product of allProducts) {
    const text = `${product.name} ${product.description || ""}`;
    const matchedTagSlugs: string[] = [];

    for (const [slug, regex] of Object.entries(TAG_ENHANCED_REGEX)) {
      if (regex.test(text)) {
        matchedTagSlugs.push(slug);
        tagCounts[slug] = (tagCounts[slug] || 0) + 1;
      }
    }

    // Atualizar tagsSearchCache no Produto
    await prisma.product.update({
      where: { id: product.id },
      data: {
        tagsSearchCache: matchedTagSlugs,
      },
    });

    // Limpar vínculos antigos e criar novos vínculos relacionais na tabela associativa
    await prisma.productCategoryTag.deleteMany({
      where: { productID: product.id },
    });

    const relationsToCreate = matchedTagSlugs
      .map((slug) => categoryTagMap.get(slug))
      .filter((id): id is string => Boolean(id))
      .map((categoryTagID) => ({
        productID: product.id,
        categoryTagID,
      }));

    if (relationsToCreate.length > 0) {
      await prisma.productCategoryTag.createMany({
        data: relationsToCreate,
        skipDuplicates: true,
      });
    }

    updatedCount++;
  }

  console.log("\n=== RESULTADO DA CLASSIFICAÇÃO NO BANCO DE DADOS ===");
  console.log(`Total de produtos atualizados: ${updatedCount}`);
  console.log("Distribuição real por etiqueta no PostgreSQL:", tagCounts);
}

main()
  .then(() => {
    console.log("Etapa 1 concluída com sucesso!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Erro na Etapa 1:", err);
    process.exit(1);
  });
