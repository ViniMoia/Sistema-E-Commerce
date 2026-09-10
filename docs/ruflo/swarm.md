# Arquitetura de Swarms e Execução Paralela

Este documento detalha o funcionamento, regras de governança, topologias e ciclo de vida de **Swarms** no ecossistema Ruflo + Antigravity.

---

## 1. Princípios de Paralelismo e Governança

* **Uso Justificado**: Swarms **NÃO** devem ser utilizados para tarefas triviais, edições pontuais ou demandas com dependência estritamente sequencial.
* **Desacoplamento Obrigatório**: Duas ou mais tarefas só podem ser executadas em paralelo se seus escopos de arquivos e contratos de interface forem independentes.
* **Coordenação Hierárquica**: Um agente coordenador (*Lead / Architect*) orquestra a distribuição de subtarefas para *workers* especializados, consolidando os resultados antes da revisão.

---

## 2. Padrão de Decomposição de Features

```
                         FEATURE COMPLEXA
                                │
                                ▼
                       [ SWARM COORDINATOR ]
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
  [ Backend Worker ]    [ Frontend Worker ]    [ Test/Docs Worker ]
  - Cria Service         - Cria Componente      - Cria Suíte Vitest
  - Cria Route API       - Cria UI desacoplada  - Atualiza docs
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                                ▼
                    [ CONSOLIDAÇÃO & MERGE ]
                                │
                                ▼
                     [ TESTER & REVIEWER ]
```

---

## 3. Matriz de Decisão: Sequencial vs Paralelo

| Cenário | Estratégia | Justificativa |
| :--- | :--- | :--- |
| **Backend API + Frontend independente com mock** | **PARALELO (Swarm)** | Os contratos de interface estão previamente acordados; cada worker atua em diretórios distintos. |
| **Migração de Banco + Alteração de Query Prisma** | **SEQUENCIAL** | A query depende diretamente da aplicação prévia da migration no banco. |
| **Criação de Testes de Unidade + Documentação** | **PARALELO (Swarm)** | Tarefas totalmente isoladas sem concorrência de arquivos. |
| **Refatoração de serviço central compartilhado** | **SEQUENCIAL** | Alto risco de conflito de merge e regressão se múltiplos agentes editarem simultaneamente. |

---

## 4. Topologias e Configuração Recomendada

* **Topologia Padrão**: `hierarchical`
* **Limite Recomendado de Agentes**: 3 a 5 agentes simultâneos (evita concorrência excessiva de recursos e saturação de tokens).
* **Comandos de Ciclo de Vida**:
  * Inicialização: `ruflo swarm init -t hierarchical -m 5`
  * Inspeção de Progresso: `ruflo swarm status <swarm-id>`
  * Finalização / Liberação de Recursos: `ruflo swarm stop <swarm-id>`

---

## 5. Prevenção de Conflitos e Deadlocks

1. **Lock de Arquivos**: Dois agentes do swarm nunca devem ter permissão de escrita simultânea no mesmo arquivo.
2. **Timeouts Explícitos**: Todo worker do swarm possui timeout padrão de 300s para evitar travamento em loops infinitos.
3. **Shutdown Limpo**: Ao concluir o ciclo, o swarm deve ser explicitamente finalizado para liberar o pool de memória e processos.
