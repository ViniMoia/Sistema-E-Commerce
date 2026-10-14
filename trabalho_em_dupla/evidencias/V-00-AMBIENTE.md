# V-00 — ambiente local do Vanderlei

Registro histórico da rodada inicial. Posteriormente o trabalho foi centralizado
em `Sistema-E-Commerce`, branch `homologacao_teste` em `a6ab642`; o worktree e a
branch temporários abaixo foram removidos. Ver relatório consolidado e `centralizacao.json`.

Responsável: Vanderlei. Revisor: Leno. Data: 13/10/2026.
Base: `d66a416`, branch `trabalho/vanderlei/preparacao-producao`.
Estado: ambiente local validado; integração/revisão pendentes.

## Diagnóstico e ações

Na inspeção anterior Docker Desktop estava parado. No início da execução ele já
estava ativo: Docker Engine 29.8.2, Linux x86_64, 12 CPUs e aproximadamente 16 GB
disponíveis à VM. Não foi necessário reinstalar Docker, WSL ou reiniciar Windows.
Compose 5.6.0 e Buildx 0.37.2 responderam. O teste `hello-world` baixou e executou
a imagem. O contêiner preexistente `ecommerce-postgres` foi preservado.

Criado worktree irmão `Sistema-E-Commerce-vanderlei`; a pasta original continua na
`main`, sem alterações desta execução. Node 22.23.3 foi instalado como distribuição
portátil oficial em `%LOCALAPPDATA%/ContinentalDevTools/node-v22.23.3-win-x64`, após
verificação SHA-256 contra o manifesto oficial. Node 24 global foi preservado.
Dependências instaladas por `npm ci`; Prisma Client gerado com Node 22. Nenhum `.env`
privado foi lido ou criado e nenhuma conexão Neon foi utilizada.

Para repetir os comandos nesta máquina, dentro do worktree:

```powershell
$env:Path = "$env:LOCALAPPDATA/ContinentalDevTools/node-v22.23.3-win-x64;" + $env:Path
node --version
npm run test:isolation:negative
```

Em outra máquina, usar a versão de `.nvmrc`, instalar pelo lockfile e gerar Prisma.
Não substituir os wrappers isolados por integração direta contra banco persistente.

## Evidências

- PostgreSQL 16.15 descartável iniciou com porta aleatória somente em localhost,
  respondeu `SELECT version()` e confirmou sentinela do run
  `103811270426230f671db05641ee0295`. Descarte realizado pelo provisionador.
- Provas negativas `missing` e `mismatched`: ambas passaram, com zero lojas e
  operações de fixture/limpeza bloqueadas antes da mutação.
- Base antes das correções: 695 testes unitários em 81 arquivos aprovados.
- Imagem Linux standalone construída pelo Dockerfile novo; runtime e consumidor
  são verificados por `npm run test:container:isolated -- continental-vanderlei:candidate`.
  O relatório final registra o digest da imagem e o run correspondente.

Os testes aplicam apenas migrations já presentes na entrega do Leno, exclusivamente
em bancos descartáveis. Nenhuma alteração de schema/migration integra esta frente.

## Limites

Docker operacional local não comprova acesso/billing/IAM, Neon, DNS, Resend ou
Google Cloud. Downloads de ferramentas e imagens não ativaram integrações comerciais.
O descarte é limitado por labels/runId; não houve limpeza global de imagens/volumes.
