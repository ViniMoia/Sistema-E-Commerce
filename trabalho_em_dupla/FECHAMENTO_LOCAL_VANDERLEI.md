# Continuação das tarefas do Vanderlei — 13/10/2026

Trabalho centralizado em `Sistema-E-Commerce`, branch `homologacao_teste`, sobre
`a6ab64293ca78b9fa378af9c19cf5eec4028bbf0`. Este registro complementa a rodada
histórica em `d66a416`; não transfere seus resultados automaticamente ao candidato.

## Implementações desta continuação

- A seleção auditada passou a incluir `inventory-admin-browser` junto de
  `inventory-admin-integrity`. O CI usa `--homologation`, compartilhando a seleção
  com os runtimes otimizados; os testes de seleção recusam flags e caminhos externos.
- A seleção explícita de navegador agora falha quando `BROWSER_BIN` é inválido,
  sem substituir silenciosamente o navegador solicitado. As medições de prontidão
  registram executável, versão e user-agent para identificar a matriz realmente usada.
- O workflow executa os 15 testes operacionais, preserva o log da integração e
  mantém as provas negativas, migrations, builds, standalone, capacidade e Linux.
- O parecer e o guia de operação reconhecem a atualização de 13/10 que exige
  boleto e débito. Não há ativação financeira remota ou capacidade de débito inventada.
- A regressão revelou que `HomeClient` ainda animava toda a home a partir de
  opacidade zero. Essa animação foi removida; o teste sem JavaScript exige título
  visível e ancestrais com opacidade plena, sem esperar um efeito visual terminar.
- O PostgreSQL descartável agora fornece URLs com `connection_limit=4`. A primeira
  suíte completa em `next dev` esgotou conexões com o pool padrão proporcional às
  CPUs. O limite é exclusivo do harness; não aumenta `max_connections` nem modifica
  banco remoto. A identidade/sentinela continua sendo exigida antes de qualquer escrita.
- O limite do pool sozinho não encerrou o esgotamento na suíte longa: Next dev
  continuava criando clientes a cada recompilação porque o isolamento desabilitava
  todo reuso. `lib/prisma.ts` agora reutiliza o cliente exclusivamente no servidor
  de desenvolvimento isolado, pela URL exata já validada. Outra URL exige reinício,
  e fixtures/workers continuam independentes. Quatro testes verificam reuso,
  rejeição de outra execução/URL remota e separação dos processos de fixtures.
- A passagem do carrinho para o checkout passa a usar navegação de documento,
  recuperando carrinho e sessão persistidos no destino. Foram reproduzidos casos
  em Chrome e Edge nos quais a requisição de navegação cliente ocorria, mas o usuário
  permanecia no detalhe do produto durante atualizações da home. A mudança evita
  depender dessa transição RSC; não altera a submissão financeira. O teste agora
  provoca foco/revalidação junto do clique e verifica checkout utilizável.

O código de estoque recebido em `a6ab642` foi preservado. Não foram modificados
checkout no servidor, carteira, serviços de pagamento/Asaas, schema ou migrations.

## Reproduzir a validação

Usar Node 22.23.3 e Docker Linux operacional. Os provisionadores fornecem bancos
descartáveis, sentinelas e configuração sintética; não carregar `env.example`.

```powershell
npm test
npm run test:operations
npx tsc --noEmit
npm run lint
npm run test:isolation:negative
npm run test:migrations:isolated
npm run test:integration:isolated -- --homologation
npm run test:production:isolated
# Outra sessão/processo para a matriz Edge:
$env:BROWSER_BIN = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
npm run test:standalone:isolated
# Chrome para a medição de capacidade; executar sem builds concorrentes:
$env:BROWSER_BIN = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run test:capacity:isolated
docker build --build-arg RELEASE_SHA=<identidade-do-candidato> -t continental-vanderlei:candidate .
npm run test:container:isolated -- continental-vanderlei:candidate
```

Os testes de navegador usam perfis descartáveis. Mobile significa viewport emulado;
Chrome e Edge compartilham Chromium. Esta matriz não certifica Safari, Firefox,
iPhone/Android físico ou redes reais. As metas de prontidão são medidas sem vídeo
externo, em loopback, com cache de navegador frio e quente. Não são cold start do
Google Cloud nem capacidade do Neon/Asaas. Os perfis de carga são limitados a
30/80 usuários HTTP e 2/5 checkouts manuais por minuto, com provedores controlados.

## Dependências concretas para liberar produção

| Pendência | Responsável / entrada necessária | Prova que falta |
|---|---|---|
| Destino Cloud Run | Vanderlei; projeto, número, região, domínio e canais de alerta confirmados | IAM, billing, secrets versionados, DNS/TLS e revisão implantada |
| Cadência e custo | Vanderlei + Leno; prazos e limites aprovados | Consumo Neon, pool/locks, backlog, sobreposição, alerta entregue |
| Frete | Vanderlei; transportadora/contrato, origem e catálogo aprovados | Cotação externa, cobertura, expiração, indisponibilidade e expedição |
| E-mail e Storage | Vanderlei; domínios e recursos separados de homologação | Reset, entrega real, cookies/proxy, permissões e uploads |
| Boleto | Leno; configuração/conta Sandbox e roteiro financeiro | Liquidação/expiração/devolução, efeitos de estoque/pontos/outbox |
| Débito | Leno; suporte e contrato do provedor/conta | Implementação ponta a ponta, recuperação e só então UI de Vanderlei |
| Dados e financeiro | Leno | Aceite de PIX/crédito até 12x, estorno, legados, backup/restore e contenção |
| Publicação do candidato | Vanderlei, após revisão local e gates | SHA remoto/CI, digest publicado, configuração aplicada e observação |

O projeto previamente selecionado no `gcloud` não foi assumido como destino desta
loja. Nenhum recurso foi provisionado, agendamento ativado ou operação financeira
externa executada. O procedimento V-09 está em `infra/cloudrun/README.md`.

### Reprodução da pendência de débito para Leno

Inspecionar `types/payment-gateway.types.ts`, `lib/commerce/contracts.ts` e
`services/asaas/asaas.adapter.ts`: a união e o adapter não oferecem método de débito.
A presença de `CREDIT_CARD` não comprova suporte a débito. O aceite exige contrato
do provedor, capacidade da loja, intenção/plano, submissão, estados/webhook,
reconciliação, devolução e efeitos duráveis; Vanderlei integra a apresentação após
receber esse contrato. Não alterar enum/schema ou aceitar um valor livre no cliente
como solução. A seção 17 do replanejamento versionado é a referência do requisito.

## Resultados desta rodada

Evidência estruturada: [candidato-local.json](evidencias/candidato-local.json).
Logs completos, inclusive tentativas anteriores: [artefatos locais](../artifacts/validation/vanderlei-f029d6257017/).
Os logs são ignorados pelo Git; o JSON conserva resultados, amostras e hashes.

| Verificação | Resultado final |
|---|---|
| Unitários | 719 aprovados, 84 arquivos |
| Operação e harness | 15 aprovados |
| TypeScript | Aprovado |
| Lint | Zero erros, 18 avisos |
| Isolamento negativo | 2 provas; sentinela ausente/divergente recusada antes de escrita |
| Migrations existentes | Reconstrução, replay, legado e retomada aprovados em PostgreSQL 16 descartável |
| Integração em desenvolvimento | 338 aprovados, 28 suítes; esgotamento de conexões corrigido |
| Build otimizado / Chrome | 347 aprovados, 30 suítes |
| Standalone realocado / Edge | 347 aprovados, 30 suítes |
| Capacidade e invariantes | 11 aprovados, 3 suítes |
| Imagem Linux | Duas instâncias UID 1000, assets, cron, reinício e consumidor aprovados |

Os totais se sobrepõem; não representam testes distintos somáveis. As tentativas
com falhas permanecem nos diagnósticos. O standalone anterior com 347 testes
aprovados e mudança de inputs foi recusado pelo harness; a rodada final foi
executada novamente com inputs estáveis.

### Identidade do candidato local

- Base Git: a6ab64293ca78b9fa378af9c19cf5eec4028bbf0.
- Manifesto de 39 arquivos alterados: f029d625701708cca84b3a0b6a7da2da9ecce12494999a0f7d7fe13ed59890dd.
- Fontes da aplicação: 41a7e66aacc8c9b24156f4a5221c9e05df2c9a7c30f1111255e4950850fb863b.
- Scripts e testes também têm hashes iguais entre build otimizado, standalone e capacidade.
- Imagem local continental-vanderlei:candidate: sha256:4903b948363c20de794c9d8c48b6844349fc8e5d35fa83b6be2bd06dc89646e0.
- Pacote standalone: 1dfa82e78192e8a1434984057cde5c042c4a9ebd245459243c7e2637ccc2eeff (2445 arquivos).

O manifesto identifica as alterações locais sobre a base. Ainda não há novo commit
ou publicação. O CI foi configurado, mas não executado no GitHub. Revisão imutável
remota, configuração e aceite externo continuam pendentes; não promover tag mutável
nem reutilizar aprovação para outro digest/configuração.

### Prontidão da interface

Valores em ms: primeira amostra com cache de navegador frio / p95 das quatro quentes.
Chrome 155.0.8059.40 e Edge 155.0.4283.45; desktop e mobile emulado.

| Fluxo | Chrome desktop | Chrome mobile | Edge desktop | Edge mobile |
|---|---:|---:|---:|---:|
| Home | 356 / 95 | 425 / 179 | 349 / 169 | 358 / 110 |
| Produto | 18 / 37 | 12 / 47 | 39 / 30 | 24 / 54 |
| Carrinho | 146 / 138 | 176 / 131 | 158 / 147 | 155 / 146 |
| Checkout | 336 / 270 | 321 / 193 | 309 / 435 | 321 / 227 |

Todos os cenários ficaram abaixo de 5 s na primeira amostra e 3 s no p95 quente.
O maior p95 foi aproximadamente 435 ms. O checkout inclui navegação de documento
e revalidação por foco junto do clique. É um piloto local, com mídia remota bloqueada;
não certifica dispositivo físico, rede pública ou cold start do Google Cloud.

### Piloto de carga

| Usuários / checkouts por minuto | Requisições / falhas | Home p95 | Produto p95 | Carrinho p95 | Checkout UI p95 |
|---|---:|---:|---:|---:|---:|
| 30 / 2 | 736 / 0 | 150 | 317 | 129 | 177 |
| 80 / 5 | 1960 / 0 | 152 | 317 | 128 | 190 |

Cada perfil durou 120 s, com quatro/dez compras manuais, replay entre instâncias e
conferência de pedidos, reservas, estoque e outbox. Dois runtimes otimizados,
PostgreSQL 16, Node 22.23.3, Windows x64, 12 CPUs lógicas e 32 GB de RAM; cerca de
4,3 GB disponíveis no início. Nenhuma outra suíte/build deste trabalho estava ativa.
Os tempos medem ações prontas, com mídia remota bloqueada e um navegador desktop
junto aos usuários HTTP. Não equivalem a 80 navegadores completos ou pagamentos no Asaas.

### Encerramento e limites

Nenhum contêiner com label logic-audit.run-id permaneceu. O ecommerce-postgres
preexistente foi preservado e continuou saudável. Docker 29.8.2 permanece operacional
em desktop-linux. A imagem candidata foi mantida para inspeção. O arquivo privado
env.example foi preservado, ignorado pelo Git e não carregado.

Nenhum gate externo foi aprovado. Permanecem as entradas e responsabilidades da
tabela anterior: destino cloud/domínio/transportadora, homologação de integrações,
financeiro/dados/débito de Leno, publicação/CI remota, capacidade final e implantação.

O lint aponta um aviso adicional pelo uso intencional de navegação de documento
na entrada do checkout. A preferência geral do framework é navegação cliente;
esta fronteira usa recarga para resolver a falha reproduzida acima, com recuperação
da identidade/carrinho no servidor e verificação dos tempos de prontidão. A regra
não foi desabilitada globalmente.
