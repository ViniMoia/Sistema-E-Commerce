# Relatório de Revisão Técnica e Auditoria Minuciosa Pré-Produção (Revisão 1)

**Projeto:** E-Commerce Multi-Tenant & Plataforma Continental Produtos Estéticos Automotivos  
**Auditor Técnico:** Staff Software Engineer / Tech Lead  
**Data da Revisão:** 16 de Setembro de 2026  
**Localização:** `diversos/PLANEJAMENTO_GERAL/revisao_1/RELATORIO_REVISAO_TECNICA_POS_AUDITORIA.md`  
**Referência Base:** [RELATORIO_AUDITORIA_PRONTIDAO_PRODUCAO.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/PLANEJAMENTO_GERAL/RELATORIO_AUDITORIA_PRONTIDAO_PRODUCAO.md)  
**Status Geral de Prontidão:** **ATENÇÃO — AVANÇO SIGNIFICATIVO COM PONTOS CRÍTICOS IDENTIFICADOS NO FLUXO DE PAGAMENTO E ESTOQUE**

---

## 1. Resumo do Progresso Recente (Ações Concluídas)

Em atendimento à Seção 6 do Relatório de Auditoria anterior, as seguintes ações de saneamento foram plenamente implementadas e verificadas no código-fonte:

| Item | Ação Executada | Status | Evidência de Validação |
| :---: | :--- | :---: | :--- |
| **ACT-001** | **Blindagem da rota de simulação de pagamentos** | ✅ Resolvido | Em `app/api/webhooks/asaas/simulate/route.ts`, requisições em `NODE_ENV === 'production'` retornam `403 Forbidden`. O botão de teste em tela foi desativado em produção. |
| **ACT-002** | **Webhook Asaas em modo Fail-Closed** | ✅ Resolvido | Em `app/api/webhooks/asaas/route.ts`, caso `ASAAS_WEBHOOK_TOKEN` esteja ausente no servidor, a requisição é rejeitada com status `500` (com log de segurança). Tokens divergentes retornam `401 Unauthorized`. 6 testes unitários dedicados aprovados. |
| **ACT-003** | **Sincronização de migrações do Prisma** | ✅ Resolvido | Resolvida a migration `20260831000000_add_loyalty_engine` e gerada a migration `20260916000000_add_asaas_and_delivery_confirmation`. `prisma migrate status` confirma 18 migrations aplicadas e schema 100% atualizado. |
| **ACT-004** | **Documentação do arquivo de ambiente** | ✅ Resolvido | `.env.example` preenchido com todas as variáveis mandatórias e orientações de preenchimento. |
| **ACT-005** | **Validação Zod no registro de usuários** | ✅ Resolvido | Criado `registerSchema` em `lib/validators/auth.ts` e validação estrita em `/api/auth/register`. 14 testes unitários aprovados. |
| **ACT-006** | **Compatibilização do ESLint 9 e Next.js 16** | ✅ Resolvido | Configurado `eslint.config.mjs` no padrão Flat Config oficial do Next 16. Corrigido bug de chamada condicional de Hook em `CatalogPagination.tsx`. `npm run lint` executa com **0 erros**. |
| **ACT-007** | **Correção do número `#` do pedido na tabela admin** | ✅ Resolvido | Seleção de `orderNumber`, `deliveryType` e `freightValue` no Prisma em `order.service.ts` e priorização de `o.orderNumber` autêntico em `OrdersPage`. |
| **ACT-008** | **Supressão de logs de `DYNAMIC_SERVER_USAGE`** | ✅ Resolvido | Exceções de dynamic server usage relançadas em `lib/tenant.ts`, eliminando falsos positivos nos logs de build. |

---

## 2. Análise Minuciosa: Novos Pontos Críticos e Riscos Identificados

Apesar da eliminação das vulnerabilidades de superfície, uma auditoria profunda nos pipelines transacionais de **checkout**, **baixa de estoque** e **chamadas à API do Asaas** revelou inconsistências arquiteturais graves que inviabilizariam a operação em produção.

---

### 🚨 Ponto Crítico P0-01: Duplo Decremento de Estoque e Travamento na Transição para "PAID"

- **Localização:** 
  - [services/checkout.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/checkout.service.ts#L213-L234)
  - [services/order.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/order.service.ts#L280-L309)
  - [services/order.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/order.service.ts#L350-L358)

#### Mecânica da Falha:
1. **No Checkout (`createOrder`)**: Ao gerar o pedido com status `PENDING`, o sistema debita imediatamente o estoque do produto principal e de sua variante:
   ```ts
   // checkout.service.ts - Linhas 214-234
   for (const item of validatedItems) {
     await tx.product.update({
       where: { id: item.productId },
       data: { stock: { decrement: item.quantity } },
     })
     if (item.variantId) {
       await tx.productVariants.update({
         where: { id: item.variantId },
         data: { stock: { decrement: item.quantity } },
       })
     }
   }
   ```
2. **Na Confirmação de Pagamento (`updateOrderStatus`)**: Quando o webhook do Asaas recebe a notificação de pagamento (`PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`) ou o admin aprova o pedido para `PAID`, o método `updateOrderStatus` executa uma segunda verificação e decremento:
   ```ts
   // order.service.ts - Linhas 286-295
   for (const item of itemsWithVariant) {
     const available = stockMap.get(item.productVariantsId) ?? 0;
     if (available < item.quantity) {
       return {
         success: false,
         error: `Estoque insuficiente para a variante ${item.productVariantsId}.`,
         code: "INVALID_TRANSITION",
       };
     }
   }
   // Linhas 304-309
   for (const item of itemsWithVariant) {
     await tx.productVariants.update({
       where: { id: item.productVariantsId, stock: { gte: item.quantity } },
       data: { stock: { decrement: item.quantity } },
     });
   }
   ```

#### Impacto Devastador no Mundo Real:
1. **Cenário de Baixo Estoque (Bloqueio Total de Pedido Pago)**:
   - Suponha que um produto tenha **1 unidade** restante no estoque.
   - O cliente finaliza o checkout: o estoque cai de 1 para 0. O pedido fica `PENDING`.
   - O cliente paga o PIX no banco dele. O dinheiro entra na conta.
   - O Asaas envia o webhook avisando que o pagamento foi confirmado.
   - O sistema tenta mudar o pedido para `PAID`, mas `stockMap.get(...)` retorna 0 (pois já foi decrementado).
   - A condição `0 < 1` é verdadeira: **o sistema rejeita a transição com erro `"Estoque insuficiente"`**.
   - **Resultado:** O cliente pagou pelo produto, mas o pedido fica eternamente travado em `PENDING` e nunca é aprovado automaticamente pelo gateway!
2. **Cenário de Estoque Maior (Furo de Estoque Duplo)**:
   - Se o produto tinha 10 unidades e o cliente comprou 2:
     - No checkout: subtrai 2 (restam 8).
     - No pagamento: subtrai mais 2 (restam 6).
     - **Resultado:** Foram vendidas 2 unidades, mas 4 unidades sumiram do estoque do lojista.
3. **Cancelamento de Pedidos Pendentes (Estoque Queimado)**:
   - Na linha 351 de `order.service.ts`, o estoque só é devolvido se `fullOrder.status === "PAID"`.
   - Se um pedido pendente for cancelado (ex: desistência do cliente ou expiração do PIX), **o estoque decrementado no checkout NUNCA é estornado**, provocando perda permanente de produtos vendíveis no catálogo!
   - Além disso, quando cancela um pedido pago, apenas `productVariants.stock` é incrementado; o `product.stock` pai permanece decrementado.

---

### 🚨 Ponto Crítico P0-02: Falha Mandatória na Criação de Cobranças no Asaas por Ausência de Cliente Cadastrado (`invalid_customer`)

- **Localização:** 
  - [services/checkout.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/checkout.service.ts#L424-L432)
  - [services/asaas/asaas.client.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/asaas/asaas.client.ts#L44-L62)

#### Mecânica da Falha:
No método `createOrder` de `checkout.service.ts`:
```ts
const asaasPayment = await asaasClient.createPayment({
  customer: params.customer.email, // <-- ERRO: Passando string de e-mail!
  billingType: 'PIX',
  value: Number(total),
  dueDate: dueDateStr,
  description: `Pedido #${created.orderNumber} - Continental`,
  externalReference: created.id,
})
```
#### Impacto na API do Asaas:
1. De acordo com a especificação oficial da API REST v3 do Asaas, o endpoint `POST /v3/payments` **exige obrigatoriamente no campo `customer` o identificador único do cliente Asaas** (com prefixo `cus_XXXXXXXXXXXX`), e **não aceita endereço de e-mail**.
2. Ao receber `customer: "joao@email.com"`, o Asaas rejeita a chamada com código HTTP `400 Bad Request`:
   ```json
   {
     "errors": [
       {
         "code": "invalid_customer",
         "description": "O campo customer deve ser o ID de um cliente cadastrado no Asaas."
       }
     ]
   }
   ```
3. O bloco `try/catch` de `checkout.service.ts` (linhas 446-448) captura o erro, emite um warning de console e faz o fallback para uma chave estática genérica:
   ```ts
   if (!pixPayload) {
     pixPayload = `00020126580014br.gov.bcb.pix0136...`
   }
   ```
4. **Consequência em Produção:** Em um ambiente com chave de API real do Asaas, **100% das tentativas de gerar cobrança dinâmica falharão**. O pedido será gravado sem `asaasPaymentId`, nenhum QR Code dinâmico será gerado pelo Asaas, e nenhum webhook de pagamento jamais chegará para esses pedidos.

---

### ⚠️ Ponto de Atenção P1-01: Descarte de CPF/CNPJ no Cadastro e Checkout

- **Localização:** 
  - [components/checkout/CheckoutForm.tsx](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/components/checkout/CheckoutForm.tsx#L69)
  - [lib/validators/checkout.validators.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/validators/checkout.validators.ts#L17)
  - [prisma/schema.prisma](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/prisma/schema.prisma#L63-L95)
  - [services/checkout.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/checkout.service.ts#L241-L260)

#### Mecânica da Falha:
1. O formulário frontend coleta e formata o CPF/CNPJ do cliente.
2. O schema do checkout (`checkout.validators.ts`) aceita `cpfCnpj: z.string().optional()`.
3. Contudo, nem a tabela `User` nem a tabela `Order` possuem a coluna `cpfCnpj` no `schema.prisma`.
4. O método `checkout.service.ts` descarta o dado na criação/upsert do usuário.
5. **Impacto:**
   - O Asaas exige nome, e-mail e CPF/CNPJ para registrar clientes e emitir cobranças vinculadas ao Banco Central (regra BACEN para PIX Dinâmico). Sem o CPF/CNPJ salvo e enviado ao Asaas, o cadastro do cliente no gateway falhará ou ficará em inconformidade fiscal.

---

### ⚠️ Ponto de Atenção P1-02: Vazamento Potencial de Dados Cross-Tenant na Rota `/api/orders`

- **Localização:** 
  - [app/api/orders/route.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/api/orders/route.ts#L45-L60)
  - [services/order.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/order.service.ts#L124-L132)

#### Mecânica da Falha:
Em `app/api/orders/route.ts`:
```ts
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const targetUserId = guard.user.role === "ADMIN" ? undefined : guard.user.id;
    const orders = await getOrdersByUser(targetUserId as string);
    return NextResponse.json(orders, { status: 200 });
  } catch (error) { ... }
}
```
E na implementação de `getOrdersByUser`:
```ts
export async function getOrdersByUser(userID: string): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: { userID },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return orders as unknown as OrderSummary[];
}
```
#### Impacto:
1. Se um usuário com papel `ADMIN` chamar a rota `/api/orders` (em vez de `/api/admin/orders`), `targetUserId` é `undefined`. No Prisma, `{ userID: undefined }` significa **ausência de filtro**. A consulta retornará **TODOS os pedidos de TODAS as lojas e clientes existentes no banco de dados**, violando o isolamento multi-tenant (`lojaID`).
2. Se um cliente comum (`CUSTOMER`) chamar a rota, o filtro é apenas por `userID`, sem restringir pelo `lojaID` da loja em que ele está navegando.

---

### ⚠️ Ponto de Atenção P1-03: Inexistência de Fluxo de Recuperação de Senhas (Self-Service)

- **Localização:** 
  - `prisma/schema.prisma` (linhas 74-75: colunas `resetToken` e `resetTokenExpires` existem).
  - Ausência de rotas em `app/api/auth/forgot-password` e `app/api/auth/reset-password`.
- **Impacto:**
  - Caso um usuário esqueça sua senha, ele não tem como recuperá-la de forma autônoma. O suporte precisaria intervir diretamente no banco de dados. Este ponto está diretamente atrelado à pendência de definição do provedor de e-mails transacionais (Resend / AWS SES).

---

### ℹ️ Pontos Secundários de Aperfeiçoamento (P2)

1. **Migração do arquivo `middleware.ts` para a convenção Next.js 16 `proxy.ts`**:
   - O Next.js 16 emite warning durante o build sobre a depreciação de `middleware.ts`. A migração é suportada via codemod ou renomeação/adaptação simples.
2. **Substituição de tags `<img>` por `<Image />` (`next/image`)**:
   - Foram identificados 13 avisos no linter (`@next/next/no-img-element`) em componentes de vitrine e catálogo. A troca melhora o Core Web Vitals (LCP/CLS) e evita carregamento de imagens pesadas sem compressão WebP/AVIF.
3. **Endpoint residual de teste**:
   - `app/api/admin/example/route.ts` é uma rota de demonstração sem propósito de negócio que deve ser removida antes do lançamento.
4. **Campos inativos da Nuvemshop**:
   - Existem colunas como `nuvemshopStoreId`, `nuvemshopAccessToken` e índices associados no banco de dados sem nenhum código ativo de sincronização. Recomenda-se mantê-los documentados como inativos ou arquivá-los.

---

## 3. Matriz de Priorização para Correção (Revisão 1)

| Código | Descrição do Problema | Severidade | Categoria | Impacto no Go-Live | Status Atual | Ação Realizada / Recomendada |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **REV-001** | **Duplo decremento de estoque e travamento de pedidos pagos** | **P0** | Integridade / Regra de Negócio | **Crítico (Bloqueador)** | ✅ **RESOLVIDO & HOMOLOGADO** | Criado `InventoryService` com reserva atômica no checkout, eliminação do segundo decremento em `updateOrderStatus('PAID')` e estorno simétrico em cancelamentos (`PENDING`/`PAID`). |
| **REV-002** | **Fluxo Asaas Customer: criação/consulta de `customer` antes do pagamento** | **P0** | Integração / Gateway | **Crítico (Bloqueador)** | ✅ **RESOLVIDO & HOMOLOGADO** | Implementado padrão find-or-create (`getOrCreateCustomer`) no `AsaasClient`, sanitização de dígitos (telefone e CPF/CNPJ) e envio obrigatório de `cus_...` para `POST /v3/payments`. |
| **REV-003** | **Persistência de CPF/CNPJ no Usuário/Pedido** | **P1** | Persistência / Conformidade | **Alto** | ✅ **RESOLVIDO & HOMOLOGADO** | Colunas `User.cpfCnpj` e `Order.customerCpfCnpj` adicionadas, migração `20260916130000_add_cpf_cnpj_to_user_and_order` aplicada no Supabase, Zod schemas e snapshot imutável no checkout. |
| **REV-004** | **Blindagem Multi-Tenant em `/api/orders`** | **P1** | Segurança / Isolamento | **Alto** | ✅ **RESOLVIDO & HOMOLOGADO** | Eliminada brecha de vazamento global por admin; adicionado escopo mandatório `{ userID, lojaID }` em `order.service.ts` com validação de entrada, fail-closed por tenant em `GET /api/orders` e prevenção de spoofing em `POST /api/orders`. |
| **REV-005** | **Fluxo de Recuperação de Senha & E-mails** | **P2** | Funcionalidade / Suporte | **Médio** | ✅ **RESOLVIDO & HOMOLOGADO** | Arquitetura desacoplada de e-mails transacionais (`lib/email`) com suporte a Resend e fallback in-memory, geração de token CSPRNG (256 bits), expiração rígida de 1h, defesa anti-enumeração, endpoints `/api/auth/forgot-password` e `/reset-password` com rate limit, e páginas completas integradas. |
| **REV-006** | **Migração `middleware.ts` para `proxy.ts`** | **P2** | Modernização Next.js 16 | **Baixo** | ⏳ **PENDENTE** | Atualizar para o padrão mais recente do framework. |

---

## 4. Conclusão Técnica e Próximos Passos

Todos os cinco itens prioritários da Revisão Técnica (**REV-001**, **REV-002**, **REV-003**, **REV-004** e **REV-005**) foram concluídos e homologados com máxima precisão, Clean Architecture e conformidade com os princípios SOLID:
- **REV-001 (Estoque):** A integridade transacional de estoque está garantida (reserva no checkout, eliminação do duplo decremento no pagamento e estorno simétrico no cancelamento).
- **REV-002 (Asaas):** O gateway Asaas agora recebe identificadores de cliente oficiais (`cus_...`) via find-or-create, eliminando erros de cobrança PIX.
- **REV-003 (CPF/CNPJ):** A persistência de CPF/CNPJ do comprador no cadastro (`User`) e no pedido (`Order.customerCpfCnpj`) está ativa e sincronizada no PostgreSQL do Supabase, cumprindo os requisitos fiscais e do BACEN.
- **REV-004 (Multi-Tenant):** O isolamento multi-tenant e proteção BOLA na API de pedidos (`/api/orders`) foi blindado (eliminação de consultas irrestritas por administradores, escopo estrito por loja e prevenção de spoofing no POST).
- **REV-005 (Recuperação de Senha & E-mails):** Serviço transacional de e-mails desacoplado com suporte a Resend REST nativo, tokens criptográficos seguros (256 bits), defesa anti-enumeração OWASP, rate limiting e páginas públicas responsivas (`/forgot-password` e `/reset-password`).

**Estado Atual dos Testes e Build:**
- **32 arquivos de testes unitários**, totalizando **209 testes**, com **100% de aprovação**.
- **TypeScript:** Verificação estática (`tsc --noEmit`) com **0 erros**.
- **ESLint 9:** **0 erros**.
- **Next.js 16 Production Build:** Concluído com sucesso (**status 0**, 49 rotas geradas).


