# Arquitetura de Orquestração: Ruflo + Antigravity

Este documento descreve a arquitetura do ecossistema agentic e o modelo de coexistência e integração do Ruflo com outros servidores MCP no Antigravity IDE.

---

## 1. Visão Geral da Arquitetura

```
                     ┌──────────────────────────────┐
                     │             USER             │
                     └──────────────┬───────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │       ANTIGRAVITY IDE        │
                     │    (Main Agent / Host UI)    │
                     └──────────────┬───────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │ (MCP Protocol / stdio)   │ (Futuro)                 │ (Futuro)
         ▼                          ▼                          ▼
 ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
 │     RUFLO     │          │    GitHub     │          │   Database    │
 │ (Orquestrador)│          │ (Repos/PRs)   │          │ (Postgres/DB) │
 └───────┬───────┘          └───────────────┘          └───────────────┘
         │
 ┌───────┴───────────────────────┬────────────────────────┐
 │                               │                        │
 ▼                               ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     MEMORY      │     │     AGENTS      │     │     SWARMS      │
│ (.swarm/mem.db) │     │ (Planner,Coder, │     │ (Parallel Task  │
│                 │     │  Tester,Review) │     │  Distribution)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 2. Padrão de Coexistência Multi-MCP

O Antigravity IDE consome múltiplos servidores MCP em paralelo através de processos `stdio` desacoplados.

### A. Isolamento de Processos
* Cada servidor MCP opera em seu próprio processo independente (`node`, `npx` ou executável dedicado).
* Uma falha em um servidor MCP não interrompe a execução do Ruflo ou do agente principal.

### B. Prevenção de Conflitos de Nomes (Namespacing)
* **Ruflo**: Expõe ferramentas organizadas por domínio (`memory_*`, `agent_*`, `swarm_*`, `workflow_*`, `security_*`, `system_*`).
* **MCPs Futuros**: Utilizam namespaces exclusivos (ex: `github_*`, `postgres_*`, `filesystem_*`), garantindo colisão zero de ferramentas.

### C. Isolamento de Secrets e Permissões
* Nenhum secret de MCPs externos deve ser gravado diretamente em arquivos JSON versionados.
* Credenciais devem ser injetadas exclusivamente via referências a variáveis de ambiente (`env`).

---

## 3. Matriz de Componentes do Ruflo

| Componente | Função | Escopo de Ação |
| :--- | :--- | :--- |
| **Memória Persistente** | Indexação vetorial e persistência de decisões arquiteturais. | Base `.swarm/memory.db`. |
| **Planner (Architect)** | Decomposição de tarefas em critérios de aceitação e análise de riscos. | Planejamento puro. |
| **Coder** | Implementação de código aderente ao plano e aos padrões de design. | Alteração cirúrgica de código. |
| **Tester** | Criação e execução de testes automatizados (`Vitest`) e emissão de laudo. | Testes e diagnóstico. |
| **Reviewer** | Auditoria independente de qualidade, segurança e conformidade. | Emissão de `APPROVED` ou `CHANGES_REQUIRED`. |
| **Swarm Coordinator** | Orquestração de tarefas paralelas quando comprovadamente desacopladas. | Múltiplos workers isolados. |
