# PLANO DE AÇÃO (CONTINUAÇÃO): PRÓXIMAS ETAPAS & ROADMAP PÓS-REMEDIAÇÃO

> **Documento:** `diversos/PLANO_DE_ACAO/continuacao/PLANO_DE_ACAO_PROXIMAS_ETAPAS.md`  
> **Documento de Origem:** `diversos/PLANO_DE_ACAO/PLANO_DE_ACAO_REVISAO_E_SEGURANCA.md`  
> **Data de Criação:** 01 de Outubro de 2026  
> **Status:** 🟢 **PRONTO PARA EXECUÇÃO / DECISÃO DO USUÁRIO**  
> **Branch Principal (Produção):** `main` (commit sincronizado: `67d0603`)  
> **Branch de Quarentena (Outro Dev):** `isolamento` (commit preservado: `d066628`)  
> **Repositório:** `https://github.com/ViniMoia/Sistema-E-Commerce.git`  

---

## 1. CONTEXTO DO PONTO DE PARTIDA

As Fases 0 a 6 do **Plano Mestre de Revisão e Segurança** foram concluídas com êxito:
1. **Preservação de Integridade:** O banco de dados **Neon DB Serverless** e o arquivo `.env` com as chaves reais de produção do **Asaas** e **Supabase** foram mantidos 100% protegidos e funcionais.
2. **Porting Cirúrgico de Segurança:** Foram corrigidas as 10 vulnerabilidades de maior severidade (vazamento de segredos de loja em `services/product.service.ts`, falhas de integridade relacional `P2003` em produtos, BOLA/IDOR em pedidos de clientes, Host Header Injection em `forgot-password`, HMAC-SHA256 em cotações de frete, proteção do ledger de fidelidade contra resgates anônimos e sanitização de logs/webhook Asaas).
3. **Validação Rigorosa:** **49 suítes de testes unitários aprovadas (364/364 testes)**, 0 erros no TypeScript (`npx tsc --noEmit`) e rotas essenciais (`/`, `/login`, `/register`, `/forgot-password`, `/checkout`, `/api/products`) respondendo com HTTP 200 OK.
4. **Sincronização do GitHub:** A branch `main` no GitHub foi restaurada e atualizada com o commit homologado `67d0603`, enquanto os 390 arquivos do outro desenvolvedor seguem isolados na branch remota `isolamento` (`d066628`).

---

## 2. ETAPAS DE CONTINUAÇÃO (ROADMAP)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     MATRIZ DE CONTINUAÇÃO DO PROJETO                     │
├───────────────────┬───────────────────────────────────────────────────────┤
│ ETAPA 1 (CRÍTICA) │ Homologação do Deploy em Produção (Vercel & Nuvem)    │
│ ETAPA 2 (OPCIONAL)│ Triagem & Colheita Seletiva de UI/UX da Quarentena    │
│ ETAPA 3 (OPERAÇÃO)│ Governança de Branches, CI/CD e Higienização de Disco │
└───────────────────┴───────────────────────────────────────────────────────┘
```

---

### ETAPA 1: Homologação do Deploy em Produção (Vercel & Nuvem) — *Recomendada*

* **Objetivo:** Garantir que o ambiente público de produção (Vercel) construiu o código da branch `main` sem falhas e validar o fluxo transacional com os serviços em nuvem reais.
* **Ações Práticas:**
  1. **Monitoramento do Build na Vercel:**
     * Verificar no dashboard da Vercel se o webhook acionado pelo commit `67d0603` concluiu a etapa de compilação (`next build`) com status *Ready*.
     * Confirmar que as novas variáveis opcionais (`FREIGHT_QUOTE_SECRET`, `OBSERVABILITY_TOKEN`) utilizam os fallbacks resilientes já configurados ou cadastrá-las nas *Environment Variables* da Vercel.
  2. **Smoke Test em Produção (Domínio Público):**
     * Acessar o domínio de produção (`https://continentalestetica.com.br` ou subdomínio configurado na Vercel).
     * Navegar pela Home e Catálogo de produtos.
     * Abrir uma página de produto e validar que o preço, variantes e cálculo de frete respondem normalmente.
     * Simular o fluxo de abertura de carrinho e direcionamento para o checkout.
  3. **Verificação do Webhook Asaas em Produção:**
     * Confirmar que o endpoint `POST /api/webhooks/asaas` está respondendo normalmente às notificações do gateway sem expor mensagens de erro detalhadas em produção.

---

### ETAPA 2: Triagem & Colheita Seletiva de UI/UX da Quarentena (`isolamento`)

* **Objetivo:** Aproveitar melhorias estéticas, componentes visuais e refinamentos de acessibilidade criados pelo outro desenvolvedor na branch `isolamento`, **sem trazer as alterações que quebram o banco de dados**.
* **O que PODE ser colhido (Baixo Risco):**
  * **Melhorias de Acessibilidade (A11y):** Ajustes de contraste de cores, labels para leitores de tela (`aria-label`) e suporte a navegação por teclado documentados em `diversos/AUDITORIAS/remediation/remediation/WEB-FIXES.md`.
  * **Otimização de Componentes React:** Componentes puros de exibição visual (ex.: carrossel de marcas, banners ou skeletons de carregamento) que não dependem de tabelas novas do Prisma.
  * **Micro-interações no Frontend:** Melhorias no feedback visual ao adicionar itens no carrinho ou ao validar campos de formulário no cliente.
* **O que DEVE permanecer bloqueado (Alto Risco):**
  * ❌ As 9 migrações Prisma (`20260926...` a `20260929...`).
  * ❌ O worker durável de reconciliação de pagamentos com tabelas ausentes (`PaymentReconciliation`).
  * ❌ Substituição do UUID real da loja por slugs arbitrários (`loja-continental-default`).
  * ❌ Validador monolítico de ambiente (`lib/config/environment.cjs`) que força variáveis para `localhost:5432`.

---

### ETAPA 3: Governança de Branches, CI/CD e Higienização de Disco

* **Objetivo:** Estabelecer barreiras definitivas para impedir novos incidentes de commits não autorizados em produção e manter o ambiente local limpo.
* **Ações Práticas:**
  1. **Proteção de Branch no GitHub (Branch Protection Rule):**
     * No repositório GitHub (`Settings > Branches`), adicionar regra de proteção na branch `main`:
       * Exigir *Pull Request* antes de realizar merge.
       * Exigir aprovação de revisão de código.
       * Bloquear *force push* para desenvolvedores convencionais.
  2. **Higienização do Espaço de Trabalho Local:**
     * Como a branch remota `origin/isolamento` já armazena permanentemente os 390 arquivos do outro dev no GitHub, a pasta local clonada `../isolamento` pode ser removida do disco do computador de desenvolvimento para liberar espaço e evitar confusões de contexto.
  3. **Fechamento e Arquivamento Documental:**
     * Manter os diretórios `diversos/PLANO_DE_ACAO/` e `diversos/AUDITORIAS/` como fonte histórica oficial de conformidade técnica e auditoria de segurança da plataforma.

---

## 3. QUADRO RESUMO DE DECISÃO

| Opção | Ação Recomendada | Impacto |
| :--- | :--- | :--- |
| **Ação Imediata** | **Validar o Deploy da Vercel (Etapa 1)** | Valida o funcionamento real do e-commerce no ar para clientes reais. |
| **Ação Secundária** | **Colheita Seletiva de UI/UX (Etapa 2)** | Agrega melhorias visuais aprovadas sem comprometer a estabilidade do backend. |
| **Ação Operacional** | **Proteção de Branch & Limpeza de Disco (Etapa 3)** | Garante governança futura e organização do ambiente de desenvolvimento. |

---

*Documento gerado para orientação das próximas fases operacionais do Sistema E-Commerce.*
