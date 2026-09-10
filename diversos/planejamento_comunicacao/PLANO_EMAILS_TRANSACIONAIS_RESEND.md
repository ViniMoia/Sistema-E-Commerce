# Plano de Implementação: E-mails Transacionais Automáticos (Resend)
**E-Commerce Continental Produtos Estéticos Automotivos**  
*Etapa: 2.1. Notificações Transacionais e Pós-Venda*  
*Serviço de Envio: Resend (API REST)*

---

## 1. Visão Geral da Arquitetura de Notificações

Utilizaremos o **Resend** ([resend.com](https://resend.com)), a plataforma mais moderna e com melhor entregabilidade para Next.js no mercado, com templates HTML responsivos no padrão estético da marca Continental (dourado `#dbb501`, preto profundo `#050505` e cinza chumbo):

```
[ Ação no Sistema ]
         │
         ├──► [ Cliente finaliza Checkout ] ────► [ Envia E-mail: Pedido Recebido + Resumo + Frete J&T ]
         │
         ├──► [ Pagamento PIX Aprovado ]   ────► [ Envia E-mail: Pagamento Confirmado + Preparando Envio ]
         │
         └──► [ Pedido Despachado ]        ────► [ Envia E-mail: Código de Rastreio J&T Express ]
```

---

## 2. Templates de E-mail Previstos

### 2.1. Template: Pedido Recebido (`order-created`)
* **Destinatário**: E-mail do cliente informado no checkout.
* **Assunto**: `Pedido #1234 recebido com sucesso! - Continental Estética Automotiva`
* **Conteúdo**:
  * Logotipo e cabeçalho com saudação personalizada.
  * Tabela com produtos adquiridos, quantidades, fotos em miniatura e preços unitários.
  * Detalhamento financeiro: Subtotal + Frete da **J&T Express** (ou Retirada no Galpão) = Total.
  * Endereço completo de entrega.
  * Chave PIX e instruções para pagamento caso o cliente precise consultar após sair da tela.

### 2.2. Template: Pagamento Confirmado (`payment-confirmed`)
* **Assunto**: `Pagamento aprovado para o Pedido #1234! - Continental`
* **Conteúdo**:
  * Confirmação de recebimento do valor.
  * Prazo estimado de entrega (dias úteis calculados pela J&T Express).
  * Informação de que os produtos estão em processo de separação e conferência no galpão em Ananindeua/PA.

### 2.3. Template: Pedido Despachado (`order-shipped`)
* **Assunto**: `Seu pedido #1234 foi enviado! Rastreie com a J&T Express`
* **Conteúdo**:
  * Transportadora: **J&T Express**.
  * Código de rastreamento com link direto para consulta no site da J&T Express.
  * Previsão de chegada no endereço de entrega.

---

## 3. Resiliência e Modo de Desenvolvimento

* O serviço de e-mail verificará a presença da variável `RESEND_API_KEY` no `.env`. 
* Se a chave ainda não estiver configurada, o sistema **não quebrará nem travará o checkout**: ele registrará um log detalhado no console com o preview do e-mail simulado. Assim que a chave for adicionada, o envio real passará a ocorrer automaticamente.

---

## 4. Estrutura de Arquivos

* `lib/services/email.service.ts`: Serviço centralizado de e-mails transacionais.
* `lib/templates/email-templates.ts`: Geradores de templates HTML embutidos com CSS inline (compatível com Gmail, Outlook e Apple Mail).
* `lib/services/checkout.service.ts`: Disparo assíncrono do e-mail de confirmação de pedido.
* `scratch/test_send_email.ts`: Script de teste para validação de envio.
