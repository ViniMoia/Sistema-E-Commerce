# Roteiro do Que Falta Ser Feito — Projeto Continental E-Commerce

> **Data da Auditoria:** 11/11/2026  
> **Base Analisada:** Comparação entre `origin/main` e `origin/feat/leno-l10-precos-duplos-schema` (commits `63f8eaa` e `8a786ed`) contra os 6 desafios de `Desafios de gay.md`.

---

## 📊 1. Resumo Executivo do Progresso Atual

O desenvolvedor **Leno** já concluiu e enviou para o repositório remoto (branch `origin/feat/leno-l10-precos-duplos-schema`) toda a fundação de **Backend (`L-10`, `L-11` e `L-12`)**.

| Código | Tarefa / Desafio | Responsável | Status Atual |
| :--- | :--- | :--- | :--- |
| **L-10** | Schema (`pixPrice`, `isFeaturedHero`, `heroBannerUrl`, `pixDiscountPct`), ingestão dupla da Nuvemshop e preço PIX no `checkout-plan.service.ts` | **Leno** | ✅ **Concluído na branch `feat/leno-l10-precos-duplos-schema`** |
| **L-11** | Fim do `WHATSAPP_ONLY`, função `isHeavyOrLargeProduct`, remoção do contágio `NONE` e bloqueio de `WHATSAPP_PIX` | **Leno** | ✅ **Concluído na branch `feat/leno-l10-precos-duplos-schema`** |
| **L-12** | Normalização de domínio com/sem `www.` e proteção do slug contra `www` em `lib/tenant.ts` | **Leno** | ✅ **Concluído no código (falta apenas apontamento externo de DNS/Asaas)** |
| **V-10** | **Desafio 1:** Substituir `HeroVideo` pelo `HeroCarousel` com artes dos produtos e preços duplos | **Vanderlei** | ✅ **100% Concluído e Validado (`HeroCarousel.tsx` em `HomeClient.tsx`)** |
| **V-11** | **Desafio 2 (UI):** Exibir Preço Cartão (destaque) + Preço PIX (secundário) nos cards, PDP e Checkout | **Vanderlei** | ✅ **100% Concluído e Validado (Cards e PDP com Preços Duplos)** |
| **V-12** | **Desafio 3 (Frete/UI):** Tabela dos 52 bairros (Belém/Ananindeua), prazo de 4 dias para pesados e remoção de "A Combinar" da UI | **Vanderlei** | ✅ **100% Concluído e Validado (Tabela 52 bairros + Entrega 4 dias + Calculadora)** |
| **V-13** | **Desafio 4:** Substituir SVGs genéricos pelas marcas reais e corrigir `sigma-tools.svg` | **Vanderlei** | ✅ **100% Concluído e Validado (`sigma-tools.svg` + 18 marcas + Carrossel ampliado)** |
| **V-14** | **Desafio 5:** Ampliar proporções visuais, tipografia e contraste para clientes com baixa visão | **Vanderlei** | ✅ **100% Concluído e Validado (`globals.css` + `tailwind.config.ts` + cards min-h 530px)** |
| **OP-01** | **Operação / Banco:** Aplicar schema no banco (`db push`/migration), re-sincronizar preços da SMB Store e configurar domínio/Asaas | **Leno + Vanderlei** | ⏳ **Pendente em ambiente de produção (DNS / Webhook Externo)** |

---

## 🛠️ 2. Roteiro Passo a Passo do Que Falta Implementar

### Passo 0 — Integrar a Branch do Leno e Atualizar o Banco Local
Antes de iniciar as tarefas de frontend/frete (`V-10` a `V-14`), é necessário trazer os commits do Leno para a branch de trabalho:

```powershell
cd Sistema-E-Commerce
git checkout feat/leno-l10-precos-duplos-schema
# Ou, se for trabalhar na main/homologacao_teste:
# git merge origin/feat/leno-l10-precos-duplos-schema

npx prisma generate
npx prisma db push
```

> **Atenção (Detalhe de Migração):** Na branch do Leno, o `prisma/schema.prisma` foi atualizado, mas ainda não foi gerada uma pasta de migration SQL em `prisma/migrations/`. Caso o pipeline de CI exija migration versionada (`npm run test:migrations:isolated`), deve-se rodar `npx prisma migrate dev --name add_dual_prices_and_hero_fields`.

---

### Passo 1 — [V-10] Implementar o Carrossel Hero de Produtos (`Desafio 1`) — ✅ CONCLUÍDO

**Implementação Concluída:**
1. Criado [HeroCarousel.tsx](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/components/home/HeroCarousel.tsx) exibindo artes dos produtos, badge "Destaque Continental", bloco duplo de preços (Cartão em destaque gigante e PIX secundário), CTAs "Comprar Agora" e "Ver Catálogo", além de setas e dots de navegação.
2. Integrado em [HomeClient.tsx](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/components/home/HomeClient.tsx) substituindo `HeroVideo`.

---

### Passo 2 — [V-11] Exibir os Dois Preços (Cartão + PIX) em Toda a Interface (`Desafio 2`) — ✅ CONCLUÍDO

**Implementação Concluída:**
1. Atualizada a interface `FilterableProduct` em [useProductFilters.ts](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/hooks/useProductFilters.ts) com `pixPrice`, `isFeaturedHero` e `heroBannerUrl`.
2. Atualizados os cards de produto em [HomeClient.tsx](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/components/home/HomeClient.tsx) (tanto no layout drawer quanto sidebar) para exibir valor no Cartão em destaque e valor no PIX em verde esmeralda. Removido o badge legado "Frete a Combinar".
3. Atualizada a página de detalhes do produto (PDP) em [HomeClient.tsx](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/components/home/HomeClient.tsx) com preços duplos e cálculo de economia. Calculadora de frete habilitada para todos os produtos.

---

### Passo 3 — [V-12] Tabela dos 52 Bairros (Belém/Ananindeua) + Prazo de 4 Dias para Pesados (`Desafio 3`) — ✅ CONCLUÍDO

**Implementação Concluída:**
1. Criado [belem-ananindeua-neighborhoods.ts](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/lib/freight/belem-ananindeua-neighborhoods.ts) com os 52 bairros de Belém, Ananindeua e Marituba (tarifas de R$ 10 a R$ 50) e aliases com e sem acento.
2. Integrado `neighborhood` no [destination.ts](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/lib/freight/destination.ts), [freight-contract.ts](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/lib/commerce/freight-contract.ts) e [orchestrator.service.ts](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/services/freight/orchestrator.service.ts).
3. Atualizado [custom-table.provider.ts](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/services/freight/providers/custom-table.provider.ts) aplicando tarifa exata por bairro, prazo de 1 dia útil para itens padrão e 4 dias úteis para itens pesados/volumosos (veículo da loja).
4. Em [ProductFreightCalculator.tsx](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/components/catalog/ProductFreightCalculator.tsx) e [CheckoutForm.tsx](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/components/checkout/CheckoutForm.tsx): removidos "Frete a Combinar" e "PIX WhatsApp" da interface, adicionado seletor e autocompletes de bairro.

---

### Passo 4 — [V-13] Substituir Marcas Genéricas pelas Marcas Reais (`Desafio 4`) — ✅ CONCLUÍDO

**Implementação Concluída:**
1. Criado `sigma-tools.svg` em `public/brands/` resolvendo a divergência de slug com `sigmatools.svg`.
2. Atualizado [seed-catalog-filters.ts](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/scripts/seed-catalog-filters.ts) com todas as 18 marcas oficiais e regex de correspondência.
3. Ampliada a altura do carrossel em [BrandMinimalistCarousel.tsx](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/components/catalog/BrandMinimalistCarousel.tsx) para `h-16 sm:h-20` (container `h-24 sm:h-28`) para máxima nitidez visual.

---

### Passo 5 — [V-14] Acessibilidade, Proporções e Contraste para Baixa Visão (`Desafio 5`) — ✅ CONCLUÍDO

**Implementação Concluída:**
1. Escala base configurada em [app/globals.css](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/app/globals.css): `106.25%` (17px) no mobile e `112.5%` (18px) no desktop.
2. Contraste de `catalog.muted` elevado para `#CBD5E1` (Slate-300) em [tailwind.config.ts](file:///c:/Users/esdra/OneDrive/Documentos/Projects/Continental/Sistema-E-Commerce/tailwind.config.ts).
3. Altura mínima dos cards de produto ampliada para `min-h-[530px]` e badges pequenos ampliados de `text-[10px]` para `text-xs`.
4. Micro-fontes (`text-[10px]`, `text-[11px]`) substituídas por `text-xs font-semibold` / `text-xs font-bold` em `Header.tsx`, `CartButton.tsx`, `CatalogToolbar.tsx`, `ProductFreightCalculator.tsx`, `StoreLocationSection.tsx`, `StorePresentationSection.tsx`, `LoyaltyPointsWidget.tsx`, `CheckoutForm.tsx` e `app/checkout/page.tsx`.
5. Integração de `pixPrice` no carrinho e checkout: subtotal recalculado dinamicamente quando a opção PIX é selecionada, sincronizado com `services/cart.service.ts` e `store/cart.store.ts`.

---

### Passo 6 — [OP-01] Checklist Operacional de Banco, Nuvemshop e Domínio (`Desafio 6`)

Após o término do código de Vanderlei:
1. **Popular `pixPrice` nos produtos já existentes no banco:**
   - Rodar uma atualização inicial (`UPDATE "Product" SET "pixPrice" = ROUND("price" * 0.95, 2) WHERE "pixPrice" IS NULL;`) ou re-executar a sincronização de produtos da Nuvemshop para preencher `pixPrice` com os dados reais da SMB Store.
2. **Configurar o Domínio Real e o Webhook do Asaas:**
   - Atualizar `Loja.customDomain` no banco com o domínio comprado pelo cliente (ex.: `continentalestetica.com.br`).
   - Configurar `PLATFORM_DOMAIN`, `NEXT_PUBLIC_APP_URL` e `PAYMENT_WORKER_ENABLED="true"` nas variáveis de ambiente de produção.
   - No painel do Asaas, alterar a URL do Webhook para `https://<DOMINIO_OFICIAL>/api/webhooks/asaas`.

---

## ✅ 3. Comandos de Validação Final

Ao concluir os passos 1 a 5, executar:

```powershell
# 1. Verificar tipagem TypeScript
npx tsc --noEmit

# 2. Rodar todos os testes unitários
npm run test:unit

# 3. Testar o build de produção do Next.js
npm run build
```
