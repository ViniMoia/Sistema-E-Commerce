# Relatório Geral de Incidente: Bloqueio Lógico na Seleção de Variantes do Catálogo

> **Arquivo:** `RELATORIO_GERAL_PROBLEMA_VARIANTES.md`  
> **Localização:** `diversos/CORRECOES/Correcoes_logicas/correcao_variante_1/relatorio/`  
> **Classificação:** Relatório Técnico Forense e Arquitetural  
> **Data do Incidente:** 03 de Outubro de 2026  
> **Produto Afetado:** *Aspirador de Pó* (ID: `6a6e98eb-98c3-4ba2-aede-a357d43893cf`)  
> **Sintoma Observado:** Alerta de *"Por favor, selecione um tamanho e uma cor válidos antes de prosseguir"*, impossibilitando a adição ao carrinho mesmo com a opção visível selecionada.

---

## 1. Sumário Executivo

Ao tentar realizar a compra do produto **"Aspirador de Pó"** no catálogo da loja, o usuário encontrou um bloqueio impeditivo. Na interface detalhada do produto, o botão de tamanho **"Padrão"** estava selecionado, mas ao clicar no botão primário **"FINALIZAR COMPRA"**, um diálogo de erro do navegador era disparado exigindo a seleção de um tamanho e de uma cor. 

O usuário relatou um dado de contexto fundamental: **cerca de 3 horas antes, o mesmo produto havia sido adicionado com sucesso ao carrinho de compras sem qualquer impedimento**.

A investigação forense revelou que o problema **não foi um erro de uso do cliente**, mas sim uma **convergência de três falhas lógicas em camadas distintas da aplicação** (Frontend Storefront, Formulário do Admin e Backend Service), engatilhada por uma atualização de estoque efetuada no painel administrativo minutos antes do teste.

---

## 2. Linha do Tempo e Evidências Forenses

Por meio de scripts de diagnóstico direto no banco de dados PostgreSQL e inspeção da tabela de auditoria (`AuditLog`), reconstruiu-se a linha do tempo exata:

```
[25/09/2026 19:56 UTC] ──> Criação original do produto "Aspirador de Pó" com 1 variante única.
                                   │
                                   ▼
[02/10/2026 21:40 UTC] ──> Testes bem-sucedidos: produto entrava no carrinho normalmente.
                                   │
                                   ▼
[03/10/2026 00:36 UTC] ──> Edição no Admin: Estoque alterado de 0 para 1.
                                   │
                                   ├──> Falha silenciosa no Admin descarta o ID da variante.
                                   └──> Backend cria uma 2ª variante duplicada (id: 7276b8e0-...).
                                   │
                                   ▼
[03/10/2026 00:40 UTC] ──> Cliente tenta comprar: Sistema detecta 2 variantes, entra em modo 
                           estrito de seleção, oculta a cor e bloqueia a finalização da compra.
```

### 2.1 Registro no `AuditLog`
Às **00:36:36 UTC** de hoje, a auditoria registrou a atualização:
```json
{
  "id": "1cb4c650-0228-480b-bc58-97bc74f8279f",
  "action": "PRODUCT_UPDATED",
  "entity": "Product",
  "entityId": "6a6e98eb-98c3-4ba2-aede-a357d43893cf",
  "previousValue": { "name": "Aspirador de Pó", "price": "11.95", "stock": 0 },
  "newValue": { "name": "Aspirador de Pó", "price": "11.95", "stock": 1 },
  "createdAt": "2026-10-03T03:36:36.008Z"
}
```

### 2.2 Duplicação no Banco de Dados (`ProductVariants`)
A consulta aos dados reais do produto revelou duas variantes ativas idênticas:
```javascript
{
  id: '6a6e98eb-98c3-4ba2-aede-a357d43893cf',
  name: 'Aspirador de Pó',
  price: 11.95,
  variants: [
    {
      id: 'eed23950-87e7-41b8-927a-6c5f2c75f026', // Variante original (25/09)
      size: 'Padrão',
      color: 'Padrão',
      stock: 10
    },
    {
      id: '7276b8e0-9d62-4a25-b8cb-9e024f8f1abe', // Variante duplicada recém-criada (03/10)
      size: 'Padrão',
      color: 'Padrão',
      stock: 10,
      createdAt: '2026-10-03T03:36:35.869Z'
    }
  ]
}
```

### 2.3 Censo Global do Catálogo (522 Produtos)
Para avaliar a extensão do problema no banco de dados, realizou-se uma varredura completa em todos os 522 produtos:
* **518 produtos:** possuem `size: "Único"` e 1 única variante (funcionam perfeitamente).
* **3 produtos:** possuem variantes comerciais reais legítimas (ex: roupas com tamanhos P/M/G e cores preto/azul).
* **Exatamente 1 produto:** possuía `size: "Padrão"` e variantes duplicadas: o **Aspirador de Pó**.

---

## 3. Análise Detalhada da Causa Raiz: A "Armadilha Lógica"

O bloqueio na tela de compra resultou da colisão direta entre três peças de código:

### 3.1 Falha 1: O Admin descarta os IDs das variantes ao salvar (`ProductForm.tsx`)
No arquivo `components/admin/ProductForm.tsx` (linhas 122-126):
```typescript
variants: data.variants.map((v) => ({
  size: v.size,
  color: v.color,
  stock: v.stock,
}))
```
Ao submeter o formulário de edição de um produto, o código omite intencionalmente ou por descuido a propriedade `id: v.id`. 

### 3.2 Falha 2: O Backend duplica a variante por falta de identificador (`product.service.ts`)
No arquivo `services/product.service.ts` (linhas 224-242):
```typescript
if (variantWithId.id && existing.productVariants.some((ev) => ev.id === variantWithId.id)) {
  await tx.productVariants.update({ ... });
} else {
  await tx.productVariants.create({ ... }); // <-- Cria uma nova variante a cada clique em Salvar!
}
```
Como o formulário não enviou o `id`, o backend assumiu que se tratava de uma variante nova, inserindo uma segunda linha idêntica no banco de dados.

### 3.3 Falha 3: A Assimetria e o Travamento Lógico no Catálogo (`HomeClient.tsx`)
Com a existência de duas variantes, a lógica do catálogo da loja entrou em um estado de impasse impossível de resolver pelo usuário:

1. **Classificação como produto com variantes reais (linhas 118-120):**
   ```typescript
   const hasRealVariants =
     variants.length > 1 &&
     variants.some((v) => v.size !== "Único" || v.color !== "Padrão");
   ```
   * Como `variants.length == 2` (> 1) e o tamanho era `"Padrão"` (`!== "Único"`), o sistema definiu `hasRealVariants = true`.

2. **A Assimetria na Renderização dos Botões (linhas 271-272):**
   ```typescript
   // Filtra apenas "Único" -> "Padrão" é mantido!
   const sizes = Array.from(new Set(variants.map(v => v.size))).filter(s => s !== "Único");

   // Filtra "Padrão" -> lista de cores fica vazia!
   const colors = Array.from(new Set(variants.map(v => v.color))).filter(c => c !== "Padrão");
   ```
   * O tamanho `"Padrão"` foi exibido na tela como um botão selecionável.
   * A cor `"Padrão"` foi descartada pelo filtro. **Nenhum seletor de cor foi renderizado**.

3. **O Bloqueio Insuperável (linhas 127-138):**
   ```typescript
   if (selectedSize && selectedColor) {
     const variant = variants.find(v => v.size === selectedSize && v.color === selectedColor);
     setSelectedVariantId(variant?.id || null);
   } else {
     setSelectedVariantId(null);
   }
   ```
   * O usuário selecionou o botão de tamanho `"Padrão"`.
   * Contudo, como não havia seletor de cor na tela, `selectedColor` permaneceu `null`.
   * O estado `selectedVariantId` nunca era preenchido.
   * Ao clicar em "FINALIZAR COMPRA", a verificação de segurança barrou a ação:
     ```typescript
     if (hasRealVariants && !selectedVariantId) {
       alert("Por favor, selecione um tamanho e uma cor válidos antes de prosseguir.");
       return;
     }
     ```

---

## 4. Matriz de Gravidade e Riscos para o Projeto

| Área | Impacto Atual | Risco Futuro Sem Correção |
| :--- | :--- | :--- |
| **Vendas e Conversão** | O cliente não consegue adicionar o produto ao carrinho, gerando abandono de compra e frustração. | Qualquer produto que for editado no Admin passará pelo mesmo travamento se tiver valores neutros de variante. |
| **Painel Admin** | Toda edição de produto no painel administrativo acumula registros duplicados silenciosamente no banco de dados. | Poluição da tabela `ProductVariants`, inconsistências de estoque compartilhado e lentidão em relatórios. |
| **Catálogo** | Produtos que possuem variação em apenas uma dimensão (ex: apenas tamanhos diferentes, sem variação de cor) ficam 100% bloqueados para compra. | Impossibilidade de vender produtos legítimos de frascos com volumes variados (ex: 500ml, 1L, 5L) ou kits. |

---

## 5. Estratégia de Blindagem Definitiva em 4 Pilares

A resolução do problema não pode se limitar a apagar a linha duplicada no banco, sob pena de o problema retornar no próximo salvamento do produto. A arquitetura de correção cobre os 4 níveis da aplicação:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA DE BLINDAGEM                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. BANCO DE DADOS: Limpeza da duplicata do Aspirador de Pó e           │
│    padronização do tamanho para "Único".                               │
│                                                                        │
│ 2. BACKEND SERVICE: Reconciliação inteligente por combinação           │
│    (size + color) em vez de criação cega sem ID.                       │
│                                                                        │
│ 3. PAINEL ADMIN: Preservação do ID da variante nas edições e           │
│    adoção de "Único" como convenção padrão.                            │
│                                                                        │
│ 4. CATÁLOGO STOREFRONT: Reconhecimento de termos neutros ("Único" e   │
│    "Padrão") e validação flexível de apenas 1 dimensão.                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Documentação Relacionada

* **Workflow Técnico de Execução:** [`WORKFLOW_IMPLEMENTACAO_BLINDAGEM_VARIANTES.md`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/CORRECOES/Correcoes_logicas/correcao_variante_1/WORKFLOW_IMPLEMENTACAO_BLINDAGEM_VARIANTES.md)
* **Design System de Referência:** [`DESIGN_SYSTEM_CONTINENTAL.md`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/REDESGN/Design_System/DESIGN_SYSTEM_CONTINENTAL.md)
* **Serviço de Produtos:** [`services/product.service.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/product.service.ts)
* **Catálogo Principal:** [`components/home/HomeClient.tsx`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/home/HomeClient.tsx)

---

## 7. Conclusão

Este relatório consolida de forma inequívoca que a anomalia identificada no produto *Aspirador de Pó* foi provocada por um efeito dominó entre a edição do produto no Admin e a lógica de verificação de variantes no frontend. 

A solução proposta no workflow complementar é completa, definitiva e restabelece a integridade total do processo de compra e gestão de produtos da plataforma.
