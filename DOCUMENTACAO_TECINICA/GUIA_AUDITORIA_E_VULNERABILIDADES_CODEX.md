# GUIA DE AUDITORIA TÉCNICA & VULNERABILIDADES — AGENTE CODEX

> **Destinatário:** Engenheiro de Auditoria & Agente Autônomo Codex  
> **Data:** 25 de Setembro de 2026  
> **Objetivo:** Orientar a varredura profunda de segurança, integridade transacional, resiliência de negócio e conformidade arquitetural no projeto.

---

## 1. INSTRUÇÕES OPERACIONAIS PARA O AGENTE CODEX

Quando você (ou o agente Codex) for analisar o repositório, execute as inspeções seguindo este fluxo estruturado:

1. **Checagem de Tipagem e Sintaxe Estática**:
   Execute `npx tsc --noEmit` na raiz. Qualquer erro de compilação TypeScript indica regressão ou quebra de contrato.
2. **Execução da Suíte de Testes Unitários**:
   Execute `npm run test:unit`. O sistema conta com **49 arquivos de teste** cobrindo 364 cenários críticos (validações, motores de cálculo, adaptadores do Asaas, políticas de acesso e sanitização de DTOs). Todas devem passar.
3. **Atenção com Testes de Integração**:
   O arquivo [tests/setup/db.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/tests/setup/db.ts) possui uma trava de segurança intencional: ele **bloqueia** qualquer teste de integração se a variável `TEST_DATABASE_URL` não contiver `localhost` ou `_test` no nome, impedindo a limpeza acidental do banco de homologação Neon DB.
4. **Regra de Ouro do Next.js RSC (App Router)**:
   Nunca repasse classes não-planas (como `Prisma.Decimal`) de Server Components (`page.tsx` assíncronas) diretamente para Client Components (`"use client"`). Converta sempre usando `Number(valor)`.

---

## 2. MATRIZ DE AUDITORIA & HOTSPOTS DE VULNERABILIDADES

Ao auditar o projeto, concentre sua análise nos seguintes tópicos de alto risco:

### 2.1 BOLA / IDOR & Quebra de Isolamento Multi-Tenant
* **Arquivos-chave**:
  * [lib/auth/guards.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/auth/guards.ts)
  * [lib/tenant.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/tenant.ts)
  * [app/api/products/[id]/route.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/api/products/[id]/route.ts)
  * [app/api/orders/[id]/route.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/api/orders/[id]/route.ts)
  * [app/api/customers/[id]/route.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/api/customers/[id]/route.ts)
* **O que verificar**:
  * Certifique-se de que rotas de mutação (`PUT`, `DELETE`, `POST`) **nunca** confiem no `lojaID` enviado no corpo da requisição ou na URL. O `lojaID` deve obrigatoriamente ser derivado do usuário autenticado (`guard.user.lojaID`).
  * Em consultas de leitura (`GET`), confira se o Prisma inclui a cláusula `where: { id, lojaID }` para impedir que um usuário acesse registros de outra loja através da modificação manual de IDs no navegador.

### 2.2 Integridade Monetária & Cálculos de Ponto Flutuante
* **Arquivos-chave**:
  * [services/checkout.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/checkout.service.ts)
  * [services/order.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/order.service.ts)
  * [services/loyalty.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/loyalty.service.ts)
  * [services/asaas/installment.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/asaas/installment.service.ts)
* **O que verificar**:
  * Operações financeiras com múltiplos produtos, cupons de desconto, pontos de fidelidade e frete **devem** ser calculadas com `Prisma.Decimal` ou métodos seguros da biblioteca `decimal.js` (como `.plus()`, `.times()`, `.minus()`).
  * O preço unitário do item **sempre** deve ser verificado a partir do banco de dados no momento da criação do pedido, nunca aceitando o preço enviado pelo payload do carrinho do navegador.

### 2.3 Concorrência de Estoque & Race Conditions
* **Arquivos-chave**:
  * [services/checkout.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/checkout.service.ts)
  * [services/order-timeout.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/order-timeout.service.ts)
* **O que verificar**:
  * Na compra simultânea do último item em estoque por dois usuários diferentes, a reserva de estoque deve ocorrer dentro de um bloco `prisma.$transaction`.
  * Verifique se o decremento valida `stock >= quantity` antes de comitar a transação para evitar que o estoque fique negativo.
  * Verifique se o cancelamento de pedidos ou timeout devolve exatamente o estoque decrementado, tanto para a tabela `Product` quanto para `ProductVariants`.

### 2.4 Segurança do Gateway Asaas & Webhooks
* **Arquivos-chave**:
  * [app/api/webhooks/asaas/route.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/app/api/webhooks/asaas/route.ts)
  * [services/asaas/](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/asaas/)
* **O que verificar**:
  * O endpoint do webhook **deve** validar obrigatoriamente o header de autenticação `asaas-access-token`. Se ausente ou inválido, deve rejeitar com `401 Unauthorized`.
  * Verifique a **idempotência de eventos**: se o Asaas enviar a mesma notificação `PAYMENT_RECEIVED` mais de uma vez para o mesmo pedido, o sistema não pode duplicar a pontuação de fidelidade nem processar transições inválidas.

### 2.5 Exposição de Dados Pessoais (LGPD / Privacy)
* **Arquivos-chave**:
  * [lib/utils/dto-sanitizer.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/utils/dto-sanitizer.ts)
  * [lib/logger.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/lib/logger.ts)
* **O que verificar**:
  * O campo `password` (mesmo com hash) **nunca** deve ser retornado por nenhuma API de usuário. O sanitizador `sanitizeUser()` deve ser aplicado em todos os retornos.
  * CPF/CNPJ, dados de cartão de crédito e tokens de sessão não devem ser impressos em texto puro nos logs do servidor (`console.log` / `lib/logger.ts`).

### 2.6 Negação de Serviço (DoS) em Consultas
* **Arquivos-chave**:
  * [services/product.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/product.service.ts)
  * [services/customer.service.ts](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/services/customer.service.ts)
* **O que verificar**:
  * Validações de paginação do Zod devem impor limites superiores rígidos (ex: `limit: z.coerce.number().max(100)`).
  * Queries com buscas textuais devem utilizar índices ou `mode: "insensitive"` adequados para não travar o banco Neon Serverless em coleções volumosas.

---

## 3. PENDÊNCIAS E DÉBITOS TÉCNICOS JÁ IDENTIFICADOS

O Codex deve prestar atenção especial aos seguintes itens que estão mapeados ou em evolução no projeto:

1. **Exclusão de Produtos com Histórico de Vendas (Integridade Referencial)**:
   * No modelo `OrderItem` ([prisma/schema.prisma](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/prisma/schema.prisma)), a relação com `Product` não possui `onDelete: Cascade` nem `onDelete: SetNull`.
   * Se um administrador tentar excluir fisicamente um produto que já tenha sido vendido em um pedido anterior, o banco de dados lançará um erro de violação de chave estrangeira (`P2003`).
   * *Ação sugerida para auditoria*: Avaliar a introdução de uma flag de **Soft Delete** (`isArchived` ou `isActive: Boolean`) para desativar o produto do catálogo sem quebrar o histórico fiscal/contábil de pedidos passados.

2. **Homologação das Chaves de Produção**:
   * O sistema conta com fallbacks resilientes para `RESEND_API_KEY` (usando log em memória de desenvolvimento). Para o Go-Live oficial em produção, os secrets reais do Asaas e Resend precisarão estar devidamente injetados no ambiente de deployment (Vercel).

3. **Conclusão do Redesign Visual Continental**:
   * A especificação oficial de design está documentada em [diversos/REDESGN/Design_System/DESIGN_SYSTEM_CONTINENTAL.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/diversos/REDESGN/Design_System/DESIGN_SYSTEM_CONTINENTAL.md).
   * As páginas da Home, Catálogo e parte do Painel de Produtos já seguem o padrão canônico. As telas de autenticação e detalhes de checkout estão no roteiro de homologação visual.

---

## 4. CHECKLIST RÁPIDO PARA AUDITORIA VIA CODEX

- [ ] Rodar `npx tsc --noEmit` para garantir conformidade estática total.
- [ ] Rodar `npm run test:unit` para verificar a bateria de 364 testes unitários.
- [ ] Inspecionar todas as chamadas `prisma.<model>.update` e `delete` para checar `where: { id, lojaID }`.
- [ ] Verificar se todas as rotas em `app/api/admin/*` possuem `await requireAdmin()`.
- [ ] Verificar se os endpoints de webhook tratam casos de requisições repetidas (idempotência).
- [ ] Analisar se há inputs sem limites de caracteres ou validações com Zod em formulários públicos.
