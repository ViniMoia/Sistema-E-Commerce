# Manual Operacional de Workflows em Produção

Este documento consolida o **Workflow de Produção** do ecossistema Ruflo + Antigravity, detalhando os papéis de cada agente, condições de disparo, matriz de paralelismo e regras de aprovação.

---

## 1. Fluxo de Produção Completo

```
                      ┌──────────────────────────────┐
                      │    DEMANDA DO USUÁRIO / IDE  │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │    1. BUSCA NA MEMÓRIA DB    │
                      │  (Pesquisa arch/* e padrões) │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │      2. AGENTE PLANNER       │
                      │  (Decomposição em 8 seções)  │
                      └──────────────┬───────────────┘
                                     │
                      ┌──────────────┴───────────────┐
                      │ Tarefa Simples               │ Feature Complexa
                      ▼                              ▼
             ┌─────────────────┐           ┌───────────────────┐
             │      CODER      │           │    SWARM WORKERS  │
             │ (Implementação  │           │ (Backend / Front /│
             │   Cirúrgica)    │           │  Docs em Paralelo)│
             └────────┬────────┘           └─────────┬─────────┘
                      │                              │
                      └──────────────┬───────────────┘
                                     │ (Consolidação de Diffs)
                                     ▼
                      ┌──────────────────────────────┐
                      │      3. AGENTE TESTER        │
                      │ (Execução Vitest + Diagnost) │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │     4. AGENTE REVIEWER       │
                      │ (Auditoria em 4 Dimensões)   │
                      └──────────────┬───────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     │                               │
             [ CHANGES_REQUIRED ]               [ APPROVED ]
                     │                               │
                     ▼                               ▼
        ┌────────────────────────┐      ┌─────────────────────────┐
        │    RETORNO AO CODER    │      │  5. PERSISTÊNCIA MEM.   │
        │  (Correção de Falhas)  │      │ (Decisão em memory.db)  │
        └────────────────────────┘      └────────────┬────────────┘
                                                     │
                                                     ▼
                                        ┌─────────────────────────┐
                                        │    ENTREGA AO USUÁRIO   │
                                        └─────────────────────────┘
```

---

## 2. Guia de Decisão Operacional

### A. Quando Consultar a Memória (`Memory Search`)
* **Momento**: Sempre no início de qualquer nova funcionalidade, refatoração ou depuração.
* **Comando**: `ruflo memory search -q "<termo>" -t hybrid`
* **Objetivo**: Garantir que as decisões já tomadas no projeto (ex: formato de autenticação, convenções de rotas API) sejam respeitadas.

### B. Quando Usar o Planner
* **Obrigatório para**:
  * Tarefas que tocam múltiplos arquivos ou criam novos módulos.
  * Alterações que impactam rotas de API, tabelas de banco de dados ou autenticação.
  * Tarefas com potencial de regressão.
* **Dispensável para**: Correções triviais de tipografia ou ajuste de formatação pontual em linha única.

### C. Quando Usar o Coder
* **Sempre que houver alteração de código**, garantindo que as mudanças sejam estritamente limitadas ao plano aprovado.

### D. Quando Usar Swarms e Executar em Paralelo
* **Utilizar Swarm SOMENTE quando**:
  * A demanda puder ser dividida em subtarefas totalmente desacopladas (ex: criação de endpoint backend independente + criação de componente de UI com mock).
  * Criação simultânea de testes e documentação técnica.
* **PROIBIDO usar Swarm quando**:
  * Uma etapa depender do output da outra (ex: Backend precisa rodar migrations antes do Frontend consumir a API real).
  * Múltiplos agentes precisarem editar o mesmo arquivo.

### E. Quando Usar o Tester
* **Obrigatório** após qualquer alteração de código. O Tester executa a suíte de testes de unidade e integração (`npm run test`), validando cenários nominais e *edge cases*.

### F. Quando Usar o Reviewer
* **Obrigatório** antes de dar uma tarefa por concluída. O Reviewer audita 4 dimensões (Arquitetura, Segurança, Qualidade de Código e Validação dos Testes) e emite veredito binário (`APPROVED` ou `CHANGES_REQUIRED`).

### G. Quando Exigir Aprovação Humana (HIGH RISK)
* **Obrigatório para**:
  * Exclusão permanente de arquivos ou diretórios.
  * Deploys ou scripts de infraestrutura externa.
  * Migrações de banco destrutivas (`DROP`, `TRUNCATE`).
  * Manipulação ou inserção de credenciais de produção.
