# DOCUMENTAÇÃO TÉCNICA DO SISTEMA — CONTINENTAL E-COMMERCE

> **Versão da Plataforma:** 1.0.0-rc  
> **Data de Atualização:** 25 de Setembro de 2026  
> **Público-Alvo:** Desenvolvedores, Engenheiros de Software e Auditores Técnicos (Agentes Autônomos / Codex).  
> **Finalidade:** Fornecer um panorama detalhado, exato e fidedigno do estado atual da arquitetura, dados, fluxos de negócio e implementações do sistema.

---

## 1. VISÃO GERAL & DOMÍNIO DO PROJETO

O sistema é uma plataforma de **E-Commerce Multi-Tenant** de alta performance voltada para o segmento automotivo de luxo, customizada para a marca **Continental Produtos Estéticos Automotivos** (loja ativa principal: `continental-prototipo`).

### Pilares Arquiteturais
1. **Multi-Tenancy por Isolamento de Dados**: Cada loja possui catálogo, clientes, carteira de fidelidade, pedidos e regras de frete associados ao seu identificador único (`lojaID`).
2. **Alta Precisão Monetária & Auditoria**: Uso de tipos decimais (`@db.Decimal(10, 2)`) em toda a camada financeira (preços, subtotais, fretes, pontos e taxas) com travas matemáticas contra dízimas de ponto flutuante.
3. **Resiliência Transacional**: Operações de inventário, criação de pedidos e liquidação financeira executadas dentro de transações atômicas com locks otimistas/pessimistas (`prisma.$transaction`).
4. **Design System Proprietário**: Interface customizada de alta sofisticação técnica, com paleta Dark Slate (`#000000`, `#050505`, `#0F172A`), Ouro Técnico Continental (`#F0B40E`, `#DDAF02`, `#B8A06A`), tipografia monoespelhada técnica e palco branco (`bg-white`) para exibição pura de produtos automotivos.

---

## 2. STACK TECNOLÓGICO & DEPENDÊNCIAS

### Core & Framework
* **Framework Web**: [Next.js](https://nextjs.org/) `16.3.5` (App Router, React Server Components, Server Actions e Turbopack habilitado).
* **Linguagem**: [TypeScript](https://www.typescriptlang.org/) `5.x` (Modo strict habilitado, zero erros de emissão via `tsc --noEmit`).
* **Runtime**: [Node.js](https://nodejs.org/) `>= 20.x` / `22.x`.
* **Biblioteca UI**: [React](https://react.dev/) `18.x` / `React DOM` `18.x`.

### Persistência & Banco de Dados
* **ORM**: [Prisma](https://www.prisma.io/) `5.22.0`.
* **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) hospedado no [Neon Serverless DB](https://neon.tech/).
  * `DATABASE_URL`: Conexão via **Transaction Pooler** (pgbouncer) na porta `6543`.
  * `DIRECT_URL`: Conexão direta nativa para migrações (`prisma migrate`) na porta `5432`.
* **Armazenamento de Mídia**: [Supabase Storage](https://supabase.com/storage) (bucket `products` para imagens em alta resolução com upload streaming).

### Validação, Formulários & Estado
* **Validação de Schemas**: [Zod](https://zod.dev/) `^4.4.3` / `@hookform/resolvers` `5.2.2`.
* **Formulários**: [React Hook Form](https://react-hook-form.com/) `7.75.0`.
* **Estado Global do Cliente**: [Zustand](https://github.com/pmndrs/zustand) `5.0.12` (utilizado para estado do carrinho persistido).
* **Componentes Acessíveis**: [@radix-ui](https://www.radix-ui.com/) (Dialog, Slot, ScrollArea, Select, Toast, Avatar, Separator).
* **Estilização**: Tailwind CSS `3.4.1`, Tailwind Merge `3.5.0`, Lucide React `1.8.0` (ícones), GSAP `3.15.0`.

### Pagamento & Integrações Externas
* **Gateway de Pagamento**: [Asaas API v3](https://docs.asaas.com/) (PIX dinâmico com QR Code, Boleto Bancário D+1 e Cartão de Crédito com parcelamento dinâmico em até 12x).
* **E-mails Transacionais**: [Resend](https://resend.com/) com fallback resiliente para provedor local em desenvolvimento (`lib/email/providers/dev.provider.ts`).
* **Logística e Frete**: Módulos para Correios (PAC/SEDEX), J&T Express, Tabela Local Customizada e Retirada no Local (`PICKUP`).

### Testes & Qualidade
* **Test Runner**: [Vitest](https://vitest.dev/) `4.1.6`.
* **Linter**: [ESLint](https://eslint.org/) `9.x` com regras específicas de App Router.

---

## 3. ESTRUTURA DE PASTAS E RESPONSABILIDADES

```text
├── app/                           # Next.js App Router (Rotas de Páginas e APIs)
│   ├── (public)/                  # Rotas públicas (Home, Catálogo)
│   ├── admin/                     # Módulo Administrativo Protegido
│   │   ├── customers/             # Gestão de Clientes e Métricas
│   │   ├── fidelidade/            # Configurações do Programa de Pontos
│   │   ├── freight/               # Gestão de Regras de Frete
│   │   ├── orders/                # Gestão de Pedidos e Expedição
│   │   ├── products/              # Listagem, Criação e Edição de Produtos
│   │   │   ├── [id]/edit/         # Página de Edição de Produto
│   │   │   └── new/               # Página de Cadastro de Novo Produto
│   │   ├── settings/              # Configurações Gerais do Tenant
│   │   └── users/                 # Gestão de Usuários e Permissões
│   ├── api/                       # Endpoints REST (Route Handlers)
│   │   ├── auth/                  # Login, Logout, Registro
│   │   ├── cart/                  # Manipulação do Carrinho
│   │   ├── checkout/              # Submissão e Processamento de Pedidos
│   │   ├── cron/                  # Tarefas Agendadas (Timeout de Pedidos, Expiração de Pontos)
│   │   ├── customers/             # API de Clientes
│   │   ├── orders/                # API de Pedidos e Histórico
│   │   ├── products/              # CRUD de Produtos e Filtros
│   │   ├── upload/                # Upload para Supabase Storage
│   │   └── webhooks/asaas/        # Receptor de Notificações de Pagamento Asaas
│   ├── checkout/                  # Fluxo de Checkout e Confirmação
│   ├── profile/                   # Painel do Cliente (Pedidos, Dados, Fidelidade)
│   ├── login/                     # Autenticação
│   └── register/                  # Cadastro de Clientes
├── components/                    # Componentes React Reutilizáveis
│   ├── admin/                     # Componentes do Dashboard e Formulários Administrativos
│   ├── brand/                     # Logotipo Canônico Continental e Assinatura Visual
│   ├── cart/                      # Drawer e Itens de Carrinho
│   ├── catalog/                   # Filtros, Cards de Produto, BottomSheet de Marcas
│   ├── checkout/                  # Formulários de Pagamento (PIX, Cartão, Boleto)
│   └── ui/                        # Primitivas de Design System (Radix + Tailwind)
├── lib/                           # Utilitários e Infraestrutura Compartilhada
│   ├── auth/                      # Guards de Rota (requireAdmin, requireAuth)
│   ├── email/                     # Clientes de Envio de E-mail (Resend & Dev)
│   ├── supabase/                  # Cliente e Storage Supabase
│   ├── utils/                     # Formatadores, DTO Sanitizers e Helpers
│   ├── validators/                # Schemas de Validação Zod
│   ├── prisma.ts                  # Singleton Global do Prisma Client
│   ├── session.ts                 # Criptografia e Gestão de Cookies de Sessão
│   └── tenant.ts                  # Resolução Dinâmica de Loja via Host/Slug
├── prisma/                        # Schema, Migrações e Seeds do Banco
│   ├── schema.prisma              # Definição Canônica do Modelo Relacional
│   └── migrations/                # Histórico de Migrações SQL
├── services/                      # Camada de Regras de Negócio e Serviços
│   ├── asaas/                     # Adaptador e Clientes da API do Asaas
│   ├── freight/                   # Provedores e Orquestrador de Frete
│   ├── auth.service.ts            # Registro, Login e Redefinição de Senha
│   ├── cart.service.ts            # Regras do Carrinho e Snapshot de Preços
│   ├── checkout.service.ts        # Criação de Pedidos e Acoplamento Gateway
│   ├── customer.service.ts        # Métricas e Perfis de Clientes
│   ├── dashboard.service.ts       # Agregação de KPIs Financeiros e Operacionais
│   ├── loyalty.service.ts         # Cálculo, Concessão e Resgate de Pontos
│   ├── order.service.ts           # Máquina de Estados e Transições de Pedidos
│   └── product.service.ts         # Consultas Protegidas, Criação e Edição
├── tests/                         # Suíte de Testes Automatizados (Vitest)
│   ├── helpers/                   # Profiler de Queries e Requisitions Mocks
│   ├── integration/               # Testes de Transição e Proteção Multi-Tenant
│   ├── load/                      # Testes de Carga e Paginação
│   ├── setup/                     # Factores, Mocks e DB Safety Guards
│   └── unit/                      # 49 Suítes de Testes Unitários de Regressão
└── types/                         # Interfaces e Tipagens Globais TypeScript
```

---

## 4. ARQUITETURA MULTI-TENANT & ISOLAMENTO DE SEGURANÇA

### 4.1 Resolução de Tenant (`lib/tenant.ts`)
A plataforma opera com suporte a subdomínios, domínios customizados ou slug padrão:
1. O middleware/serviço analisa os headers HTTP `host` e `x-forwarded-host`.
2. Se o host for `localhost` ou um IP de rede local, utiliza o slug padrão configurado (`NEXT_PUBLIC_DEFAULT_LOJA_SLUG`, ex: `continental-prototipo`).
3. O banco de dados armazena o registro na tabela `Loja`. Todas as entidades filhas vinculam-se obrigatoriamente a `lojaID`.

### 4.2 Defesa contra BOLA / IDOR (Finding TEN-002 e BOLA-001)
* **Regra de Ouro**: O cliente **nunca** decide o `lojaID` em operações sensíveis de escrita.
* Nas rotas de administração (`POST /api/products`, `PUT /api/orders`, etc.), a função `requireAdmin()` extrai a sessão verificada do cookie e força:
  ```typescript
  const guard = await requireAdmin();
  const lojaId = guard.user.lojaID; // Origem confiável do servidor
  ```
* Nas queries Prisma, todas as cláusulas `where` exigem a composição `{ id, lojaID }`, impedindo que um administrador altere ou visualize dados de outro tenant.

---

## 5. MODELO DE DADOS RELACIONAL (PRISMA ORM)

### Principais Entidades e Relacionamentos
* **`Loja`**: Representa a loja tenant. Contém chaves PIX, configurações Asaas, parâmetros de frete e configurações de fidelidade (`loyaltyEarnRate`, `loyaltyPointValue`, `loyaltyMaxDiscountPct`).
* **`User`**: Contas de usuários com roles `CUSTOMER`, `ADMIN` e `SELLER`. Índice único composto por `[email, lojaID]`, permitindo que o mesmo e-mail exista em lojas diferentes com total segregação.
* **`Product` & `ProductVariants`**:
  * `Product`: Nome, descrição, preço base (`Decimal`), estoque geral, fotos, dimensões de frete (`weightInGrams`, `lengthCm`, `widthCm`, `heightCm`).
  * `ProductVariants`: Grade de variações (litragens: 500ml, 1L, 5L; cores/versões) com controle de estoque individual por SKU.
* **`Order` & `OrderItem`**:
  * `Order`: Histórico de vendas, cliente, endereço snapshot, método de pagamento, status (`PENDING`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`), valores monetários (`subtotal`, `shippingCost`, `total`, `pointsDiscountValue`), identificador Asaas (`asaasPaymentId`) e chave de idempotência (`idempotencyKey`).
  * `OrderItem`: Snapshot imutável do produto e preço unitário no momento da compra.
* **`OrderStatusHistory`**: Log de auditoria registrando quem alterou o status do pedido, IP de origem e data/hora.
* **`LoyaltyWallet` & `LoyaltyTransaction`**: Extrato de pontos acumulados, resgatados e expirados por cliente.

---

## 6. MÓDULOS DE DOMÍNIO E REGRAS DE NEGÓCIO

### 6.1 Checkout & Pagamentos (Asaas Integration)
Localização: `services/asaas/` e `services/checkout.service.ts`
* **PIX**:
  * Suporte a PIX estático da loja ou cobrança dinâmica via Asaas.
  * Webhook em [app/api/webhooks/asaas/route.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/api/webhooks/asaas/route.ts) processa eventos `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`.
  * Validação rigorosa do header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`.
* **Cartão de Crédito**:
  * Suporte a parcelamento de 1x até 12x.
  * Validação de tokenização do cartão, portador e antifraude do gateway.
* **Boleto Bancário**:
  * Vencimento configurado para D+1 dia útil.
  * Geração de linha digitável, código de barras e link de PDF oficial.
* **Idempotência de Pedidos**: Todo checkout gera uma `idempotencyKey` única para prevenir cobranças duplicadas em caso de retransmissão de rede.

### 6.2 Gestão de Estoque e Ciclo de Vida do Pedido
Localização: `services/order.service.ts` e `services/order-timeout.service.ts`
* Ao submeter um pedido, o estoque é reservado (decrementado) de forma atômica.
* **Timeout de Pedidos Pendentes (`Cron`)**:
  * Rota: `app/api/cron/orders-timeout/route.ts`.
  * Pedidos em estado `PENDING` não pagos dentro do limite de tempo (ex: boletos expirados ou PIX abandonado) são cancelados automaticamente pelo serviço `order-timeout.service.ts`, devolvendo o estoque aos produtos e variantes.

### 6.3 Programa de Fidelidade & Cashback
Localização: `services/loyalty.service.ts`
* Clientes ganham pontos calculados pela taxa `loyaltyEarnRate` sobre o valor pago.
* Os pontos podem ser convertidos em desconto no checkout até o teto estipulado (`loyaltyMaxDiscountPct`).
* Rota de expiração agendada: `app/api/cron/loyalty-expiration/route.ts`.

### 6.4 Gestão de Catálogo e Produtos
Localização: `app/admin/products/` e `services/product.service.ts`
* Suporte a produtos com ou sem variantes de grade.
* **Serialização de Preços**: A camada de persistência utiliza `Prisma.Decimal`. Nas fronteiras de Server Component para Client Component, os preços são convertidos via `Number(product.price)` para respeitar as exigências de serialização do React Server Components (RSC).
* Exclusão segura: O produto pode ser excluído diretamente da listagem ou dentro da página de edição, com confirmação obrigatória.

---

## 7. AUTENTICAÇÃO, SESSÕES & RBAC

### Mecanismo de Autenticação (`lib/session.ts` & `services/auth.service.ts`)
* **Senhas**: Hasheadas via `bcryptjs` com salt rounds = 10.
* **Sessão**: Cookie HTTP-only, seguro e com flag `SameSite=lax`. O token JWT/Sessão contém `{ userId, email, role, lojaID }` e é criptografado com a chave `SESSION_SECRET`.
* **Guards de Rota (`lib/auth/guards.ts`)**:
  * `getCurrentUser()`: Recupera o usuário decodificado da sessão.
  * `requireAuth()`: Garante autenticação de qualquer usuário ativo.
  * `requireAdmin()`: Garante que o usuário possua role `ADMIN` e status `ACTIVE`. Caso contrário, redireciona ou retorna HTTP 401/403.

---

## 8. CONTA DE TESTES HOMOLOGADA

Para auditoria manual e testes automatizados no painel administrativo:
* **URL de Login**: [`/login`](http://localhost:3000/login)
* **E-mail**: `dev.admin@continental.com.br`
* **Senha**: `DevAdmin@2026#Continental`
* **Papel**: `ADMIN`
* **Loja Vinculada**: Continental Produtos Estéticos Automotivos (`536bfa58-0531-49e8-9209-3a046281e516`)
