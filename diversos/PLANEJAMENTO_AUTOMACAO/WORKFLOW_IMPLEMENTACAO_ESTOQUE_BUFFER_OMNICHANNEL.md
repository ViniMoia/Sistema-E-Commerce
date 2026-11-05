# Workflow de Implementação: Estoque de Segurança Omnichannel (`stockBuffer`)

> **Documento:** Plano de Trabalho, Especificação Técnica e Matriz de Implementação  
> **Arquivo:** `WORKFLOW_IMPLEMENTACAO_ESTOQUE_BUFFER_OMNICHANNEL.md`  
> **Status:** Proposta de Workflow para Análise (Aguardando Aprovação para Execução)  
> **Objetivo:** Blindar o sistema contra a venda online da última unidade física, eliminando concorrência e constrangimento no balcão da loja.  
> **Regras Vinculadas:** [`AGENTS.md`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/AGENTS.md) e [`schema.prisma`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto-notebook-20261025/prisma/schema.prisma)

---

## 1. Contexto e Justificativa de Negócio

### 1.1. O Problema
No varejo híbrido onde a loja física (**SMB Store**) e o **E-Commerce** compartilham o mesmo inventário local:
- Se houver apenas **1 unidade física** na prateleira da loja;
- E um cliente presencial estiver caminhando até o caixa com o produto na mão;
- Enquanto um cliente na internet finaliza o pagamento via PIX no exato mesmo momento;
- **Conflito:** O e-commerce baixa o estoque para zero antes do lojista passar a peça no caixa, gerando recusa de venda ou venda duplicada (*overselling*), criando uma péssima experiência para o cliente que já está fisicamente dentro da loja.

### 1.2. A Regra de Ouro do Varejo Físico
> **"O cliente que já está fisicamente na loja com a mercadoria em mãos tem prioridade presencial absoluta."**

### 1.3. A Solução
Ativar a lógica do campo **`stockBuffer`** (Estoque de Segurança / Margem de Balcão), que já existe nativamente no schema do Prisma (`stockBuffer Int @default(1)`):
- O e-commerce só disponibiliza para compra a quantidade que excede o buffer;
- Quando o estoque total for menor ou igual ao `stockBuffer` (ex.: 1 unidade), a venda online é bloqueada e o produto é apresentado como:  
  **"Disponível exclusivamente para compra presencial na Loja Física"**.

---

## 2. Especificação da Regra de Domínio

### 2.1. Fórmula Canônica de Disponibilidade Online
Para qualquer produto ou variante:

$$\text{Estoque Disponível Online} = \max(0, \text{Estoque Físico Total} - \text{stockBuffer})$$

### 2.2. Tabela de Estados com `stockBuffer = 1` (Padrão)

| Estoque no SMB Store | Estoque no E-Commerce | Pode Comprar Online? | Exibição na Vitrine |
| :---: | :---: | :---: | :--- |
| **5 UN** | 4 UN | Sim (até 4 UN) | Disponível para entrega ou retirada |
| **2 UN** | 1 UN | Sim (apenas 1 UN) | "Última unidade disponível online!" |
| **1 UN** | **0 UN** | **NÃO** | **"Esgotado online · Disponível na Loja Física"** |
| **0 UN** | 0 UN | **NÃO** | "Produto Esgotado" |

### 2.3. Flexibilidade por Tipo de Produto
- **Itens Compartilhados Físico/Virtual (Padrão):** `stockBuffer = 1` (protege a última peça do balcão);
- **Itens de Altíssimo Giro de Balcão:** O lojista pode definir `stockBuffer = 2` ou `3` pelo Admin;
- **Itens Exclusivos de E-Commerce (Sem vitrine física):** `stockBuffer = 0` (permite vender até a última unidade).

---

## 3. Matriz de Impacto e Arquivos Alvo

A implementação do buffer de estoque atua em **5 pontos estratégicos** da aplicação para garantir consistência total:

```mermaid
flowchart TD
    A["Estoque Físico (SMB Store / DB)"] --> B["1. Camada de Leitura e Catálogo"]
    B -->|Exibe Estoque com Buffer| C["Vitrine / PWA / Detalhe do Produto"]
    C --> D["2. Resolução de Variantes (lib/product-variants.ts)"]
    D -->|Bloqueia Variantes com Estoque <= Buffer| E["Seleção de Cor/Tamanho"]
    E --> F["3. Adição ao Carrinho (Cart Service)"]
    F -->|Valida Quantidade Máxima| G["Carrinho de Compras"]
    G --> H["4. Trava Atômica de Checkout (services/inventory.service.ts)"]
    H -->|Rejeita se (stock - buffer < qty)| I["Reserva de Inventário (Transação Neon)"]
    I --> J["Pedido Confirmado sem Conflito no Balcão"]
```

---

## 4. Etapas Detalhadas de Implementação

### Etapa 1: Resolução de Variantes e Regras de Domínio
- **Arquivo Alvo:** [`lib/product-variants.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto-notebook-20261025/lib/product-variants.ts)
- **Modificações:**
  - Ajustar a função de verificação de disponibilidade (`hasStock`):
    ```typescript
    // Antes:
    const hasStock = variant.stock > 0;
    
    // Novo (respeitando o buffer do produto pai):
    const effectiveBuffer = product.stockBuffer ?? 1;
    const hasStock = (variant.stock - effectiveBuffer) > 0;
    ```
  - Assegurar conformidade estrita com o [`AGENTS.md`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/AGENTS.md): variantes cujo estoque estiver dentro da margem de proteção não devem ser selecionáveis no checkout online.

### Etapa 2: Trava Transacional de Inventário (Reserva Atômica)
- **Arquivo Alvo:** [`services/inventory.service.ts`](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto-notebook-20261025/services/inventory.service.ts)
- **Modificações:**
  - Na função `reserveStock` (executada sob `CommerceLocks`):
    - Obter o `stockBuffer` do produto pai;
    - Validar se o estoque remanescente após o decremento respeita o limite mínimo do buffer:
      ```typescript
      const buffer = product.stockBuffer ?? 1;
      if (updatedProduct.stock < buffer) {
        throw new InventoryError(
          'INSUFFICIENT_STOCK',
          `A última unidade deste produto está reservada para compra presencial na loja física.`
        );
      }
      ```
  - Aplicar a mesma salvaguarda simétrica para a variante individual (`updatedVariant.stock < buffer`).

### Etapa 3: Validação na Adição e Atualização do Carrinho
- **Arquivo Alvo:** `services/cart.service.ts` e rotas de carrinho.
- **Modificações:**
  - Impedir que o cliente adicione ao carrinho uma quantidade que ultrapasse o estoque disponível online (`maxQuantity = Math.max(0, stock - stockBuffer)`);
  - Se um produto tiver 2 unidades em estoque e `stockBuffer = 1`, o seletor de quantidade no carrinho limita o teto em **1 unidade**.

### Etapa 4: Exibição na Vitrine e Detalhe do Produto (UI/UX)
- **Arquivos Alvo:**
  - `components/product/product-card.tsx`
  - `components/product/product-actions.tsx`
- **Modificações:**
  - Quando `stock <= stockBuffer && stock > 0`:
    - Desabilitar botão "Comprar Online";
    - Exibir badge informativo amigável:  
      🏷️ **"Disponível apenas na Loja Física (Última peça no balcão)"**;
    - Exibir endereço e botão para "Falar com a loja no WhatsApp" ou "Como chegar".

### Etapa 5: Gestão do Buffer no Painel Administrativo
- **Arquivos Alvo:**
  - `app/admin/products/[id]/page.tsx`
  - `app/api/admin/products/route.ts`
- **Modificações:**
  - Exibir o campo "Estoque de Segurança para Loja Física (Buffer)" no cadastro/edição do produto;
  - Permitir customizar o valor (ex.: 0, 1, 2) com tooltip explicativo para o lojista.

---

## 5. Bateria de Testes Automatizados (Vitest)

Para garantir que a alteração não quebre nenhuma das 101 suítes de teste existentes, desenvolveremos uma nova suíte de testes unitários dedicada:

📁 **Novo Arquivo de Teste:** `tests/unit/inventory-stock-buffer.test.ts`

### Casos de Teste Essenciais:
1. **Caso 1: Produto com estoque 1 e buffer 1**
   - Tentativa de reserva online ➔ Rejeita com `INSUFFICIENT_STOCK` (Reserva protegida para o balcão);
2. **Caso 2: Produto com estoque 2 e buffer 1**
   - Primeira compra online (1 un) ➔ Sucesso (Estoque cai para 1);
   - Segunda compra online imediata (1 un) ➔ Rejeita (Estoque remanescente atingiu o buffer);
3. **Caso 3: Produto exclusivo online (`stockBuffer = 0`)**
   - Produto com estoque 1 e buffer 0 ➔ Permite a compra normalmente até zerar;
4. **Caso 4: Reconciliação e Restituição (Cancelamento)**
   - Cancelamento de pedido devolve o item para o estoque sem corromper o cálculo do buffer;
5. **Caso 5: Concorrência Simultânea**
   - Duas requisições de checkout concorrentes disputando a penúltima unidade: apenas uma é aceita, a segunda é rejeitada com segurança pelo `CommerceLocks`.

---

## 6. Procedimento de Rollout e Critérios de Aceite

1. **Execução Isolada no Worktree:**
   - Implementação estrita na branch `homologacao_teste` do worktree `Projeto-notebook-20261025`;
   - Manutenção do diretório principal `Projeto` estritamente limpo e intocado.
2. **Quality Gates Obrigatórios:**
   - `npx tsc --noEmit` ➔ 0 erros de tipo;
   - `npm run lint` ➔ 0 warnings/erros;
   - `npm test` ➔ 100% dos testes aprovados (mais de 1.000 testes com a nova suíte);
   - `npm run test:operations` ➔ Aprovado.
3. **Critério de Sucesso do Ensaio:**
   - Simular um produto com 1 unidade no SMB Store e comprovar que o e-commerce exibe o item como reservado para a loja física, impedindo o checkout online e eliminando 100% o risco de conflito no balcão.

