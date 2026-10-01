# Política de Memória Persistente do Ruflo

Este documento estabelece as diretrizes e regras operacionais para o uso da camada de memória persistente no ecossistema agentic.

---

## 1. Objetivos da Memória

* **Continuidade**: Manter o contexto de arquitetura e decisões de engenharia entre diferentes sessões e interações.
* **Consistência**: Evitar retrabalho e contradições com decisões técnicas previamente acordadas.
* **Eficiência**: Permitir que agentes especializados recuperem padrões de código e soluções de problemas conhecidos sem reprocessar todo o histórico.

---

## 2. Política Operacional (Quando Consultar e Gravar)

### A. ANTES de uma Decisão Arquitetural / Nova Funcionalidade
* **Ação**: Executar busca semântica ou por palavra-chave na memória persistente.
* **Exemplo**: `memory search -q "autenticação supabase" -t hybrid`
* **Objetivo**: Verificar se já existe um padrão estabelecido para o tema no projeto.

### B. DEPOIS de uma Decisão Arquitetural Relevante
* **Ação**: Registrar um resumo conciso da decisão tomada.
* **Exemplo**: `memory store -k "arch/supabase-auth-flow" --value "Decisão: Autenticação gerenciada via SSR cookies (@supabase/ssr) com RLS ativado no Postgres."`

### C. DEPOIS de Resolver um Bug ou Problema Difícil
* **Ação**: Registrar a causa raiz e a solução aplicada.
* **Exemplo**: `memory store -k "troubleshooting/prisma-multi-tenant-leak" --value "Solução: Forçar filtro explícito de tenantId nas queries do repositório."`

---

## 3. Padrão de Nomenclatura e Namespaces

Para manter a base de conhecimento organizada, utilizar as seguintes convenções de chaves:

| Prefixo de Chave | Finalidade | Exemplo |
| :--- | :--- | :--- |
| `arch/<tema>` | Decisões estruturais e arquiteturais do sistema | `arch/state-management` |
| `patterns/<stack>` | Padrões de implementação e convenções de código | `patterns/service-layer-error-handling` |
| `troubleshooting/<tema>` | Solução de problemas complexos ou armadilhas conhecidas | `troubleshooting/vitest-mocking-supabase` |
| `security/<regra>` | Políticas de conformidade e restrições de acesso | `security/admin-rbac-roles` |

---

## 4. O Que NUNCA Armazenar na Memória (Guardrails)

* **PROIBIDO**: Chaves de API (`API_KEY`, `SERVICE_ROLE_KEY`), tokens de sessão (JWT), senhas ou credenciais de banco.
* **PROIBIDO**: Dados pessoais identificáveis (PII - CPF, nomes de clientes, dados de cartão de crédito).
* **PROIBIDO**: Dumps completos de código ou binários (apenas resumos conceituais e snippets elucidativos).

---

## 5. Ciclo de Vida e Manutenção

* **Manutenção Preventiva**: Executar periodicamente `ruflo memory cleanup` para purgar entradas temporárias expiradas.
* **Otimização**: Utilizar `ruflo memory compress` para otimizar o índice vetorial e tamanho do banco SQLite WASM.
* **Backup**: O arquivo de banco reside em `.swarm/memory.db` e `.claude/memory.db`.
