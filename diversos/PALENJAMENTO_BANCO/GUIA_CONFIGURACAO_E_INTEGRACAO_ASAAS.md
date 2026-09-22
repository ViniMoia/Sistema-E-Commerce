# Guia de Configuração e Integração: Gateway de Pagamento Asaas
**E-Commerce Continental Produtos Estéticos Automotivos**  
*Objetivo: Configuração da conta no Asaas, obtenção de credenciais, integração de PIX Dinâmico com Webhook e repasse automático para o Banco Itaú.*

---

## 📱 PARTE 1: Configuração da Conta no Aplicativo Asaas (No Celular)

### 1. Cadastro Inicial e Tipo de Conta
* Abra o aplicativo do Asaas no celular e selecione a opção de novo cadastro.
* **Recomendação**:
  * Se a **Distribuidora Continental** possuir CNPJ, escolha **Conta Pessoa Jurídica (PJ)**. Isso garante limites maiores de movimentação, emissão do PIX com o nome oficial da empresa e vinculação bancária direta com o Itaú PJ.
  * Se ainda não possuir CNPJ ativo, cadastre como **Pessoa Física** utilizando o CPF do responsável legal.
* Preencha os dados: Razão Social / Nome Completo, E-mail oficial da empresa, Telefone e defina uma senha segura.

### 2. Envio de Documentação (Validação Cadastral)
* Logo no primeiro acesso, o aplicativo solicitará o envio de fotos dos documentos para aprovação de recebimentos:
  * Foto nítida da CNH ou RG do titular.
  * Foto do Contrato Social / Cartão CNPJ (em caso de conta PJ).
  * Biometria facial (selfie) solicitada pelo app.
* *Prazo*: O Asaas costuma aprovar a documentação cadastral em poucas horas úteis.

### 3. Ativação da Chave PIX
* No menu inferior ou lateral do app, acesse a opção **PIX**.
* Toque em **Cadastrar Chave PIX** (pode ser o CNPJ, e-mail oficial ou chave aleatória).
* Esta chave será utilizada pela API para emissão dos QR Codes dinâmicos em cada venda realizada na loja virtual.

### 4. Cadastro da Conta Bancária do Banco Itaú
* No menu do aplicativo, acesse **Transferências** (ou *Contas Bancárias*).
* Toque em **Adicionar Nova Conta Bancária**:
  * **Banco**: Selecione `341 - Banco Itaú S.A.`
  * **Tipo de Conta**: Corrente (ou Poupança).
  * **Agência**: 4 dígitos da agência Itaú (sem o dígito).
  * **Número da Conta**: Número completo com o dígito verificador.
  * *Importante*: A conta do Banco Itaú deve obrigatoriamente possuir a **mesma titularidade** (mesmo CNPJ ou mesmo CPF registrado na conta Asaas).

### 5. Ativação do Repasse Automático Diário para o Itaú
* Na seção de transferências bancárias, localize a opção **"Transferência Automática"** (ou *Repasse Automático*).
* Ative essa funcionalidade e defina a frequência: **Diária**.
* Com isso, ao final de cada dia útil, todo o saldo recebido via PIX será transferido automaticamente para sua conta corrente do Itaú, sem necessidade de solicitações manuais de saque.

---

## 🔑 PARTE 2: Obtenção das Credenciais de API (No Computador / Navegador)

Para conectar o e-commerce ao Asaas, são necessárias duas informações disponíveis no painel web ([asaas.com](https://www.asaas.com)):

### 1. Geração da Chave de API (`API_KEY`)
1. Pelo computador, acesse sua conta no Asaas via navegador.
2. Clique no ícone de perfil no topo direito ➔ **Configurações da Conta**.
3. Acesse a aba **Integrações**.
4. Clique no botão **"Gerar Chave de API"**.
5. O Asaas gerará uma chave única iniciando com `$aact_...`. Copie e guarde em local protegido.

### 2. Configuração do Webhook de Cobranças
1. Na mesma aba **Integrações**, role até a seção **Webhooks de Cobranças**.
2. No campo **Token de Autenticação**, defina uma senha/token secreta de segurança (ex: `continental_webhook_seguro_2026`).
3. Marque os eventos que o sistema deve escutar:
   * `PAYMENT_RECEIVED` (Pagamento recebido)
   * `PAYMENT_CONFIRMED` (Pagamento confirmado)
   * `PAYMENT_OVERDUE` (Cobrança expirada sem pagamento)
4. A **URL do Webhook** será preenchida assim que o domínio ou deploy de produção estiver no ar:
   `https://seu-dominio.com.br/api/webhooks/asaas`

---

## 💻 PARTE 3: Estrutura Técnica de Implementação no Sistema

Quando você autorizar o início da implementação no código, realizaremos as seguintes alterações no projeto:

### 1. Inclusão do Campo CPF/CNPJ no Checkout
* A regulamentação do Banco Central para PIX Dinâmico exige CPF ou CNPJ válido do comprador para registrar a cobrança.
* Atualizaremos os arquivos `lib/validators/checkout.validators.ts` e `components/checkout/CheckoutForm.tsx` para solicitar o documento com validação de formato.

### 2. Criação do Serviço Asaas (`lib/services/asaas.service.ts`)
* Implementação dos métodos de integração:
  * `createCustomerIfNotExists`: Cadastra o comprador no Asaas.
  * `createPixPayment`: Envia o valor e os dados do pedido para a API `/v3/payments`.
  * `getPixQrCode`: Recupera a imagem em base64 do QR Code e a linha digitável Copia-e-Cola (`payload`).

### 3. Rota de Webhook em Tempo Real (`app/api/webhooks/asaas/route.ts`)
* Endpoint seguro para receber a notificação do Asaas:
  * Validação do header `asaas-access-token` contra invasões ou disparos falsos.
  * Atualização atômica do status do pedido de `PENDING` para `PAID` no banco Supabase.
  * Disparo automático para o serviço de pedidos da Nuvemshop (`orderSyncService.dispatchOrderToNuvemshopAsync`) para baixar o estoque físico do SMB Store.

### 4. Interface do Checkout com Modal de Pagamento
* Exibição na tela de confirmação de:
  * QR Code dinâmico para leitura direta pelo app do banco.
  * Botão de 1 clique: *"Copiar Código PIX"*.
  * Contador regressivo de tempo de validade do PIX.
  * Verificação automática em segundo plano: assim que o pagamento for concluído, a tela atualiza para "Pagamento Aprovado!".

---

## 🧪 PARTE 4: Homologação e Teste Real de R$ 1,00

Antes de liberar para os clientes finais:
1. Faremos um pedido de teste de **R$ 1,00** na loja virtual.
2. Faremos a leitura do QR Code e o pagamento pelo celular.
3. Confirmaremos se:
   * O status do pedido mudou para `PAID` em poucos segundos.
   * O estoque foi abatido na Nuvemshop/SMB Store.
   * O valor líquido (R$ 1,00 subtraído da taxa fixa do Asaas) caiu na conta do Banco Itaú no dia seguinte.
