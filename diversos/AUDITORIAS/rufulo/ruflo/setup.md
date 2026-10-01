# Guia de Instalação e Reconstrução do Ambiente

Este guia descreve os passos reproduzíveis para configurar o Ruflo como camada de orquestração MCP no Antigravity IDE do zero.

---

## 1. Pré-requisitos do Sistema

* **Node.js**: `>= 20.0.0` (recomendado v22+)
* **npm / npx**: `>= 10.0.0`
* **Sistema Operacional**: Windows 10/11, macOS ou Linux
* **Antigravity IDE**: Instalado e operacional

---

## 2. Passo a Passo de Reconstrução

### Passo 1: Backup da Configuração MCP
Antes de qualquer alteração, faça backup do arquivo de configuração do Antigravity:
```powershell
Copy-Item "C:\Users\Vmoia\.gemini\config\mcp_config.json" "C:\Users\Vmoia\.gemini\config\mcp_config.json.bak" -Force
```

### Passo 2: Configuração do Servidor MCP
No arquivo `C:\Users\Vmoia\.gemini\config\mcp_config.json`, insira o bloco de configuração:

```json
{
  "mcpServers": {
    "ruflo": {
      "command": "npx",
      "args": [
        "-y",
        "ruflo@latest",
        "mcp",
        "start"
      ]
    }
  }
}
```

### Passo 3: Inicialização da Base de Memória
Execute a inicialização da base vetorial híbrida no workspace:
```bash
npx -y ruflo@latest memory init
npx -y ruflo@latest memory search -q "init" --build-hnsw
```

### Passo 4: Diagnóstico de Saúde do Ambiente
Valide a instalação com o utilitário médico do Ruflo:
```bash
npx -y ruflo@latest doctor
```

### Passo 5: Teste Rápido de Comunicação MCP
```bash
npx -y ruflo@latest mcp exec -t system_status -p "{}"
```

---

## 3. Estrutura de Diretórios Criada

```
docs/ruflo/
├── architecture.md          # Arquitetura geral e modelo multi-MCP
├── setup.md                 # Este guia de instalação e reconstrução
├── configuration.md         # Configuração MCP e padrões de expansão
├── tool-inventory.md        # Catálogo das 333 ferramentas MCP
├── memory-policy.md         # Diretrizes de memória persistente
├── workflows.md             # Manual operacional de workflows
├── security.md              # Matriz de risco e guardrails de segurança
├── observability.md         # Guia de logs, telemetria e rastreabilidade
├── optimization.md          # Otimização de performance e índice HNSW
├── stress-test-report.md    # Relatório do teste de estresse de ponta a ponta
├── troubleshooting.md       # Diagnóstico de problemas e rollback
├── agents/                  # Especificação dos agentes especializados
│   ├── planner.md           # Agente Planner (Architect)
│   ├── coder.md             # Agente Coder
│   ├── tester.md            # Agente Tester
│   └── reviewer.md          # Agente Reviewer
└── workflows/               # Schemas de definição de pipeline
    ├── basic-dev-pipeline.json
    └── basic-dev-pipeline.yaml
```
