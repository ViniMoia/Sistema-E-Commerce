# Checklist Operacional de Deploy & Observabilidade — Gateway Asaas

**Projeto:** Continental Produtos Estéticos Automotivos  
**Ambiente Alvo:** Produção (Vercel / Cloud Provider)  
**Data de Homologação:** 18/09/2026  
**Status:** Preparado para Go-Live (Fase 8 Concluída)

---

## 1. Variáveis de Ambiente Obrigatórias no Provedor (Vercel / Servidor)

As variáveis abaixo devem ser configuradas no painel da Vercel (ou do servidor de aplicação) nas abas **Production** e **Preview**:

| Variável | Escopo | Descrição / Valor de Referência | Proteção |
| :--- | :--- | :--- | :--- |
| `ASAAS_API_URL` | Production / Preview | `https://api.asaas.com/v3` | Pública de Sistema |
| `ASAAS_API_KEY` | Production / Preview | `[CHAVE_PRODUCAO_FORNECIDA_PELO_CLIENTE]` *(Inicia com `$aact_prod_`)* | **Segredo Crítico** (Sensitive) |
| `ASAAS_WEBHOOK_TOKEN` | Production / Preview | `whsec_29228f604df044d451be2e8a5e876d182e5a47ae3d29d602bc8d0a9352d72d85` | **Segredo Crítico** (Sensitive) |
| `DATABASE_URL` | Production / Preview | String de Conexão Supabase Pooler (Porta 6543 / Transaction) | **Segredo Crítico** |
| `DIRECT_URL` | Production / Preview | String de Conexão Supabase Direta (Porta 5432 / Migrations) | **Segredo Crítico** |

> [!IMPORTANT]
> **Nenhuma** dessas variáveis possui o prefixo `NEXT_PUBLIC_`. Portanto, o Next.js garante nativamente que seus valores permaneçam confinados ao ambiente Node.js do servidor, sem qualquer risco de vazamento para o bundle do navegador.

---

## 2. Configuração do Webhook no Painel do Asaas

Assim que a aplicação for publicada e o domínio oficial estiver respondendo (`https://seu-dominio.com.br`):

1. Acesse o **Painel do Asaas Produção** ([asaas.com](https://www.asaas.com)) com as credenciais do titular da conta.
2. Navegue até o menu lateral esquerdo: **Configurações da Conta** ➔ **Integrações** ➔ **Webhooks**.
3. Na seção de **Webhooks para Cobranças**, configure:
   * **URL do Webhook:** `https://[SEU_DOMINIO]/api/webhooks/asaas`
   * **Email para Notificação de Erros:** Email operacional do responsável pela TI / E-commerce.
   * **Token de Autenticação:**
     ```
     whsec_29228f604df044d451be2e8a5e876d182e5a47ae3d29d602bc8d0a9352d72d85
     ```
   * **Versão da API:** `v3`
   * **Status:** `Ativo`
4. Selecione estritamente os seguintes **Eventos Monitorados**:
   - [x] `PAYMENT_RECEIVED` *(Pagamento em dinheiro recebido ou PIX liquidado)*
   - [x] `PAYMENT_CONFIRMED` *(Pagamento confirmado e saldo compensado)*
   - [x] `PAYMENT_OVERDUE` *(Cobrança vencida sem pagamento — cancela pedido e libera estoque)*
   - [x] `PAYMENT_DELETED` *(Cobrança removida no Asaas — cancela pedido e libera estoque)*
   - [x] `PAYMENT_REFUNDED` *(Cobrança estornada — atualiza pedido para estornado)*
5. Clique em **Salvar Configurações**.

---

## 3. Observabilidade, Métricas e Rastreamento de Logs (LGPD Compliant)

Todas as rotas de checkout e webhook emitem logs estruturados em formato JSON com identificadores de correlação (`correlationId`, `orderId`, `asaasPaymentId`) e mascaramento automático de dados sensíveis (LGPD).

### Ações Logadas e Consultas no Visualizador de Logs (Vercel / Cloudwatch / Datadog):

| Ação (`action`) | Nível | Significado Operacional | Indicador Associado |
| :--- | :--- | :--- | :--- |
| `CHECKOUT_ORDER_SUCCESS` | `info` | Pedido gerado e cobrança PIX criada com sucesso | Total de Cobranças Iniciadas |
| `ASAAS_PIX_ISSUED` | `info` | Retorno com sucesso do Asaas contendo QR Code e Payload PIX | Latência de Emissão (`durationMs`) |
| `ASAAS_WEBHOOK_PROCESSED` | `info` | Evento do webhook recebido, autenticado e persistido | Idempotência e Confiabilidade |
| `PAYMENT_CONFIRMED` | `info` | Status do pedido transitado para `PAID`, estoque baixado | Taxa de Conversão de Vendas |
| `PAYMENT_EXPIRED_CANCELLED` | `warn` | PIX não pago dentro do vencimento. Estoque restituído | Taxa de Abandono de Pagamento |
| `ASAAS_PIX_ISSUE_FAILED` | `error` | Erro ao chamar API Asaas (timeout ou dados incorretos) | Taxa de Falha do Gateway |
| `CHECKOUT_VALIDATION_FAILED` | `warn` | Validação de checkout recusada (ex: CPF inválido) | Fricção no Formulário |

### Exemplo de Log Estruturado Produzido pelo Sistema:
```json
{
  "timestamp": "2026-09-18T14:03:00.123Z",
  "level": "info",
  "message": "Cobrança PIX emitida com sucesso no Asaas",
  "context": {
    "action": "ASAAS_PIX_ISSUED",
    "orderId": "08f8703a-18b8-4c12-8e6f-402a39a75661",
    "orderNumber": 1042,
    "asaasPaymentId": "pay_98231749812",
    "durationMs": 420,
    "value": 159.90,
    "customer": {
      "cpfCnpj": "529.***.***-25",
      "email": "cliente@email.com"
    }
  }
}
```

> [!TIP]
> **Mascaramento Automático LGPD:** Observe que o campo `cpfCnpj` preserva apenas os dígitos iniciais e finais para validação pelo operador, enquanto os dígitos centrais são permanentemente ofuscados, impedindo vazamento de dados em agregadores de telemetria.

---

## 4. Procedimento de Contingência e Rollback

Caso o Asaas apresente degradação prolongada ou manutenção externa:

1. **Comportamento Automático da Aplicação (Fail-Closed):**
   - O cliente não recebe chaves estáticas falsas. O sistema cancela a transação em menos de 8 segundos, libera o estoque e exibe mensagem clara: *"Não foi possível gerar a cobrança PIX no momento. Por favor, tente novamente em instantes."*
2. **Reenvio de Webhooks:**
   - O Asaas possui política de reintenta automática de webhook caso o endpoint retorne timeout ou erro 5xx. Nosso endpoint possui garantia de idempotência absoluta baseada no `eventId` na tabela `PaymentWebhookEvent`.
