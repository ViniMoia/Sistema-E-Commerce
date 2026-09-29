# Auditoria de Backend, APIs e Regras de Negócio

**Etapa:** 03/15  
**Data da análise:** 2026-09-25  
**Escopo:** backend HTTP, contratos consumidos pelo frontend e regras de carrinho, checkout, pedido, pagamento, frete, pontos e estoque  
**Base analisada:** estado local do repositório; sem acesso a produção, banco real ou serviços externos

## 1. Resultado executivo

O backend possui controles positivos relevantes no caminho canônico `POST /api/checkout`: validação Zod, resolução de tenant pelo host, releitura de preço no banco, reserva transacional de estoque e cálculo de pontos no servidor. Esses controles, contudo, não tornam o fluxo publicável no estado observado.

Há um **BLOCKER funcional**: o checkout renderizado chama uma rota inexistente e envia/consome contratos incompatíveis com a rota implementada. Há ainda cinco achados críticos: exposição pública de credenciais de loja, frete controlável pelo cliente, um segundo caminho de criação de pedido que contorna o checkout canônico, confirmação de pagamentos sem reconciliação financeira robusta e transições concorrentes de pedido que podem repetir estoque/pontos.

**Conclusão limitada a esta etapa:** publicação não recomendada até a correção e regressão de `BE-001` a `BE-007`, com prioridade adicional para `BE-012`. A análise foi estática porque as dependências locais não estão instaladas.

### Contagem por severidade

| Severidade | Quantidade |
|---|---:|
| BLOCKER | 1 |
| CRITICAL | 5 |
| HIGH | 6 |
| MEDIUM | 5 |
| LOW | 0 |
| INFORMATIONAL | 0 |
| **Total** | **17** |

### Bloqueios de publicação

- `BE-001`: o checkout web não alcança o handler existente e, mesmo se o caminho fosse corrigido isoladamente, DTO e envelope de resposta continuariam incompatíveis.
- `BE-002`: endpoints públicos devolvem credenciais operacionais da loja.
- `BE-003`: custo de frete não local pode ser escolhido pelo cliente, inclusive zero.
- `BE-004`: `POST /api/orders` cria pedidos sem o conjunto de invariantes do checkout e admite uma cadeia cross-tenant via carrinho.
- `BE-005`: webhook pode confirmar um pedido sem conferir valor e pode considerar definitivamente processado um evento cujos efeitos falharam.
- `BE-006`: transições não usam compare-and-set; chamadas concorrentes podem duplicar estorno de estoque e movimentos de pontos.
- `BE-007`: idempotência não é obrigatória e não cobre de forma segura a fronteira banco → gateway.

## 2. Metodologia e limites

Foram lidos `AGENTS.md`, `package.json`, a documentação técnica local, todas as rotas sob `app/api`, os serviços e validadores chamados pelos fluxos auditados, o schema Prisma, consumidores frontend e testes relacionados. A documentação foi tratada apenas como orientação; as conclusões abaixo se baseiam no código atual.

Foram rastreados:

- entrada HTTP → autenticação/tenant → schema → serviço → Prisma/gateway;
- contrato efetivamente enviado e lido pelo frontend;
- autoridade dos valores monetários e das quantidades;
- transições de pedido, pagamento, estoque e pontos;
- repetição e concorrência em checkout, pedido, webhook, cancelamento e reembolso;
- rotas públicas, autenticadas, administrativas, internas e webhook.

Nenhum segredo do ambiente, dado pessoal real ou credencial presente em documentação foi reproduzido neste relatório.

### Comandos locais e resultados reproduzíveis

Executados a partir da raiz do repositório:

```powershell
rg -n --glob 'app/api/**/route.ts' 'export async function (GET|POST|PUT|PATCH|DELETE)' app/api
rg -n --glob 'app/api/**/route.ts' 'require(Auth|Admin)|ASAAS_WEBHOOK_TOKEN|CRON_SECRET|NODE_ENV' app/api
rg -n '/api/' app components hooks store -g '*.ts' -g '*.tsx'
rg -n 'statusHistory\.(create|createMany)|orderStatusHistory\.(create|createMany)|OrderStatusHistory' app services lib tests -g '*.ts' -g '*.tsx'
rg -ni 'coupon|cupom|cashback|imposto|tax(es)?\b' app components lib services prisma tests -g '*.ts' -g '*.tsx' -g '*.prisma'
npm run test:unit
npm run lint
```

Resultados observados:

- 45 caminhos de rota e 62 handlers HTTP exportados foram inventariados.
- Não foram encontradas escritas de `OrderStatusHistory` no código de produto; somente factories/testes referenciam criação.
- A busca por cupom, cashback e impostos não encontrou implementação no código de produto/schema auditado.
- `npm run test:unit` não iniciou: `vitest` não está disponível.
- `npm run lint` não iniciou: `eslint` não está disponível.
- `node_modules` e `node_modules/next/dist/docs` estão ausentes. Assim, não foi possível executar testes, lint, build ou consultar a documentação local obrigatória do Next.js 16.3.5. Não foram instaladas dependências para respeitar a restrição de criar somente este relatório.
- Ambiente local observado: Node `v24.16.0`, npm `11.13.0`.

## 3. Inventário das APIs

Legenda de saída: **raw** = JSON específico da rota; **envelope** = `{ success, data }` ou `{ success: false, error, code? }` de `lib/api-response.ts`.

### Públicas, autenticação opcional e autenticação

| Método e caminho | Acesso/papel | Entrada validada | Saída observada | Caso de uso |
|---|---|---|---|---|
| `POST /api/auth/login` | público | `loginSchema` | raw, usuário sanitizado + cookie | autenticar no tenant do host |
| `POST /api/auth/register` | público | `registerSchema` | raw, usuário sanitizado + cookie | cadastrar cliente no tenant do host |
| `POST /api/auth/logout` | público/sessão | sem body | raw/redirecionamento | remover sessão |
| `POST /api/auth/forgot-password` | público | Zod `email` | raw | solicitar link de recuperação |
| `POST /api/auth/reset-password` | público | Zod token/senha | raw | trocar senha por token |
| `GET /api/brands` | público | tenant pelo host | raw array | catálogo de marcas ativas |
| `GET /api/products` | público | `productFiltersSchema` + tenant pelo host | raw array | listar catálogo |
| `GET /api/products/[id]` | público | ID sem schema/tenant | raw produto + relações | detalhe de produto |
| `POST /api/checkout` | público; sessão opcional | `createOrderSchema` | envelope duplo (`data.success`, `data.order`) | checkout canônico + cobrança |
| `GET /api/freight` | público | query manual `lojaID`, `cityName` | raw `{value}` | regra local legada |
| `POST /api/freight` | público | checagem manual mínima | raw/envelope próprio | cálculo de frete legado |
| `POST /api/freight/calculate` | público | Zod local | raw `{success,data}` | orquestrar cotação de frete |
| `GET /api/loja/active` | público | tenant pelo host | raw DTO explícito | identidade pública da loja ativa |
| `GET /api/loja/[slug]` | público | slug apenas não vazio | raw `LojaSettings` | obter loja por slug |
| `GET /api/orders/[id]/status` | público | ID sem schema; tenant + rate limit | raw `{success,order}` | polling de pagamento/status |
| `POST /api/loyalty/simulate` | público; sessão opcional | `SimulateLoyaltyRedeemSchema` | envelope | projetar desconto de pontos |
| `POST /api/webhooks/asaas` | token compartilhado | cast TypeScript + presença de `event/payment` | raw | eventos de pagamento |
| `POST /api/webhooks/asaas/simulate` | público se `NODE_ENV != production` | checagens manuais | raw | homologar eventos sem gateway |
| `GET /api/cart` | sessão ACTIVE | sem entrada | raw carrinho | consultar carrinho |
| `POST /api/cart` | sessão ACTIVE | Zod produto/variante/quantidade 1..99 | raw carrinho | adicionar item |
| `PATCH /api/cart` | sessão ACTIVE | Zod variante/quantidade 1..99 | raw carrinho | alterar quantidade |
| `DELETE /api/cart` | sessão ACTIVE | `variantID` manual em query/body | raw carrinho | remover item |
| `GET /api/orders` | sessão ACTIVE | sem query formal | raw array | listar pedidos do cliente/tenant |
| `POST /api/orders` | sessão ACTIVE | Zod `cartID/addressID/lojaID?` | raw pedido | criar pedido a partir do carrinho |
| `GET /api/orders/[id]` | sessão ACTIVE; dono ou admin da loja | ID sem schema | raw pedido | detalhe do pedido |
| `POST /api/orders/[id]/confirm-delivery` | sessão ACTIVE; dono | estado verificado manualmente | raw | cliente confirmar recebimento |
| `POST /api/address/set-default` | sessão ACTIVE | Zod `addressId` | raw | definir endereço padrão |
| `GET /api/user/profile` | sessão ACTIVE | sem entrada | envelope | ler perfil sanitizado |
| `PUT /api/user/profile` | sessão ACTIVE | `updateProfileSchema` | envelope | alterar perfil próprio |
| `GET /api/loyalty/wallet` | sessão ACTIVE | `page/limit` por `parseInt` | envelope | extrato e saldo de pontos |
| `POST /api/upload` | sessão ACTIVE; bucket `products` exige ADMIN | multipart, MIME e até 5 MB | envelope | upload direto quando feature habilitada |

### Administrativas

| Método e caminho | Acesso/papel | Entrada validada | Saída observada | Caso de uso |
|---|---|---|---|---|
| `POST /api/products` | ADMIN ACTIVE | `createProductSchema` | raw produto | criar produto no tenant da sessão |
| `PUT /api/products/[id]` | ADMIN ACTIVE | `updateProductSchema` | raw produto | editar produto do tenant |
| `DELETE /api/products/[id]` | ADMIN ACTIVE | ID sem schema | `204` | excluir produto do tenant |
| `GET /api/loja/settings` | ADMIN ACTIVE | sessão | raw settings | ler configuração da loja |
| `PUT /api/loja/settings` | ADMIN ACTIVE | Zod local | raw settings | editar configuração da loja |
| `GET /api/admin/users` | ADMIN ACTIVE | query manual `search/cursor` | envelope | listar usuários da loja |
| `PATCH /api/admin/users/[id]/role` | ADMIN ACTIVE | Zod enum de papel | raw usuário sanitizado | promover/rebaixar usuário |
| `GET /api/customers` | ADMIN ACTIVE | sem filtros | envelope | listagem legada de clientes |
| `GET /api/customers/[id]` | ADMIN ACTIVE | ID sem schema | raw | perfil legado de cliente |
| `GET /api/admin/customers` | ADMIN ACTIVE | `listCustomersSchema` | envelope | listar clientes paginados |
| `GET /api/admin/customers/[customerId]` | ADMIN ACTIVE | `customerIdSchema` | envelope | detalhe de cliente |
| `GET /api/admin/customers/[customerId]/metrics` | ADMIN ACTIVE | `customerIdSchema` | envelope | métricas de cliente |
| `GET /api/admin/freight` | ADMIN ACTIVE | sessão | envelope | listar regras locais |
| `POST /api/admin/freight` | ADMIN ACTIVE | validação no serviço/entrada não formal na rota | envelope | criar regra local |
| `PATCH/PUT /api/admin/freight/[id]` | ADMIN ACTIVE | Zod local (`PUT` delega ao `PATCH`) | envelope | editar regra local |
| `DELETE /api/admin/freight/[id]` | ADMIN ACTIVE | ID manual | envelope | excluir regra local |
| `GET /api/admin/orders` | ADMIN ACTIVE | `listOrdersQuerySchema` | envelope paginado | listar pedidos da loja |
| `GET /api/admin/orders/[orderId]` | ADMIN ACTIVE | ID sem schema | envelope | detalhe operacional |
| `PATCH /api/admin/orders/[orderId]/status` | ADMIN ACTIVE | `updateOrderStatusBodySchema` | envelope | transicionar pedido |
| `PATCH /api/admin/orders/[orderId]/tracking` | ADMIN ACTIVE | Zod `trackingCode` | raw `{success,data}` | alterar rastreio |
| `PATCH /api/admin/orders/[orderId]/notes` | ADMIN ACTIVE | Zod `adminNotes` | raw `{success,data}` | alterar nota interna |
| `PATCH /api/orders/[id]` | ADMIN ACTIVE | Zod `status` | raw pedido | rota administrativa duplicada de status |
| `GET /api/admin/loyalty/config` | ADMIN ACTIVE | sessão | envelope | ler configuração de pontos |
| `PUT /api/admin/loyalty/config` | ADMIN ACTIVE | `UpdateLoyaltyConfigSchema` | envelope | configurar pontos |
| `POST /api/admin/loyalty/adjust` | ADMIN ACTIVE | `AdjustLoyaltyBalanceSchema`, com IDs sobrescritos pela sessão | envelope | ajuste manual de saldo |
| `GET /api/admin/loyalty/reports` | ADMIN ACTIVE | query manual | envelope | relatório do programa |

### Internas/agendadas

| Método e caminho | Acesso/papel | Entrada validada | Saída observada | Caso de uso |
|---|---|---|---|---|
| `GET/POST /api/cron/orders-timeout` | Bearer ou `x-cron-secret`, comparação constante | `batchSize` manual limitado a 100, `lojaID?` | raw resumo | cancelar pedidos pendentes expirados |
| `GET/POST /api/cron/loyalty-expiration` | Bearer ou `x-cron-secret`, comparação constante | query manual | raw resumo | expirar lotes de pontos |

## 4. Contratos e máquinas de estado observadas

### Pedido

O contrato declarado em `lib/order-transitions.ts:1-20` é:

```text
PENDING -> PAID | CANCELLED
PAID    -> SHIPPED | CANCELLED
SHIPPED -> DELIVERED
DELIVERED e CANCELLED -> terminais
PAID -> DELIVERED somente para PICKUP/NONE (regra especial)
```

Há três implementações efetivas: `updateOrderStatus`, confirmação pelo cliente e automações do webhook. Elas não usam a mesma operação atômica. A regra especial `PAID -> DELIVERED` não recebe `deliveryType` em `updateOrderStatus`; a confirmação do cliente a reproduz diretamente e contorna o serviço. Estados ilegais simples são recusados, mas a verificação ocorre antes da transação e não protege contra mudança concorrente (`BE-006`, `BE-013`).

### Pagamento

Não há enum/máquina de estado própria: `Order.asaasPaymentStatus` é `String?` (`prisma/schema.prisma:281-282`). O webhook trata `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED` e `PAYMENT_AWAITING_RISK_ANALYSIS`. Não há reconciliação de valor/moeda/cliente e o reembolso após expedição/entrega não altera o estado do domínio (`BE-005`, `BE-012`).

### Estoque

O fluxo pretendido é:

```text
criação PENDING -> decrementa produto e variante
PAID            -> não altera estoque
CANCELLED       -> restaura produto e variante se origem PENDING/PAID
SHIPPED/DELIVERED -> sem alteração
```

`InventoryService.reserveStock` decrementa dentro da transação e lança se o resultado ficar negativo, fazendo rollback. O risco residual está nos caminhos que passam tenant inconsistente e nas transições repetidas/concorrentes, não na ausência de decremento atômico do caminho canônico.

### Pontos

O ledger implementa `EARN`, `REDEEM`, estornos, expiração e ajuste manual. Resgate ocorre durante a criação do pedido; ganho ocorre na transição para `PAID`; cancelamento tenta reverter ambos; cron expira lotes. Débito e crédito usam transação, mas não há unicidade/idempotência por `(orderId, tipo)` e a transição concorrente pode repetir movimentos (`BE-006`).

### Cupons, cashback e impostos

**Não aplicável ao repositório observado.** Não há modelos, handlers, serviços ou referências funcionais a cupom/cupom promocional, cashback ou cálculo tributário. Pontos de fidelidade não foram tratados como cashback. Portanto, validade, combinação, reúso, concessão e estorno desses recursos não puderam ser auditados. Sua ausência não foi classificada como defeito, pois não há evidência de requisito de produto nesta etapa.

## 5. Achados

### BE-001 — Checkout web usa rota, DTO e resposta incompatíveis

- **Severidade:** BLOCKER
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/checkout/CheckoutForm.tsx:397-446`; `app/api/checkout/route.ts:10-42,84-106`; `lib/validators/checkout.validators.ts:24-45,87-108`; `app/checkout/page.tsx:90-123`
- **Fluxo e condição:** cliente conclui qualquer compra pelo `CheckoutForm`.
- **Evidência observada (fato):** o formulário chama `POST /api/checkout/create-order`, caminho inexistente; a única rota é `POST /api/checkout`. O formulário envia cliente em campos planos, `cardData` e `productID`, enquanto o schema exige `customer`, `creditCard` e `productId`. A rota responde `{success:true,data:{success:true,order}}`, mas a página de checkout lê o pedido no nível raiz.
- **Hipótese separada:** nenhuma; a incompatibilidade é determinística pelo código.
- **Impacto:** checkout da interface retorna 404; se apenas a URL for corrigida, recebe 400; se apenas o DTO for corrigido, a tela de confirmação ainda falha ao ler a resposta.
- **Correção proposta:** definir um contrato único versionado; apontar o cliente para `/api/checkout`, gerar payload pelo tipo/schema compartilhado e retornar um único envelope. Remover ou impedir compilação de caminhos inexistentes.
- **Teste de regressão:** teste de contrato que renderiza/preenche o formulário, intercepta o request real, passa pelo handler e verifica confirmação para PIX, cartão, boleto, entrega e retirada.
- **Risco residual:** mudanças independentes entre componentes e handlers podem reintroduzir drift sem teste end-to-end.

### BE-002 — Endpoints públicos expõem credenciais e configuração privada da loja

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/loja.service.ts:189-224`; `app/api/loja/[slug]/route.ts:23-32`; `services/product.service.ts:101-113`; `app/api/products/[id]/route.ts:25-29`; `prisma/schema.prisma:14-58`
- **Fluxo e condição:** requisição anônima a um slug válido ou UUID de produto.
- **Evidência observada:** `getLojaBySlug` seleciona e a rota retorna `correiosPassword`, código de contrato, endereço operacional e chave PIX. O detalhe de produto usa `include: { loja: true }`, que inclui também `nuvemshopAccessToken` e demais campos do modelo `Loja`, e devolve o objeto bruto.
- **Hipótese separada:** não foi verificado se os campos estão preenchidos em produção; a possibilidade de exposição independe disso.
- **Impacto:** vazamento de credenciais de integração/frete e dados operacionais, com potencial acesso indevido a terceiros e fraude.
- **Correção proposta:** criar DTO público allow-list separado (`id`, nome, slug, branding e canais estritamente necessários); nunca serializar entidade Prisma `Loja`; rotacionar credenciais se estes endpoints já estiveram publicados e preenchidos.
- **Teste de regressão:** snapshots/asserções negativas para todas as rotas públicas garantindo ausência de `*Token`, `*Password`, credenciais, endereço de origem e configuração interna.
- **Risco residual:** novas colunas sensíveis voltam a vazar se respostas usarem `include: true` ou objetos Prisma sem mapper.

### BE-003 — Frete e total de entrega são parcialmente controlados pelo cliente

- **Severidade:** CRITICAL
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/freight/calculate/route.ts:7-24,56-118,130-140`; `services/checkout.service.ts:345-390`; `app/api/freight/route.ts:41-59`; `components/checkout/CheckoutForm.tsx:242-270`
- **Fluxo e condição:** entrega sem regra local exata para a cidade, ou uso direto das rotas públicas de frete.
- **Evidência observada:** cálculo aceita `lojaID`, preço, peso e dimensões do body; valores do cliente têm precedência sobre o cadastro (`??`). Produtos são carregados sem filtro de tenant. No checkout, quando não existe `FreightRule`, `shippingCost`/`freightValue` do cliente são aceitos e, ausentes, o custo vira zero. A rota legada aceita qualquer `lojaID` sem schema. O formulário principal ainda usa nomes de campo incompatíveis e lê o envelope errado.
- **Hipótese separada:** comportamento tarifário dos provedores externos não foi chamado; o bypass local está confirmado antes deles.
- **Impacto:** subfaturamento de frete, total incorreto, cotações cross-tenant e pedidos com entrega grátis indevida.
- **Correção proposta:** vincular tenant exclusivamente ao host/sessão; aceitar somente IDs/quantidades/CEP/opção assinada; reler dimensões e preço no banco; recalcular a cotação selecionada no checkout ou validar token de cotação curto e assinado; falhar fechado quando não houver modalidade válida.
- **Teste de regressão:** adulterar custo/dimensões/tenant/opção; confirmar que o total usa apenas dados persistidos/cotação servidor e que produto de outra loja retorna 404/403.
- **Risco residual:** mudança de tarifa entre cotação e cobrança exige política explícita de expiração/tolerância.

### BE-004 — Caminho alternativo de pedido contorna checkout, pagamento e isolamento

- **Severidade:** CRITICAL
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/api/orders/route.ts:8-58`; `services/order.service.ts:17-108`; `services/cart.service.ts:63-180`; `services/inventory.service.ts:29-32,43-80`
- **Fluxo e condição:** cliente autenticado chama `POST /api/orders` com carrinho/endereço próprios; primeiro item do carrinho pode ser produto de outro tenant.
- **Evidência observada:** a rota escolhe tenant por host/sessão/body, mas `createOrderFromCart` não confirma que os produtos pertencem a esse tenant, não relê preço atual, usa snapshot/custo do carrinho, não aplica pagamento/pontos/idempotência e conclui o carrinho. `addToCart` só compara lojas quando já existe item; o primeiro produto não é comparado ao tenant da sessão. `InventoryService` recebe `_lojaID`, mas não o usa.
- **Hipótese separada:** a exploração requer conhecer um UUID de produto/carrinho/endereço; UUIDs de produto são expostos no catálogo.
- **Impacto:** pedido da loja A pode reservar estoque da loja B, manter preço/frete obsoleto e existir sem cobrança; regras distintas conforme o endpoint escolhido.
- **Correção proposta:** remover/deprecar o POST alternativo ou fazê-lo delegar ao mesmo caso de uso canônico; validar cada produto/variante/endereços no tenant; reler preço/frete; exigir idempotência e modelo explícito de pagamento.
- **Teste de regressão:** matriz tenant A/B, preço alterado após carrinho, frete adulterado, repetição paralela e assertiva de que somente um pipeline cria pedido.
- **Risco residual:** qualquer futura rota de importação/admin deve declarar quais invariantes pode contornar e por quê.

### BE-005 — Webhook confirma valor não reconciliado e perde retries após falhas parciais

- **Severidade:** CRITICAL
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:88-169,171-207,209-239,326-349`
- **Fluxo e condição:** evento autenticado do Asaas novo, especialmente se algum efeito após o insert falhar ou se o pagamento tiver valor divergente.
- **Evidência observada:** token é comparado em tempo constante, porém payload recebe apenas checagem superficial. O evento é gravado como processado antes de localizar/atualizar pedido e antes dos efeitos; qualquer retry posterior retorna `ALREADY_PROCESSED`, mesmo se a tentativa anterior terminou 500. A associação usa `externalReference OR asaasPaymentId`, e `payment.value` não é comparado a `order.total`; tampouco há validação de moeda/cliente. Se `body.id` faltar, o fallback inclui `Date.now()`, destruindo estabilidade entre retries.
- **Hipótese separada:** não foi verificado na documentação local do provedor se `body.id` e moeda são sempre obrigatórios; por isso essa garantia não foi presumida.
- **Impacto:** pedido pode ficar pago por evento de valor incorreto; falha transitória pode ser reconhecida para sempre sem completar pontos/status; inconsistência financeira silenciosa.
- **Correção proposta:** schema estrito; identidade estável do evento; transação/outbox com estados `RECEIVED/PROCESSING/PROCESSED/FAILED`; validar vínculo, valor, moeda e estado da cobrança por dados confiáveis; só concluir idempotência após efeitos atômicos/reconciliáveis.
- **Teste de regressão:** valor divergente, evento sem ID repetido, falha injetada após insert, retry concorrente e reprocessamento de `FAILED`.
- **Risco residual:** webhook e gateway não formam transação distribuída; job de reconciliação continua necessário.

### BE-006 — Transições concorrentes podem duplicar estoque e pontos

- **Severidade:** CRITICAL
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `services/order.service.ts:265-310,312-413`; `services/loyalty.service.ts:304-369,445-519`; `app/api/orders/[id]/confirm-delivery/route.ts:14-107`
- **Fluxo e condição:** duas requisições/webhooks/admin/cron processam o mesmo pedido quase simultaneamente.
- **Evidência observada:** estado é lido fora da transação; as atualizações usam `where: {id}` sem estado/versionamento esperado. Dois cancelamentos podem ambos observar `PENDING/PAID` e restaurar estoque. Duas confirmações de pagamento podem creditar `EARN`; não há unicidade por pedido/tipo no ledger. Confirmação de entrega repete o mesmo padrão e contorna o serviço central.
- **Hipótese separada:** a duplicação exige interleaving concorrente; não foi reproduzida em banco por ausência de dependências/database de teste.
- **Impacto:** estoque inflado, saldo de pontos incorreto, auditoria contraditória e status final dependente de corrida.
- **Correção proposta:** transição compare-and-set (`updateMany` por `id + status` ou versão), efeitos e histórico na mesma transação, chaves idempotentes no ledger/estoque e retry controlado para conflitos.
- **Teste de regressão:** disparar N transições paralelas sobre PostgreSQL real e provar exatamente uma mudança e um único movimento de cada tipo.
- **Risco residual:** ações externas (e-mail/gateway) precisam de outbox/idempotência própria.

### BE-007 — Idempotência de checkout é opcional, sem fingerprint e não fecha a fronteira com o gateway

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/checkout/route.ts:84-94`; `components/checkout/CheckoutForm.tsx:433-437`; `services/checkout.service.ts:115-168,474-480,501-665`
- **Fluxo e condição:** duplo clique/retry sem header; reutilização acidental de chave com payload diferente; timeout após envio ao gateway.
- **Evidência observada:** o cliente não envia chave e o servidor não a exige. Quando existe, a consulta ocorre antes de validar tenant/cliente/payload e não compara fingerprint. Pedido é commitado antes da chamada ao gateway; falha/timeout cancela localmente, mesmo que o provedor possa ter aceitado a cobrança. O retorno de pedido existente não tenta completar/reconciliar cobrança incompleta.
- **Hipótese separada:** não foi verificado se o SDK/endpoint Asaas oferece chave idempotente própria; o adapter local não demonstra garantia fim a fim.
- **Impacto:** pedidos/cobranças duplicados, resposta de pedido incorreto para chave reutilizada e divergência pago-no-gateway/cancelado-local.
- **Correção proposta:** exigir chave opaca por tentativa, escopada a tenant/usuário, persistir hash do payload, máquina de execução da cobrança e idempotência no provedor; reconciliar estados ambíguos antes de cancelar.
- **Teste de regressão:** requests paralelos, mesma chave/payload, mesma chave/payload diferente, timeout antes/depois de resposta do gateway e retry após processo reiniciado.
- **Risco residual:** indisponibilidade prolongada do provedor requer fila e reconciliação operacional.

### BE-008 — Simulação de pontos permite consultar/criar carteira arbitrária

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/loyalty.service.ts:34-39,196-251`; `app/api/loyalty/simulate/route.ts:18-36`
- **Fluxo e condição:** chamada anônima com `lojaID` e `userID` conhecidos; ou usuário autenticado fornecendo outro `lojaID`.
- **Evidência observada:** schema aceita `userID` opcional; sem sessão ele é usado diretamente e `getOrCreateWallet` pode consultar/criar carteira e devolver saldo no resultado. Com sessão, apenas `userID` é sobrescrito; `lojaID` continua vindo do cliente e não é ligado ao tenant da sessão/host.
- **Hipótese separada:** UUIDs de usuário não parecem listados publicamente para clientes, mas podem aparecer em outros fluxos/logs.
- **Impacto:** BOLA de saldo/política de fidelidade, criação indevida de carteiras e leitura cross-tenant.
- **Correção proposta:** para anônimo, nunca aceitar `userID` nem retornar saldo; para autenticado, derivar `userID` e `lojaID` do contexto validado; separar endpoint puramente matemático de endpoint de carteira.
- **Teste de regressão:** guest com `userID`, sessão A com loja B e usuário A/B; verificar ausência de escrita/leitura indevida.
- **Risco residual:** projeções públicas ainda podem revelar política comercial se isso não for desejado.

### BE-009 — Recuperação de senha confia no Origin/Referer e usa fallback cross-tenant

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/auth/forgot-password/route.ts:52-80`; `services/auth.service.ts:145-198`
- **Fluxo e condição:** atacante envia `Origin`/`Referer` controlado ou host não resolvido.
- **Evidência observada:** a rota usa `Origin`/`Referer` para montar o link com token enviado por e-mail. Quando tenant não resolve, usa variável pública e depois a primeira loja do banco. O serviço concatena essa origem diretamente ao token.
- **Hipótese separada:** filtros do proxy/CDN podem restringir headers em produção, mas não há evidência local dessa garantia.
- **Impacto:** link de recuperação aponta para domínio do atacante (phishing/exposição do token pelo clique) e solicitação pode operar no tenant errado.
- **Correção proposta:** construir URL somente de domínio canônico/configuração allow-list do tenant; falhar fechado sem tenant; ignorar headers de origem não confiáveis.
- **Teste de regressão:** Origins maliciosos, host desconhecido, loja inexistente e confirmação de URL canônica no e-mail mockado.
- **Risco residual:** comprometimento de configuração/DNS permanece fora do controle da aplicação.

### BE-010 — Simulador de webhook é mutável e não autenticado fora de `production`

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/simulate/route.ts:9-20,29-94`; `app/checkout/confirmation/page.tsx:141`
- **Fluxo e condição:** deployment acessível com `NODE_ENV` diferente da string exata `production`.
- **Evidência observada:** não há sessão, papel, token ou tenant; qualquer `orderId` pode receber evento simulado que altera metadados/status e aciona estoque/pontos. O único bloqueio é `NODE_ENV === 'production'`.
- **Hipótese separada:** em produção Next convencional o bloqueio deve atuar; previews, staging e configuração incorreta continuam expostos.
- **Impacto:** fraude/alteração destrutiva em homologação compartilhada e risco crítico se o ambiente for publicado com flag errada.
- **Correção proposta:** excluir a rota do build público ou exigir segredo separado + ADMIN + tenant; habilitar apenas por feature flag fail-closed e rede restrita.
- **Teste de regressão:** matriz de ambientes e ausência de autorização, incluindo preview; garantir que o bundle/roteamento de produção não exponha handler mutável.
- **Risco residual:** segredo de homologação deve ser rotacionável e nunca reutilizado em produção.

### BE-011 — Adicionar ao carrinho pode mutar catálogo e sofre corridas de criação/incremento

- **Severidade:** HIGH
- **Confiança:** HIGH CONFIDENCE
- **Arquivo e linhas:** `services/cart.service.ts:10-20,63-180`; `app/api/cart/route.ts:7-58`
- **Fluxo e condição:** cliente adiciona produto sem `variantID`, ou duas requisições adicionam/criam carrinho ao mesmo tempo.
- **Evidência observada:** na ausência de variante, o fluxo público do carrinho cria `ProductVariants` padrão, convertendo uma operação de cliente em mutação de catálogo. Carrinho ativo e item são obtidos por read-then-create/read-then-update sem transação ou retry; incremento concorrente pode perder atualização e criação paralela pode conflitar. O primeiro item não é ligado ao tenant da sessão (cadeia explorada em `BE-004`).
- **Hipótese separada:** colisões dependem de concorrência; o efeito de criação de variante é determinístico.
- **Impacto:** clientes alteram estrutura de produto, respostas 500/intermitentes, quantidades perdidas e preparação de pedido cross-tenant.
- **Correção proposta:** criar variante padrão somente na administração/migração; exigir variante persistida; escopar produto ao tenant; usar upsert/transaction com incremento atômico e unicidade de carrinho ativo.
- **Teste de regressão:** produto sem variante, produto de outra loja e 20 adições paralelas verificando um carrinho/item e soma exata.
- **Risco residual:** estoque ainda é apenas validado no carrinho; a reserva autoritativa deve permanecer no checkout.

### BE-012 — Reembolso após expedição/entrega não é refletido no domínio

- **Severidade:** HIGH
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `app/api/webhooks/asaas/route.ts:282-293`; `lib/order-transitions.ts:3-9`; `prisma/schema.prisma:281-282`
- **Fluxo e condição:** `PAYMENT_REFUNDED` chega quando pedido está `SHIPPED`, `DELIVERED` ou já `CANCELLED`.
- **Evidência observada:** o webhook só chama cancelamento se o estado for exatamente `PAID`; demais estados são ignorados além da atualização textual de `asaasPaymentStatus`. O modelo de pedido não possui estado de reembolso/disputa nem registro financeiro próprio.
- **Hipótese separada:** política comercial de devolução não está documentada; ainda assim, ignorar o evento cria divergência factual.
- **Impacto:** pedido permanece entregue/enviado embora o dinheiro tenha sido devolvido; pontos e relatórios podem permanecer incorretos; operação não recebe workflow de devolução.
- **Correção proposta:** separar fulfillment de pagamento; introduzir estados/eventos financeiros (`REFUNDED`, parcial, chargeback) e processo explícito de devolução/estoque/pontos, sem forçar todo reembolso a `CANCELLED`.
- **Teste de regressão:** reembolso integral/parcial em cada estado de fulfillment, repetição do evento e reconciliação de pontos/relatórios.
- **Risco residual:** devolução física exige decisão operacional que não pode ser inferida apenas do gateway.

### BE-013 — Rastreio, histórico e regra especial de entrega divergem entre contratos

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `components/admin/orders/OrderStatusManager.tsx:62-78`; `lib/validators/order.validators.ts:15-17`; `services/order.service.ts:265-441`; `lib/order-transitions.ts:11-20`; `prisma/schema.prisma:352-363`; `tests/integration/status-transitions.test.ts:24-99`
- **Fluxo e condição:** admin marca `SHIPPED`, consulta histórico ou tenta transição especial de retirada.
- **Evidência observada:** frontend envia `trackingCode` junto ao status, mas o schema o remove e o serviço não persiste. Existe endpoint separado que o componente não usa nesse fluxo. Nenhuma transição cria `OrderStatusHistory`, embora o detalhe administrativo o leia. O serviço chama `isValidTransition` sem `deliveryType`, tornando inalcançável por ele o caso especial `PAID -> DELIVERED` para retirada. O teste de integração usa ainda `toStatus`, diferente de `newStatus` atual.
- **Hipótese separada:** rastreio é rotulado opcional na UI; o histórico, porém, é expectativa explícita do modelo/testes.
- **Impacto:** operador acredita ter salvo rastreio, timeline vazia e comportamento diferente conforme endpoint.
- **Correção proposta:** um comando único de transição contendo estado esperado, motivo/rastreio; gravar pedido + histórico na mesma transação; passar `deliveryType`; remover rotas duplicadas.
- **Teste de regressão:** cada arco válido/ilegal, rastreio em `SHIPPED`, timeline e retirada paga → entregue.
- **Risco residual:** importações/webhooks precisam usar o mesmo comando para não furar histórico.

### BE-014 — Formatos de resposta, validação e mapeamento de erro são inconsistentes

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `lib/api-response.ts:3-11`; `app/api/checkout/route.ts:31-40,106-117`; `app/api/cart/route.ts:18-125`; `app/api/products/route.ts:7-37`; `app/api/admin/orders/[orderId]/status/route.ts:15-35`
- **Fluxo e condição:** consumidores compartilham helpers ou tratam falhas de domínio/infraestrutura.
- **Evidência observada:** coexistem arrays raw, `{order}`, `{success,data}`, envelopes aninhados e erros com/sem `code/details`. Validação usa 400 ou 422 dependendo da rota. Checkout converte qualquer exceção, inclusive interna/gateway, em 400 e devolve `error.message`; outras rotas retornam 500. O frontend administrativo já contém lógica para três formatos possíveis.
- **Hipótese separada:** não há OpenAPI/contrato versionado encontrado; não se presumiu qual padrão seria o oficial.
- **Impacto:** clientes quebram silenciosamente, retry é decidido de forma errada e mensagens internas podem chegar ao usuário.
- **Correção proposta:** envelope e taxonomia única de erros; mapear domínio a 409/422, autenticação a 401/403 e infraestrutura a 5xx com mensagem pública; validar JSON com catch uniforme; gerar tipos/contratos compartilhados.
- **Teste de regressão:** contract tests por família de rota para sucesso, Zod, domínio e exceção inesperada.
- **Risco residual:** migração exige versionamento ou compatibilidade temporária com clientes existentes.

### BE-015 — Catálogo declara ordenação que o serviço ignora e não fornece metadados de paginação

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/product.service.ts:4-15,51-98`; `app/api/products/route.ts:7-34`; `lib/validators/product.ts` (schema de filtros)
- **Fluxo e condição:** consumidor usa filtros de ordenação/paginação do catálogo.
- **Evidência observada:** o schema aceita opções de filtro/ordenação, mas `getProducts` sempre ordena por `createdAt desc` e retorna somente array; não há `total`, `nextCursor` ou `hasNextPage`. O serviço aceita `all`, capaz de remover limite quando chamado internamente.
- **Hipótese separada:** a UI atual pode funcionar carregando a primeira página; o contrato prometido não é cumprido integralmente.
- **Impacto:** ordenação incorreta, navegação incompleta e acoplamento do cliente a heurística de tamanho da lista.
- **Correção proposta:** implementar allow-list de ordenação no Prisma e envelope paginado consistente; manter `all` fora da entrada HTTP.
- **Teste de regressão:** preço/nome/data asc/desc, cursor estável, limites e ausência de duplicata entre páginas.
- **Risco residual:** paginação por cursor precisa desempate determinístico (`createdAt`, `id`).

### BE-016 — Logger mascara documento, mas mantém e-mail de cliente em claro

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `services/checkout.service.ts:633-644`; `app/api/checkout/route.ts:107-116`; `lib/logger.ts:20-59,88-113`
- **Fluxo e condição:** checkout ou chamada ao gateway falha.
- **Evidência observada:** contexto de erro inclui CPF/CNPJ e e-mail. O sanitizador mascara chaves contendo CPF/CNPJ e segredos, mas não e-mail; logo o endereço é serializado em claro. Stack/mensagem de exceção também são registradas sem sanitização de seu conteúdo.
- **Hipótese separada:** retenção/acesso ao coletor de logs não foi verificado.
- **Impacto:** ampliação de dados pessoais em logs e risco de exposição por suporte/observabilidade.
- **Correção proposta:** remover PII desnecessária; mascarar/hash de e-mail de modo consistente; sanitizar erro do provedor; definir retenção e acesso.
- **Teste de regressão:** logger com contexto aninhado e erro contendo documento/e-mail/token, garantindo que nenhum valor bruto apareça.
- **Risco residual:** mensagens de bibliotecas podem conter payload; redaction por chave não cobre texto livre.

### BE-017 — Testes de contrato estão desatualizados e a suíte não é executável no checkout local

- **Severidade:** MEDIUM
- **Confiança:** CONFIRMED
- **Arquivo e linhas:** `tests/integration/status-transitions.test.ts:24-99`; `tests/unit/checkout-authoritative.test.ts:94-175`; `tests/unit/audit-hotfix-phase2.test.ts:228-253`; `package.json:6-14`
- **Fluxo e condição:** uso da suíte como gate de regressão.
- **Evidência observada:** teste de transição envia `toStatus`, espera `trackingCode` e `OrderStatusHistory`, enquanto a rota atual exige `newStatus` e não escreve os dois últimos. Testes autoritativos exercitam diretamente serviços com mocks e não cobrem o contrato real do `CheckoutForm`. O teste de frete confirma query em lote, mas aceita explicitamente consulta sem filtro de tenant. Localmente, `vitest`/`eslint` estão indisponíveis por ausência de dependências.
- **Hipótese separada:** CI remoto pode instalar dependências e falhar; seu estado não foi acessado.
- **Impacto:** falsa confiança em correções anteriores e ausência de gate para os blockers de contrato atuais.
- **Correção proposta:** alinhar fixtures ao contrato vigente; adicionar testes handler+frontend e integração PostgreSQL concorrente; executar `lint`, typecheck, unit, integration e build em CI limpa.
- **Teste de regressão:** o próprio pipeline deve instalar por lockfile e executar todos os comandos com zero testes skipped relevantes.
- **Risco residual:** mocks continuam úteis, mas não substituem contrato HTTP nem concorrência real.

## 6. Controles positivos confirmados

- Login e registro derivam tenant do host e não aceitam papel/tenant do cliente (`app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`).
- Sessão retorna DTO de usuário com password/reset token removidos (`lib/session.ts:83-123`, `lib/utils/dto-sanitizer.ts`).
- `requireAuth` e `requireAdmin` verificam usuário ACTIVE e papel; rotas administrativas principais aplicam tenant da sessão.
- Carrinho rejeita quantidades não inteiras, menores que 1 e maiores que 99; checkout exige quantidade inteira positiva.
- O checkout canônico ignora preço enviado e relê `Product.price`; confirma produto no tenant; reserva produto e variante em transação.
- Reserva de estoque lança quando o decremento produz saldo negativo e o erro aborta a transação.
- Pontos solicitados e desconto são recalculados no servidor no caminho canônico.
- Webhook e crons falham fechados quando seus segredos não estão configurados e usam comparação em tempo constante.
- Status público de pedido retorna DTO limitado, é escopado ao tenant do host e tem rate limit.

Esses fatos não neutralizam os achados porque há rotas alternativas, contratos quebrados e efeitos concorrentes fora das garantias citadas.

## 7. Lacunas e verificações pendentes

1. Instalar dependências a partir do lockfile em ambiente descartável e executar `npm run lint`, typecheck (`tsc --noEmit`), `npm run test:unit`, `npm run test:integration` e `npm run build`.
2. Ler a documentação local de Next.js 16.3.5 após `node_modules` existir, conforme `AGENTS.md`, e revalidar semântica de handlers/cache/headers.
3. Executar testes concorrentes contra PostgreSQL real para checkout, cancelamento, pagamento, pontos, estoque e carrinho.
4. Validar contratos reais do Asaas (ID de evento, retries, valor/moeda, idempotência de cobrança, eventos de reembolso parcial e consulta de reconciliação) sem usar conta/serviço de produção.
5. Testar os fluxos completos no navegador em ambiente local: checkout por método/modalidade, falhas e confirmação.
6. Confirmar política de negócio para reembolso após envio/entrega, devolução física, frete externo e ausência de cupom/cashback/impostos.
7. Verificar se endpoints públicos já estiveram expostos com credenciais preenchidas; se sim, conduzir rotação fora desta auditoria.
8. Auditar comportamento distribuído do rate limit/cache em deploy multi-instância; esta etapa só verificou uso local do helper.

## 8. Riscos residuais

Mesmo após as correções propostas, pagamentos e e-mails permanecem efeitos externos não transacionais. O desenho deve assumir respostas ambíguas, retries e entrega fora de ordem, com outbox, estados intermediários, reconciliação e observabilidade sem PII. Regras de tenant precisam ser impostas no caso de uso e nas queries, não apenas no handler. Finalmente, uma única máquina de transição deve ser usada por admin, cliente, cron e webhook; enquanto existirem caminhos paralelos, invariantes continuarão sujeitas a divergência.

## 9. Conclusão

O caminho canônico contém boas salvaguardas de preço, estoque e pontos, mas não é alcançável pelo checkout atual e convive com endpoints que aceitam autoridade do cliente ou contornam invariantes. Além do blocker funcional, a exposição de segredos e os riscos financeiros/concorrentes impedem recomendar publicação. Esta conclusão se restringe a backend, APIs e regras de negócio da etapa 03; nenhuma correção de produto foi realizada e nenhuma etapa posterior foi iniciada.


---

## Revalidação de 2026-09-29 — etapa 03/15

O conteúdo anterior é histórico e foi preservado. Esta seção avalia o código local atual, incluindo mudanças sem commit, após as correções registradas em docs/remediation. Base: HEAD 0c7ef7ddfa5fb4520c4bc794163cbc71257c2bc4. O responsável autorizou continuar as etapas sem pausas. Somente relatórios são alterados.

### Resultado

Corrigido: **13**; Parcialmente corrigido: **4**. Pendências confirmadas/parciais por risco residual: HIGH 3, MEDIUM 1. Itens não verificados ficam separados de defeitos confirmados.

Corrigido refere-se ao defeito original no recorte verificado; não certifica toda a funcionalidade ou serviços externos. Confiança CONFIRMED identifica código observado e/ou teste executado, conforme a evidência; não transforma inspeção em teste dinâmico. Severidade original é preservada, e risco residual não deve ser somado entre relatórios sem deduplicação.

### Matriz dos achados

| ID | Severidade original | Estado | Risco residual | Confiança | Evidência atual, fluxo e impacto | Encerramento / regressão / limite |
|---|---|---|---|---|---|---|
| BE-001 | BLOCKER | Corrigido | LOW | CONFIRMED | CheckoutForm.tsx:468 e api/checkout/route.ts:145 concordam em rota/payload/envelope; testes de contrato passaram. | Manter E2E isolado; navegador não executado. |
| BE-002 | CRITICAL | Corrigido | LOW | CONFIRMED | lib/utils/dto-sanitizer.ts e loja.service usam projeção pública; public-store-boundary/cache-tenant passaram. | Não serializar credenciais nos DTOs; armazenamento externo não verificado. |
| BE-003 | CRITICAL | Corrigido | LOW | CONFIRMED | freight-quote.ts:44-88 e checkout.service.ts:613-645 assinam/verificam frete e total autoritativo. | Manter adulteração/expiração/tenant; tarifa real pendente. |
| BE-004 | CRITICAL | Corrigido | LOW | CONFIRMED | api/orders/route.ts:11 retorna 410; integração backend-invariants provou carrinho isolado/serializado. | Nenhum pedido deve contornar checkout. |
| BE-005 | CRITICAL | Corrigido | MEDIUM | CONFIRMED | Webhook valida valor/identidade (:304-354), inbox retomável; corrida com worker passou em PostgreSQL. | Replay externo/autenticidade operacional pendentes. |
| BE-006 | CRITICAL | Corrigido | LOW | CONFIRMED | order.service.ts:435 CAS; cancelamentos concorrentes produziram único efeito no teste real. | Manter transação/histórico/ledger. |
| BE-007 | HIGH | Parcialmente corrigido | HIGH | CONFIRMED | Idempotency-Key obrigatório e fingerprint (:111, checkout.service:245); reconciliador persistido testado com PostgreSQL. | Comprovar agenda, alertas e comportamento do gateway real antes de atendimento financeiro. |
| BE-008 | HIGH | Corrigido | LOW | CONFIRMED | loyalty/simulate/route.ts:18-41 deriva usuário/loja da sessão e rejeita campos extras. | Matriz authz-account/cross-tenant passou com mocks; HTTP completo pendente. |
| BE-009 | HIGH | Corrigido | LOW | CONFIRMED | forgot-password usa getTenantCanonicalOrigin; auth.service.ts:147-208 limita tenant e origem. | Manter teste de host malicioso; DNS/proxy externo pendente. |
| BE-010 | HIGH | Corrigido | LOW | CONFIRMED | webhooks/asaas/simulate/route.ts:16-37 exige opt-in, admin e loja, bloqueia produção. | Não habilitar em ambiente público sem controle; suite simulador passou. |
| BE-011 | HIGH | Corrigido | LOW | CONFIRMED | cart.service.ts:34-49 usa lock por usuário; 20 adições concorrentes no teste real não duplicaram agregado. | Sem mutação de catálogo; reserva continua no checkout. |
| BE-012 | HIGH | Parcialmente corrigido | HIGH | CONFIRMED | refund.service.ts:319-375 limita elegibilidade/política; shipped/delivered exigem operação manual (:474). | Definir logística reversa, estorno parcial com pontos e regras de casos manuais; não confundir contenção com resolução. |
| BE-013 | MEDIUM | Corrigido | LOW | CONFIRMED | order.service.ts:349,415-493 grava deliveryType/tracking/histórico; admin e cliente delegam. | Testes backend-order-contracts/client-confirmation passaram. |
| BE-014 | MEDIUM | Parcialmente corrigido | MEDIUM | CONFIRMED | Há códigos de domínio em checkout/cart/order; outros handlers mantêm envelopes e erros próprios. loyalty/simulate/route.ts:44-46 devolve error.message. | Revisar erro desconhecido por rota e padronizar contratos sem quebrar clientes; não afirmar que todo erro é sanitizado. |
| BE-015 | MEDIUM | Corrigido | LOW | CONFIRMED | product.service.ts:122-205 implementa sort/desempate/página; catálogo limitado; product-pagination passou. | Relevance é fallback lexical, não ranking textual; medir navegação. |
| BE-016 | MEDIUM | Corrigido | LOW | CONFIRMED | lib/logger.ts possui redação; logger.test passou cobrindo PII e preservação de IDs. | Chamadas console fora do logger e coletor externo continuam em OBS/CQ. |
| BE-017 | MEDIUM | Parcialmente corrigido | HIGH | CONFIRMED | Suítes locais agora executam; CI possui PostgreSQL. HTTP legado e E2E não foram provados nesta rodada. | Atualizar testes de sessão e servidor HTTP; TST-002/TST-004 detalham limite. |

### Testes e superfície atual

613/613 unitários e 26/26 integrações PostgreSQL passaram nesta rodada, com gateway/e-mail mockados e banco temporário exclusivo. Detalhes do isolamento e migrations constam da seção de revalidação de DATABASE-AUDIT.md. Os testes de handlers usam Request em memória; não equivalem a HTTP pelo Next nem ao navegador.

Inventário estático atual: **50 arquivos de rota API**. A tabela abaixo identifica métodos exportados, guardas chamadas diretamente e schemas usados no arquivo; ausência de nome na coluna não prova ausência de proteção, pois há delegação a serviços/proxy. A validação dinâmica integral de cada método não foi realizada.

| Rota | Métodos | Chamadas de identidade/guarda observadas | Schema/parse observado |
|---|---|---|---|
| /api/address/set-default | POST | requireAuth | setDefaultAddressSchema |
| /api/admin/customers | GET | requireAdmin | listCustomersSchema |
| /api/admin/customers/[customerId]/metrics | GET | requireAdmin | customerIdSchema |
| /api/admin/customers/[customerId] | GET | requireAdmin | customerIdSchema |
| /api/admin/freight | GET, POST | requireAdmin | createFreightRuleSchema |
| /api/admin/freight/[id] | PATCH, PUT, DELETE | requireAdmin | updateFreightRuleSchema |
| /api/admin/loyalty/adjust | POST | requireAdmin | AdjustLoyaltyBalanceSchema |
| /api/admin/loyalty/config | GET, PUT | requireAdmin | UpdateLoyaltyConfigSchema |
| /api/admin/loyalty/reports | GET | requireAdmin | ver handler |
| /api/admin/orders | GET | requireAdmin | listOrdersQuerySchema |
| /api/admin/orders/[orderId]/notes | PATCH | requireAdmin | updateNotesSchema |
| /api/admin/orders/[orderId]/refund | POST | requireAdmin | requestRefundBodySchema |
| /api/admin/orders/[orderId] | GET | requireAdmin | ver handler |
| /api/admin/orders/[orderId]/status | PATCH | requireAdmin | updateOrderStatusBodySchema |
| /api/admin/orders/[orderId]/tracking | PATCH | requireAdmin | updateTrackingSchema |
| /api/admin/users | GET | requireAdmin | ver handler |
| /api/admin/users/[id]/role | PATCH | requireAdmin | updateRoleSchema |
| /api/auth/forgot-password | POST | delegação/controle específico | forgotPasswordSchema |
| /api/auth/login | POST | delegação/controle específico | loginSchema |
| /api/auth/logout | POST | delegação/controle específico | ver handler |
| /api/auth/register | POST | delegação/controle específico | registerSchema |
| /api/auth/reset-password | POST | delegação/controle específico | resetPasswordSchema |
| /api/brands | GET | delegação/controle específico | ver handler |
| /api/cart | GET, POST, PATCH, DELETE | requireAuth | addToCartSchema, updateCartSchema, removeFromCartSchema |
| /api/checkout | POST | getCurrentUser | createOrderSchema |
| /api/cron/loyalty-expiration | GET, POST | validateCronAuth | ver handler |
| /api/cron/orders-timeout | GET, POST | validateCronAuth | ver handler |
| /api/cron/payment-reconciliation/v1 | GET, POST | validateCronAuth | ver handler |
| /api/customers | GET | requireAdmin | ver handler |
| /api/customers/[id] | GET | requireAdmin | ver handler |
| /api/freight/calculate | POST | delegação/controle específico | calculateFreightSchema |
| /api/freight | GET, POST | delegação/controle específico | ver handler |
| /api/health/live | GET | delegação/controle específico | ver handler |
| /api/health/ready | GET | delegação/controle específico | ver handler |
| /api/internal/metrics | GET | delegação/controle específico | ver handler |
| /api/loja/active | GET | delegação/controle específico | ver handler |
| /api/loja/settings | GET, PUT | requireAdmin | updateLojaSettingsSchema |
| /api/loja/[slug] | GET | delegação/controle específico | ver handler |
| /api/loyalty/simulate | POST | getCurrentUser | publicSimulationSchema |
| /api/loyalty/wallet | GET | requireAuth | ver handler |
| /api/orders | POST, GET | requireAuth | ver handler |
| /api/orders/[id]/confirm-delivery | POST | requireAuth | ver handler |
| /api/orders/[id] | GET, PATCH | requireAuth, requireAdmin | updateOrderSchema |
| /api/orders/[id]/status | GET | delegação/controle específico | ver handler |
| /api/products | GET, POST | requireAdmin | productFiltersSchema, createProductSchema |
| /api/products/[id] | GET, PUT, DELETE | requireAdmin | updateProductSchema |
| /api/upload | POST | getCurrentUser | ver handler |
| /api/user/profile | GET, PUT | getCurrentUser | updateProfileSchema |
| /api/webhooks/asaas | POST | delegação/controle específico | webhookSchema |
| /api/webhooks/asaas/simulate | POST | requireAdmin | simulationSchema |

Novidades relevantes: refund administrativo, health live/ready, métricas internas e cron de reconciliação v1. Essas rotas foram inspecionadas e têm suítes unitárias; não representam serviços operacionais ativos por existir código.

### Conclusão

Contratos e isolamento corrigidos possuem evidência local. Permanecem recuperação externa/agenda, política de reembolso, inconsistências pontuais de erro e cobertura HTTP/browser. Cupons/carteira monetária não foram presumidos recursos implementados.
