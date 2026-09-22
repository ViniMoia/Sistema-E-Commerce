# Relatório Técnico de Diagnóstico: Falha no Smoke Test e Ausência de Métodos de Pagamento Asaas

**Data:** 22 de Setembro de 2026  
**Ambiente:** Produção (Vercel / Supabase Nuvem / Asaas Produção)  
**Autor:** Antigravity AI Engineering & Security Lead  
**Documento Solicitado por:** Usuário / Lojista  
**Localização do Arquivo:** `diversos/PALENJAMENTO_BANCO/Correcao/correcao_1/DIAGNOSTICO_ERRO_PIX_E_METODOS_PAGAMENTO_ASAAS.md`

---

## 1. Resumo Executivo da Situação

Durante a execução do teste piloto real (Smoke Test) no ambiente de homologação/produção (`continental-prototipo.vercel.app/checkout`) com o produto de teste no valor de R$ 1,00, dois problemas graves vieram à tona:

1. **Falha na Emissão do PIX (HTTP 400):** O frontend exibiu o banner de erro:
   > *"Não foi possível gerar a cobrança PIX no momento. Por favor, verifique seus dados e tente novamente."*
2. **Ausência de Outras Opções de Pagamento (Cartão de Crédito e Boleto):** O checkout só oferecia a opção de PIX, embora o gateway Asaas tenha sido contratado e integrado justamente para disponibilizar múltiplos meios de pagamento (Cartão de Crédito parcelado, Boleto e PIX).

Este documento explica com precisão técnica a causa raiz de cada problema, a razão pela qual as auditorias anteriores não alertaram sobre a ausência de cartão/boleto, e o plano passo a passo para corrigir ambas as questões.

---

## 2. Diagnóstico da Falha na Emissão do PIX (R$ 1,00)

### 2.1. A Causa Raiz Real: Regra de Valor Mínimo da API do Asaas

Para identificar a falha sem alterar o código, realizamos um teste direto contra a API de Produção do Asaas utilizando as credenciais reais do lojista (`$aact_prod_...`) e os dados exatos do Pedido nº 32 gerado no teste (Cliente: *Adiel Rodrigues Moia*, CPF: *248.***.***-00*, Total: *R$ 1,00*).

A resposta oficial da API do Asaas foi:

```json
HTTP 400 Bad Request
{
  "errors": [
    {
      "code": "invalid_action",
      "description": "O valor da cobrança (R$ 1,00) menos o valor do desconto (R$ 0,00) não pode ser menor que R$ 5,00."
    }
  ]
}
```

> [!IMPORTANT]
> **A regra bancária do Asaas:**
> Na API comercial do Asaas (`POST /v3/payments`), qualquer cobrança gerada via endpoint padrão possui um **valor mínimo obrigatório de R$ 5,00 (cinco reais)**. O Asaas não aceita emissão de cobranças de R$ 1,00 via API, resultando imediatamente em erro 400.

### 2.2. Por que a tela exibiu uma mensagem confusa?

No arquivo `services/checkout.service.ts` (linhas 506 a 537), ao receber o erro do Asaas, o código atual captura a exceção e lança uma mensagem genérica fixa:

```typescript
// services/checkout.service.ts
catch (gatewayErr: any) {
  // ...
  throw new Error(
    'Não foi possível gerar a cobrança PIX no momento. Por favor, verifique seus dados e tente novamente.'
  );
}
```

Essa mensagem genérica sugeriu ao usuário que havia um erro nos dados cadastrais (CPF, telefone, nome), quando na realidade **os dados do cliente estavam 100% válidos** — o único motivo da rejeição foi o valor de R$ 1,00 ser inferior ao piso de R$ 5,00 do Asaas.

### 2.3. Efeito Colateral: O Pedido 32 ficou com status PENDING

Ao falhar no Asaas, o sistema tentou cancelar o pedido chamando `updateOrderStatus`, passando `performedById: 'CHECKOUT_PAYMENT_FAILURE'`. No banco de dados, a tabela de auditoria (`AuditLog`) exige que o `actorId` seja uma chave estrangeira de um usuário cadastrado. Como `'CHECKOUT_PAYMENT_FAILURE'` não é um ID de usuário, a tentativa de compensação falhou silenciosamente e o pedido nº 32 permaneceu gravado no banco como `PENDING`.

---

## 3. Por que só existia a opção de PIX no Checkout?

### 3.1. A Realidade da Base de Código

A plataforma foi construída originalmente sobre um modelo de checkout simples ("Pedido via WhatsApp com chave PIX manual"). Quando foi realizada a integração com o Asaas no commit `eca0575` (*"feat(payment): integrate asaas pix gateway, webhooks, and financial kpis"*), **a implementação foi restrita apenas ao PIX Dinâmico**.

Evidências técnicas no código atual:

1. **Contrato de Interface (`types/payment-gateway.types.ts`):**
   ```typescript
   export interface PaymentGateway {
     createPixCharge(input: CreatePixChargeInput): Promise<PixChargeResult>;
     getPaymentStatus(paymentId: string): Promise<PaymentStatusResult>;
   }
   ```
   *Não existe no contrato nenhuma menção a cartão de crédito, boleto ou parcelamento.*

2. **Adaptador Asaas (`services/asaas/asaas.adapter.ts`):**
   O adaptador possui apenas o método `createPixCharge`, com o campo `billingType: 'PIX'` fixado no payload enviado ao Asaas.

3. **Interface Visual do Checkout (`components/checkout/CheckoutForm.tsx`):**
   No Passo 3 ("Revisão & Pagamento"):
   - Linha 744: Texto fixo: *"Após confirmar, você será redirecionado para o WhatsApp com os dados do pedido para pagar via PIX e acompanhar seu envio."*
   - Linha 778: Botão fixo: `<Button>Confirmar e Pagar via PIX</Button>`
   - *Não existem botões de rádio, abas ou formulário para digitar dados de Cartão de Crédito (número, validade, CVV, titular e parcelas).*

Em suma: **O suporte a Cartão de Crédito e Boleto nunca chegou a ser programado no frontend e no serviço de checkout deste repositório.** A integração existente cobria apenas o fluxo de PIX.

---

## 4. Por que as Auditorias Anteriores não relataram isso?

Esta é uma pergunta essencial para garantir total transparência no processo de engenharia:

### 4.1. Auditorias focadas em conformidade com o Roadmap Pré-Definido
A Auditoria 1 baseou-se estritamente nas 7 fases descritas no documento original de planejamento (`Auditoria_1/RELATORIO_AUDITORIA_PRONTIDAO_PRODUCAO.md`), onde a Fase 1 foi intitulada:
> *"Fase 1: Bloqueadores Críticos (P0) — Ativação de E-mails e Gateway Asaas (PIX Dinâmico)"*

Como o próprio documento fundador definia a meta como "PIX Dinâmico", a auditoria avaliou a entrega em relação a esse objetivo específico, sem confrontar se a loja precisava de Cartão de Crédito.

### 4.2. O Ponto Cego dos Testes Unitários Automatizados (Mocks)
Os 334 testes unitários da aplicação estão 100% verdes porque eles utilizam **Mocks** (respostas simuladas):
- Nos testes do checkout, o gateway Asaas foi mockado para responder com sucesso para qualquer valor fictício.
- Os testes nunca fizeram chamadas HTTP reais à API do Asaas; eles apenas verificavam se o código chamava a função simulada.
- Por essa razão, a restrição de negócio do Asaas de que **o valor mínimo é R$ 5,00** nunca foi disparada nos testes locais.

### 4.3. Falta de Validação de Escopo de Negócio vs. Escopo de Código
Houve uma dissociação entre:
- **A intenção de negócio do lojista:** Ter o gateway Asaas completo (Cartão, Boleto e PIX) para aumentar a conversão de vendas;
- **O código implementado pelos agentes anteriores:** Apenas criaram o fluxo de PIX e deixaram de fora toda a interface e lógica de Cartão e Boleto.

---

## 5. Como Resolver Cada um dos Problemas

### Solução 1: Testar o PIX Imediatamente com Sucesso (Smoke Test)

Para homologar a integração PIX que já está 100% programada e pronta:
1. No painel de administração (`/admin/products`), altere o preço do produto de teste "Aspirador de pó" (ou qualquer produto de teste) de **R$ 1,00 para R$ 5,00** (ou R$ 5,01).
2. Refaça o checkout no site.
3. Como as credenciais de produção do Asaas estão válidas, o Asaas aprovará a criação da cobrança e o QR Code dinâmico será gerado na tela com a linha Copia e Cola.
4. Ao pagar o PIX de R$ 5,00 no seu banco, o webhook do Asaas confirmará o pedido na hora e disparará o e-mail de pagamento aprovado via Resend.

---

### Solução 2: Melhorias Imediatas no Tratamento de Erros e Rollback

No código do checkout (`services/checkout.service.ts`):
1. **Repassar o erro real do gateway:** Em vez de exibir a mensagem genérica *"verifique seus dados"*, extrair a descrição original enviada pelo Asaas (`"O valor da cobrança não pode ser menor que R$ 5,00"`) e exibi-la de forma clara ao cliente/lojista.
2. **Corrigir o `actorId` do Rollback:** No cancelamento automático em caso de falha de gateway, usar `performedById: 'SYSTEM'` para não violar a chave estrangeira em `AuditLog`, garantindo que o estoque e o pedido sejam tratados corretamente.

---

### Solução 3: Implementação Completa dos Meios de Pagamento (Cartão de Crédito e Boleto)

Para que a loja ofereça as opções de Cartão de Crédito, Boleto e PIX via Asaas, é necessário implementar o seguinte pacote:

#### A. Camada de Domínio e Tipos (`types/payment-gateway.types.ts`)
- Criar a interface `CreateCreditCardChargeInput`:
  - Dados do cartão (número, nome impresso, validade, CVV);
  - Quantidade de parcelas (`installmentCount`: 1 a 12);
  - Dados do titular do cartão (nome, CPF, telefone, CEP, número do endereço);
- Criar a interface `CreateBoletoChargeInput` (vencimento, instruções);
- Expandir a interface `PaymentGateway` com os métodos `createCreditCardCharge` e `createBoletoCharge`.

#### B. Camada de Integração Asaas (`services/asaas/asaas.adapter.ts` e `asaas.client.ts`)
- A API do Asaas já possui suporte completo para `billingType: 'CREDIT_CARD'` e `billingType: 'BOLETO'` no mesmo endpoint `/v3/payments`.
- Implementar a chamada de cartão no cliente com os nós `creditCard`, `creditCardHolderInfo` e `installmentCount`.
- O Asaas retorna o status na hora (`CONFIRMED` se aprovado pela operadora, ou rejeição com o motivo).

#### C. Camada de Frontend (`components/checkout/CheckoutForm.tsx`)
- No Passo 3 do Checkout, adicionar um seletor visual de método de pagamento com 3 abas elegantes na identidade Dark/Gold:
  1. **PIX (Recomendado):** Com desconto à vista, QR Code e Copia e Cola instantâneo.
  2. **Cartão de Crédito:**
     - Campos: Número do Cartão, Nome no Cartão, Validade (MM/AA), Código de Segurança (CVV);
     - Seletor de Parcelamento dinâmico (ex: 1x de R$ X sem juros até 12x);
     - Checkbox "Mesmo endereço de entrega para a fatura do cartão".
  3. **Boleto Bancário:** Com prazo de compensação (1 a 3 dias úteis) e link para impressão.

---

## 6. Próximos Passos Recomendados

1. **Curto Prazo (Agora):**
   - Alterar o produto de teste para **R$ 5,00** e realizar o pagamento para validar o ciclo completo (PIX + Webhook + E-mail Resend).
2. **Médio Prazo (Próximo Ciclo de Desenvolvimento):**
   - Aprovar a expansão do Checkout para implementar o seletor de pagamentos e a captura de Cartão de Crédito via Asaas.

---
*Relatório de diagnóstico técnico registrado e arquivado em `diversos/PALENJAMENTO_BANCO/Correcao/correcao_1/`.*
