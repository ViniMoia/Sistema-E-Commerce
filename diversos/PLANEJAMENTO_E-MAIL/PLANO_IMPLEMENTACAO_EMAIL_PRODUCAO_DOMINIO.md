# Plano de Implementação: Configuração de E-mails em Produção (Domínio Próprio)

> **Documento de Referência Operacional**  
> **Status:** Pronto para execução futura  
> **Objetivo:** Guia passo a passo para transição do ambiente de testes (`onboarding@resend.dev`) para o remetente oficial da loja com domínio personalizado (ex: `pedidos@sualoja.com.br`), garantindo 100% de entregabilidade e reputação anti-spam (SPF, DKIM e DMARC).

---

## 1. Visão Geral e Contexto

No estágio atual (testes e homologação), o sistema utiliza:
- **Provedor:** Resend API
- **Remetente de Sandbox:** `onboarding@resend.dev`
- **Limitação de Sandbox:** E-mails só chegam ao e-mail proprietário da conta Resend.

Para a **produção definitiva**, a loja necessita disparar e-mails para qualquer cliente (Gmail, Hotmail, Yahoo, etc.) sem que caiam na caixa de spam. Este documento detalha como habilitar o domínio próprio do cliente.

---

## 2. Decisão de Propriedade da Conta Resend

Antes de iniciar a configuração de DNS, defina o modelo de gestão da conta:

### Opção A: Conta no nome do Cliente (Recomendado para Produção)
1. O cliente cria uma conta no [Resend](https://resend.com) utilizando o e-mail oficial dele (ex: `asb7@live.com` ou o e-mail corporativo).
2. Ele convida você como membro (menu **Settings** ➔ **Team** ➔ **Invite Member** com papel de *Admin* ou *Developer*).
3. **Vantagem:** A fatura, propriedade jurídica e reputação do domínio ficam sob posse direta do cliente.

### Opção B: Conta Gerenciada pelo Desenvolvedor/Agência
1. O desenvolvedor mantém o domínio do cliente cadastrado em sua própria conta Resend.
2. **Vantagem:** Maior agilidade técnica na configuração sem necessidade de intervenção do cliente além da inserção dos registros DNS.

---

## 3. Passo a Passo Técnico de Configuração

### Etapa 1: Cadastrar o Domínio no Resend
1. Acesse o painel da conta Resend definitiva em: [https://resend.com/domains](https://resend.com/domains).
2. Clique no botão **"Add Domain"**.
3. Insira o domínio oficial da loja (Exemplo: `continentalmodels.com.br`).
4. Selecione a região do servidor de e-mails:
   - Escolha **`sa-east-1` (São Paulo, Brasil)** para menor latência no Brasil ou **`us-east-1` (North Virginia)** (padrão global).
5. Clique em **"Add"**.

---

### Etapa 2: Configurar Apontamentos DNS (Zona DNS)

O Resend exibirá uma tabela com os registros obrigatórios que devem ser cadastrados no painel onde o domínio foi registrado (ex: **Registro.br**, **Cloudflare**, **Hostinger**, **GoDaddy** ou cPanel).

#### 1. Registro DKIM (Assinatura Criptográfica Anti-Fraude)
* **Tipo:** `TXT`
* **Nome / Host:** `resend._domainkey` (ou `resend._domainkey.sualoja.com.br`, dependendo do painel)
* **Valor / Conteúdo:** *(Chave pública longa gerada pelo Resend)*
* **TTL:** Automático ou 3600

#### 2. Registro SPF / Return-Path (Autorização de Envio)
* **Tipo:** `MX`
* **Nome / Host:** `send` (ou `bounces.sualoja.com.br`, conforme indicado no painel)
* **Prioridade:** `10`
* **Valor / Destino:** `feedback-smtp.sa-east-1.amazonses.com` (ou valor indicado pelo Resend)

* **Tipo:** `TXT`
* **Nome / Host:** `send` (ou subdomínio de bounce)
* **Valor / Conteúdo:** `v=spf1 include:amazonses.com ~all` (conforme exibido na tela)

#### 3. Registro DMARC (Política de Proteção de Marca - Altamente Recomendado)
Se o domínio ainda não tiver um registro DMARC, crie:
* **Tipo:** `TXT`
* **Nome / Host:** `_dmarc`
* **Valor / Conteúdo:** `v=DMARC1; p=none; rua=mailto:dmarc-reports@sualoja.com.br`
  *(Nota: `p=none` é o modo de monitoramento inicial seguro que não bloqueia e-mails legítimos).*

---

### Etapa 3: Validação no Resend
1. Após salvar os registros no painel do domínio, aguarde a propagação de DNS (geralmente entre 5 minutos e 2 horas).
2. No painel do Resend, clique em **"Verify DNS Records"**.
3. O status do domínio passará para **`Verified` (Verde)**.

---

### Etapa 4: Gerar Nova API Key de Produção
1. Acesse **[Resend API Keys](https://resend.com/api-keys)**.
2. Clique em **"Create API Key"**.
3. Defina:
   - **Name:** `ecommerce-producao-oficial`
   - **Permission:** `Full Access` ou `Sending Access`
   - **Domain:** Selecione o domínio verificado (ex: `continentalmodels.com.br`).
4. Copie a chave gerada (`re_prod_...`).

---

### Etapa 5: Atualização das Variáveis de Ambiente (`.env`)

No servidor de produção (ou arquivo `.env` definitivo):

```env
# -----------------------------------------------------------------------------
# E-MAIL PRODUCTION CONFIGURATION (RESEND)
# -----------------------------------------------------------------------------
# Chave de produção gerada na conta do domínio verificado
RESEND_API_KEY=re_prod_XXXXXXXXXXXXXXXXXXXXXXXX

# Remetente com nome de exibição amigável e domínio corporativo
EMAIL_FROM="Continental Models <pedidos@continentalmodels.com.br>"

# (Opcional) E-mail para onde o cliente pode responder
EMAIL_REPLY_TO="atendimento@continentalmodels.com.br"
```

---

## 4. Checklist de Homologação e Testes (Go-Live)

Execute este checklist antes de liberar compras para clientes reais:

- [ ] **Teste para Gmail:** Realizar um pedido e verificar se chega na **Caixa de Entrada Principal** (sem alertas amarelos de "remetente não verificado").
- [ ] **Teste para Outlook/Hotmail:** Realizar um pedido e confirmar que o e-mail não caiu no "Lixo Eletrônico".
- [ ] **Validação de Links e Imagens:** Abrir o e-mail no celular e no desktop, verificando se o logotipo da loja e o link do pedido funcionam corretamente.
- [ ] **Checagem de Reputação (Opcional, mas recomendado):** Enviar um e-mail de teste para ferramentas como [Mail-Tester](https://www.mail-tester.com/) e verificar se a pontuação obtida é **9.5/10 ou 10/10**.

---

## 5. Troubleshooting (Resolução de Problemas Comuns)

| Sintoma / Erro | Causa Provável | Solução |
| :--- | :--- | :--- |
| **Erro `403 Domain not verified`** | O domínio ainda não propagou ou o remetente no `.env` está diferente do domínio cadastrado. | Conferir se o status no Resend está `Verified` e se o `@dominio.com.br` no `.env` é idêntico. |
| **E-mail caindo no Spam (Junk)** | Falta de registro DKIM ou DMARC no DNS do domínio. | Verificar se os registros `TXT` do DKIM foram criados sem aspas duplicadas no provedor DNS. |
| **Erro de Autenticação `401 Unauthorized`** | A chave `RESEND_API_KEY` foi digitada incorretamente ou excluída do painel. | Gerar uma nova API Key no Resend e atualizar o `.env`. |
| **Limite de Envios Atingido** | O plano gratuito do Resend permite 100 e-mails/dia e 3.000/mês. | Caso o volume de vendas diário supere 100 pedidos/dia, realizar o upgrade para o plano Pro ($20/mês) no painel do Resend. |
