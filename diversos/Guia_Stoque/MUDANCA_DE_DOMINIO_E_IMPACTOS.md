# Mudança Futura de Domínio: Impactos na Integração Nuvemshop / SMB Store

Este documento esclarece os impactos técnicos caso o domínio do seu e-commerce seja alterado no futuro e descreve os procedimentos necessários.

---

## 1. Resumo Executivo: Haverá Algum Problema?

**Não.** A mudança de domínio no futuro **não quebra a integração** e **não invalida o seu `ACCESS_TOKEN`**. 

O token de acesso gerado fica vinculado exclusivamente à loja do cliente e ao seu aplicativo no banco de dados da Nuvemshop, sendo completamente independente do endereço (URL ou domínio) onde o seu e-commerce está hospedado.

---

## 2. O que NÃO é Afetado (Fica 100% Preservado)

1. **O `ACCESS_TOKEN` Continua Válido:**
   * O token gerado via OAuth 2.0 não possui data de expiração e não está atrelado ao domínio de origem das requisições.
2. **A URL de Callback (Redirecionamento):**
   * A URL de callback (`Callback URL`) é utilizada **apenas uma única vez**, no momento da autorização inicial do aplicativo para entregar o código temporário. Uma vez que você já obteve o token final e o salvou no arquivo `.env`, essa URL nunca mais é acionada.
3. **Despacho de Pedidos (Seu Site ➔ Nuvemshop / SMB):**
   * O envio de pedidos pagos do seu e-commerce para a Nuvemshop/SMB continuará funcionando imediatamente, pois as requisições partem do seu servidor para a API oficial da Nuvemshop (`https://api.nuvemshop.com.br/v1/...`).

---

## 3. O Único Ajuste Necessário ao Mudar de Domínio

Quando o novo domínio estiver ativo, a única ação técnica necessária será **atualizar a URL de destino dos Webhooks**:

* **Por que isso é necessário?**  
  Sempre que houver uma alteração física de estoque no balcão (SMB Store), a Nuvemshop dispara uma notificação (Webhook) para avisar o seu site. Se o domínio mudar, a Nuvemshop precisará saber o novo endereço para onde enviar essas notificações.
* **Como atualizar:**  
  Basta cadastrar ou atualizar o Webhook na Nuvemshop para apontar para o novo endereço:
  ```text
  https://sitenovo.com.br/api/webhooks/nuvemshop
  ```

---

## 4. Conclusão

Pode registrar o aplicativo e gerar as credenciais com tranquilidade utilizando qualquer URL temporária ou o domínio atual. A arquitetura implementada é desacoplada e suporta migrações de domínio sem retrabalho.
