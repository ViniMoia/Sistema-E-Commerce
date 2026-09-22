# Relatório Técnico da Auditoria Profunda e Contínua do Sistema (Rodada 2)
## Inspeção Ofensiva de Concorrência, Pentest OWASP API 2023, FSM e MCP Swarm

**Data da Auditoria:** 16 de Setembro de 2026  
**Auditor Líder:** Staff Software Engineer / Lead Security Auditor  
**Repositório:** `ecommerce-app` (Continental Produtos Estéticos Automotivos)  
**Status do Sistema:** Auditado — 8 Novas Ocorrências Identificadas (2 Críticas, 3 Altas, 2 Médias, 1 Baixa)  
**Arquivo de Destino:** `diversos/PLANEJAMENTO_GERAL/RELATORIO_AUDITORIA_PROFUNDA_RODADA_2.md`

---

## 1. Sumário Executivo e Matriz Comparativa de Maturidade

Após a implementação bem-sucedida e homologação de 100% das fases anteriores (**REV-001 a REV-005** e **AUD-001 a AUD-010**), que garantiram 34 suítes de testes unitários com **222 testes aprovados**, compilação estrita Next.js 16.3.5 sem erros e erradicação de vulnerabilidades de dependências, foi executada a **Rodada 2 de Auditoria Profunda**.

Esta segunda rodada atuou como um exercício de **Red Team Avançado** e **Engenharia do Caos**, inspecionando camadas de concorrência profunda no PostgreSQL, invariantes relacionais de banco, superfícies de API públicas e integração financeira com o gateway Asaas.

### Quadro Comparativo de Segurança e Resiliência

| Métrica de Avaliação | Rodada 1 (Pós-Revisão 1) | Rodada 2 (Auditoria Profunda Atual) | Status de Alvo |
| :--- | :---: | :---: | :---: |
| **Testes Unitários Automatizados** | 222 aprovados (100%) | 222 aprovados (100%) | 240+ (após correções R2) |
| **Vulnerabilidades de Dependências (npm)** | 0 Críticas / 0 Altas | 0 Críticas / 0 Altas | 0 |
| **Isolamento de Domínio / Tenancy** | Blindado em 95% | 1 Rota com fail-open pontual | 100% Fail-Closed |
| **Integridade de FSM & Webhooks** | Blindado com token | Race condition em retentativas | 100% Idempotência Estrita |
| **Resiliência a Concorrência & Locks** | Locks atômicos simples | Risco de Deadlock multi-item e colisão de chave | Deadlock-free determinístico |
| **OWASP API Security Top 10** | Aderente em 85% | Bypass de Rate Limit via Headers e IDOR em Checkout | 100% Zero-Trust |

---

## 2. Emprego Operacional das Ferramentas MCP na Auditoria

Conforme especificado no Plano de Metodologia, a auditoria mobilizou ferramentas especializadas do ecossistema **Model Context Protocol (MCP)**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   MAPA DE EXECUÇÃO DE FERRAMENTAS MCP NA RODADA 2                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [MCP: OFENSIVO & SEGURANÇA AVANÇADA]                                                  │
│  ├── metaharness_security_bench ──► Identificou AUD2-001 (BOLA/IDOR no checkout)       │
│  ├── aidefence_scan             ──► Identificou AUD2-003 (Bypass de Rate Limit por IP) │
│  └── metaharness_threat_model   ──► Identificou AUD2-005 (FSM financeira no Asaas)    │
│                                                                                        │
│  [MCP: CONCORRÊNCIA, DESEMPENHO & BANCO DE DADOS]                                      │
│  ├── performance_bottleneck     ──► Identificou AUD2-004 (Deadlocks PostgreSQL 40P01)  │
│  ├── agentdb_graph-query        ──► Identificou AUD2-002 (Unique Constraint OrderItem) │
│  └── analyze_file-risk          ──► Identificou AUD2-008 (Índices e Proxy Next.js 16)  │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Matriz Sintética de Vulnerabilidades Encontradas (Rodada 2)

| ID | Severidade | CVSS v3.1 | Categoria OWASP / Arquitetura | Arquivo / Componente Afetado | Linhas |
| :---: | :---: | :---: | :--- | :--- | :---: |
| **AUD2-001** | **CRÍTICA** | **9.1** | OWASP API1:2023 (BOLA / IDOR) | `services/checkout.service.ts` | 235-244 |
| **AUD2-002** | **CRÍTICA** | **8.2** | Falha de Integridade Relacional / DoS | `prisma/schema.prisma` (`OrderItem`) | 332 |
| **AUD2-003** | **ALTA** | **7.5** | OWASP API4:2023 (Rate Limit Bypass) | `lib/rate-limit.ts` | 78-83 |
| **AUD2-004** | **ALTA** | **7.4** | Concorrência / Deadlock PostgreSQL | `services/inventory.service.ts` | 34-72 |
| **AUD2-005** | **ALTA** | **7.1** | Concorrência em Webhooks & FSM | `app/api/webhooks/asaas/route.ts` | 41-61, 102-123 |
| **AUD2-006** | **MÉDIA** | **5.3** | Tenancy Fail-Open em Polling | `app/api/orders/[id]/status/route.ts` | 38-43 |
| **AUD2-007** | **MÉDIA** | **4.3** | Race Condition em Confirmação | `app/api/orders/[id]/confirm-delivery/route.ts` | 75-105 |
| **AUD2-008** | **BAIXA** | **3.9** | Next.js 16 Proxy & Índices DB | `middleware.ts`, `prisma/schema.prisma` | N/A |

---

## 4. Detalhamento Técnico das Vulnerabilidades e Provas de Conceito (PoCs)

---

### [AUD2-001] [CRÍTICA] Injeção de `customer.userId` em Checkout Público: BOLA / IDOR e Furto de Pontos de Fidelidade
- **Classificação:** OWASP API Security Top 10 (2023) - API1: Broken Object Level Authorization (BOLA / IDOR)
- **Score CVSS:** `9.1` (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)
- **Arquivos Afetados:**
  - `services/checkout.service.ts` (linhas 235-244, 280-285)
  - `lib/validators/checkout.validators.ts` (linha 18)
  - `app/api/checkout/route.ts` (linha 48)

#### Mecanismo da Falha:
O endpoint `/api/checkout` é uma rota pública destinada a permitir compras de clientes cadastrados ou visitantes (*guest checkout*). No validador `createOrderSchema`, o campo `customer.userId` é aceito livremente como opcional. No serviço `checkout.service.ts`:
```typescript
// services/checkout.service.ts:235-244
let resolvedUserId: string
if (params.customer.userId) {
  resolvedUserId = params.customer.userId
  if (cleanCustomerCpfCnpj) {
    await tx.user.update({
      where: { id: resolvedUserId },
      data: { cpfCnpj: cleanCustomerCpfCnpj },
    })
  }
} else {
  // cria ou atualiza usuário pelo e-mail
}
```
Não há **nenhuma verificação** de que a requisição HTTP possui uma sessão ativa, tampouco se a sessão logada corresponde ao `params.customer.userId`, ou se o usuário pertence à mesma loja (`lojaID`).

#### Vetor de Exploração (PoC):
Um atacante não autenticado pode enviar o payload:
```json
POST /api/checkout
{
  "lojaID": "loja-1",
  "customer": {
    "name": "Atacante",
    "email": "atacante@evil.com",
    "phone": "11999999999",
    "userId": "uuid-da-vitima"
  },
  "pointsToRedeem": 10000,
  "items": [{ "productId": "prod-1", "quantity": 1, "price": 100 }],
  "deliveryType": "NONE"
}
```
**Consequências Imediatas:**
1. **Furto de Saldo de Fidelidade:** A chamada `simulatePointsRedemption` e `debitRedeemedPoints` utiliza `resolvedUserId`. O atacante consome 10.000 pontos da carteira da vítima para abater o valor de seu pedido.
2. **Corrupção de Cadastro PII:** O comando `tx.user.update` sobrescreve o `cpfCnpj` da vítima no banco com o CPF informado pelo atacante.
3. **Quebra de Multi-Tenancy:** Se a vítima pertence à Loja A e o atacante compra na Loja B, o banco de dados associa um pedido da Loja B a um usuário da Loja A.

#### Remediação Técnica Proposta:
Nunca confiar em `params.customer.userId` proveniente do cliente. Resolver o usuário de forma autoritativa:
- Se houver sessão ativa (`getCurrentUser()`), o ID do usuário deve ser estritamente `session.user.id`, validando que `session.user.lojaID === activeLoja.id`.
- Se o usuário for anônimo/visitante, ignorar qualquer `userId` enviado e realizar o `upsert` estritamente por e-mail e `lojaID`.

---

### [AUD2-002] [CRÍTICA] Unique Constraint `@@unique([orderId, productId])` no Modelo `OrderItem` Bloqueia Compras com Múltiplas Variações
- **Classificação:** Falha de Modelagem de Dados / Indisponibilidade de Negócio (Denial of Core Flow)
- **Score CVSS:** `8.2` (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:H)
- **Arquivos Afetados:**
  - `prisma/schema.prisma` (linha 332)
  - `services/checkout.service.ts` (linhas 389-399)

#### Mecanismo da Falha:
No `prisma/schema.prisma`:
```prisma
// prisma/schema.prisma:317-334
model OrderItem {
  id                String           @id @default(uuid())
  orderId           String
  order             Order            @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId         String?
  product           Product?         @relation(fields: [productId], references: [id])
  name              String
  quantity          Int
  price             Decimal          @db.Decimal(10, 2)
  color             String?
  size              String?
  createdAt         DateTime         @default(now())
  variant           ProductVariants? @relation(fields: [productVariantsId], references: [id])
  productVariantsId String?

  @@unique([orderId, productId])
  @@index([productId])
}
```
A diretiva `@@unique([orderId, productId])` impõe que dentro de um mesmo pedido (`orderId`), um mesmo `productId` **só pode aparecer exatamente uma vez**.

#### Cenário de Falha em Produção:
1. Uma loja de produtos automotivos possui o produto "Shampoo Automotivo Continental" com duas variantes:
   - Frasco 500ml (`variantId: "var-1"`)
   - Galão 5L (`variantId: "var-2"`)
2. Ambas as variantes compartilham o mesmo `productId: "prod-shampoo"`.
3. O cliente adiciona ambos ao carrinho e avança para o checkout.
4. Ao submeter o pedido, `tx.order.create` tenta inserir dois registros em `OrderItem` com o mesmo `orderId` e `productId`.
5. O PostgreSQL aborta a transação com erro `PrismaClientKnownRequestError: P2002 - Unique constraint failed on the fields: (orderId, productId)`.
6. O checkout falha com HTTP 400 "Erro interno do servidor ao criar pedido", impedindo o cliente de concluir a compra.

#### Remediação Técnica Proposta:
Remover a restrição `@@unique([orderId, productId])` de `OrderItem`. No comércio eletrônico, itens de pedido podem conter diferentes variantes do mesmo produto pai, ou mesmo linhas separadas para o mesmo produto com atributos distintos. A integridade primária da linha é garantida pelo campo `id @id @default(uuid())`. Se desejado controle de unicidade por variação, utilizar `@@unique([orderId, productVariantsId])` condicional ou gerenciar o agrupamento na aplicação.

---

### [AUD2-003] [ALTA] Bypass Completo de Rate Limiting via Spoofing do Header `X-Forwarded-For`
- **Classificação:** OWASP API Security Top 10 (2023) - API4: Unrestricted Resource Consumption
- **Score CVSS:** `7.5` (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
- **Arquivos Afetados:**
  - `lib/rate-limit.ts` (linhas 77-83, 88-96)

#### Mecanismo da Falha:
A função `getClientIp` obtém o endereço do cliente da seguinte forma:
```typescript
// lib/rate-limit.ts:77-83
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
```
A função confia cegamente no **primeiro elemento** do header `x-forwarded-for`. Em conexões HTTP convencionais ou quando a aplicação opera atrás de balanceadores/proxies que realizam append de IPs (ou em deploys onde o cabeçalho não é sanitizado no edge), um atacante pode injetar qualquer valor arbitrário:
`X-Forwarded-For: 203.0.113.199`

#### Vetor de Exploração (PoC):
Um invasor querendo realizar ataques de força bruta contra `/api/auth/login`, registro em massa em `/api/auth/register`, ou DoS no inventário em `/api/checkout`:
```bash
for i in $(seq 1 1000); do
  curl -X POST https://loja.com/api/auth/login \
    -H "X-Forwarded-For: 10.0.$((i/256)).$((i%256))" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@loja.com","password":"guess"}'
done
```
Como o IP extraído muda a cada requisição, a chave `${action}:${ip}` é sempre nova. **O rate limiter nunca bloqueia a requisição**, permitindo força bruta infinita. Além disso, o mapa em memória `rateLimitStore` é inundado com milhares de chaves falsas, provocando esgotamento de memória (*Memory Leak / DoS*).

#### Remediação Técnica Proposta:
1. Inspecionar cabeçalhos autoritativos de borda de acordo com o provedor de hospedagem (ex: `cf-connecting-ip` da Cloudflare, `x-vercel-forwarded-for` da Vercel, ou o último IP confiável em proxies Nginx/ALB).
2. Sanitizar e validar o IP com expressões regulares de formato IPv4/IPv6 válido.
3. Se não houver proxy confiável ou o IP for inválido, recorrer a identificadores adicionais como fallback e limitar o tamanho máximo do `Map` em memória.

---

### [AUD2-004] [ALTA] Risco de Deadlock Concorrente (PostgreSQL 40P01) em Pedidos com Múltiplos Itens
- **Classificação:** Concorrência e Transações em Banco de Dados / Chaos Engineering
- **Score CVSS:** `7.4` (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:H)
- **Arquivos Afetados:**
  - `services/inventory.service.ts` (linhas 29-73)
  - `services/checkout.service.ts` (linhas 219-228)

#### Mecanismo da Falha:
No método `InventoryService.reserveStock(items, tx)`, a reserva itera sobre o array `items` na exata ordem enviada pelo cliente:
```typescript
// services/inventory.service.ts:34-47
for (const item of items) {
  const updatedProduct = await tx.product.update({
    where: { id: item.productId },
    data: { stock: { decrement: quantity } },
  });
  // ...
}
```
No PostgreSQL, o comando `UPDATE` adquire um bloqueio exclusivo de linha (*Row Exclusive Lock*).
Se duas transações concorrentes tentam atualizar os mesmos recursos em ordens opostas:
- **Transação A (Pedido 1):** Atualiza Produto 1, depois tenta atualizar Produto 2.
- **Transação B (Pedido 2):** Atualiza Produto 2, depois tenta atualizar Produto 1.

#### Cenário de Concorrência:
1. Transação A adquire lock no Produto 1.
2. Transação B adquire lock no Produto 2.
3. Transação A tenta adquirir lock no Produto 2 (fica bloqueada esperando a Transação B).
4. Transação B tenta adquirir lock no Produto 1 (fica bloqueada esperando a Transação A).
5. O PostgreSQL detecta o ciclo de dependência mútua e dispara o erro:
   `ERROR 40P01: deadlock detected - Process X waits for ShareLock on transaction Y`.
6. Uma das transações é abortada imediatamente com erro 500 não tratado.

#### Remediação Técnica Proposta:
**Ordenação Determinística de Locks:** Antes de iniciar as operações de atualização de estoque, ordenar obrigatoriamente os itens pelo identificador único (`productId` crescente, seguido de `variantId` crescente). Adicionalmente, consolidar itens duplicados do mesmo produto no array antes do lock, garantindo que o PostgreSQL sempre adquira os locks na mesma sequência universal em todas as transações, eliminando a possibilidade matemática de deadlocks.

---

### [AUD2-005] [ALTA] Condição de Corrida em Webhooks Asaas e Captura Silenciosa de Pagamentos em Pedidos Cancelados
- **Classificação:** Integridade Financeira / Concorrência em Mensageria Assíncrona
- **Score CVSS:** `7.1` (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:L)
- **Arquivos Afetados:**
  - `app/api/webhooks/asaas/route.ts` (linhas 41-61, 102-123)

#### Mecanismo da Falha:
A rota de webhook apresenta duas falhas de borda:
1. **Race Condition no Registro de Idempotência:**
   ```typescript
   // Linhas 41-61
   const existingEvent = await prisma.paymentWebhookEvent.findUnique({ where: { eventId } });
   if (existingEvent) return NextResponse.json({ status: 'ALREADY_PROCESSED' });
   await prisma.paymentWebhookEvent.create({ data: { eventId, ... } });
   ```
   Se o Asaas disparar duas notificações simultâneas do mesmo evento (comum em picos de rede ou retentativas automáticas), ambas as threads passam pelo `findUnique` antes de qualquer escrita ser confirmada. A segunda chamada a `create` quebra na constraint única do banco e cai no bloco `catch`, retornando HTTP 500. Isso faz o Asaas entender que o endpoint caiu e continuar reenviando o webhook em loop.

2. **Pagamento Confirmado em Pedido Já Cancelado (*Late Payment on Expired Order*):**
   ```typescript
   // Linhas 102-123
   if (body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED') {
     if (order.status === 'PENDING') {
       await updateOrderStatus({ orderId: order.id, newStatus: 'PAID' });
     }
   }
   ```
   Se o cliente demorou para pagar o PIX e o pedido foi cancelado automaticamente por expiração (liberando o estoque de volta para a loja), mas o cliente pagou segundos depois no banco, o Asaas envia `PAYMENT_CONFIRMED`.
   O webhook verifica que `order.status !== 'PENDING'` (está `CANCELLED`) e simplesmente **ignora a transição**, retornando 200 PROCESSED.
   - O dinheiro entra na conta do lojista no Asaas.
   - O pedido continua marcado como `CANCELLED` no painel.
   - Os produtos já podem ter sido recomprados por outro cliente.
   - **Nenhum alerta de auditoria ou notificação administrativa é gerado**, deixando o lojista sem saber que precisa estornar o cliente ou resolver o atendimento.

#### Remediação Técnica Proposta:
1. Tratar a criação de `paymentWebhookEvent` com bloco `try/catch` capturando o erro `P2002` (Unique Constraint) do Prisma e retornando HTTP 200 `{ status: 'ALREADY_PROCESSED' }` graciosamente.
2. Quando um evento `PAYMENT_CONFIRMED` for recebido para um pedido `CANCELLED`, registrar imediatamente um alerta de alta prioridade na tabela `AuditLog` (`action: "PAYMENT_RECEIVED_ON_CANCELLED_ORDER"`), marcar no `adminNotes` a discrepância financeira e registrar flag para ação imediata do operador.

---

### [AUD2-006] [MÉDIA] Verificação de Tenancy Permissiva (*Fail-Open*) na Consulta de Status de Pedidos
- **Classificação:** Multi-Tenant Isolation / Fail-Open Pattern
- **Score CVSS:** `5.3` (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N)
- **Arquivos Afetados:**
  - `app/api/orders/[id]/status/route.ts` (linhas 37-43)

#### Mecanismo da Falha:
No endpoint público de polling de status de pedido:
```typescript
// app/api/orders/[id]/status/route.ts:37-43
const activeLoja = await getLojaFromHeaders();
const order = await prisma.order.findUnique({ where: { id } });

if (!order || (activeLoja && order.lojaID !== activeLoja.id)) {
  return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
}
```
A condição `(activeLoja && order.lojaID !== activeLoja.id)` é **permissiva** (*fail-open*). Se por alguma razão o header `Host` não puder ser resolvido e `activeLoja` for `null`, a segunda parte da verificação é ignorada, e o sistema retorna o status de pedidos de qualquer loja da plataforma.

#### Remediação Técnica Proposta:
Adotar o padrão estrito **Fail-Closed**: se `!activeLoja`, rejeitar imediatamente com HTTP 404.

---

### [AUD2-007] [MÉDIA] Condição de Corrida de Duplo Clique na Confirmação de Entrega pelo Cliente
- **Classificação:** Idempotência e Concorrência de Interface
- **Score CVSS:** `4.3` (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N)
- **Arquivos Afetados:**
  - `app/api/orders/[id]/confirm-delivery/route.ts` (linhas 75-105)

#### Mecanismo da Falha:
A verificação de elegibilidade (`order.status !== 'DELIVERED'`) é feita fora da transação atômica. Se um cliente clicar duas vezes rapidamente no botão "Confirmar Recebimento", ambas as requisições leem o status `SHIPPED` antes do commit da primeira. Ambas executam o `order.update` e geram dois registros duplicados na tabela `AuditLog`.

#### Remediação Técnica Proposta:
Condicionar o `update` no Prisma com verificação do status anterior ou aplicar controle de concorrência otimista (`where: { id: order.id, status: { not: 'DELIVERED' } }`).

---

### [AUD2-008] [BAIXA] Convenção de Middleware Depreciada no Next.js 16 e Ausência de Índices Compostos
- **Classificação:** Modernização de Arquitetura & Otimização de Performance
- **Score CVSS:** `3.9` (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N)
- **Arquivos Afetados:**
  - `middleware.ts` (linha 3)
  - `prisma/schema.prisma` (`Order`, linhas 311-315)

#### Mecanismo da Falha:
1. O Next.js 16 emite aviso de depreciação durante o build:
   `The "middleware" file convention is deprecated. Please use "proxy" instead.`
   A documentação do Next.js 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`) instrui a renomeação do arquivo para `proxy.ts` com a exportação da função `proxy(request: NextRequest)`.
2. O modelo `Order` no banco de dados não possui índice composto para as listagens mais frequentes do painel administrativo (`lojaID` + `status` + `createdAt DESC`) nem índice na chave estrangeira `userID`, provocando *Sequential Scans* no PostgreSQL à medida que o volume de pedidos cresce.

#### Remediação Técnica Proposta:
1. Migrar `middleware.ts` para `proxy.ts`.
2. Acrescentar índices no `prisma/schema.prisma`:
   - `@@index([lojaID, status, createdAt(sort: Desc)])`
   - `@@index([userID, createdAt(sort: Desc)])`

---

## 5. Plano de Resolução e Implementação Sequencial

Recomenda-se a execução das correções organizadas em 3 fases prioritárias:

### Fase 1 — Bloqueio Imediato de Riscos Críticos e Integridade Central
- [ ] **Fix AUD2-001:** Remover a aceitação cega de `customer.userId` no checkout e forçar resolução segura da sessão autenticada (`getCurrentUser()`).
- [ ] **Fix AUD2-002:** Remover a restrição `@@unique([orderId, productId])` no modelo `OrderItem` do Prisma, permitindo pedidos com múltiplas variantes do mesmo produto pai.
- [ ] **Fix AUD2-003:** Blindar `getClientIp` no rate limiter contra injeção e falsificação do cabeçalho `X-Forwarded-For`.

### Fase 2 — Resiliência Concorrente, FSM e FinTech
- [ ] **Fix AUD2-004:** Implementar ordenação determinística de produtos/variantes por ID em `InventoryService.reserveStock` para eliminar deadlocks no PostgreSQL.
- [ ] **Fix AUD2-005:** Proteger o webhook do Asaas contra exceção `P2002` em retentativas concorrentes e registrar alertas de auditoria para pagamentos de pedidos cancelados.
- [ ] **Fix AUD2-006 & AUD2-007:** Aplicar padrão fail-closed em `orders/[id]/status` e idempotência atômica em `confirm-delivery`.

### Fase 3 — Modernização Arquitetural Next.js 16 e Índices
- [ ] **Fix AUD2-008:** Migrar convenção `middleware.ts` para `proxy.ts` conforme especificação do Next.js 16 e adicionar índices compostos de alta performance no Prisma.

---

## 6. Conclusão da Auditoria

A Rodada 2 de Auditoria Profunda atingiu seu objetivo de inspecionar os cenários mais complexos de borda, concorrência e segurança ofensiva. Nenhuma modificação em código de produção foi realizada durante esta análise analítica.

**Próximo Passo:** O auditor aguarda a revisão deste relatório e a autorização do usuário para iniciar a implementação das correções em código.
