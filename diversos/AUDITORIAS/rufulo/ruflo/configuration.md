# Configuração e Arquitetura Multi-MCP no Antigravity

Este documento estabelece o modelo de configuração do Model Context Protocol (MCP) para o Ruflo e futuros servidores integrados ao Antigravity.

---

## 1. Arquivo de Configuração Ativo

* **Localização Global**: `C:\Users\Vmoia\.gemini\config\mcp_config.json`
* **Backup de Segurança**: `C:\Users\Vmoia\.gemini\config\mcp_config.json.bak`

### Configuração Atual (Ruflo Ativo):
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

---

## 2. Modelo de Expansão para Novos Servidores MCP (Autorizados)

Quando novos MCPs forem formalmente autorizados pelo usuário, a estrutura expandida seguirá o seguinte padrão sem remover ou afetar o Ruflo:

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
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "${DATABASE_URL}"
      ]
    }
  }
}
```

---

## 3. Checklist de Validação para Novos MCPs

Antes de cadastrar qualquer novo servidor MCP:

1. [ ] **Autorização Prévia**: O usuário confirmou explicitamente a instalação do MCP?
2. [ ] **Validação de Sintaxe**: O arquivo JSON é sintaticamente válido (`ConvertFrom-Json`)?
3. [ ] **Isolamento de Secrets**: Credenciais estão em variáveis de ambiente, sem valores em texto plano no JSON?
4. [ ] **Conflito de Nomes**: O novo servidor utiliza prefixo exclusivo que não colide com as ferramentas do Ruflo?
5. [ ] **Saúde do Servidor**: O processo inicia e responde em stdio sem travar ou gerar loops de CPU?
