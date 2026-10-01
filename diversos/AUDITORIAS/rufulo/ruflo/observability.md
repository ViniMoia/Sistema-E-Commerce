# Guia de Observabilidade, Telemetria e Logs

Este documento estabelece o modelo de rastreabilidade, monitoramento de saúde e observabilidade operacional no ecossistema Ruflo + Antigravity.

---

## 1. Matriz de Rastreabilidade

O sistema foi estruturado para responder com precisão às 9 questões fundamentais de auditoria:

| Pergunta de Auditoria | Como é Respondida / Onde Inspecionar | Ferramenta / Campo |
| :--- | :--- | :--- |
| **1. Qual agente executou uma tarefa?** | Identificador único (`agent_id`) e tipo especializado (`planner`, `coder`, `tester`, `reviewer`). | `ruflo agent list`, `ruflo agent status <id>` |
| **2. Qual ferramenta foi utilizada?** | Nome da ferramenta MCP invocada (`memory_store`, `analyze_diff`, etc.). | `ruflo mcp logs`, `tools/call` payload |
| **3. Quando foi executada?** | Timestamp padronizado em formato ISO-8601 UTC em cada evento. | Campo `timestamp` / `created_at` |
| **4. Qual foi o resultado?** | Status (`completed`, `failed`, `changes_required`), payload de retorno e diffs. | Relatório do Tester / Parecer do Reviewer |
| **5. Qual tarefa originou a execução?** | Identificador de tarefa (`task_id`) e plano gerado pelo Planner. | `ruflo task status <id>` |
| **6. Qual agente chamou outro agente?** | Cadeia hierárquica e eventos do barramento de mensagens. | `ruflo swarm status <id>`, topologia |
| **7. Qual etapa falhou?** | Localização exata da etapa na pipeline (`planning`, `coding`, `testing`, `review`). | `step_id`, laudo diagnóstico do Tester |
| **8. Quanto tempo levou?** | Duração da execução em milissegundos e métricas de CPU/event-loop. | `ruflo performance metrics`, `elapsed_ms` |
| **9. Quantas tentativas foram necessárias?** | Contagem de iterações e ciclos de retorno (reprovação no Reviewer → Coder). | Contador de tentativas / histórico de tarefas |

---

## 2. Formato do Log Estruturado (Schema Padrão)

Todas as execuções e transições de estado geram registros em formato estruturado:

```json
{
  "traceId": "trace-1788299290223",
  "timestamp": "2026-09-01T22:16:23.774Z",
  "actor": {
    "agentId": "agent-1788299124793-65ukpm",
    "role": "coder",
    "engineType": "coder"
  },
  "context": {
    "workflowId": "workflow-1788299254089",
    "taskId": "task-cep-validator",
    "callerAgentId": "agent-planner-01"
  },
  "action": {
    "type": "tool_invocation",
    "toolName": "memory_store",
    "parameters": {
      "key": "arch/cep-validation-rule",
      "sanitized": true
    }
  },
  "result": {
    "status": "success",
    "durationMs": 42.5,
    "retryCount": 0
  }
}
```

---

## 3. Política de Proteção de Dados e Secrets nos Logs

* ⛔ **PROIBIDO registrar chaves de API, senhas ou tokens JWT nos logs.**
* Cabeçalhos como `Authorization: Bearer ...` ou `supabase_key` são mascarados para `[REDACTED]` antes de qualquer persistência em disco ou saída no console.
* Dados pessoais identificáveis (PII) são filtrados automaticamente pelo módulo de segurança antes da serialização.

---

## 4. Comandos Essenciais de Monitoramento

* **Logs do Servidor MCP**:
  ```bash
  ruflo mcp logs -n 50
  ```
* **Logs de Atividade de um Agente Específico**:
  ```bash
  ruflo agent logs -i <agent-id> --since 1h
  ```
* **Telemetria de Desempenho e Recursos do Sistema**:
  ```bash
  ruflo performance metrics
  ```
* **Estado Geral de Saúde do Ecossistema**:
  ```bash
  ruflo status
  ```
