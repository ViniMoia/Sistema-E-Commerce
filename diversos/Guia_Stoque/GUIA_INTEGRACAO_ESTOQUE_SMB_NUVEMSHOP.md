# Guia Arquitetural de Integração: E-Commerce & Estoque SMB Store (via Nuvemshop Bridge)

Este documento descreve a arquitetura, viabilidade, fluxos de dados, consumo de API e plano de implementação para sincronizar o estoque do **E-Commerce Próprio** com o sistema **SMB Store Online** utilizado na loja física de estética automotiva.

---

## 1. Contexto e Motivação

O sistema **SMB Store Online** é o ERP/PDV utilizado na loja física para controle de estoque, frente de caixa e faturamento. Como a SMB Store não disponibiliza API pública aberta diretamente para e-commerces proprietários, a solução arquitetural adotada é a utilização da **Nuvemshop como Ponte de Integração (*Bridge / Middleware*)**.

### Visão Geral da Arquitetura

```
┌────────────────────────────────────────────────────────┐
│                    SMB STORE ONLINE                    │
│            (Estoque Real da Loja Física)               │
└───────────────────────────▲────────────────────────────┘
                            │
              Sincronização │ App Oficial SMB Store
                     Nativa │ (Nuvemshop App Store)
                            ▼
┌────────────────────────────────────────────────────────┐
│                    CONTA NUVEMSHOP                     │
│               (Hub de Dados / API Gateway)             │
└───────────────────────────▲────────────────────────────┘
                            │
               API REST /   │ Webhooks
               Webhooks     │ HTTPS
                            ▼
┌────────────────────────────────────────────────────────┐
│                   SEU E-COMMERCE                       │
│        (Next.js / PostgreSQL / Prisma / Supabase)      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Checklist de Ações para o Cliente

O cliente (dono da loja) precisa realizar os seguintes passos iniciais:

1. **Criar Conta na Nuvemshop:**
   - Criar uma conta (plano de entrada/básico é suficiente).
   - A vitrine pública da Nuvemshop pode ser colocada em modo restrito/manutenção com senha caso o cliente não queira receber visitas diretamente por ela.
2. **Instalar o Aplicativo SMB Store na Nuvemshop:**
   - Acessar o painel da Nuvemshop > **Loja de Aplicativos** > Buscar por **SMB Store** > **Instalar**. 
   - Fazer o login e vincular à conta do SMB Store Online.
   - Aguardar a sincronização inicial de produtos e estoques do SMB Store para a Nuvemshop.
3. **Fornecer Acesso / Credenciais de Desenvolvedor:**
   - Fornecer o `STORE_ID` da conta Nuvemshop.
   - Fornecer o `ACCESS_TOKEN` da API Nuvemshop (gerado via Portal de Parceiros Nuvemshop ou App Privado).

---

## 3. Especificação Técnica da API Nuvemshop

### A. Configurações de Conexão e Headers

* **Base URL:** `https://api.nuvemshop.com.br/v1/{STORE_ID}`
* **Headers Obrigatórios:**
  ```http
  Authentication: bearer {ACCESS_TOKEN}
  User-Agent: NomeDoSeuEcommerce (contato@seusite.com.br)
  Content-Type: application/json
  ```
  > **Atenção:** A Nuvemshop bloqueia requisições sem o cabeçalho `User-Agent` formatado com nome da aplicação e e-mail de contato válido.

---

### B. Fluxo 1: Leitura e Sincronização de Estoque (SMB -> Nuvemshop -> E-Commerce)

#### 1. Tempo Real via Webhook (Recomendado)
Cadastrar o endpoint de webhook no painel de parceiros ou via API da Nuvemshop para o evento `product/updated`.

* **Payload recebido pelo seu e-commerce:**
  ```json
  {
    "store_id": 1234567,
    "event": "product/updated",
    "id": 98765432
  }
  ```
* **Processamento no Backend:**
  1. O e-commerce recebe o evento.
  2. Executa `GET https://api.nuvemshop.com.br/v1/{STORE_ID}/products/{id}`.
  3. Atualiza o `stockQuantity` no banco de dados local para o SKU correspondente.

#### 2. Rotina Periódica de Segurança (Cron Job de Fallback)
* Executada a cada 10 ou 15 minutos para cobrir eventuais falhas de rede em webhooks.
* **Endpoint:** `GET https://api.nuvemshop.com.br/v1/{STORE_ID}/products?fields=id,variants`
* **Exemplo de Resposta:**
  ```json
  [
    {
      "id": 98765432,
      "name": { "pt": "Cera Carnaúba Vonixx Native 500ml" },
      "variants": [
        {
          "id": 11223344,
          "sku": "VON-NAT-500",
          "stock": 14,
          "price": "129.90"
        }
      ]
    }
  ]
  ```

---

### C. Fluxo 2: Baixa de Estoque por Compra (E-Commerce -> Nuvemshop -> SMB)

Quando um pedido é concluído e o pagamento é aprovado no seu e-commerce:

1. O e-commerce grava a compra no banco local e reduz o estoque local imediatamente.
2. O backend dispara uma requisição de criação de pedido para a Nuvemshop:
   * **Endpoint:** `POST https://api.nuvemshop.com.br/v1/{STORE_ID}/orders`
   * **Payload:**
     ```json
     {
       "products": [
         {
           "variant_id": 11223344,
           "quantity": 2,
           "price": 129.90
         }
       ],
       "customer": {
         "name": "Carlos Silva",
         "email": "carlos@email.com",
         "phone": "81999998888"
       },
       "billing_address": {
         "first_name": "Carlos",
         "last_name": "Silva",
         "address": "Rua das Oficinas, 100",
         "city": "Recife",
         "state": "PE",
         "zipcode": "50000000",
         "country": "BR"
       },
       "payment_status": "paid",
       "status": "open",
       "note": "Pedido originado do E-commerce Próprio - Ref: #1052"
     }
     ```
3. A Nuvemshop registra o pedido e decrementa o saldo da variante.
4. O aplicativo SMB Store na Nuvemshop lê o pedido e dá baixa no estoque do ERP físico da loja.

---

## 4. Mapeamento de Implementação no Projeto E-Commerce

Quando a etapa de codificação for iniciada, os seguintes módulos serão necessários:

| Componente | Localização Sugerida | Responsabilidade |
| :--- | :--- | :--- |
| **Modelagem de Dados** | `prisma/schema.prisma` | Adicionar campos `nuvemshopProductId`, `nuvemshopVariantId`, `sku` e `syncStatus`. |
| **Cliente de API** | `lib/nuvemshop.ts` | Funções de integração HTTP (`getProducts`, `getProductById`, `createOrder`). |
| **Webhook Handler** | `app/api/webhooks/nuvemshop/route.ts` | Rota para receber notificações de alteração de estoque em tempo real. |
| **Despacho de Pedido** | `lib/orders/dispatchOrderToERP.ts` | Rotina assíncrona executada após confirmação do pagamento. |
| **Fila de Retentativa** | Background Worker / Cron | Garantir que pedidos não sincronizados sejam reenviados em caso de instabilidade. |

---

## 5. Boas Práticas e Regras de Concorrência

1. **Unicidade de SKU:** Todo produto cadastrado no SMB Store deve possuir um SKU idêntico no e-commerce para correspondência automática.
2. **Estoque de Segurança (*Buffer*):** Para itens com 1 unidade no estoque físico, pode-se configurar regra de alerta ou reserva temporária no checkout para evitar venda simultânea no balcão e no site.
3. **Resiliência:** O e-commerce nunca deve depender de chamadas síncronas para a Nuvemshop durante o carregamento de páginas da vitrine; o estoque deve ser sempre lido do banco local (atualizado via Webhook/Cron).
