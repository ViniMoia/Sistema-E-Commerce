# Roadmap de Evolução — Pagamentos e Estoque

## 1. Situação Atual
Atualmente, a plataforma opera com um fluxo de checkout focado em **WhatsApp/Pix Manual**. Este modelo permite uma entrada rápida no mercado com baixo custo operacional inicial, mas exige intervenção humana para confirmação de pagamentos.

- **Implementado:** Fluxo completo de checkout público, cálculo automático de frete por cidade, criação de pedidos transacional via Prisma, e geração de mensagem estruturada para fechamento via WhatsApp.
- **Preparação de Dados:** O esquema do banco de dados (Prisma) já contempla o modelo `PaymentIntent` e campos de `stockQuantity` no modelo `Product`, além dos enums `PaymentMethod` e `PaymentProvider`.
- **Pontos de Extensão:** O `checkout.service.ts` utiliza uma transação que pode ser facilmente estendida para incluir chamadas de API externas e o `checkout/route.ts` já possui validação via Zod pronta para novos campos.

---

## 2. FASE A — Gateway de Pagamento Completo
O objetivo desta fase é automatizar a confirmação de pagamentos, eliminando a necessidade de validação manual do comprovante.

### Requisitos
- Integração com API de um provedor de pagamento (SDK ou REST).
- Sistema de Webhooks para ouvir eventos de "Pagamento Confirmado" ou "Falha".
- Interface de processamento (Loading states) no frontend enquanto o gateway processa o cartão/Pix.

### Limitações atuais a resolver
- Dependência de intervenção humana no WhatsApp para mudar o status do pedido para `PAID`.
- Ausência de suporte automatizado para Cartão de Crédito e Boleto.

### Passos de implementação
1. **Configuração do Provider:** Escolha e configuração de chaves de API.
2. **Atualização do Service:** Modificar `createOrder` para gerar um `PaymentIntent` vinculado ao provedor.
3. **Criação do Endpoint de Webhook:** Nova rota `api/webhooks/payments` para processar notificações assíncronas do provedor.
4. **UI de Checkout:** Adicionar suporte a campos de Cartão de Crédito (usando Elementos/Iframes do provedor para conformidade PCI).

### Providers recomendados
- **Stripe:** Melhor documentação e suporte global.
- **Mercado Pago:** Taxas competitivas no Brasil e ótima aceitação de Pix.
- **Pagar.me:** Excelente para recorrência e controle de recebíveis detalhado.

### Estimativa de esforço
- **Complexidade:** Média/Alta.
- **Tempo:** 2 a 3 semanas de desenvolvimento e testes.

---

## 3. FASE B — Dashboard de Estoque
O dashboard permitirá que o lojista gerencie sua disponibilidade de produtos em tempo real através de uma interface administrativa.

### Requisitos
- Visão geral de produtos com estoque baixo (alertas).
- Histórico de entradas e saídas (Audit Log de estoque).
- Edição em lote de quantidades e preços.

### Dados já capturados que alimentam o dashboard
- `Product.stockQuantity`: Campo atual que armazena a quantidade disponível.
- `OrderItem.quantity`: Utilizado para abater o estoque no momento da criação do pedido (necessário implementar o decremento atômico).
- `Loja.id`: Filtro principal para isolar dados por unidade de negócio.

### Componentes a construir
- **InventoryTable:** Listagem com filtros de categoria e status de disponibilidade.
- **StockAdjustmentModal:** Interface para entrada manual de novos lotes de mercadoria.
- **LowStockWidget:** Card de resumo para a home do admin com itens abaixo do limite crítico.

### Estimativa de esforço
- **Complexidade:** Média.
- **Tempo:** 1 a 2 semanas.

---

## 4. Dependências entre Fases
1. **Prioridade de Fluxo:** A Fase A (Pagamentos) deve idealmente preceder a Fase B completa, pois a confirmação automática de pagamento é o gatilho ideal para a reserva definitiva de estoque no banco de dados (evitando "vendas fantasmas").
2. **Reserva de Estoque:** Recomenda-se implementar uma "reserva temporária" na Fase A que é confirmada ou liberada dependendo do status do `PaymentIntent`.

---

## 5. Considerações de Segurança
- **PCI Compliance:** Nunca armazenar números de cartão de crédito no banco de dados local. Utilizar tokens fornecidos pelos gateways (Stripe Elements, etc).
- **Validação de Webhooks:** Implementar verificação de assinatura (signature verification) em todos os endpoints de webhook para garantir que a requisição veio realmente do provedor de pagamento.
- **Idempotência:** Garantir que o processamento de um webhook de pagamento não duplique pedidos ou abatimentos de estoque caso a mesma notificação seja enviada mais de uma vez pelo gateway.
