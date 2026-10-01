# PLANO MESTRE DE AÇÃO: REMEDIAÇÃO, SEGURANÇA & CONSOLIDAÇÃO DO E-COMMERCE

> **Documento:** `diversos/PLANO_DE_ACAO/PLANO_DE_ACAO_REVISAO_E_SEGURANCA.md`  
> **Data de Criação:** 01 de Outubro de 2026  
> **Status:** 🟡 **AGUARDANDO APROVAÇÃO DO USUÁRIO (NÃO IMPLEMENTAR AINDA)**  
> **Branch Estável / Produção:** `main` (ponto base funcional: commit `0c7ef7d`)  
> **Branch de Quarentena / Isolamento:** `isolamento` (código do outro desenvolvedor: commit `d066628`)  
> **Repositório:** `https://github.com/ViniMoia/Sistema-E-Commerce.git`  

---

## 1. CONTEXTO E DIAGNÓSTICO DO CENÁRIO

### 1.1 O que ocorreu
O projeto foi submetido a uma revisão geral e auditoria de segurança conduzida por outro desenvolvedor. Foi utilizado o framework multi-agente **Ruflo MCP** (agentes *Planner*, *Coder*, *Tester* e *Reviewer*), gerando 15 relatórios de auditoria e alterando **390 arquivos (+34.689 linhas / -4.307 linhas)**.

### 1.2 O Veredito Oficial do Laudo e o Erro Cometido
O relatório consolidado de encerramento dos próprios agentes (`FINAL-VALIDATION.md`, linhas 5-6) declarou explicitamente:
* **Recomendação de publicação:** **`BLOCKED — NÃO PUBLICAR`**
* **Motivo:** *Migrações históricas com risco crítico de corrupção/perda de integridade no banco de dados, reconciliação e estornos financeiros incompletos, ausência de testes E2E em navegador real e falta de homologação dos serviços em nuvem.*

Apesar desse veredito formal, os commits foram enviados para o GitHub. A criação da branch `isolamento` no GitHub pelo proprietário do projeto resolveu o isolamento desse código, permitindo que a branch `main` seja preservada como versão estável funcional.

### 1.3 O Diagnóstico das Variáveis de Ambiente (`.env`)
O arquivo `.env` do outro desenvolvedor foi expandido para 83 linhas porque os agentes criaram um validador obrigatório de contrato de ambiente (`lib/config/environment.cjs`), mas configurado para rodar contra um **PostgreSQL local (`localhost:5432`)** e credenciais fictícias de desenvolvimento (mocks), desvinculando-se do banco de dados **Neon DB Serverless**, do **Supabase** e do **Asaas** de produção.

---

## 2. GOVERNANÇA DE BRANCHES E AMBIENTES

| Branch / Local | Finalidade | Estado / Política de Acesso |
| :--- | :--- | :--- |
| **`main` (GitHub)** | Produção / Vercel | Deve conter apenas o código estável, testado e homologado com os segredos reais de produção. |
| **`isolamento` (GitHub)** | Quarentena do Outro Dev | Armazena o código de 390 arquivos gerado pelos agentes Ruflo (`d066628`) para estudo, diff e colheita seletiva. |
| **`Projeto` (Local)** | Workspace Oficial | Mantém a versão funcional (`0c7ef7d`), sem sofrer merge destrutivo nem alteração de credenciais. |
| **`isolamento` (Local)** | Sandbox de Leitura | Pasta `../isolamento` clonada localmente de forma isolada, usada exclusivamente para leitura e inspeção. |
| **`feature/security-hardening`** | Branch de Implementação | Branch local criada a partir de `main` onde aplicaremos de forma cirúrgica apenas as correções aprovadas. |

---

## 3. MATRIZ DE FERRAMENTAS & MCPS UTILIZADOS NO PLANO

Para garantir a máxima precisão, segurança e rastreabilidade, cada etapa do plano utilizará os **Model Context Protocols (MCPs)** instalados no ambiente:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           MCP TOOLCHAIN DE APOIO                          │
├─────────────────┬─────────────────────────────────────────────────────────┤
│ MCP git         │ Gestão cirúrgica de diffs, branches e cherry-pick       │
│ MCP ruflo       │ Análise estática de risco (analyze_diff), scans e audit │
│ MCP postgres    │ Verificação e integridade de queries/constraints        │
│ MCP sequential  │ Raciocínio causal estruturado para refatorações         │
│ MCP memory      │ Rastreabilidade de invariantes e dos 198 IDs auditados  │
│ MCP puppeteer   │ Testes automatizados em navegador real (E2E / a11y)     │
└─────────────────┴─────────────────────────────────────────────────────────┘
```

### Funções detalhadas de cada MCP:
1. **MCP `git`**:
   * **Ferramentas:** `git_diff`, `git_log`, `git_show`, `git_branch`, `git_checkout`, `git_cherry_pick`, `git_status`.
   * **Utilidade:** Comparar exatamente o que mudou arquivo por arquivo entre `main` e `isolamento`, extrair trechos cirúrgicos de correção e garantir que nada seja mesclado por acidente.
2. **MCP `ruflo`**:
   * **Ferramentas:** `analyze_diff-risk`, `analyze_diff`, `aidefence_scan`, `aidefence_has_pii`, `hooks_coverage-route`, `performance_profile`.
   * **Utilidade:** Auditar o risco intrínseco de cada arquivo antes de portá-lo para o código oficial, verificar se dados de clientes (PII) estão protegidos e garantir que não haja rotas órfãs ou vulneráveis.
3. **MCP `sequential-thinking`**:
   * **Ferramentas:** `sequentialthinking`.
   * **Utilidade:** Analisar as ramificações e dependências lógicas de cada refatoração crítica (como reserva de estoque, transações monetárias e autenticação multi-tenant), prevenindo regressões de negócio.
4. **MCP `memory`**:
   * **Ferramentas:** `create_entities`, `create_relations`, `search_nodes`, `open_nodes`.
   * **Utilidade:** Criar um mapa de grafos relacionando cada um dos 198 apontamentos de auditoria com a sua resolução no código, mantendo o histórico de conformidade documentado.
5. **MCP `postgres`**:
   * **Ferramentas:** `query`.
   * **Utilidade:** Validar sintaxe SQL, checagem de tipos Decimal e indexação em ambiente de testes antes de aplicar qualquer alteração estrutural no banco Neon.
6. **MCP `puppeteer`**:
   * **Ferramentas:** `puppeteer_navigate`, `puppeteer_click`, `puppeteer_fill`, `puppeteer_screenshot`, `puppeteer_evaluate`.
   * **Utilidade:** Suprir a lacuna crítica identificada em `FINAL-VALIDATION.md` (falta de testes em navegador), testando o fluxo real do usuário na loja: navegação no catálogo, adição ao carrinho, preenchimento do checkout e resposta visual.

---

## 4. FASES DE EXECUÇÃO DETALHADAS

### FASE 0: Proteção & Alinhamento de Branches no Repositório Remoto
* **Objetivo:** Garantir que a branch `main` no GitHub reflita com segurança a versão funcional estável do sistema, enquanto a branch `isolamento` guarda o histórico do outro desenvolvedor.
* **Ações:**
  1. Confirmar que a branch `isolamento` no GitHub está com o commit mais recente (`d066628`).
  2. Restaurar/apontar a branch `main` no GitHub para o commit estável `0c7ef7d` (ou garantir que o pipeline de deploy em produção esteja travado na versão homologada).
  3. Criar a branch de trabalho local: `git checkout -b feature/security-hardening`.
* **Uso de MCPs nesta fase:**
  * **MCP `git`** (`git_status`, `git_branch`, `git_log`): Validação dos ponteiros locais e remotos de forma controlada.

---

### FASE 1: Triagem & Filtro dos 198 Apontamentos de Auditoria
* **Objetivo:** Separar as correções legítimas e essenciais do que é código quebrado, arriscado ou dependente de mocks.
* **Categorização das Mudanças:**

#### 🟢 Grupo A: Correções de Segurança Aprovadas (Para Colheita Seletiva)
* **BOLA / IDOR:** Fechamento de brechas em `app/api/orders/[id]/route.ts` e rotas de entrega (exigir simultaneamente `lojaID` e usuário da sessão).
* **Assinatura de Frete (Anti-Tampering):** Assinatura HMAC na cotação de frete para impedir manipulação de valor no cliente.
* **Reserva Atômica de Estoque:** `stock >= quantity` garantido dentro de `prisma.$transaction`.
* **Sanitização de DTOs Públicos:** Remover senhas de Correios e dados de contratos retornados em `app/api/products` e `app/api/lojas`.
* **Guest Checkout Hardening:** Impedir que clientes anônimos utilizem e-mails existentes para resgatar pontos ou alterar dados de terceiros.
* **Prevenção de Host Header Injection:** Correção na rota de `forgot-password` para não confiar cegamente no header `Origin`/`Referer`.

#### 🔴 Grupo B: Mudanças Rejeitadas da Quarentena (Alto Risco / Não Aplicar)
* **9 Novas Migrations Prisma:** Não aplicar as migrations `20260926...` no Neon real sem testes prévios de compatibilidade com os dados em produção.
* **Reconciliador Durável em Segundo Plano (`PaymentReconciliation`):** Rejeitar até que haja infraestrutura de crons/workers reais na Vercel/servidor.
* **Troca de UUID por Slug Genérico:** Rejeitar `loja-continental-default` e manter o UUID real da Continental (`536bfa58-0531-49e8-9209-3a046281e516`).
* **Bootstrap com Senha Fixa (`scripts/create_test_admin.ts`):** Não versionar scripts com credenciais estáticas (`AdminPassword123!`).

* **Uso de MCPs nesta fase:**
  * **MCP `sequential-thinking`**: Decompor o impacto de cada grupo de vulnerabilidade no fluxo de compras.
  * **MCP `memory`**: Armazenar os nós de cada vulnerabilidade (`FINAL-001` a `FINAL-036`) com status `APPROVED_FOR_PORT` ou `REJECTED_QUARANTINE`.
  * **MCP `ruflo`** (`analyze_diff-risk`): Avaliar o nível de risco de cada arquivo do Grupo A antes de iniciar o porting.

---

### FASE 2: Porting Cirúrgico de Segurança (Sem Quebrar o Schema Atual)
* **Objetivo:** Aplicar os patches de segurança diretamente nos services e rotas do projeto funcional, preservando 100% o schema e o banco de dados atual.
* **Itens a Implementar:**
  1. **Atualização do Checkout Service:**
     * Trava de integridade monetária em `services/checkout.service.ts` utilizando `Decimal` e recalculando frete no servidor.
     * Idempotência estrita de checkout (`Idempotency-Key`).
  2. **Atualização do Webhook Asaas:**
     * Leitura e transição idempotente de eventos de pagamento em `app/api/webhooks/asaas/route.ts` sem descartar notificações legítimas.
  3. **Proteção Multi-tenant (BOLA/IDOR):**
     * Garantir que todas as consultas do Prisma em `/api/orders`, `/api/products` e `/api/customers` incluam a cláusula composta `{ id, lojaID }`.
  4. **Sanitização de DTOs e Mascaramento de Logs:**
     * Atualização de `lib/logger.ts` para ofuscar CPFs, senhas e dados de cartão de forma rigorosa.
* **Uso de MCPs nesta fase:**
  * **MCP `git`** (`git_show` e `git_diff`): Extrair pontualmente os blocos de código da pasta `isolamento`.
  * **MCP `ruflo`** (`hooks_coverage-route` e `aidefence_scan`): Varrer as rotas alteradas para confirmar que continuam cobertas e livres de vazamentos de segredos ou PII.

---

### FASE 3: Contrato de Variáveis de Ambiente Resiliente
* **Objetivo:** Adicionar as novas variáveis de segurança necessárias sem quebrar o `.env` de produção.
* **Estratégia:**
  1. **Manter o `.env` atual funcional** com as credenciais reais do Neon DB, Supabase e Asaas.
  2. **Adicionar apenas as variáveis de segurança necessárias** com fallbacks seguros e documentados:
     * `FREIGHT_QUOTE_SECRET`: Chave secreta de 32 caracteres para assinatura do frete.
     * `OBSERVABILITY_TOKEN`: Token interno para endpoints de health check.
     * `NEXT_PUBLIC_APP_URL`: Definir `http://localhost:3000` em dev e a URL da Vercel em produção.
  3. **Criar um `.env.example` completo e claro** para orientar novos desenvolvedores sem expor credenciais reais.
* **Uso de MCPs nesta fase:**
  * **MCP `ruflo`** (`aidefence_has_pii`): Checar se nenhum token sensível foi colocado acidentalmente no repositório.

---

### FASE 4: Validação de Banco de Dados e Migrações (Isolamento)
* **Objetivo:** Garantir que o schema do Prisma e o banco Neon continuem em perfeita harmonia.
* **Ações:**
  1. Executar `npx prisma validate` e `npx prisma generate` no projeto funcional.
  2. Caso seja necessária alguma adição estritamente obrigatória no schema (ex: coluna de data de expiração de cotação ou flag de soft-delete), ela será ensaiada primeiramente em banco local.
  3. **Regra de Ouro:** Nenhuma migration será aplicada no Neon Serverless sem teste prévio de diff e sem garantia de retrocompatibilidade com dados já existentes.
* **Uso de MCPs nesta fase:**
  * **MCP `postgres`**: Executar queries de validação de compatibilidade de tipos (`Decimal` vs `Float`) e checagem de integridade referencial.

---

### FASE 5: Testes de Regressão e Validação em Navegador Real (E2E)
* **Objetivo:** Resolver o principal bloqueio apontado na auditoria original — a ausência de testes em navegador real.
* **Ações:**
  1. **Testes Unitários e de Integração:**
     * Executar `npm run test:unit` para validar cálculo de parcelas, regras de negócio e validação Zod.
  2. **Automação E2E com Navegador Real (Puppeteer):**
     * Subir o servidor local (`npm run dev`).
     * Executar roteiro automatizado via Puppeteer navegando na Home da Continental, acessando um produto, calculando frete, adicionando ao carrinho e abrindo a página de checkout.
     * Capturar screenshots comprobatórios do fluxo de checkout funcional para arquivamento no relatório de homologação.
* **Uso de MCPs nesta fase:**
  * **MCP `puppeteer`**:
    * `puppeteer_navigate`: Abrir a URL da loja local.
    * `puppeteer_fill` & `puppeteer_click`: Simular o preenchimento de CEP, seleção de produto e avanço de carrinho.
    * `puppeteer_screenshot`: Registrar visualmente que a UI não sofreu nenhuma quebra ou erro 500.

---

### FASE 6: Homologação Final, Relatório Executivo e Merge Seguro
* **Objetivo:** Concluir a remediação com documentação completa e liberar o código para a branch principal.
* **Ações:**
  1. Executar `npm run build` para garantir que o Next.js App Router compila 100% das rotas sem erros de TypeScript.
  2. Gerar o **Relatório Final de Remediação de Segurança**, listando todos os itens corrigidos com evidências de testes.
  3. Realizar o merge seguro da branch `feature/security-hardening` na branch `main`.
* **Uso de MCPs nesta fase:**
  * **MCP `memory`**: Fechar todos os nós de tarefas e gravar o histórico consolidado.
  * **MCP `git`**: Comitar as alterações com mensagens semânticas padronizadas e sincronizar com o repositório remoto.

---

## 5. RESUMO DE SEGURANÇA E COMPROMISSO OPERACIONAL

* 🔒 **Nenhum dado real será perdido:** O banco Neon DB Serverless permanece intocado durante todo o processo de implementação.
* 🔒 **O arquivo `.env` de produção está protegido:** As credenciais válidas do Asaas e do Supabase não serão substituídas por mocks.
* 🔒 **Risco zero de regressão em massa:** Não haverá merge cego de 390 arquivos. Cada correção será analisada, portada e testada individualmente.

---

**Fim do Documento.**  
*Aguardando análise e aprovação formal do usuário para dar início à Fase 0 e Fase 1.*
