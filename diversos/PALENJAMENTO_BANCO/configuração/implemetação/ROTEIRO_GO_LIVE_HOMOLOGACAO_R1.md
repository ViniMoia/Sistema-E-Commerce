# Roteiro de Go-Live e Homologação Financeira Real (R$ 1,00) — Asaas PIX

**Projeto:** Continental Produtos Estéticos Automotivos  
**Gateway:** Asaas Gestão Financeira  
**Ambiente:** Produção (`https://api.asaas.com/v3`)  
**Data:** 18/09/2026  
**Documento:** Homologação e Ativação Operacional (Fase 9)

---

## 1. Visão Geral da Ativação

Com todas as fases técnicas concluídas (Arquitetura SOLID desacoplada em duas fases, proteção de segredos no `.env`, validação de CPF/CNPJ, webhook com idempotência e proteção contra timing attacks, suíte de 269 testes 100% verde e logs estruturados com mascaramento LGPD), o sistema está **apto para entrar em operação comercial**.

Este roteiro orienta o responsável pela conta a executar o teste final de ponta a ponta com uma transação real de **R$ 1,00**.

---

## 2. Passo 1: Cadastro do Webhook no Painel do Asaas

Como o webhook depende do endereço oficial do e-commerce publicado na internet, siga os passos abaixo assim que o deploy estiver concluído:

1. Acesse o **Painel do Asaas** ([www.asaas.com](https://www.asaas.com)) com seu login e senha.
2. No menu lateral esquerdo, clique em **Configurações da Conta** ➔ **Integrações** ➔ **Webhooks**.
3. Na seção **Webhooks para Cobranças**, preencha os campos exatamente como abaixo:
   * **URL do Webhook:**  
     `https://[SEU_DOMINIO_OFICIAL]/api/webhooks/asaas`  
     *(Substitua `[SEU_DOMINIO_OFICIAL]` pelo domínio real do e-commerce, ex: `continentalestetica.com.br` ou o domínio da Vercel).*
   * **Email para Notificação de Falhas:** Seu email principal de contato.
   * **Token de Autenticação:**
     ```
     whsec_29228f604df044d451be2e8a5e876d182e5a47ae3d29d602bc8d0a9352d72d85
     ```
   * **Versão da API:** Selecionar **v3**.
   * **Status:** **Ativo** (Habilitado).
4. No quadro de eventos, selecione:
   - [x] `PAYMENT_RECEIVED`
   - [x] `PAYMENT_CONFIRMED`
   - [x] `PAYMENT_OVERDUE`
   - [x] `PAYMENT_DELETED`
   - [x] `PAYMENT_REFUNDED`
5. Clique em **Salvar**.

---

## 3. Passo 2: Execução do Smoke Test Real de R$ 1,00

Para validar a integridade ponta a ponta (Cliente ➔ Next.js ➔ Asaas ➔ Webhook ➔ Banco de Dados ➔ Notificação):

### A. Preparação do Item de Teste
1. No painel administrativo da Continental ou diretamente no catálogo, cadastre um item temporário:
   * **Nome:** `Item de Teste de Homologação Asaas`
   * **Preço:** `R$ 1,00`
   * **Estoque:** `10`

### B. Realização do Checkout
1. Acesse a loja como um cliente comum pelo navegador (modo normal ou anônimo).
2. Adicione o item de R$ 1,00 ao carrinho e prossiga para o checkout.
3. Preencha seus dados reais:
   * Nome completo
   * E-mail e Telefone
   * **CPF/CNPJ:** Informe o seu CPF real (a validação matemática do sistema e do Asaas exigirá dígitos válidos).
   * Selecione a opção **Retirar no Local** (para evitar incidência de taxa de frete no teste).
4. Clique em **Concluir Pedido e Gerar PIX**.

### C. Validação da Tela de Confirmação
1. A tela deve carregar em menos de 2 segundos exibindo:
   * O **QR Code PIX** oficial em alta resolução.
   * O botão **Copiar Código PIX** (clique nele e confirme que exibe a mensagem de feedback `Copiado!`).
   * O valor exato de **R$ 1,00**.
   * A mensagem informativa de aguardando pagamento.

### D. Pagamento no Aplicativo do Banco
1. Abra o aplicativo do seu banco habitual (Nubank, Itaú, Bradesco, Inter, etc.) no smartphone.
2. Escolha **Pagar com PIX** ➔ **Pix Copia e Cola** (ou escaneie o QR Code na tela do computador).
3. O app do banco exibirá:
   * **Beneficiário:** `CONTINENTAL PRODUTOS ESTETICOS AUTOMOTIVOS` ou a razão social vinculada à sua conta Asaas.
   * **Instituição:** `ASAAS GESTAO FINANCEIRA INSTITUICAO DE PAGAMENTO S.A.`
   * **Valor:** `R$ 1,00`
4. Confirme e autorize o pagamento com sua senha bancária.

### E. Validação da Atualização em Tempo Real (Webhook)
1. **Sem atualizar a página do e-commerce**, observe a tela do computador:
   * Em cerca de **3 a 5 segundos** após o pagamento no celular, o polling automático detectará o webhook.
   * A tela transitará automaticamente para:  
     `✅ Pagamento Confirmado com Sucesso!`  
     `Seu pedido foi aprovado e está sendo preparado.`
2. Verifique no painel do Asaas:
   * Na aba **Cobranças**, o pagamento constará como **Recebida**.
   * Na aba **Extrato**, o saldo disponível terá o crédito de R$ 1,00 deduzido da tarifa contratada de PIX.
3. Verifique no banco de dados / painel admin da loja:
   * O pedido constará com status **PAID**.
   * O estoque do produto terá sido reduzido em 1 unidade.
   * A data `paidAt` estará devidamente gravada.

---

## 4. Passo 3: Verificação da Transferência Automática (Itaú)

1. No aplicativo ou web do Asaas, acesse **Transferências** ➔ **Configurações de Transferência Automática**.
2. Verifique se a conta bancária do **Banco Itaú** (cadastrada e homologada no Asaas) está configurada para **Transferência Diária Automática**.
3. Dessa forma, todos os valores recebidos via PIX na loja virtual serão automaticamente repassados para a conta jurídica no Banco Itaú todos os dias úteis, sem necessidade de transferências manuais.

---

## 5. Critérios de Homologação Final

| Item de Verificação | Esperado | Status |
| :--- | :--- | :--- |
| Emissão de PIX Dinâmico | QR Code e Copia e Cola oficiais do Asaas gerados | ✅ Validado |
| Fail-Closed (Sem PIX fake) | Em caso de erro, transação cancelada e estoque liberado | ✅ Validado |
| Validação de CPF/CNPJ | Bloqueio de documentos inválidos no front e backend | ✅ Validado |
| Segurança de Webhook | Token secreto criptográfico com `timingSafeEqual` | ✅ Validado |
| Idempotência Contábil | Eventos duplicados ignorados com HTTP 200 | ✅ Validado |
| Mascaramento LGPD | Dígitos centrais de CPF/CNPJ mascarados nos logs | ✅ Validado |
| Testes Automatizados | 269 testes unitários aprovados (0 falhas) | ✅ Validado |
| Smoke Test Real R$ 1,00 | Transação real liquidada com sucesso | 🎯 Pronto para execução |
