# Guia de Resolução de Problemas (Troubleshooting) e Rollback

Este documento contém diagnósticos, soluções para problemas comuns e o procedimento de rollback da arquitetura Ruflo + Antigravity.

---

## 1. Diagnósticos Rápidos

Para verificar o estado do ecossistema, execute o comando consolidado:

```bash
npx -y ruflo@latest doctor
```

---

## 2. Problemas Comuns e Soluções

### A. O Servidor MCP não responde no Antigravity
* **Sintoma**: As ferramentas Ruflo não aparecem ou geram timeout.
* **Causa Comum**: Arquivo `mcp_config.json` corrompido ou processo em deadlock.
* **Solução**:
  1. Validar a sintaxe do JSON:
     ```powershell
     Get-Content "C:\Users\Vmoia\.gemini\config\mcp_config.json" | ConvertFrom-Json
     ```
  2. Verificar status do servidor MCP:
     ```bash
     ruflo mcp status
     ```
  3. Reiniciar o daemon do Ruflo:
     ```bash
     ruflo daemon stop
     ruflo daemon start
     ```

### B. Erro ao Acessar ou Inicializar a Memória Persistente
* **Sintoma**: `No memory.db found` ou erro ao executar `memory search`.
* **Solução**:
  1. Re-inicializar a base híbrida SQLite WASM:
     ```bash
     ruflo memory init
     ```
  2. Reconstruir o índice vetorial HNSW:
     ```bash
     ruflo memory search -q "test" --build-hnsw
     ```

### C. Swarm travado ou com alto consumo de recursos
* **Sintoma**: Comandos de swarm pendentes ou processos filhos não encerrados.
* **Solução**:
  1. Listar swarms ativos:
     ```bash
     ruflo swarm status
     ```
  2. Forçar shutdown do swarm pelo ID:
     ```bash
     ruflo swarm stop <swarm-id>
     ```

### D. Conflitos de Permissão no Windows (EPERM / Lock de Arquivo)
* **Sintoma**: Alertas de `EPERM` durante download de cache do npm/npx.
* **Solução**:
  * Limpar cache temporário do npx:
    ```powershell
    Remove-Item -Path "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Force -ErrorAction SilentlyContinue
    ```

---

## 3. Procedimento Completo de Rollback

Caso seja necessário reverter o ambiente para o estado pré-Ruflo:

### Passo 1: Restaurar a Configuração MCP
Substituir `mcp_config.json` pelo backup de segurança criado na Etapa 2:
```powershell
Copy-Item "C:\Users\Vmoia\.gemini\config\mcp_config.json.bak" "C:\Users\Vmoia\.gemini\config\mcp_config.json" -Force
```

### Passo 2: Encerrar Daemons e Processos Ruflo
```bash
ruflo daemon stop
```

### Passo 3: Limpar Artefatos Locais de Memória (Opcional)
```powershell
Remove-Item -Path ".swarm" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".claude" -Recurse -Force -ErrorAction SilentlyContinue
```
