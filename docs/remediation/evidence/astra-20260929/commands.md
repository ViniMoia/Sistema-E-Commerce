# Execução local de 29/09/2026

Este registro descreve os comandos inspecionados e executados. Não é autorização para executar os mesmos comandos contra a configuração normal da aplicação. Os arquivos `harness/*.txt` são cópias de evidência dos scripts temporários; não são um runner portátil ou um novo gate de CI.

## Isolamento usado

- Node oficial 22.22.1 com SHA-256 conferido, npm 10.9.4, instalados apenas em `.tmp/remediation-astra-runtime/node-v22.22.1-win-x64/`.
- Container próprio `codex-astra-remediation-20260929`, PostgreSQL 16, label `codex.task=astra-remediation-20260929`, `--rm`, armazenamento `--tmpfs /var/lib/postgresql/data:rw`, nenhum mount/volume e bind `127.0.0.1:55439:5432`. O container/banco da aplicação não foi usado.
- Os launchers forneceram allowlist de variáveis do sistema operacional e valores fictícios. `fake-env.cjs.txt` documenta os valores. O Prisma CLI registrou carregamento de `.env`, mas as URLs de banco já estavam explicitamente sobrescritas com o destino descartável; nenhuma integração configurada foi chamada. Todas as senhas/chaves nesses artefatos são **fictional fixtures**.
- Guardas bloquearam HTTP/HTTPS/fetch externos. O build foi executado em cópia de arquivos de código sem `.env`, com `SKIP_RUNTIME_ENV_VALIDATION=build-only`; o servidor recebeu configuração fictícia completa e validada. O guard do runtime permite loopback e bloqueia inclusive as portas 5432/5433.
- O browser usou perfil próprio, bloqueio de URLs externas e CDP em 127.0.0.1:9229; servidor de teste em 127.0.0.1:3209, tenant fictício resolvido por Host localhost. Chamadas de gateway/Resend foram interceptadas em memória antes de qualquer socket externo.

## Comandos dos gates

Executados através do launcher isolado, usando o Node temporário acima:

```text
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --max-warnings=16
node scripts/check-env-contract.mjs
node scripts/scan-secrets.mjs
node node_modules/vitest/vitest.mjs run tests/unit
node node_modules/vitest/vitest.mjs run tests/integration --hookTimeout 120000
```

O `isolated-launcher.cjs.txt` contém o launcher dos gates sem HTTP. Substituir `REPLACE_ARGS` por um array JSON dos argumentos do comando inspecionado, omitindo o primeiro `node`. Para integrações que usam o servidor, foi usado `integration-runner.cjs.txt`, com TEST_BASE_URL loopback explícita. Não rodar o conjunto HTTP contra a aplicação normal.

No PostgreSQL descartável, Prisma aplicou as migrations e comparou o resultado com `prisma/schema.prisma`. A sequência começou do zero, aplicou as 28 migrations existentes e, após a correção, a 29ª. O diff final foi vazio. A suite `commerce-child-ownership` verificou os triggers que o diff Prisma não modela. Uma segunda base descartável recebeu as 28 migrations históricas, um CartItem inconsistente fictício e a nova migration: o preflight abortou sem apagar a linha ou deixar novos triggers. Resultado em `migration-probe.txt`.

O build usou `node node_modules/next/dist/bin/next build --webpack` com cwd na cópia isolada. A preparação está em `build-runner.cjs.txt`; o servidor usou `next start --hostname 127.0.0.1 --port 3209`. Isso não executou `npm run dev`, seed da aplicação, sandbox financeiro, deploy ou migration no banco configurado.

O core do CI passa a incluir as suites `payment-reconciliation-postgres` e `commerce-child-ownership` via `package.json:test:integration:core`. As 68 integrações finais incluem 34 casos core, 26 HTTP e 8 de performance; não somar esses números novamente.

## Browser e encerramento

Os scripts CDP arquivados mostram o cliente e a jornada final de recuperação. Fixtures de usuário, sessão, loja, produto e estoque foram criadas somente no banco descartável. O checkout fake gerou dois pedidos distintos e dois pagamentos fictícios; tentativa offline não gerou duplicidade. Screenshots e JSON de pós-condições estão neste diretório. O cenário depende do bootstrap temporário e não é um teste browser pronto para CI.

O teste de SIGTERM reutilizou a imagem Linux local `codex-remediation12-ecommerce:local`, Node22/Next16.3.5, com `--network none`, build atual e runtime JS montados somente leitura. Uma requisição health foi atrasada artificialmente em 1,8s; SIGTERM foi enviado após 200ms. Ela terminou HTTP200, o processo saiu com143 e a conexão seguinte foi recusada. Resultado em `drain-result.txt`; scripts em `harness/drain.mjs.txt` e `harness/drain-runner.cjs.txt`. Não certifica imagem de release ou chamada financeira em andamento.

## Limitações explícitas

- Não houve sandbox financeiro, entrega externa, upload, análise online de dependências, deploy, backup/restore ou acesso à base da aplicação.
- Estatísticas ANALYZE pertencem ao setup de performance descartável. Tempos locais não são SLO de produção.
- Zoom foi aproximado por largura equivalente; não houve certificação WCAG, leitor de tela ou Safari/Firefox.
- O scanner detecta padrões conhecidos; passar não comprova ausência absoluta de segredos nem revogação histórica.
- Os arquivos `.txt` preservam o ensaio e precisam ser revisados/reconstituídos para reprodução. A automação portátil do browser permanece pendente.
