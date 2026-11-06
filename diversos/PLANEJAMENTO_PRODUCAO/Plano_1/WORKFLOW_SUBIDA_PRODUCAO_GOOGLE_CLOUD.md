# Workflow de Implantação em Produção — Google Cloud (Cloud Run)

> **Documento:** Plano Mestre e Guia Operacional de Subida para Produção  
> **Destino:** Google Cloud Platform (Cloud Run + Secret Manager + Cloud Scheduler)  
> **Operadores:** Vinícius (Desenvolvimento, Testes e Governança) / Vanderlei (Operação de Infraestrutura e Deploy GCP)  
> **Status:** Planejamento Aprovado para Execução  
> **Localização:** `diversos/PLANEJAMENTO_PRODUCAO/Plano_1/WORKFLOW_SUBIDA_PRODUCAO_GOOGLE_CLOUD.md`  
> **Data:** Novembro de 2026  

---

## 1. Visão Geral e Filosofia de Operação

Este workflow estabelece o passo a passo seguro para publicar o e-commerce no ambiente de **Produção Oficial no Google Cloud (Cloud Run)**, aproveitando a versão mais recente do código cuja integração de pagamento com **dinheiro real na conta oficial do Asaas** foi 100% validada (cobrança Pix real, conciliação de status `PAID`, baixa física no Neon, exportação para Nuvemshop/SMB Store e tratamento das travas de estorno e saldo).

### Princípios da Subida:
1. **MVP Operacional Funcional:** Subiremos uma versão estável e segura para dar início imediato às operações de venda da loja.
2. **Continuidade de Desenvolvimento Ativo:** A plataforma continuará recebendo novas implementações e refinamentos enquanto atende clientes reais, exigindo um pipeline de deploys contínuos sem downtime (*Zero Downtime Rolling Updates*).
3. **Pré-requisitos Mandatórios de Negócio:** Antes do build final de produção, serão implementadas nesta máquina as duas especificações já aprovadas:
   - **Proteção Financeira de Frete e WhatsApp Fallback** (`PLANO_PROTECAO_FRETE_E_MEDIDAS_WHATSAPP.md`)
   - **Interface Otimista e Sync Gate no Carrinho** (`ARQUITETURA_OPTIMISTIC_UI_E_SYNC_GATE_CARRINHO.md`)

---

## 2. Divisão de Responsabilidades e Protocolo de Handoff (Vinícius vs. Vanderlei)

A subida será executada em **duas máquinas diferentes por operadores com papéis estritamente separados**. Para evitar qualquer desvio arquitetural, improviso ou "ideia errada" de última hora, os limites operacionais são inegociáveis:

```mermaid
flowchart TD
    subgraph MaquinaVinicius["Máquina do Vinícius (Desenvolvimento e Governança)"]
        DevFrete["1. Implementa Proteção de Frete WhatsApp"]
        DevCart["2. Implementa Carrinho Otimista + Sync Gate"]
        UnitTests["3. Roda 100% dos Testes Unitários (>1.000 asserções)"]
        GitCommit["4. Commit e Push da Versão Oficial Blindada"]
        TagRelease["5. Cria a Tag Oficial: prod-candidate-v1.0.0"]
        DevFrete --> DevCart --> UnitTests --> GitCommit --> TagRelease
    end

    subgraph Handoff["Ponto de Transição e Handoff"]
        TagRelease ==>|Repositório Git Remoto (origin)| PullVanderlei["Vanderlei faz git fetch & checkout da Tag Oficial"]
    end

    subgraph MaquinaVanderlei["Máquina do Vanderlei (Infraestrutura Pura no GCP)"]
        PullVanderlei --> LockCheck["Verifica Integridade: git status limpo (NÃO altera código)"]
        LockCheck --> DockerBuild["Executa Docker Build da Imagem Oficial"]
        DockerBuild --> PushGCR["Push para o Artifact Registry do GCP"]
        PushGCR --> DeployCloudRun["gcloud run deploy com Segredos e Flags Oficiais"]
        DeployCloudRun --> ReportURL["Devolve a URL Oficial do Cloud Run para o Vinícius"]
    end

    subgraph ViradaFinal["Virada Final do Gateway Asaas"]
        ReportURL --> AsaasWebhook["Vinícius e Dono da Loja atualizam a URL do Webhook no Asaas"]
    end
```

### Regras de Ouro do Handoff:
* **O que a máquina do Vinícius faz:** Desenvolvimento de código, testes unitários, validação comercial e congelamento da versão no Git (`commit` e `tag`).
* **O que a máquina do Vanderlei faz:** Operação de infraestrutura estrita — baixar o código congelado, construir o contêiner Docker oficial, publicar no Google Cloud Run e vincular os segredos e domínio.
* ⚠️ **Proibição Absoluta para o Vanderlei ("Zero Ideias Erradas"):**
  1. **Não alterar código:** Não mexer em arquivos `.ts`, `.tsx`, `.js` ou `.json`.
  2. **Não inventar parâmetros comerciais:** Não alterar prazos, taxas de parcelamento, valores mínimos do Asaas ou regras de cálculo de frete.
  3. **Não alterar migrations do banco:** Não executar `prisma migrate dev` ou mutações manuais no Neon de produção.
  4. **Seguir o script à risca:** Rodar estritamente os comandos documentados na **Etapa 4**, sem atalhos ou scripts não homologados.

---

## 3. Diagrama Arquitetural de Produção (Google Cloud)

```mermaid
flowchart TD
    subgraph Clientes["Acessos Externos"]
        User["Clientes / Navegadores"]
        AsaasHook["Gateway Asaas (Webhooks)"]
        NuvemHook["Nuvemshop / SMB Store"]
    end

    subgraph GCP["Google Cloud Platform (southamerica-east1 - SP)"]
        DNS["Domínio Próprio / Cloud Run Domain Mapping<br/>(Certificado SSL Gerenciado Automático)"]
        
        subgraph CloudRun["Cloud Run Service (Next.js Standalone Container)"]
            App["App Web + APIs (/api/checkout, /api/webhooks, /api/cart)"]
        end

        subgraph Schedulers["Rotinas em Segundo Plano"]
            CloudScheduler["Cloud Scheduler (A cada 1 minuto)"]
            CronEndpoint["Endpoint Seguro: /api/cron/payments<br/>(Header: Bearer CRON_SECRET)"]
            CloudScheduler -->|POST com Token| CronEndpoint
        end

        subgraph Security["Segurança e Configurações"]
            SecretManager["GCP Secret Manager<br/>(DATABASE_URL, ASAAS_API_KEY, RESEND_API_KEY)"]
            SecretManager -.->|Injeção como Env Vars| App
        end
    end

    subgraph Dados["Persistência Externa Segura"]
        NeonDB[("Neon Database (PostgreSQL - Produção)")<br/>Branch Principal / sa-east-1]
        AsaasAPI["Asaas API v3 (Produção)"]
        NuvemAPI["Nuvemshop API v1"]
    end

    User -->|HTTPS| DNS
    AsaasHook -->|POST /api/webhooks/asaas| DNS
    NuvemHook -->|POST /api/webhooks/nuvemshop| DNS
    DNS --> App
    App --> NeonDB
    App --> AsaasAPI
    App --> NuvemAPI
    CronEndpoint --> App
```

---

## 4. As 6 Etapas do Workflow de Subida

---

### ETAPA 1: Implementação dos Recursos Pendentes (Na Máquina do Vinícius)

Antes de congelar a versão de produção, implementar as duas melhorias essenciais já desenhadas:

#### 1.1 Proteção Financeira de Frete (`PLANO_PROTECAO_FRETE_E_MEDIDAS_WHATSAPP.md`)
* **Problema Resolvido:** Produtos pesados cadastrados na SMB Store sem peso/dimensões não devem gerar prejuízo de frete cotado a preço mínimo (R$ 18 vs R$ 75 real).
* **Entregas Técnicas:**
  1. No cálculo de frete (`services/freight/orchestrator.service.ts`), classificar itens como `AUTOMATIC` (se tiver peso >= 50g e medidas) ou `WHATSAPP_ONLY` (se não tiver medidas e não for resgatado por regex).
  2. **Regra de Contágio:** Se o carrinho tiver 1 produto `WHATSAPP_ONLY`, as transportadoras automáticas são desabilitadas; o frete vai como R$ 0,00 no checkout (`deliveryType = 'NONE'`).
  3. **UI Transparente:** Badge *"Frete a combinar via WhatsApp"* no card do produto e aviso explícito no checkout.
  4. **Página de Confirmação:** Botão verde dinâmico direcionando para o WhatsApp da loja física com a mensagem pré-formatada informando o número do pedido e o CEP para cotação do frete.

#### 1.2 Interface Otimista e Sync Gate no Carrinho (`ARQUITETURA_OPTIMISTIC_UI_E_SYNC_GATE_CARRINHO.md`)
* **Problema Resolvido:** Eliminar a percepção de lentidão de 4 a 5 segundos nas ações de adicionar/remover itens do carrinho causada pela rota transcontinental até o banco.
* **Entregas Técnicas:**
  1. Em `store/cart.store.ts`: aplicar mutações visuais otimistas instantâneas (0ms) no Zustand, recalculando subtotais na memória do navegador enquanto a requisição HTTP ocorre em background.
  2. Implementar fila serializada monotônica FIFO para evitar colisão de cliques rápidos.
  3. **Sync Gate:** No botão *"Finalizar Compra"*, interceptar cliques caso haja mutação em voo (`isMutating: true`), exibindo spinner breve (*"Confirmando itens..."*) e liberando a navegação para `/checkout` somente após a resposta do banco Neon.
  4. Mecanismo de rollback automático com toast discreto caso a conexão falhe.

---

### ETAPA 2: Bateria de Testes, Build Local e Congelamento (Na Máquina do Vinícius)

Garantir que todas as proteções comerciais, financeiras e estruturais continuam íntegras antes do envio ao Vanderlei:

1. **Executar a suíte de testes unitários e de integração:**
   ```bash
   npm run test
   ```
   * Critério de Sucesso: 100% dos testes aprovados (mais de 1.000 asserções válidas).
2. **Executar testes de isolamento e regras de arquitetura:**
   ```bash
   npm run test:isolation:negative
   npm run test:operations
   ```
3. **Build local do Next.js standalone:**
   ```bash
   npm run build
   ```
   * Critério de Sucesso: Build concluído gerando a pasta `.next/standalone` sem erros de TypeScript ou Webpack.
4. **Congelar a Versão no Git e Enviar ao Repositório Remoto:**
   ```bash
   git add .
   git commit -m "feat(release): versao de producao validada com asaas real e protecoes de frete"
   git tag -a prod-candidate-v1.0.0 -m "Versao candidata oficial para deploy no Google Cloud Run"
   git push origin main --tags
   ```

---

### ETAPA 3: Preparação da Infraestrutura no Google Cloud (GCP Setup)

Configuração do ambiente de destino na região de São Paulo (`southamerica-east1`):

#### 3.1 Criação dos Segredos no GCP Secret Manager
Armazenar todas as credenciais no Secret Manager:
```bash
gcloud secrets create continental-database-url --replication-policy="automatic"
gcloud secrets create continental-asaas-api-key --replication-policy="automatic"
gcloud secrets create continental-asaas-webhook-token --replication-policy="automatic"
gcloud secrets create continental-cron-secret --replication-policy="automatic"
gcloud secrets create continental-nuvemshop-token --replication-policy="automatic"
gcloud secrets create continental-resend-api-key --replication-policy="automatic"
gcloud secrets create continental-jwt-secret --replication-policy="automatic"
```

#### 3.2 Tabela de Variáveis de Ambiente de Produção

| Variável | Valor em Produção | Observação |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Modo de alta performance |
| `PORT` | `8080` | Porta padrão do Cloud Run |
| `NEXT_PUBLIC_APP_URL` | `https://loja.continentalestetica.com.br` | URL oficial de produção |
| `DATABASE_URL` | *Secret Manager* | String de conexão da branch de produção do Neon |
| `ASAAS_API_URL` | `https://api.asaas.com/v3` | Endpoint de Produção Oficial do Asaas |
| `ASAAS_API_KEY` | *Secret Manager* (`$aact_prod_...`) | Chave Real de Produção |
| `ASAAS_WEBHOOK_TOKEN` | *Secret Manager* | Token do novo webhook do Cloud Run |
| `ASAAS_ACCOUNT_SCOPE` | `primary` | Escopo da conta principal |
| `PAYMENT_DEPLOYMENT_ENVIRONMENT` | `PRODUCTION` | Libera validação de produção |
| `PAYMENT_REMOTE_ENABLED` | `true` | Ativa comunicação externa com Asaas |
| `PAYMENT_WORKER_ENABLED` | `true` | Habilita os workers de processamento |
| `PAYMENT_EXPIRATION_ENABLED` | `true` | Habilita expiração automática de pedidos |
| `CRON_SECRET` | *Secret Manager* | Chave de proteção do Cloud Scheduler |
| `TENANT_HOST_ALIASES` | `{"loja.continentalestetica.com.br":"3a82b33c-3646-4272-9a89-80bb1ba327a5"}` | Vincula o domínio à loja no Neon |
| `CHECKOUT_PAUSED` | `false` | Loja aberta para vendas |

#### 3.3 Configuração do Domínio Personalizado e DNS
1. No Cloud Run, adicionar o mapeamento de domínio:
   * **Domínio:** `loja.continentalestetica.com.br` (ou o domínio principal acordado).
2. Inserir os registros `CNAME` / `A` gerados pelo Google no painel DNS do domínio (ex: Cloudflare, Registro.br, GoDaddy).
3. Aguardar a validação e emissão do certificado SSL gerenciado pelo Google Cloud.

---

### ETAPA 4: Roteiro Fechado para a Máquina do Vanderlei (Deploy Cloud Run)

Este é o **bloco estrito de comandos** que o Vanderlei deve executar no terminal da máquina dele. Sem invenções, sem alterar arquivos locais:

```bash
# 1. Puxar o repositório oficial e posicionar na tag congelada
git fetch origin --tags
git checkout tags/prod-candidate-v1.0.0

# 2. Conferir que a árvore de trabalho está 100% limpa (deve retornar nada)
git status --short

# 3. Instalar as dependências rigorosamente pelo lockfile
npm ci
npx prisma generate

# 4. Autenticar no Artifact Registry do GCP
gcloud auth configure-docker southamerica-east1-docker.pkg.dev

# 5. Fazer o Build oficial da imagem Docker
$RELEASE_TAG = "prod-candidate-v1.0.0"
docker build --build-arg RELEASE_SHA=$RELEASE_TAG -t southamerica-east1-docker.pkg.dev/SEU_PROJECT_ID/continental-repo/continental-app:$RELEASE_TAG .

# 6. Enviar a imagem para o repositório do Google Cloud
docker push southamerica-east1-docker.pkg.dev/SEU_PROJECT_ID/continental-repo/continental-app:$RELEASE_TAG

# 7. Executar o Deploy no Cloud Run
gcloud run deploy continental-ecommerce `
  --image southamerica-east1-docker.pkg.dev/SEU_PROJECT_ID/continental-repo/continental-app:$RELEASE_TAG `
  --region southamerica-east1 `
  --platform managed `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --min-instances 1 `
  --max-instances 10 `
  --set-secrets="DATABASE_URL=continental-database-url:latest,ASAAS_API_KEY=continental-asaas-api-key:latest,ASAAS_WEBHOOK_TOKEN=continental-asaas-webhook-token:latest,CRON_SECRET=continental-cron-secret:latest"

# 8. Devolver a URL gerada para validação
gcloud run services describe continental-ecommerce --region southamerica-east1 --format='value(status.url)'
```

#### 4.1 Configuração do Cloud Scheduler (Execução Financeira Contínua)
Para que os pagamentos Pix e boletos continuem sendo conciliados automaticamente em produção:
```bash
gcloud scheduler jobs create http continental-payment-worker `
  --location=southamerica-east1 `
  --schedule="* * * * *" `
  --uri="https://loja.continentalestetica.com.br/api/cron/payments?limit=5" `
  --http-method=POST `
  --headers="Authorization=Bearer SUA_CRON_SECRET" `
  --time-zone="America/Sao_Paulo"
```

---

### ETAPA 5: Transição do Webhook do Asaas para a Nova URL

Esta etapa só ocorre após o Vanderlei confirmar que o contêiner está respondendo:

1. **Acessar o Painel Oficial do Asaas:**
   * Navegar até **Configurações da Conta** > **Integrações** > **Webhooks** (ou Webhook para Cobranças).
2. **Atualizar a URL de Envio:**
   * **URL Anterior (Vercel):** `https://continental-prototipo.vercel.app/api/webhooks/asaas`
   * **Nova URL Oficial (Google Cloud):** `https://loja.continentalestetica.com.br/api/webhooks/asaas`
3. **Configurar o Token de Autenticação:**
   * Definir um token forte no Asaas e garantir que o mesmo valor esteja salvo no `ASAAS_WEBHOOK_TOKEN` no Secret Manager.
4. **Fila e Eventos Ativos no Asaas:**
   * Garantir marcados os eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `PAYMENT_OVERDUE`.
   * Enviar um teste de ping pelo painel do Asaas e confirmar que o endpoint do Cloud Run retorna `HTTP 200`.

---

### ETAPA 6: Testes de Fumaça em Produção e Abertura Oficial

Com a URL de produção no ar, realizar o teste de fumaça inicial antes da divulgação pública:

| Checkpoint | Ação | Critério de Aceite |
| :--- | :--- | :--- |
| **1. Catálogo e Filtros** | Acessar a home e páginas de categoria | Carregamento rápido em SP (<500ms), imagens exibidas |
| **2. Carrinho Otimista** | Adicionar e remover produtos no carrinho | 0ms de espera visual; total atualizado em tempo real |
| **3. Regra de Frete WhatsApp** | Adicionar produto sem medidas | Desabilita Correios/J&T; frete R$ 0,00; aviso de WhatsApp |
| **4. Compra Teste Pix (R$ 5)** | Gerar um pedido teste Pix de R$ 5,00 | QR Code oficial Asaas gerado com o novo domínio |
| **5. Webhook em Tempo Real** | Efetuar o Pix pelo banco | A tela vira automaticamente para "Pago" em segundos |
| **6. Integração Omnichannel** | Verificar a Nuvemshop e o Neon | Pedido gerado na Nuvemshop e baixado no SMB Store |
| **7. Estorno Administrativo** | Acionar o cancelamento do teste | Estoque restaurado no Neon e na Nuvemshop |

---

## 5. Estratégia de Continuidade (Desenvolvimento Pós-Subida)

Como o sistema entrará em operação comercial mas seguirá em desenvolvimento constante, adota-se o seguinte modelo de governança:

1. **Estratégia de Branches:**
   - `main`: Reflete exatamente o código ativo em produção no Google Cloud. Nenhum commit direto é feito na `main`.
   - `homologacao_teste`: Branch de homologação onde novas telas e recursos continuam sendo desenvolvidos e testados.
   - Subidas de novas features são feitas via Pull Request validado com testes unitários passando.
2. **Deploys com Zero Downtime no Cloud Run:**
   - Cada novo deploy no Cloud Run cria uma nova **Revisão (*Revision*)**. O tráfego só é migrado para a nova versão quando o healthcheck inicial estiver 100% saudável.
3. **Segurança de Migrations no Banco:**
   - Adotar o padrão *Expand and Contract*: nunca renomear ou deletar colunas em uso pelo código antigo antes da nova versão estar estabilizada.
4. **Chave de Emergência (`CHECKOUT_PAUSED`):**
   - Caso seja necessário realizar uma manutenção pesada na base de dados, basta definir a variável `CHECKOUT_PAUSED=true` no Cloud Run. O catálogo continua acessível, mas novas compras são pausadas com um aviso amigável ao cliente.

---

## 6. Plano de Rollback Imediato

Se qualquer anomalia crítica for identificada nas primeiras horas de produção:

1. **Reversão Instantânea no Cloud Run:**
   ```bash
   gcloud run services update-traffic continental-ecommerce --to-revisions=REVISAO_ANTERIOR=100 --region southamerica-east1
   ```
2. **Reversão de Webhooks:**
   - Caso necessário, a URL do Webhook no painel do Asaas pode ser temporariamente reconduzida.
3. **Integridade de Dados:**
   - Como o banco Neon possui *Point-in-Time Restore (PITR)*, qualquer estado anterior pode ser recuperado sem perda de registros.

---

> **Aprovação:** Documento atualizado e blindado contra desvios operacionais. Nenhuma alteração de código ou banco foi executada nesta etapa de planejamento.
