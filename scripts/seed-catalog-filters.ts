import prisma from "@/lib/prisma";

const CATEGORY_TAGS = [
  { slug: "acessorios", name: "Acessórios", group: "GERAL", order: 1, icon: "Wrench" },
  { slug: "airless", name: "AIRLESS", group: "EQUIPAMENTO", order: 2, icon: "SprayCan" },
  { slug: "aspiradores", name: "Aspiradores", group: "EQUIPAMENTO", order: 3, icon: "Wind" },
  { slug: "boinas", name: "Boinas", group: "GERAL", order: 4, icon: "Disc" },
  { slug: "ceras-e-selantes", name: "Ceras e Selantes", group: "PRODUTO", order: 5, icon: "Shield" },
  { slug: "cheirinho-para-carro", name: "Cheirinho Para Carro", group: "PRODUTO", order: 6, icon: "Sparkles" },
  { slug: "compressor", name: "Compressor", group: "EQUIPAMENTO", order: 7, icon: "Gauge" },
  { slug: "externo", name: "Externo", group: "APLICACAO", order: 8, icon: "Car" },
  { slug: "extratoras", name: "Extratoras", group: "EQUIPAMENTO", order: 9, icon: "Droplets" },
  { slug: "interno", name: "Interno", group: "APLICACAO", order: 10, icon: "Armchair" },
  { slug: "kit-de-produtos", name: "Kit de Produtos", group: "PRODUTO", order: 11, icon: "Package" },
];

const BRANDS = [
  { slug: "vonixx", name: "Vonixx", description: "Referência nacional em estética automotiva, vitrificadores e ceras nobres." },
  { slug: "easytech", name: "Easytech", description: "Tecnologia molecular de ponta e vitrificadores cerâmicos Insignia." },
  { slug: "cadillac", name: "Cadillac", description: "Tradição em polimento profissional, ceras artesanais e limpadores nobres." },
  { slug: "lincoln", name: "Lincoln", description: "Especialista em boinas de lã e compostos polidores de alto desempenho." },
  { slug: "kers", name: "Kers", description: "Inovação em politrizes, boinas térmicas e acessórios automotivos." },
  { slug: "nobrecar", name: "Nobrecar", description: "Compostos de corte, refino e selantes de acabamento espelhado." },
  { slug: "zacs", name: "Zacs", description: "Linha eficiente e acessível com a qualidade e garantia Vonixx." },
  { slug: "ipc", name: "IPC Brasil", description: "Líder mundial em extratoras profissionais de estofados e aspiradores industriais." },
  { slug: "karcher", name: "Kärcher", description: "Pioneirismo em hidrolavadoras de alta pressão e engenharia alemã." },
  { slug: "wap", name: "WAP", description: "Líder em lavadoras de pressão, aspiradores e equipamentos residenciais." },
];

// Regras de correspondência semântica por expressão regular
const TAG_RULES: Record<string, RegExp> = {
  "acessorios": /\b(APLICADOR|ESCOVA|PINCEL|MICROFIBRA|PULVERIZADOR|BORRIFADOR|SNOW FOAM|ADAPTADOR|FITA|LUVAS|ESPONJA|BALDE|GRELHA|PANO)\b/i,
  "airless": /\b(AIRLESS|PISTOLA DE PINTURA|BICO AIRLESS|PULVERIZADOR DE ALTA PRESSAO)\b/i,
  "aspiradores": /\b(ASPIRADOR|ECOCLEAN|LITE 1200W|PO E AGUA|ASPIRACAO)\b/i,
  "boinas": /\b(BOINA|CORTE|REFINO|LUSTRO|ESPUMA|LÃ|INTERFACE|HEX)\b/i,
  "ceras-e-selantes": /\b(CERA|SELANTE|GRAFENO|VITRIFICADOR|SIO2|COATING|ROOTZ|BLEND|NATIVE|CARNAUBA|GLAZE)\b/i,
  "cheirinho-para-carro": /\b(AROMATIZANTE|CHEIRINHO|ODORIZADOR|SPRAY OLFATIVO|FRAGRANCIA|ESSENCIA|PERFUME|LITTLE TREES)\b/i,
  "compressor": /\b(COMPRESSOR|PNEUMATICO|MANGUEIRA AR|CALIBRADOR)\b/i,
  "externo": /\b(PNEUS|RODAS|LATARIA|VIDROS|CHASSI|MOTOR|ALUMAX|DESINCRUSTANTE|ACIDO|SHAMPOO|LAVA AUTOS|VERNIZ DE MOTOR|RESTAURADOR DE PLASTICOS|V-PLASTIC|DELET|D-RET)\b/i,
  "extratoras": /\b(EXTRATORA|LAVADORA DE ESTOFADOS|IPC CARPET|SANITIZADORA|LAVA ESTOFADOS)\b/i,
  "interno": /\b(COURO|PAINEL|PLASTICOS INTERNOS|ESTOFADOS|HIGIENIZADOR|APC INTERIORES|SINTRA|BACTRON|FLOAT|PLURI)\b/i,
  "kit-de-produtos": /\b(KIT|COMBO|TRIO|CONJUNTO|PCT|PACK)\b/i,
};

const BRAND_RULES: Record<string, RegExp> = {
  "vonixx": /\b(VONIXX|ROOTZ|SINTRA|BLEND|NATIVE|DELET|ALUMAX|PRISMA|V-PLASTIC|V-LIGHT|V-PAINT|V-ENERGY|VERONA)\b/i,
  "easytech": /\b(EASYTECH|EASY TECH|INSIGNIA|PLASTI COAT|QUARTZ 9H|FLOAT|ZAP|MELT)\b/i,
  "cadillac": /\b(CADILLAC|CADMIX|MONSTER CARNAUBA|BLACK MAGIC)\b/i,
  "lincoln": /\b(LINCOLN|POLIDOR LINCOLN|BOINA LINCOLN)\b/i,
  "kers": /\b(KERS|POLITRIZ KERS)\b/i,
  "nobrecar": /\b(NOBRECAR|NOBRE CAR)\b/i,
  "zacs": /\b(ZACS)\b/i,
  "ipc": /\b(IPC|ECOCLEAN|CARPET)\b/i,
  "karcher": /\b(KARCHER|KÄRCHER)\b/i,
  "wap": /\b(WAP)\b/i,
};

async function seed() {
  console.log("=== INICIANDO SEED DE MARCAS E CATEGORIAS ===");

  const lojas = await prisma.loja.findMany();
  if (lojas.length === 0) {
    console.error("Nenhuma loja encontrada!");
    return;
  }

  const loja = lojas[0];
  console.log(`Loja Selecionada: ${loja.name} (${loja.id})`);

  // 1. Cadastrar / Atualizar CategoryTags
  const createdTagsMap = new Map<string, string>(); // slug -> id
  for (const tag of CATEGORY_TAGS) {
    const record = await prisma.categoryTag.upsert({
      where: {
        lojaID_slug: {
          lojaID: loja.id,
          slug: tag.slug,
        },
      },
      update: {
        name: tag.name,
        group: tag.group,
        order: tag.order,
        icon: tag.icon,
      },
      create: {
        lojaID: loja.id,
        name: tag.name,
        slug: tag.slug,
        group: tag.group,
        order: tag.order,
        icon: tag.icon,
      },
    });
    createdTagsMap.set(tag.slug, record.id);
  }
  console.log(`✓ ${createdTagsMap.size} Etiquetas de Categoria sincronizadas.`);

  // 2. Cadastrar / Atualizar Brands
  const createdBrandsMap = new Map<string, string>(); // slug -> id
  for (const brand of BRANDS) {
    const record = await prisma.brand.upsert({
      where: {
        lojaID_slug: {
          lojaID: loja.id,
          slug: brand.slug,
        },
      },
      update: {
        name: brand.name,
        description: brand.description,
        isActive: true,
      },
      create: {
        lojaID: loja.id,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        isActive: true,
      },
    });
    createdBrandsMap.set(brand.slug, record.id);
  }
  console.log(`✓ ${createdBrandsMap.size} Marcas sincronizadas.`);

  // 3. Mapear e Associar os 521 Produtos Existentes
  const products = await prisma.product.findMany({
    where: { lojaID: loja.id },
    select: { id: true, name: true, description: true },
  });
  console.log(`Processando categorização de ${products.length} produtos...`);

  let brandMatches = 0;
  let tagMatches = 0;

  for (const product of products) {
    const text = `${product.name} ${product.description || ""}`.toUpperCase();

    // Detectar Marca
    let matchedBrandId: string | null = null;
    for (const [brandSlug, regex] of Object.entries(BRAND_RULES)) {
      if (regex.test(text)) {
        matchedBrandId = createdBrandsMap.get(brandSlug) || null;
        if (matchedBrandId) break;
      }
    }

    // Detectar Tags
    const matchedTagIds: string[] = [];
    const matchedTagSlugs: string[] = [];
    for (const [tagSlug, regex] of Object.entries(TAG_RULES)) {
      if (regex.test(text)) {
        const tagId = createdTagsMap.get(tagSlug);
        if (tagId) {
          matchedTagIds.push(tagId);
          matchedTagSlugs.push(tagSlug);
        }
      }
    }

    // Atualizar produto
    await prisma.product.update({
      where: { id: product.id },
      data: {
        brandID: matchedBrandId,
        tagsSearchCache: matchedTagSlugs,
      },
    });

    if (matchedBrandId) brandMatches++;

    // Criar associações ProductCategoryTag
    for (const tagId of matchedTagIds) {
      tagMatches++;
      await prisma.productCategoryTag.upsert({
        where: {
          productID_categoryTagID: {
            productID: product.id,
            categoryTagID: tagId,
          },
        },
        update: {},
        create: {
          productID: product.id,
          categoryTagID: tagId,
        },
      });
    }
  }

  console.log(`✓ Mapeamento Concluído!`);
  console.log(`- Produtos associados a marcas: ${brandMatches}`);
  console.log(`- Vínculos com categorias criados: ${tagMatches}`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
