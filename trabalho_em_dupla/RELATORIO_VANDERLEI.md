# Implementação e auditoria local do Vanderlei

Data: 13/10/2026. Responsável: Vanderlei. Revisor previsto: Leno.
Local atual: `Sistema-E-Commerce`, branch `homologacao_teste`, acompanhando
`origin/homologacao_teste` em `a6ab642`. Alterações locais ainda sem commit/publicação.
As evidências da rodada original abaixo foram produzidas sobre `d66a416`.

**Continuação:** a nova rodada na base `a6ab642` está descrita em
[FECHAMENTO_LOCAL_VANDERLEI.md](FECHAMENTO_LOCAL_VANDERLEI.md). Os números e hashes
da rodada original neste documento permanecem históricos; consultar a continuação
para o candidato atual.

## Resultado e escopo

Docker operacional; Node 22 portátil e dependências preparadas; correções
independentes de home, segurança e frete implementadas; contratos de compra/Admin
auditados; imagem standalone e infraestrutura Cloud Run preparadas. Por solicitação
do usuário, todo o trabalho foi centralizado em `Sistema-E-Commerce`, na branch
existente `homologacao_teste`. O worktree auxiliar e a branch local temporária foram
removidos após conferência SHA-256 da transferência. O histórico da `main` foi preservado.

Esta rodada não libera produção: não provisionou cloud, não implantou serviço,
não conectou ao Neon compartilhado e não operou Asaas/Resend externos. PIX,
cartão até 12x, pontos e entrega permanecem requisitos. A seção 17 do replanejamento
de 13/10 também exige boleto e débito antes do lançamento, substituindo o adiamento
anterior de boleto; a implementação financeira de débito ainda é pendência de Leno.
Financeiro, checkout no
servidor, estoque, pontos, schema, migrations e carga comercial pertencem a Leno.
Não foram alterados nessa entrega. Os manifestos começam com capacidades externas
desligadas; isso é estado de preparação, não redução do escopo de lançamento.

## Entregas por pacote

| Pacote | Entrega nesta rodada | Limite do aceite |
|---|---|---|
| V-00 | Docker/Linux/BuildKit, PostgreSQL descartável, sentinela negativa, Node 22 e worktree | Operacional local |
| V-01 | Conteúdo SSR visível sem vídeo/JS; movimento reduzido; ação de produto por teclado; medições | Mídia real e destino final pendentes |
| V-02 | Regressão de compra, QR, carrinho, abas, identidade, reload e storage | Navegadores/dispositivos adicionais e integração externa pendentes |
| V-03 | Host estrito, fallback de tenant restrito, logs sensíveis, buckets de upload; regressão auth/reset/DTOs | E-mail/domínio/IAM/MFA/rotação externos pendentes |
| V-04 | Tarifas J&T e respostas Correios rejeitam valores impróprios; autoridade e cache entre instâncias | Contrato e cotação real da transportadora pendentes |
| V-05 | Regressão de catálogo/IDs, Admin, expedição, retirada, rastreio e métricas | Legados/volume/produtores financeiros dependem de Leno |
| V-06 | Dockerfile standalone sem root, duas instâncias Linux, reinício; configuração declarativa | Nenhum recurso Google Cloud criado |
| V-07 | Job autenticado, escopo validado, progresso/ausência/falha, Scheduler OAuth, alertas e operação documentados | Cadência/custo Neon, prazos, entrega de alerta e e-mail externos pendentes |
| V-08 | CI para homologação, regressão, hashes/artefatos e piloto de capacidade | Candidato combinado, aceite integrado e ambiente final pendentes |
| V-09 | Procedimento de implantação/contenção/recuperação preparado | Deploy e observação não iniciados |

Evidências detalhadas:

- [V-00 — ambiente](evidencias/V-00-AMBIENTE.md).
- [V-01 a V-05 — correções, provas e limites](evidencias/V-01-A-V-05.md).
- [Parecer da entrega de Leno](evidencias/V-REVISAO-LENO.md).
- [V-06/V-07/V-09 — infraestrutura e operação](../infra/cloudrun/README.md).
- [Resultados estruturados](evidencias/validacao-local.json).

## Validação

| Verificação | Resultado |
|---|---|
| Unitários finais da aplicação | 713 aprovados, 83 arquivos |
| Acionador e manifestos | 12 aprovados |
| Provas negativas de isolamento | Sentinela ausente/divergente rejeitadas antes de escrita |
| Build otimizado, duas instâncias `next start` | 317 aprovados, 27 suítes |
| Standalone realocado, fontes de build removidas, duas instâncias | 346 aprovados, 29 suítes |
| Recuperação por morte de processo, incluída no standalone | 21 aprovados; transporte externo controlado |
| TypeScript | Aprovado (`tsc --noEmit`) |
| Lint | Zero erros, 17 avisos |
| Manifestos renderizados | 15 arquivos locais com referências fictícias, sem implantação |
| Capacidade e invariantes entre instâncias | 11 aprovados, 3 suítes; ambos os perfis sem falhas |
| Revalidação final de prontidão e duas instâncias | 12 aprovados, 3 suítes; mesmo hash da aplicação |

Os totais de regressões se sobrepõem: não somá-los como testes distintos.
O standalone acrescentou as suítes existentes de recuperação/ciclo financeiro
à seleção auditada. Todos os ensaios aplicaram somente migrations existentes em
PostgreSQL descartável. Os erros de constraints deliberadamente provocados pelas
provas negativas não são falhas do resultado final.

Comandos reproduzíveis (Node de `.nvmrc`, Docker Linux):

```powershell
npm ci
npx prisma generate
npm run test:isolation:negative
npm test
npm run test:operations
npx tsc --noEmit
npm run lint
npm run test:production:isolated
npm run test:standalone:isolated
npm run test:capacity:isolated
docker build --build-arg RELEASE_SHA=<revisao> -t continental-vanderlei:candidate .
npm run test:container:isolated -- continental-vanderlei:candidate
```

A CI foi atualizada, mas não executada no GitHub nesta rodada. Os resultados acima
são execuções locais; nenhuma publicação remota é implicitamente autorizada.
O workflow inclui o piloto limitado de capacidade e guarda logs por SHA por 14 dias.
O shell Bash mantém `pipefail` ao registrar os resultados com `tee`.

O teste novo de prontidão em `next dev` apresentou duas falhas intermitentes no
handshake (resposta HTML onde se exige JSON), após compilação da home. A rodada
de diagnóstico passou, sem expor uma causa definitiva. Identificada sobreposição
possível entre casos: a prova sem JS verificava conteúdo antes de terminar a carga
e mantinha seu navegador aberto. O teste agora espera `document.readyState=complete`
nesse caso e fecha cada navegador em `afterEach`. Duas rodadas consecutivas após o
ajuste passaram nos três casos; a revalidação otimizada final passou nos 12 casos
selecionados (run `8e83153c48fe2cafba62c613d456f13c`). Nenhuma guarda foi removida
nem retry de handshake foi acrescentado.
Os cenários também passaram nos runtimes otimizados. Uma recorrência deve ser
investigada; o teste continua recusando prosseguir sem identidade válida.

## Revisão, artefato e configuração

Imagem final local `continental-vanderlei:candidate`:
`sha256:488b52e537d384565b0801feadd3ef749296fabfb4fc9238ca1177f2156e1636`.
Ensaio Linux `344e84fd893be4a0a26e3c85d0671cbd`: duas instâncias UID 1000,
mesmo Build ID `fzhVZWVr7dlnVnAXH0bUV`, banco/sentinela, home/assets, cron
anônimo recusado, reinício e consumidor autenticado aprovados. Inicialização até
prontidão completa do probe: 1.745 e 1.970 ms. Imagem já estava no cache local;
isso não mede download nem escalonamento/cold start do Google Cloud.

O código da aplicação nos ensaios otimizado e standalone possui o mesmo
`sourceSHA256`: `870e895d362a216c1a2d0c3310117db7d53419052f7be7aac3bb2c6d92ecaffb`.
O pacote standalone realocado tem SHA-256
`34b2d19e45bb3ec86b928dd758db8db4b3cda023c6b2cec5c7229dfc60895e63`,
2.445 arquivos e 74.437.495 bytes. Build ID `hK8btzGj-He9kYcUlFWuh`.

O acionador recebeu depois uma correção dirigida de observabilidade: contar
cancelamentos confirmados separadamente de candidatos de expiração/dry-run.
Os testes operacionais e a imagem Linux foram revalidados após essa correção;
ela não altera o código da aplicação, schema nem as suítes funcionais existentes.
Os hashes completos de scripts/testes de cada rodada estão na evidência JSON.
O ajuste posterior de encerramento entre casos do teste de prontidão foi revalidado
separadamente; não modificou os fontes da aplicação nem o teste de capacidade.

Como as alterações ainda não constituem um commit, `d66a416` sozinho não identifica
esta entrega. A lista de hashes dos arquivos alterados acompanha as evidências.
Manifesto de 33 arquivos da entrega (dossiê `trabalho_em_dupla/` excluído):
`632c25fb24597068790301b42e3596a697bdf4a35f1a31fb7f1e3dcd8e5c4396`.
Antes de integrar/publicar, criar revisão imutável, repetir checks exigidos na CI
e associar o digest/configuração aprovada a essa revisão. Flags e segredos distintos
do ensaio não herdam automaticamente sua aprovação.

## Prontidão e capacidade local

No standalone, cada dispositivo teve cinco amostras por fluxo. Valores abaixo em
milissegundos, primeira amostra com cache de navegador frio e p95 das quatro quentes:

| Fluxo | Desktop primeira / p95 quente | Mobile emulado primeira / p95 quente |
|---|---:|---:|
| Home | 313 / 162 | 311 / 174 |
| Detalhe de produto | 18 / 19 | 27 / 18 |
| Carrinho | 149 / 129 | 157 / 137 |
| Checkout | 109 / 108 | 109 / 111 |

Condições: Windows, Node 22.23.3, Chromium local, rede loopback sem throttling,
PostgreSQL 16 Docker; viewport desktop 1280×900 e mobile 390×844. Vídeo/mídia
externa bloqueados, poster e imagens locais. Mede texto/ações utilizáveis, não
tempo de transporte remoto ou todas as mídias reais. Metas desta rodada: primeira
amostra até 5 s; p95 quente até 3 s. A amostra de quatro valores quentes é um piloto,
não estimativa estatística de tráfego de produção.

O perfil de capacidade usa duas instâncias otimizadas, 36 produtos sintéticos,
30 e 80 usuários HTTP com intervalo de 5 s e apenas um navegador desktop real
medindo ações. Cada perfil dura 120 s, com 2 e 5 checkouts manuais/minuto,
respectivamente. Verifica idempotência entre instâncias, pedidos, reservas,
outbox e saldo de estoque após a carga. Não equivale a 80 dispositivos completos
nem a 5 compras/minuto no Asaas. Relatório estruturado preserva amostras, percentis,
atraso do gerador e limites; capacidade financeira externa continua aberta.

Resultados do run `7d11af2faf742f92e183c10d3805bcb6`, em ms:

| Usuários / checkouts por minuto | Requisições / falhas | Home p95 | Produto p95 | Carrinho p95 | Checkout UI p95 | Compra manual p95 |
|---|---:|---:|---:|---:|---:|---:|
| 30 / 2 | 736 / 0 | 129 | 313 | 125 | 165 | 730 |
| 80 / 5 | 1.960 / 0 | 152 | 312 | 127 | 164 | 347 |

Foram 45 amostras de home/produto/carrinho e 44 de checkout por perfil; quatro e
dez compras, respectivamente, com replay na outra instância. Os HTTPs auxiliares
do navegador e handshake não estão somados às 736/1.960 requisições cronometradas.
Todos os p95 de prontidão medidos ficaram abaixo de 3 s; invariantes finais passaram.

## Pendências de liberação

Permanecem abertos os gates externos de dados/financeiro de Leno; métodos PIX e
cartão/parcelamento/devolução; estoque e carteiras legadas; backup/restore/RPO/RTO;
conta/projeto/billing/IAM; domínio/TLS/cookies/proxy; transportadora; Resend/Storage;
alertas recebidos; custo/conexões/pool Neon; capacidade no Google Cloud e observação.
O parecer de Leno deve confirmar a hipótese de uma conta financeira por instalação,
o controle de contenção que preserve recepção de obrigações e os prazos do consumidor.

Não foi alterada a marcação histórica dos 38 achados nem encerrado WF-18/19/20.
O prazo original de 48 horas não foi reiniciado por esta execução local.

## Encerramento local

Os contêineres descartáveis dos ensaios foram removidos pelos respectivos
provisionadores. Na conferência final, nenhum contêiner com label
`logic-audit.run-id` permaneceu; apenas `ecommerce-postgres`, preexistente e saudável,
continuou executando. Imagens candidatas foram mantidas para inspeção/reuso.
Docker Desktop permanece operacional no contexto `desktop-linux`. Não foi mantido
servidor de teste em execução nem criado
arquivo com credenciais remotas para simular um ambiente de desenvolvimento real.

## Centralização posterior na branch existente

A branch remota foi consultada e continha `a6ab642`, atualização de inventário/Admin
posterior à base da auditoria. Seus cinco arquivos foram preservados; não havia
sobreposição com os 38 arquivos locais transferidos. Dependências e artefatos
gerados também foram movidos para a pasta principal. Só existe agora um worktree.
Nenhuma branch foi criada no GitHub e nenhum push foi executado.

O arquivo fornecido `env.example` foi preservado e incluído no `.gitignore`, pois
se destina a configuração privada. O modelo versionado continua sendo `.env.example`
(com ponto). O arquivo fornecido possui 33 definições, ainda com placeholders para
banco e várias credenciais e sem declaração explícita `PAYMENT_DEPLOYMENT_ENVIRONMENT`.
Não foi copiado automaticamente para `.env.local`: o Next.js não carrega `env.example`,
e valores de exemplo não configuram uma conexão válida. Quando os valores corretos
forem preenchidos, a configuração local usa `.env.local`, já ignorado pelo Git.
Os testes continuam com configuração sintética, sem carregar esse arquivo privado.

As métricas, a imagem e a regressão completa acima são evidências históricas da
base `d66a416`; não certificam automaticamente o novo conjunto com `a6ab642`.
A validação após centralização e o manifesto atual constam em
[centralizacao.json](evidencias/centralizacao.json): 715 unitários (83 arquivos),
12 testes operacionais, TypeScript e 6 integrações dirigidas de inventário/isolamento
aprovados. Antes de promover uma imagem
da base atual, executar novamente o build e os gates completos exigidos pela CI.
