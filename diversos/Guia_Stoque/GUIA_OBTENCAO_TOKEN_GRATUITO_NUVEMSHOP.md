# Guia Definitivo: Obtenção de ACCESS_TOKEN Gratuito na Nuvemshop (Sem Planos Escala/Next)

Este guia explica como contornar o paywall da Nuvemshop (que exige os planos "Escala" ou "Next" para gerar tokens manuais no painel da loja) e obter o **`ACCESS_TOKEN` oficial e definitivo de forma 100% gratuita** através do **Portal de Parceiros Nuvemshop (OAuth 2.0)**.

---

## 1. Por que isso acontece? (O "Pulo do Gato")

* **No Painel da Loja:** A Nuvemshop cobra pelos planos "Escala/Next" para permitir que o lojista crie "Aplicativos Privados" de forma simplificada em poucos cliques.
* **No Portal de Parceiros:** A Nuvemshop disponibiliza a API e os Webhooks **gratuitamente para qualquer plano (inclusive planos básicos ou gratuitos)** para desenvolvedores cadastrados como parceiros oficiais.
* **Resultado:** Você pode criar um app de desenvolvedor gratuito, instalar na loja do seu cliente com 1 clique e gerar o `ACCESS_TOKEN` definitivo sem pagar nenhuma mensalidade extra.

---

## 2. Passo a Passo: Gerando o Token Gratuito em 5 Minutos

### Passo 1: Criar sua Conta de Parceiro (Gratuita)
1. Acesse o portal de desenvolvedores da Nuvemshop:  
   👉 **[https://partners.nuvemshop.com.br](https://partners.nuvemshop.com.br)**
2. Cadastre-se com seu e-mail de desenvolvedor (ou faça login com sua conta existente).

---

### Passo 2: Criar o Aplicativo da Integração
1. No menu lateral do Portal de Parceiros, clique em **Aplicativos** > **Criar Aplicativo**.
2. Preencha os campos básicos:
   * **Nome do Aplicativo:** `Integracao E-commerce SMB`
   * **URL de Redirecionamento (Callback URL):**  
     Coloque a URL temporária ou do seu site para receber o código (ex: `https://httpbin.org/get` ou `https://seusite.com.br/api/auth/nuvemshop/callback`).
   * **Permissões (Scopes):** Selecione os seguintes acessos necessários:
     * `read_products` (Ler produtos e estoque)
     * `write_products` (Atualizar estoque)
     * `read_orders` (Ler pedidos)
     * `write_orders` (Criar/despachar pedidos)
3. Clique em **Salvar Aplicativo**.
4. Anote os dois dados gerados:
   * **`Client ID`** (Identificador do aplicativo)
   * **`Client Secret`** (Chave secreta do aplicativo)

---

### Passo 3: Autorizar o App na Loja do Cliente
1. Abra uma aba no navegador onde a **conta da Nuvemshop do seu cliente** esteja logada.
2. Acesse a seguinte URL no navegador (substituindo `{CLIENT_ID}` pelo seu Client ID real):
   ```text
   https://www.nuvemshop.com.br/apps/{CLIENT_ID}/authorize
   ```
3. A Nuvemshop exibirá uma tela: *"O aplicativo Integracao E-commerce SMB deseja acessar sua loja"*.
4. Clique em **"Aceitar e Instalar"**.
5. O navegador será redirecionado para a sua URL de callback com um parâmetro na barra de endereços:
   ```text
   https://httpbin.org/get?code=SEU_CODIGO_DE_AUTORIZACAO_AQUI
   ```
6. Copie o valor do **`code`** (ele é temporário e válido por alguns minutos).

---

### Passo 4: Trocar o `code` pelo `ACCESS_TOKEN` Definitivo
Abra o terminal (PowerShell ou Postman / Insomnia / cURL) e execute a requisição abaixo para trocar o `code` pelo token final:

#### No PowerShell:
```powershell
$body = @{
    client_id     = "SEU_CLIENT_ID"
    client_secret = "SEU_CLIENT_SECRET"
    grant_type    = "authorization_code"
    code          = "SEU_CODIGO_COPIADO"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://www.nuvemshop.com.br/apps/authorize/token" -Method POST -Body $body -ContentType "application/json"
```

#### Resposta Retornada pela Nuvemshop:
```json
{
  "access_token": "a1b2c3d4e5f6g7h8i9j0...",
  "token_type": "bearer",
  "scope": "read_products,write_products,read_orders,write_orders",
  "user_id": 1234567
}
```

---

## 3. Configurando no seu E-Commerce

Agora que você tem as credenciais reais e gratuitas, basta inseri-las no seu arquivo `.env`:

```env
# Nuvemshop / SMB Store Integration
NUVEMSHOP_STORE_ID="1234567"
NUVEMSHOP_ACCESS_TOKEN="a1b2c3d4e5f6g7h8i9j0..."
NUVEMSHOP_USER_AGENT="EcommerceEstetica (seu-email@dominio.com)"
NUVEMSHOP_WEBHOOK_SECRET="seu_client_secret_ou_webhook_secret"
NUVEMSHOP_MOCK_MODE="false"
```

---

## 4. Outras Alternativas Disponíveis

| Alternativa | Custo | Vantagem | Desvantagem |
| :--- | :---: | :--- | :--- |
| **1. Portal de Parceiros (Recomendado)** | **R$ 0,00** | Token definitivo, Webhooks em tempo real e despacho de pedidos. | Exige criar conta gratuita de parceiro. |
| **2. Feed JSON Público (`/products.json`)** | **R$ 0,00** | Leitura de estoque sem necessidade de tokens. | Apenas mão única (não despacha pedidos para o SMB). |
| **3. Agente Local no Banco do SMB Store (Desktop)** | **R$ 0,00** | Independência total da Nuvemshop. | Exige que o computador físico da loja esteja sempre ligado. |
