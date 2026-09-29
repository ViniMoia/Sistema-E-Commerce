import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";

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
];

const SAMPLE_PRODUCTS = [
  {
    name: "Cera Carnaúba Vonixx Blend Paste Wax 100ml",
    description: "Cera híbrida com carnaúba brasileira e sílica SiO2 para brilho profundo e proteção de até 7 meses.",
    price: 99.90,
    imageUrl: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80",
    stock: 50,
    sku: "VNX-BLEND-100",
    brandSlug: "vonixx",
    tags: ["ceras-e-selantes", "externo"],
  },
  {
    name: "Limpador APC Bactericida Sintra Fast 500ml",
    description: "Flotador multilimpador universal bactericida com pH neutro para higienização interna de veículos.",
    price: 34.90,
    imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&q=80",
    stock: 80,
    sku: "VNX-SINTRA-500",
    brandSlug: "vonixx",
    tags: ["interno"],
  },
  {
    name: "Composto Polidor Insignia Step 1 500ml Easytech",
    description: "Composto polidor de corte pesado com tecnologia de abrasivos decrescentes para remoção de marcas de lixa.",
    price: 119.00,
    imageUrl: "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=600&q=80",
    stock: 35,
    sku: "ET-INSIGNIA-STEP1",
    brandSlug: "easytech",
    tags: ["ceras-e-selantes", "externo"],
  },
  {
    name: "Selante Sintético Hardwax Cadillac 300g",
    description: "Cera em pasta com polímeros sintéticos que proporciona repelência à água e toque aveludado.",
    price: 79.50,
    imageUrl: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=600&q=80",
    stock: 40,
    sku: "CAD-HARDWAX-300",
    brandSlug: "cadillac",
    tags: ["ceras-e-selantes", "externo"],
  },
  {
    name: "Boina de Lã Lincoln Ninja Amarela 6 Polegadas",
    description: "Boina de corte híbrida de microfibra e lã para remoção de defeitos severos na pintura.",
    price: 59.90,
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
    stock: 60,
    sku: "LNC-NINJA-6",
    brandSlug: "lincoln",
    tags: ["boinas", "acessorios"],
  },
  {
    name: "Politriz Roto Orbital Kers 15mm 900W 220V",
    description: "Politriz roto orbital com órbita de 15mm para acabamento perfeito e sem hologramas.",
    price: 689.00,
    imageUrl: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80",
    stock: 15,
    sku: "KRS-ROTO-15MM",
    brandSlug: "kers",
    tags: ["acessorios"],
  },
];

async function main() {
  console.log("=== SEED LOCAL DE DESENVOLVIMENTO ===");

  // 1. Criar ou atualizar Loja Padrão
  const lojaId = process.env.BOOTSTRAP_LOJA_ID || "loja-continental-default";
  const lojaSlug = process.env.DEFAULT_LOJA_SLUG || "continental-prototipo";

  const loja = await prisma.loja.upsert({
    where: { id: lojaId },
    update: {
      name: "Continental Estética Automotiva",
      slug: lojaSlug,
      description: "Produtos profissionais e soluções completas para estética automotiva.",
      coverImageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
      primaryColor: "#DDAF02",
      secondaryColor: "#050505",
      enablePickup: true,
      enableNoFreight: true,
      loyaltyEnabled: true,
    },
    create: {
      id: lojaId,
      name: "Continental Estética Automotiva",
      slug: lojaSlug,
      description: "Produtos profissionais e soluções completas para estética automotiva.",
      coverImageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
      primaryColor: "#DDAF02",
      secondaryColor: "#050505",
      enablePickup: true,
      enableNoFreight: true,
      loyaltyEnabled: true,
    },
  });
  console.log(`✓ Loja padrão pronta: ${loja.name} (${loja.slug})`);

  // 2. Criar ou atualizar Usuário Administrador Local
  const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@continental.local").toLowerCase();
  const rawAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AdminPassword123!";
  const adminPasswordHash = await bcrypt.hash(rawAdminPassword, 12);

  const admin = await prisma.user.upsert({
    where: {
      email_lojaID: {
        email: adminEmail,
        lojaID: loja.id,
      },
    },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      name: "Administrador Local",
      email: adminEmail,
      password: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
      lojaID: loja.id,
    },
  });
  console.log(`✓ Administrador local pronto: ${admin.email} (Senha: ${rawAdminPassword})`);

  // 3. Cadastrar Marcas (Brands)
  const brandMap = new Map<string, string>();
  for (const b of BRANDS) {
    const brand = await prisma.brand.upsert({
      where: {
        lojaID_slug: {
          lojaID: loja.id,
          slug: b.slug,
        },
      },
      update: { name: b.name, description: b.description },
      create: {
        lojaID: loja.id,
        name: b.name,
        slug: b.slug,
        description: b.description,
      },
    });
    brandMap.set(b.slug, brand.id);
  }
  console.log(`✓ ${brandMap.size} marcas cadastradas.`);

  // 4. Cadastrar Categorias (CategoryTags)
  const tagMap = new Map<string, string>();
  for (const t of CATEGORY_TAGS) {
    const tag = await prisma.categoryTag.upsert({
      where: {
        lojaID_slug: {
          lojaID: loja.id,
          slug: t.slug,
        },
      },
      update: { name: t.name, group: t.group, order: t.order, icon: t.icon },
      create: {
        lojaID: loja.id,
        name: t.name,
        slug: t.slug,
        group: t.group,
        order: t.order,
        icon: t.icon,
      },
    });
    tagMap.set(t.slug, tag.id);
  }
  console.log(`✓ ${tagMap.size} categorias cadastradas.`);

  // 5. Cadastrar Produtos e Variantes de Exemplo
  for (const item of SAMPLE_PRODUCTS) {
    const brandID = brandMap.get(item.brandSlug);

    const product = await prisma.product.create({
      data: {
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        stock: item.stock,
        sku: item.sku,
        lojaID: loja.id,
        userID: admin.id,
        brandID: brandID || null,
        weightInGrams: 400,
        lengthCm: 20,
        widthCm: 15,
        heightCm: 10,
        productVariants: {
          create: {
            size: "Único",
            color: "Padrão",
            stock: item.stock,
            sku: `${item.sku}-STD`,
          },
        },
        categoryTags: {
          create: item.tags
            .filter((t) => tagMap.has(t))
            .map((t) => ({
              categoryTagID: tagMap.get(t)!,
            })),
        },
      },
    });
    console.log(`✓ Produto criado: ${product.name} (R$ ${product.price})`);
  }

  // 6. Criar Cliente de Teste com Endereço
  const customerEmail = "cliente@continental.local";
  const customerPasswordHash = await bcrypt.hash("ClientePassword123!", 10);
  const customer = await prisma.user.upsert({
    where: {
      email_lojaID: {
        email: customerEmail,
        lojaID: loja.id,
      },
    },
    update: {
      role: "CUSTOMER",
      status: "ACTIVE",
    },
    create: {
      name: "Cliente Demonstração",
      email: customerEmail,
      password: customerPasswordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      cpfCnpj: "123.456.789-00",
      phone: "(11) 98765-4321",
      lojaID: loja.id,
      addresses: {
        create: {
          cep: "01310-100",
          state: "SP",
          city: "São Paulo",
          district: "Bela Vista",
          street: "Avenida Paulista",
          number: "1000",
          complement: "Apto 42",
        },
      },
    },
  });
  console.log(`✓ Cliente teste pronto: ${customer.email} (Senha: ClientePassword123!)`);

  console.log("\n=== AMBIENTE LOCAL POPULADO COM SUCESSO! ===");
}

main()
  .catch((e) => {
    console.error("Erro no seed local:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
