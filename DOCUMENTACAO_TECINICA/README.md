# DOCUMENTAÇÃO TÉCNICA E GUIA DE AUDITORIA — CONTINENTAL

Este diretório contém a documentação técnica oficial e estruturada do projeto, elaborada para guiar o segundo desenvolvedor e seu agente autônomo (**Codex**) durante as auditorias de código, testes de segurança e homologação funcional.

---

## Estrutura de Documentos

1. [DOCUMENTACAO_TECNICA_SISTEMA.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/DOCUMENTACAO_TECINICA/DOCUMENTACAO_TECNICA_SISTEMA.md)
   * **Visão Geral & Arquitetura**: Visão completa do projeto, stack tecnológico, dependências e arquitetura de componentes.
   * **Topologia do Código**: Mapeamento detalhado de diretórios, módulos e serviços.
   * **Modelo de Dados Relacional**: Tabelas do Prisma, chaves primárias, índices e relacionamentos.
   * **Multi-Tenancy**: Resolução de domínios, isolamento de dados e regras de tenant.
   * **Módulos de Domínio**: Checkout, Asaas (PIX, Cartão, Boleto), Fidelidade, Frete e Catálogo de Produtos.
   * **Bootstrap local**: o procedimento exige variáveis de ambiente efêmeras; credenciais não são documentadas nem versionadas.

2. [GUIA_AUDITORIA_E_VULNERABILIDADES_CODEX.md](file:///c:/Diversos/TI/Trabalhos/2026/Sistemas/Projeto/DOCUMENTACAO_TECINICA/GUIA_AUDITORIA_E_VULNERABILIDADES_CODEX.md)
   * **Instruções para o Codex**: Diretrizes de execução, comandos de teste e checagem de tipos estáticos.
   * **Matriz de Auditoria de Vulnerabilidades**: Hotspots críticos (BOLA/IDOR, concorrência de estoque, precisão decimal, segurança de webhooks, proteção de PII e DoS).
   * **Pendências & Débitos Técnicos Mapeados**: Itens sob atenção (como a trava de chave estrangeira em exclusão de produtos com histórico de vendas).
   * **Checklist Executivo**: Roteiro de verificação passo a passo.

---

## Comandos Rápidos de Validação

```bash
# 1. Checagem estática de tipos TypeScript (deve retornar 0 erros)
npx tsc --noEmit

# 2. Execução da suíte de testes unitários
npm run test:unit

# 3. Inicialização do servidor em modo de desenvolvimento
npm run dev
```

## Bootstrap administrativo local

O script `scripts/create_test_admin.ts` é bloqueado em produção, não contém valores padrão e nunca altera uma conta existente. A execução local exige confirmação explícita e as variáveis `BOOTSTRAP_LOJA_ID`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`. Não registre esses valores em arquivos, histórico de shell ou logs.
