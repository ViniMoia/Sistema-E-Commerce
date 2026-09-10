# Inventário e Catálogo de Ferramentas Ruflo (v3.38.20)

Este documento cataloga as ferramentas disponibilizadas pela camada MCP do Ruflo, estruturadas por categoria, perfil de risco, recomendações de uso e guardrails de segurança.

---

## Matriz Resumida de Categorias

| Categoria | Quantidade / Exemplos | Nível de Risco | Finalidade Principal |
| :--- | :--- | :--- | :--- |
| **1. Memory** | `memory_store`, `memory_search`, `memory_retrieve`, `memory_list`, `memory_delete` | BAIXO / MÉDIO | Persistência e busca semântica de decisões e contexto. |
| **2. Agents** | `agent_spawn`, `agent_execute`, `agent_status`, `agent_terminate`, `agent_pool` | MÉDIO | Gerenciamento do ciclo de vida de agentes especializados. |
| **3. Swarms & Hive-Mind** | `swarm_init`, `swarm_status`, `swarm_shutdown`, `hive-mind_spawn`, `hive-mind_consensus` | MÉDIO / ALTO | Orquestração de múltiplos agentes em paralelo/consenso. |
| **4. Coordination** | `coordination_topology`, `coordination_sync`, `coordination_load_balance`, `coordination_consensus` | MÉDIO | Topologia, balanceamento de carga e sincronização de estado. |
| **5. Workflows & Tasks** | `workflow_run`, `workflow_execute`, `task_create`, `task_complete`, `task_status` | BAIXO / MÉDIO | Execução de pipelines e acompanhamento de tarefas atômicas. |
| **6. Security & Policy** | `policy_evaluate`, `aidefence_scan`, `transfer_detect-pii`, `metaharness_threat_model` | BAIXO (Verificação) | Avaliação de conformidade, detecção de PII e modelagem de ameaças. |
| **7. AgentDB** | `agentdb_pattern-store`, `agentdb_pattern-search`, `agentdb_hierarchical-*`, `agentdb_route` | BAIXO / MÉDIO | Base de dados vetorial de padrões de código e rotas neurais. |
| **8. Embeddings** | `embeddings_generate`, `embeddings_search`, `embeddings_compare` | BAIXO | Vetorização e cálculo de similaridade textual/código. |
| **9. Autopilot** | `autopilot_status`, `autopilot_enable`, `autopilot_disable`, `autopilot_progress` | ALTO | Modo de auto-conclusão persistente de tarefas. |
| **10. Browser** | `browser_session_record`, `browser_session_replay`, `browser_act` | MÉDIO / ALTO | Interações e testes automatizados em navegadores. |
| **11. Observability & System** | `system_status`, `system_health`, `performance_report`, `analyze_diff-risk`, `progress_check` | BAIXO | Monitoramento de métricas, diagnóstico e análise de risco de diffs. |
| **12. Hooks & Intelligence** | `hooks_pre-edit`, `hooks_post-edit`, `hooks_intelligence_*`, `hooks_route` | BAIXO / MÉDIO | Interceptadores de eventos para aprendizado e automação adaptativa. |
| **13. Outros (Neural, Claims, Federation)** | `neural_*`, `claims_*`, `federation_*`, `business_pod_*`, `terminal_*` | VARIADO | Treinamento de padrões locais, reivindicação de issues e federação. |

---

## Catálogo Detalhado por Categoria

### 1. Memory
* **Ferramentas**: `memory_store`, `memory_retrieve`, `memory_search`, `memory_list`, `memory_delete`, `memory_stats`, `memory_export`, `memory_import`.
* **Finalidade**: Gravação e busca semântica de conhecimento técnico, padrões de código e decisões de arquitetura.
* **Risco**:
  * `memory_search` / `memory_retrieve` / `memory_list`: **BAIXO**
  * `memory_store` / `memory_delete`: **MÉDIO**
* **Quando Utilizar**:
  * Ao iniciar um novo épico/refatoração para resgatar contexto anterior.
  * Ao concluir uma decisão arquitetural relevante para persistir aprendizado.
* **Quando NÃO Utilizar**:
  * Nunca utilizar para armazenar chaves de API, senhas, tokens ou dados pessoais (PII).
  * Não utilizar para armazenar arquivos binários grandes ou logs brutos volumosos.

---

### 2. Agents
* **Ferramentas**: `agent_spawn`, `agent_execute`, `agent_status`, `agent_terminate`, `agent_list`, `agent_pool`, `agent_health`.
* **Finalidade**: Instanciação e controle de execução de agentes com funções delimitadas (ex: Planner, Coder, Tester, Reviewer).
* **Risco**: **MÉDIO**
* **Quando Utilizar**:
  * Quando uma tarefa complexa exigir decomposição clara e execução especializada.
* **Quando NÃO Utilizar**:
  * Não criar agentes para ações pontuais de linha única ou leitura direta de arquivos que o próprio agente principal do Antigravity pode executar.

---

### 3. Swarms & Hive-Mind
* **Ferramentas**: `swarm_init`, `swarm_status`, `swarm_shutdown`, `hive-mind_spawn`, `hive-mind_consensus`, `hive-mind_broadcast`.
* **Finalidade**: Execução paralela e colaborativa de múltiplos agentes em tarefas independentes.
* **Risco**: **MÉDIO / ALTO**
* **Quando Utilizar**:
  * Em tarefas com subtarefas comprovadamente desacopladas (ex: frontend isolado + documentação técnica independente).
* **Quando NÃO Utilizar**:
  * Em tarefas sequenciais com dependências estritas (ex: implementar backend e refatorar testes que dependem do schema novo).
  * Nunca iniciar swarms sem monitoramento explícito de shutdown.

---

### 4. Coordination
* **Ferramentas**: `coordination_topology`, `coordination_sync`, `coordination_load_balance`, `coordination_node`, `coordination_metrics`.
* **Finalidade**: Ajustar topologia de agentes (mesh, hierarchical, pipeline) e balancear carga de processamento.
* **Risco**: **MÉDIO**
* **Quando Utilizar**:
  * Na configuração de fluxos complexos multi-agente que exigem consenso ou topologia hierárquica formal.
* **Quando NÃO Utilizar**:
  * Em interações simples do dia a dia.

---

### 5. Workflows & Tasks
* **Ferramentas**: `workflow_run`, `workflow_create`, `workflow_execute`, `workflow_status`, `task_create`, `task_complete`, `task_list`.
* **Finalidade**: Orquestrar pipelines determinísticos com etapas bem definidas (Planner → Coder → Tester → Reviewer).
* **Risco**: **BAIXO / MÉDIO**
* **Quando Utilizar**:
  * Para padronizar o ciclo de desenvolvimento de features e correções de bugs.
* **Quando NÃO Utilizar**:
  * Para tarefas exploratórias ou de depuração rápida interativa.

---

### 6. Security, Policy & AIDefence
* **Ferramentas**: `policy_evaluate`, `policy_status`, `aidefence_scan`, `transfer_detect-pii`, `metaharness_threat_model`.
* **Finalidade**: Avaliar se uma ação fere políticas de segurança, escanear potenciais vulnerabilidades ou detectar vazamento de dados sensíveis.
* **Risco**: **BAIXO** (Apenas avaliação/inspeção).
* **Quando Utilizar**:
  * Antes de operações de risco médio/alto ou antes de persistir dados externos na memória.
* **Quando NÃO Utilizar**:
  * Não deve substituir a aprovação humana explícita em ações de alto risco (exclusões ou deploys).

---

### 7. AgentDB & Embeddings
* **Ferramentas**: `agentdb_pattern-store`, `agentdb_pattern-search`, `embeddings_generate`, `embeddings_search`.
* **Finalidade**: Indexação vetorial e aprendizado de padrões de código de alta performance (HNSW index).
* **Risco**: **BAIXO**
* **Quando Utilizar**:
  * Para encontrar similaridades entre componentes ou soluções técnicas já aplicadas no repositório.
* **Quando NÃO Utilizar**:
  * Como banco relacional de dados da aplicação.

---

### 8. Autopilot
* **Ferramentas**: `autopilot_status`, `autopilot_enable`, `autopilot_disable`, `autopilot_config`.
* **Finalidade**: Manter os agentes trabalhando recursivamente em background até a conclusão de todas as pendências da fila.
* **Risco**: **ALTO**
* **Quando Utilizar**:
  * Apenas quando explicitamente solicitado pelo usuário com escopo e guardrails restritos.
* **Quando NÃO Utilizar**:
  * **PROIBIDO** em modo não supervisionado ou sem limites claros de iterações configurados.

---

### 9. Observability & System Diagnostics
* **Ferramentas**: `system_status`, `system_health`, `performance_report`, `analyze_diff-risk`, `progress_check`.
* **Finalidade**: Inspecionar a saúde do cluster agentic, métricas de execução e calcular o risco de alterações git (`diff risk`).
* **Risco**: **BAIXO**
* **Quando Utilizar**:
  * Durante diagnósticos de ambiente e na fase de Review para auditar o risco do diff gerado.
* **Quando NÃO Utilizar**:
  * Não há restrições (operações somente-leitura e diagnósticas).
