# Procedimento Operacional de Go-Live e Ativação em Produção

Este documento fornece o checklist passo a passo para a ativação final da integração em produção assim que você receber as credenciais oficiais da **Nuvemshop** com o **SMB Store Online**.

---

## 1. Checklist Pré-Ativação (Reunião Presencial com o Cliente)

- [ ] Conta da Nuvemshop criada no CNPJ da estética automotiva.
- [ ] Aplicativo oficial do **SMB Store** instalado na Nuvemshop e vinculado ao SMB Store Online.
- [ ] Vitrine pública da Nuvemshop colocada em modo "Em Manutenção" (com senha) para evitar acessos externos.
- [ ] Acesso de Desenvolvedor / App Privado configurado no Portal de Parceiros Nuvemshop para gerar o `ACCESS_TOKEN`.
- [ ] Anotar os 3 dados essenciais:
  1. `STORE_ID` (ID numérico da loja).
  2. `ACCESS_TOKEN` (Token de autenticação da API).
  3. `WEBHOOK_SECRET` (Segredo para validação de assinaturas HMAC).

---

## 2. Passo a Passo de Ativação no E-Commerce

### Passo 1: Inserir as Chaves no `.env` de Produção
No servidor ou arquivo `.env` do projeto, preencha as variáveis de ambiente:

```env
# Nuvemshop / SMB Store Integration
NUVEMSHOP_STORE_ID="1234567"
NUVEMSHOP_ACCESS_TOKEN="seu_token_de_producao_aqui"
NUVEMSHOP_USER_AGENT="EcommerceEsteticaAutomotiva (seu-email@dominio.com)"
NUVEMSHOP_WEBHOOK_SECRET="seu_webhook_secret_aqui"
NUVEMSHOP_MOCK_MODE="false"
```

---

### Passo 2: Executar a Sincronização Inicial do Catálogo
1. Faça login como Administrador no seu e-commerce.
2. Acesse o menu lateral: **Painel Admin > Integração ERP** (`/admin/integration`).
3. Verifique se o card de status exibe: **🟢 Conexão Ativa (Live)**.
4. Clique no botão: **"Sincronizar Estoque Agora"**.
5. O sistema fará a varredura de todos os produtos do SMB Store via Nuvemshop e atualizará os saldos e IDs no seu banco PostgreSQL.

---

### Passo 3: Cadastrar a URL de Webhook na Nuvemshop
No painel de desenvolvedor da Nuvemshop (ou via API), registre a URL de webhook do seu site:

* **URL de Destino:** `https://seusite.com.br/api/webhooks/nuvemshop`
* **Eventos para Escutar:**
  * `product/updated` (Atualização de estoque/produto)
  * `product/created` (Novo produto cadastrado no SMB)
  * `inventory/updated` (Alteração de estoque no balcão)

---

### Passo 4: Teste Prático de Ponta a Ponta (Homologação Real)
1. **Teste de Entrada (Loja Física ➔ Site):**
   * Altere manualmente o estoque de 1 produto de teste no SMB Store.
   * Em menos de 3 a 5 segundos, acerte o F5 na página do produto no seu e-commerce e confirme se o novo estoque já está refletido.
   * Abra o Painel Admin > Integração ERP e verifique a nova linha no histórico de auditoria.
2. **Teste de Saída (Site ➔ Loja Física):**
   * Faça uma compra de teste no seu e-commerce via PIX.
   * Acesse o painel do SMB Store e confirme se o pedido apareceu na lista de vendas e deu a baixa de 1 unidade no estoque físico da loja.
