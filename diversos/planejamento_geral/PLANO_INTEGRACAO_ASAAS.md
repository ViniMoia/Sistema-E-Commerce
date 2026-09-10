# Plano de Implementação: Integração do Gateway de Pagamento Asaas (PIX Automatizado & Repasse Itaú)

Este documento detalha o planejamento passo a passo para configurar a conta no **Asaas**, obter as credenciais e integrar o fluxo de pagamento automático por PIX com QR Code dinâmico e webhook ao e-commerce da **Continental Produtos Estéticos Automotivos**, incluindo a rotina de transferência automática para a conta bancária do **Banco Itaú**.

---

## 1. Visão Geral da Arquitetura de Pagamento

Atualmente, o checkout do sistema gera pedidos com método estático (`WHATSAPP_PIX`), exigindo conferência manual do comprovante. Com o Asaas, o processo passará a ser 100% automatizado:

```
[ Cliente no Carrinho ]
         │
         ▼
[ Finalizar Pedido ] ──► [ Sistema cria Pedido no DB (PENDING) ]
                                 │
                                 ▼
                 [ Sistema chama API do Asaas (/v3/payments) ]
                                 │
                                 ▼
                  [ Asaas retorna QR Code + Linha Copia-e-Cola ]
                                 │
                                 ▼
                 [ Cliente escaneia / paga no App do Banco ]
                                 │
                                 ▼
     [ Asaas detecta pagamento e envia Webhook: PAYMENT_RECEIVED ]
                                 │
                                 ▼
              [ Rota /api/webhooks/asaas valida autenticidade ]
                                 │
                                 ├──► [ Atualiza Pedido no DB para PAID ]
                                 │
                                 ├──► [ Despacha Pedido para Nuvemshop (Abate Estoque) ]
                                 │
                                 └──► [ Asaas faz Repasse Automático Diário para o Banco Itaú ]
```

---

## 2. Passo a Passo de Execução

### Etapa 1: Configuração da Conta Asaas (App / Painel Web)
*Objetivo: Deixar a conta jurídica/física da Continental apta a transacionar e enviar fundos para o Itaú.*

1. **Cadastro e Envio de Documentos (App / Web)**:
   * Concluir o cadastro no Asaas utilizando os dados da empresa (CNPJ da Continental ou CPF do responsável legal).
   * No app/painel, enviar as fotos dos documentos solicitados (documento de identificação com foto e comprovante de endereço/contrato social).
   * Aguardar a liberação do status da conta (o Asaas costuma aprovar em poucas horas úteis).
2. **Ativação da Chave PIX**:
   * No menu do Asaas, acessar a seção **PIX** e cadastrar/vincular a chave PIX da empresa para emissão dos QR Codes.
3. **Cadastro da Conta Bancária do Banco Itaú**:
   * Acessar **Transferências** / **Configurações Bancárias**.
   * Cadastrar os dados da conta do Itaú:
     * Código do Banco: `341 - Banco Itaú S.A.`
     * Agência e Conta Corrente com dígito.
     * Mesma titularidade (mesmo CNPJ/CPF cadastrado no Asaas).
4. **Ativação da Transferência Automática (Repasse Programado)**:
   * No painel do Asaas, habilitar a opção **"Transferência Automática"**.
   * Definir a frequência desejada: **Diária** (ao final de cada dia útil, o saldo disponível é transferido diretamente para o Itaú) ou **Semanal**.

---

### Etapa 2: Obtenção das Credenciais de API & Webhook
*Objetivo: Coletar as chaves necessárias para que o sistema converse com o Asaas.*

1. **Geração da Chave de API (`API_KEY`)**:
   * Acessar o painel web do Asaas: **Minha Conta** ➔ **Configurações da Conta** ➔ aba **Integrações**.
   * Clicar em **Gerar Chave de API**.
   * O Asaas gerará uma chave que começa com `$aact_...`. Copiar e guardar em local seguro.
2. **Configuração da Fila de Webhook**:
   * Na mesma aba de Integrações, localizar a seção **Webhooks de Cobranças**.
   * Definir uma senha secreta para o campo **Token de Autenticação** (ex: uma hash segura que usaremos para validar a autenticidade dos disparos).
   * Marcar os eventos desejados:
     * `PAYMENT_RECEIVED` (Pagamento recebido em dinheiro/PIX)
     * `PAYMENT_CONFIRMED` (Pagamento confirmado)
     * `PAYMENT_OVERDUE` (Cobrança vencida sem pagamento)
   * A URL do Webhook será configurada assim que o deploy de produção ou túnel estiver ativo: `https://seu-dominio.com.br/api/webhooks/asaas`.

---

### Etapa 3: Implementação Técnica no Código do E-Commerce
*Objetivo: Integrar a geração do PIX e a recepção do Webhook no Next.js.*

#### 3.1. Variáveis de Ambiente (`.env`)
Adicionar as credenciais ao arquivo de configuração:
```env
ASAAS_API_KEY="$aact_prod_..."
ASAAS_API_URL="https://api.asaas.com/v3"
ASAAS_WEBHOOK_TOKEN="seu_token_secreto_definido_no_painel"
```

#### 3.2. Serviço de Integração (`lib/services/asaas.service.ts`)
Criar o serviço responsável pelas chamadas HTTP ao Asaas:
* `getOrCreateCustomer(customerData)`: Verifica se o cliente já existe no Asaas por CPF/E-mail; se não existir, cria o cadastro via `POST /v3/customers`.
* `createPixPayment(orderData)`: Cria a cobrança no Asaas via `POST /v3/payments` com `billingType: 'PIX'`, valor total, vencimento (ex: 30 a 60 minutos) e referência externa com o ID do pedido local.
* `getPixQrCode(paymentId)`: Consulta `GET /v3/payments/{id}/pixQrCode` para obter o `encodedImage` (imagem base64 do QR Code) e o `payload` (código Copia-e-Cola).

#### 3.3. Adaptação do Fluxo de Checkout (`lib/services/checkout.service.ts` e UI)
* Ao clicar em "Finalizar Pedido" escolhendo PIX:
  1. O sistema cria o pedido local com status inicial `PENDING` e método `ASAAS_PIX`.
  2. Aciona o `asaasService.createPixPayment()` recebendo o QR Code e o código copia e cola.
  3. A tela do cliente exibe o modal elegante de pagamento:
     * Imagem do QR Code para leitura rápida com o app do banco.
     * Botão com 1 clique: *"Copiar Código PIX"*.
     * Instruções claras de pagamento e tempo de expiração.
     * Indicador visual de aguardando confirmação (*polling* leve na rota de status do pedido).

#### 3.4. Rota do Webhook de Confirmação (`app/api/webhooks/asaas/route.ts`)
* Rota dedicada para escutar notificações do Asaas:
  1. **Validação de Segurança**: Compara o header `asaas-access-token` recebido na requisição com o `ASAAS_WEBHOOK_TOKEN` configurado no `.env`. Se for inválido, rejeita com HTTP 401.
  2. **Idempotência**: Verifica se o pedido já está como `PAID` para evitar processamento duplicado.
  3. **Atualização Atômica**: Ao receber `PAYMENT_RECEIVED`:
     * Altera o status do pedido para `PAID`.
     * Registra o ID da transação do Asaas no pedido.
  4. **Despacho Imediato para Nuvemshop**:
     * Chama `orderSyncService.dispatchOrderToNuvemshopAsync(order.id)` para dar baixa instantânea no estoque da loja física / SMB Store.

---

### Etapa 4: Homologação e Testes Controlados
*Objetivo: Validar o circuito completo ponta a ponta antes de liberar para o público geral.*

1. **Teste de Geração de PIX**:
   * Criar um pedido de teste no e-commerce e verificar se o QR Code e o Copia-e-Cola são gerados perfeitamente na tela.
2. **Teste de Pagamento Real (R$ 1,00)**:
   * Realizar um pagamento real de R$ 1,00 via app do banco pelo celular.
   * Verificar se o Webhook recebe o evento em menos de 5 segundos.
   * Checar no banco de dados se o status do pedido mudou automaticamente de `PENDING` para `PAID`.
   * Confirmar se o pedido foi criado na Nuvemshop e o estoque abatido.
3. **Teste de Repasse Bancário**:
   * Conferir no dia seguinte se o valor líquido (R$ 1,00 menos a taxa fixa do PIX) foi transferido automaticamente para a conta do Banco Itaú cadastrada.

---

## 3. Considerações Críticas para o Checkout

1. **Inclusão do Campo CPF/CNPJ no Checkout**:
   * O Banco Central e a API do Asaas exigem obrigatoriamente um CPF ou CNPJ válido do comprador para gerar o QR Code dinâmico do PIX.
   * Atualmente o formulário do carrinho coleta Nome, E-mail e WhatsApp. Precisaremos adicionar o campo de CPF no formulário de fechamento.

2. **Repasse ao Itaú sem Custo Abusivo**:
   * O Asaas permite programar repasse diário automático para o Itaú. É importante apenas confirmar na aba de tarifas se a conta possui transferências PIX/TED gratuitas ilimitadas para mesma titularidade (geralmente sim, conforme política padrão de contas PJ).
