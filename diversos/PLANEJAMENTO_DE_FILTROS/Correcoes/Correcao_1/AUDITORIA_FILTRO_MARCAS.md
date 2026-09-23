# Relatório de Auditoria Técnica: Falha no Filtro de Marcas do Catálogo

**Data da Auditoria:** 23 de Setembro de 2026  
**Localização:** `diversos/PLANEJAMENTO_DE_FILTROS/Correcoes/Correcao_1/AUDITORIA_FILTRO_MARCAS.md`  
**Escopo:** Investigação da causa raiz pela qual marcas como **Autoamerica** retornam "0 produtos encontrados", enquanto marcas como **Cadillac** funcionam normalmente.  
**Restrição Cumprida:** Nenhuma alteração foi realizada no código do projeto durante esta auditoria.

---

## 1. Sumário Executivo

Ao selecionar marcas parceiras no carrossel superior ([`BrandMinimalistCarousel.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/catalog/BrandMinimalistCarousel.tsx)) ou na barra lateral de filtros ([`CatalogFreeSidebar.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/catalog/CatalogFreeSidebar.tsx)), identificou-se um comportamento inconsistente no catálogo:

* **Marcas que funcionam:** Ao clicar em marcas como **Cadillac**, o sistema exibe corretamente **15 produtos**. Marcas como **Vonixx** exibem **28 produtos**, **Easytech** exibe **7 produtos**, etc.
* **Marcas que falham:** Ao clicar em marcas como **Autoamerica**, o sistema exibe a mensagem de catálogo vazio: *"0 produtos encontrados - Nenhum produto encontrado"*.

### Diagnóstico Principal
A falha decorre de uma **dupla desconexão estrutural** entre o banco de dados relacional e a lógica de filtragem do frontend:
1. **No Banco de Dados:** Dos **522 produtos** cadastrados na loja, **450 produtos (86,2%) estão com `brandID = NULL`**. No caso específico da **Autoamerica**, existem **0 produtos vinculados** a ela via chave estrangeira.
2. **No Hook de Filtragem (`useProductFilters.ts`):** O sistema utiliza uma estratégia híbrida (`hasDbBrand || hasRegexBrand`). Como não há vínculo no banco, o filtro recorre ao dicionário `BRAND_REGEX`. No entanto, **o slug `autoamerica` sequer foi registrado no `BRAND_REGEX`**. Consequentemente, para 100% dos produtos do catálogo, o teste resulta em `false`, eliminando todos os itens da vitrine.

---

## 2. Matriz de Auditoria das 18 Marcas Cadastradas

A tabela abaixo apresenta o status real de cada uma das 18 marcas cadastradas no banco de dados da loja ativa:

| Marca | Slug | Produtos com `brandID` no Banco | Presente no `BRAND_REGEX`? | Status no Catálogo | Produtos Reais Identificados no Catálogo |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Autoamerica** | `autoamerica` | **0** | ❌ Não | 🔴 **FALHA (0 itens)** | **6 produtos** |
| **Cadillac** | `cadillac` | **15** | ✅ Sim | 🟢 **FUNCIONA (15 itens)** | **17 produtos** |
| **Easytech** | `easytech` | **7** | ✅ Sim | 🟢 **FUNCIONA (7 itens)** | **14 produtos** |
| **IPC Brasil** | `ipc` | **4** | ✅ Sim | 🟢 **FUNCIONA (4 itens)** | **7 produtos** |
| **Kärcher** | `karcher` | **7** | ✅ Sim | 🟢 **FUNCIONA (7 itens)** | **7 produtos** |
| **Kers** | `kers` | **3** | ✅ Sim | 🟢 **FUNCIONA (3 itens)** | **7 produtos** |
| **Lincoln** | `lincoln` | **0** | ⚠️ Sim (Restritivo) | 🔴 **FALHA (0 itens)** | **2 produtos** |
| **Meguiar's** | `meguiars` | **0** | ❌ Não | 🔴 **FALHA (0 itens)** | 0 produtos diretos |
| **Nasiol** | `nasiol` | **0** | ❌ Não | 🔴 **FALHA (0 itens)** | 0 produtos diretos |
| **Nobrecar** | `nobrecar` | **0** | ⚠️ Sim (Restritivo) | 🔴 **FALHA (0 itens)** | **3 produtos** |
| **Protelim** | `protelim` | **0** | ❌ Não | 🔴 **FALHA (0 itens)** | 0 produtos diretos |
| **Sandet** | `sandet` | **0** | ❌ Não | 🔴 **FALHA (0 itens)** | 0 produtos diretos |
| **Sigma Tools** | `sigma-tools` | **0** | ❌ Não | 🔴 **FALHA (0 itens)** | **14 produtos** |
| **Soft99** | `soft99` | **0** | ❌ Não | 🔴 **FALHA (0 itens)** | **10 produtos** |
| **Sonax** | `sonax` | **0** | ❌ Não | 🔴 **FALHA (0 itens)** | 0 produtos diretos |
| **Vonixx** | `vonixx` | **28** | ✅ Sim | 🟢 **FUNCIONA (28 itens)** | **46 produtos** |
| **WAP** | `wap` | **1** | ✅ Sim | 🟢 **FUNCIONA (2 itens)** | **1 produto** |
| **Zacs** | `zacs` | **7** | ✅ Sim | 🟢 **FUNCIONA (7 itens)** | **13 produtos** |

> **Resultado Consolidado:**
> * **Apenas 8 marcas funcionam** atualmente no catálogo.
> * **10 marcas falham completamente (retornam 0 produtos)** quando selecionadas pelo usuário.

---

## 3. Análise Detalhada da Causa Raiz

### 3.1. A Lógica de Filtragem no Frontend ([`hooks/useProductFilters.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/hooks/useProductFilters.ts))

Na linha 331 do hook de domínio `useProductFilters.ts`, a filtragem por marca é executada da seguinte forma:

```typescript
// 2. Filtro de Marca
if (selectedBrand) {
  const hasDbBrand = prod.brandSlug === selectedBrand;
  const hasRegexBrand = BRAND_REGEX[selectedBrand]?.test(text);
  if (!hasDbBrand && !hasRegexBrand) return false;
}
```

O filtro adota uma abordagem de duas etapas (banco de dados prioritário com fallback por regex):
1. **Etapa 1 (`hasDbBrand`):** Verifica se o produto tem a marca explicitamente associada no banco (`prod.brandSlug === selectedBrand`).
2. **Etapa 2 (`hasRegexBrand`):** Caso o produto não tenha `brandSlug` (seja nulo), testa o texto do nome e da descrição contra o mapa de expressões regulares `BRAND_REGEX[selectedBrand]`.

#### O que ocorre quando o usuário clica em "Autoamerica":
* `selectedBrand` assume o valor `'autoamerica'`.
* **Etapa 1:** Como nenhum produto no banco possui `brandID` associado à Autoamerica, `prod.brandSlug` é `null`. Logo, `hasDbBrand === false` para todos os 522 produtos.
* **Etapa 2:** O código consulta `BRAND_REGEX['autoamerica']`. 
* Abaixo está o objeto `BRAND_REGEX` completo conforme declarado no arquivo:
  ```typescript
  const BRAND_REGEX: Record<string, RegExp> = {
    vonixx:
      /\b(VONIXX|ROOTZ|SINTRA|BLEND|NATIVE|DELET|ALUMAX|PRISMA|V-PLASTIC|V-LIGHT|V-PAINT|V-ENERGY|VERONA)\b/i,
    easytech:
      /\b(EASYTECH|EASY TECH|INSIGNIA|PLASTI COAT|QUARTZ 9H|FLOAT|ZAP|MELT)\b/i,
    cadillac: /\b(CADILLAC|CADMIX|MONSTER CARNAUBA|BLACK MAGIC)\b/i,
    lincoln: /\b(LINCOLN|POLIDOR LINCOLN|BOINA LINCOLN)\b/i,
    kers: /\b(KERS|POLITRIZ KERS)\b/i,
    nobrecar: /\b(NOBRECAR|NOBRE CAR)\b/i,
    zacs: /\b(ZACS)\b/i,
    ipc: /\b(IPC|ECOCLEAN|CARPET)\b/i,
    karcher: /\b(KARCHER|KÄRCHER)\b/i,
    wap: /\b(WAP)\b/i,
  };
  ```
* Como `autoamerica` **não existe** como chave no objeto `BRAND_REGEX`, a expressão `BRAND_REGEX['autoamerica']?.test(text)` avalia para `undefined` (falsy).
* O teste final `if (!hasDbBrand && !hasRegexBrand) return false;` é avaliado como `true` (descarte) para **cada um dos 522 produtos**.
* **Resultado:** Lista vazia, gerando a tela de erro exibida no screenshot do usuário.

---

### 3.2. Por que a marca "Cadillac" funciona?

O usuário observou que a marca "Cadillac" funciona perfeitamente. Os motivos técnicos para isso são:
1. No script de seed anterior ([`scripts/seed-catalog-filters.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/scripts/seed-catalog-filters.ts)), a marca Cadillac foi incluída na lista `BRANDS` e na lista `BRAND_RULES`:
   ```typescript
   "cadillac": /\b(CADILLAC|CADMIX|MONSTER CARNAUBA|BLACK MAGIC)\b/i
   ```
2. Durante a execução daquele seed, **15 produtos** contendo termos como `CADILLAC`, `CADMIX` ou `BLACK MAGIC` tiveram o campo `Product.brandID` preenchido no PostgreSQL com o ID da marca Cadillac.
3. Além disso, `cadillac` está devidamente mapeado no `BRAND_REGEX` de `useProductFilters.ts`.
4. Logo, tanto `hasDbBrand` quanto `hasRegexBrand` funcionam para a Cadillac.

---

### 3.3. Por que a marca "Lincoln" e a marca "Nobrecar" também falham mesmo estando no `BRAND_REGEX`?

Ao auditar as outras marcas, descobrimos que **Lincoln** e **Nobrecar** também retornam 0 produtos, apesar de possuírem entradas no `BRAND_REGEX`:
* **No Banco de Dados:** Ambas possuem `productCount = 0` no banco.
* **No `BRAND_REGEX`:**
  * O regex de `lincoln` é: `/\b(LINCOLN|POLIDOR LINCOLN|BOINA LINCOLN)\b/i`.  
    No catálogo real, os produtos da Lincoln estão cadastrados como `BOINA DE LÃ CORTE PESADO PESADO LISTRAS VERDES 5` e `MASSA BRAZUCA POLIMENTO CORTE PESADO 500ML` — **nenhum deles contém o termo literal "LINCOLN"**, falhando no regex.
  * O regex de `nobrecar` é: `/\b(NOBRECAR|NOBRE CAR)\b/i`.  
    No catálogo real, os produtos da Nobrecar estão cadastrados sob suas linhas e códigos famosos: `S7 CLEANER LIMPA PNEUS E BORRACHAS 1L`, `S7 CLEANER 5L`, etc. — **nenhum deles contém o termo literal "NOBRECAR"**, falhando no regex.

---

### 3.4. Origem Histórica do Problema (Divergência de Evolução)

Investigando o histórico do repositório:
1. **Fase 1 (Seed Inicial):** O script `scripts/seed-catalog-filters.ts` foi criado inicialmente com apenas 10 marcas (Vonixx, Easytech, Cadillac, Lincoln, Kers, Nobrecar, Zacs, IPC, Kärcher e WAP).
2. **Fase 2 (Carrossel V2 Minimalista):** No commit `e96b104` (`feat(catalog): implement V2 minimalist 5-brand loose carousel`), foram adicionadas **8 novas marcas parceiras** à tabela `Brand` e criados os respectivos logos SVG na pasta `public/brands/` (incluindo Autoamerica, Soft99, Sigma Tools, Meguiar's, Sonax, Protelim, Sandet e Nasiol).
3. **A lacuna:** As marcas foram criadas na tabela `Brand` para viabilizar a exibição visual das logos no carrossel, porém **não foi executado um script de categorização para associar os 522 produtos existentes a essas novas marcas**, e o arquivo `hooks/useProductFilters.ts` não foi atualizado com as expressões regulares das novas marcas.

---

## 4. Produtos Reais da Autoamerica Já Presentes no Catálogo

A auditoria comprovou que **a loja possui diversos produtos da Autoamerica no catálogo**, mas eles estão órfãos de marca (`brandID: null`).

Exemplos de produtos no banco que pertencem à Autoamerica:
1. **`CERA AUTO ESPELHAMENTO 500ML`** (Produto emblemático da Autoamerica)
2. **`FOAM GLOSS LAVA AUTO 3L`** (Linha de lavagem da Autoamerica)
3. **`FOAM GLOSS 1L`** (Linha de lavagem da Autoamerica)
4. **`HIGH SHINE SHAMPOO AUTOMOTIVO COM CERA 500ML`** (Linha de acabamento da Autoamerica)
5. **`LIMPA AR CONDICIONADO AMERICA`** (Aromatização/higienização Autoamerica)
6. **`SILICONE SPRAY PERFUMADO AMERICA`** (Finalização Autoamerica)

Além da Autoamerica, outras marcas cadastradas possuem produtos órfãos imediatos no banco:
* **Soft99 (10 produtos):** `BIG GLACO CRISTALIZADOR DE VIDROS 120ML`, `CERA THE KING OF GLOSS BLACK&DARK 300G`, `CERA THE KING OF GLOSS WHITE CLEANER 320G`, `GLACO BLAVE`, `GLACO CRISTALIZADOR 75ML`, `GLACO WASHER`, etc.
* **Sigma Tools / SGT (14 produtos):** `APLICADOR PNEU PRETINHO SGT`, `BALDE DETAILING TRANSPARENTE SGT`, `KIT 3 PINCEIS SUPER MACIOS SGT`, `MINI POLITRIZ ROTO ORBITAL SGT 3`, `POLITRIZ ROTO ORBITAL 5 SGT 5117 PRO`, etc.
* **Nobrecar (3 produtos):** `S7 CLEANER LIMPA PNEUS E BORRACHAS 1L`, `5L` e `SPRAY 500ML`.
* **Lincoln (2 produtos):** `BOINA DE LÃ CORTE PESADO LISTRAS VERDES`, `MASSA BRAZUCA POLIMENTO`.

---

## 5. Roteiro Técnico Recomendado para a Futura Correção

Quando a implementação da correção for autorizada pelo usuário, as seguintes ações deverão ser realizadas:

### Etapa 1: Atualização do `BRAND_REGEX` no Frontend ([`hooks/useProductFilters.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/hooks/useProductFilters.ts))
Expandir o dicionário `BRAND_REGEX` com suporte a todas as 18 marcas e suas linhas de produtos específicas:
```typescript
const BRAND_REGEX: Record<string, RegExp> = {
  autoamerica: /\b(AUTOAMERICA|AUTO AMERICA|AUTO ESPELHAMENTO|TRIPLE PASTE|HIGH SHINE|FOAM GLOSS|GOLD DUSTER)\b/i,
  soft99: /\b(SOFT99|SOFT 99|GLACO|FUSSO|KING OF GLOSS|DARK & BLACK|KIWAMI|IRON TERMINATOR)\b/i,
  "sigma-tools": /\b(SIGMA TOOLS|SIGMA|SGT|SGT-|ROTO ORBITAL SGT)\b/i,
  lincoln: /\b(LINCOLN|POLIDOR LINCOLN|BOINA LINCOLN|BRAZUCA|BOINA DE LÃ|MEGA POLIDOR|SUPER POLIDOR|DUPLA FACE)\b/i,
  nobrecar: /\b(NOBRECAR|NOBRE CAR|S7 CLEANER|S-7|X-CAM|OFF LEATHER)\b/i,
  // ... e as demais marcas mapeadas
};
```

### Etapa 2: Atualização e Sincronização Relacional no Banco de Dados
Executar um script de migração/sincronização no banco de dados para vincular o `brandID` dos produtos órfãos às respectivas marcas da tabela `Brand`.
* Isso garantirá que `prod.brandSlug` venha preenchido direto do banco (`hasDbBrand = true`).
* Garantirá também que o contador numérico de produtos por marca exibido no carrossel e na sidebar (`b.productCount`) reflita a quantidade real de produtos em estoque.

### Etapa 3: Validação Automatizada de Regressão
* Testar a seleção de cada uma das 18 marcas no carrossel e na sidebar.
* Executar a suíte de testes unitários (`npm run test:unit`) para assegurar conformidade total.
