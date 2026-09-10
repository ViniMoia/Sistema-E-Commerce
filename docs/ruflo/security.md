# Diretrizes de Segurança, Guardrails e Aprovação

Este documento detalha as políticas de segurança, classificação de risco de ações, protocolos de aprovação humana e integração com os módulos de segurança e compliance do Ruflo.

---

## 1. Matriz de Risco e Classificação de Operações

Toda e qualquer ação realizada por agentes isolados ou em swarm é categorizada nos três níveis a seguir:

```
                  ┌─────────────────────────────────────┐
                  │          MATRIZ DE RISCO            │
                  └──────────────────┬──────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
 ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
 │   LOW RISK    │           │  MEDIUM RISK  │           │   HIGH RISK   │
 └───────┬───────┘           └───────┬───────┘           └───────┬───────┘
         │                           │                           │
         ▼                           ▼                           ▼
  - Leitura de arquivos       - Alteração de código       - Exclusão de arquivos/DB
  - Busca semântica/DB        - Criação de novos files    - Deploy / Infraestrutura
  - Linting e Diagnósticos    - Instalação de pacotes     - Comandos destrutivos
  - Execução de testes unit.    locais do projeto         - Acesso/manuseio de secrets
         │                           │                           │
         ▼                           ▼                           ▼
 [ Execução Autônoma ]       [ Execução com Log/Diff ]   [ APROVAÇÃO HUMANA ]
                                                         [     OBRIGATÓRIA  ]
```

---

## 2. Protocolo de Aprovação Humana (HIGH RISK)

Ações classificadas como **HIGH RISK** jamais podem ser executadas automaticamente sem confirmação explícita do usuário:

1. **Exclusões Permanentes**: Remoção de diretórios, exclusão em lote de arquivos ou comandos `rm -rf` / `Remove-Item -Recurse`.
2. **Infraestrutura e Deploy**: Aplicação de scripts de deploy, alteração de configurações de DNS, Vercel ou instâncias de nuvem.
3. **Migrações Destrutivas de Banco**: Comandos SQL contendo `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` ou reset de schema.
4. **Modificação de Secrets / Env**: Criação ou alteração de arquivos contendo chaves de produção ou connection strings.

### Regra do Swarm:
> ⚠️ **Nenhum agente, worker ou coordenador de swarm possui autoridade para aprovar ou rebaixar uma operação de HIGH RISK.** Toda solicitação deve ser apresentada ao usuário com o impacto e aguardar o comando explícito para prosseguir.

---

## 3. Prevenção de Vazamento de Credenciais e PII

* **Scanner de Secrets**: Execução rotineira do comando de auditoria:
  ```bash
  ruflo security secrets
  ```
* **Filtro de Memória**: Antes de persistir qualquer informação na memória via `memory_store` ou `memory store`, o conteúdo é sanitizado para garantir que não contenha:
  * Tokens JWT (`ey...`)
  * Senhas ou credenciais de banco
  * Chaves de API (`supabase_key`, `OPENAI_API_KEY`, etc.)
  * Dados pessoais de clientes (PII)

---

## 4. Política de Avaliação Contínua de Diffs e Riscos

Durante o ciclo de Code Review, o agente **Reviewer** e o orquestrador utilizam ferramentas de análise estática e de risco:

* `ruflo security scan`: Varredura de vulnerabilidades conhecidas em dependências.
* `ruflo security defend`: Proteção contra injeções de prompt em mensagens entre agentes.
* `ruflo policy evaluate`: Verificação de conformidade no ledger de políticas e decisões.
