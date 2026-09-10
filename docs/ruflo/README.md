# Documentação Central da Arquitetura Ruflo + Antigravity

Bem-vindo à documentação da plataforma de orquestração agentic baseada em **Ruflo MCP** integrada ao **Antigravity IDE**.

---

## 📚 Índice Geral de Documentos

| Documento | Descrição |
| :--- | :--- |
| 🏗️ [architecture.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/architecture.md) | Visão geral da arquitetura de orquestração e modelo multi-MCP. |
| 🚀 [setup.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/setup.md) | Guia completo de instalação e reconstrução do ambiente do zero. |
| ⚙️ [configuration.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/configuration.md) | Configurações do MCP global/workspace e modelo de expansão. |
| 🧰 [tool-inventory.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/tool-inventory.md) | Catálogo e inventário das 333 ferramentas MCP por categoria e risco. |
| 🧠 [memory-policy.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/memory-policy.md) | Política de uso, retenção e convenções da memória persistente. |
| 🔄 [workflows.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/workflows.md) | Manual operacional dos fluxos de produção (Planner → Coder → Tester → Reviewer). |
| 🛡️ [security.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/security.md) | Matriz de risco em 3 níveis, guardrails e aprovação humana. |
| 🐝 [swarm.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/swarm.md) | Governança de swarms, paralelismo seguro e prevenção de deadlocks. |
| 📊 [observability.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/observability.md) | Telemetria, rastreabilidade em 9 dimensões e logs estruturados. |
| ⚡ [optimization.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/optimization.md) | Indexação HNSW, compressão e rotinas de manutenção. |
| 🧪 [stress-test-report.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/stress-test-report.md) | Relatório do teste de estresse de ponta a ponta. |
| 🔧 [troubleshooting.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/troubleshooting.md) | Diagnóstico de falhas comuns e procedimento de rollback. |

---

## 🤖 Agentes Especializados
* 📐 [Planner (Architect)](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/agents/planner.md) — Planejamento puro, decomposição e análise de riscos.
* 💻 [Coder](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/agents/coder.md) — Implementação cirúrgica com rigor de tipagem.
* 🧪 [Tester](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/agents/tester.md) — Automação de testes Vitest e laudo diagnóstico.
* 🔍 [Reviewer](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/docs/ruflo/agents/reviewer.md) — Auditoria independente de 4 dimensões (APPROVED / CHANGES_REQUIRED).
