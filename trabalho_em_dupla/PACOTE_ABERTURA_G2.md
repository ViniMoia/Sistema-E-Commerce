# G2 — Pacote de abertura do banco existente

## Backup fresco e ensaio de abertura — 21/10/2026

**Restauração e abertura local aprovadas; G2 permanece aberto.** [Evidência sanitizada](evidencias/L-G2-BACKUP-ENSAIO-2026-10-21.json). Candidata de runtime `9495ff9`; checkout documental `f2a55eb`. A origem foi identificada antes da captura e acessada somente leitura; `.env` foi selecionado explicitamente para não herdar o outro destino de `.env.local`.

- Captura/validação entre **12:12:30 e 12:13:20 BRT**; backup consistente do schema `public`, AES-256-GCM, chave DPAPI e ACL restrita, fora do repositório. Hash do dump: `e48959c523715bc217946d1bbec37275df50681eab0a1e43a19de7e5798a173a`. Localizador: `%LOCALAPPDATA%/logic-audit-backups/b0072bdd3f7e2302fea9dd8e49f91d6d`. Essa janela inclui restore/upgrade; o instante exato do snapshot do dump não foi registrado separadamente.
- Dois restores equivalentes do backup persistido; restore sanitizado, histórico/checksums, constraints, dados e sequências preservados. Quinze migrations pendentes aplicadas **somente nos clones**; diff vazio e segunda aplicação sem alteração de dados.
- Ensaio de abertura entre **12:13:35 e 12:15:24 BRT**, sem reconexão à origem: quatro produtos/dez variantes retirados, cinco produtos comerciais protegidos e 518 produtos ativos no clone. Estoques numéricos não foram reconciliados nem produtos excluídos.
- Duas carteiras abertas com baixa auditada dos 475 pontos de teste, dois ajustes/duas auditorias, movimentos e 24 pedidos históricos preservados. Replay sem duplicar ajustes. Isso não altera nem autoriza baixa nos saldos do banco de origem.
- Nove verificações HTTP passaram, incluindo catálogo, pedidos, carteiras e recusas de acesso. Três testes de abertura/compra passaram: 20 comandos legados recusados e uma compra controlada local; sem chamadas Asaas. Cinco testes das proteções do executor passaram. Clone descartado e ausência conferida.

**Classificação dos pedidos no backup novo:** ainda não reensaiada. O classificador exige o hash aprovado do snapshot de 15/10; a proteção foi preservada. Revisar o manifesto e a impressão integral dos pedidos do backup novo antes de habilitar essa fase. A prova anterior continua identificada como histórica, não como execução no snapshot de 21/10.

**Recuperação independente:** o usuário confirmou que será o operador alternativo. A execução acima ocorreu pela conta Windows atual e não demonstra acesso independente. Próxima prova: o usuário obtém o backup e a chave pelo mecanismo aprovado, em conta/ambiente cuja independência seja verificada, restaura em destino novo isolado e confere integridade. Não copiar `key.dpapi` supondo portabilidade. Ainda faltam definir/comprovar acesso independente, cópia fora desta máquina, retenção e RPO/RTO; tempos locais não são RPO/RTO aprovados.

**Condições restantes de G2:** recuperação pelo operador alternativo; revisão do manifesto do snapshot fresco; obrigações das duas referências remotas e estoque comercial físico; backup/cutoff da janela final, contenção dos escritores, executor específico e comparação antes/depois no destino autorizado. Nenhuma migration, classificação, alteração de estoque/pontos ou abertura foi aplicada à origem/homologação compartilhada. Evidências e pendências do inventário abaixo conservam seu horário de coleta.

## Inventário atualizado — 21/10/2026

Leitura da origem às **12:05:26 BRT / 15:05:26 UTC**, com identidade da loja conferida e transação `REPEATABLE READ / READ ONLY` verificada. Fonte de conexão: `.env`; `.env.local` já aponta para outro destino e não foi usado na auditoria. Nenhuma credencial é registrada. [Evidência sanitizada](evidencias/L-G2-INVENTARIO-ORIGEM-2026-10-21.json). Código de origem `7f9b26e`, candidata integrada `9495ff9`.

| Item | Observação atual | Pendência de abertura |
|---|---|---|
| Catálogo | 522 produtos, 528 variantes, 18 marcas e 10 categorias; contagens coincidem com 15/10. | Conferir estoque comercial físico e identidade dos itens; contagens iguais não comprovam linhas inalteradas. |
| Quatro produtos de teste | IDs previstos encontrados, dez variantes; divergências de estoque preservadas: aspirador vermelho 1/10, calça 13/30, camisa branca 16/30, camisa preta 8/30. Cinco produtos protegidos encontrados. | Retirada não comprovada na origem. Valor nulo nesta coleta não distingue coluna ausente de campo vazio, nem comprova disponibilidade na aplicação. Conferir identificação/imagem e vínculos no cutoff antes da ação autorizada. |
| Pedidos | 24 pedidos, 33 itens, todos sem histórico de status; 33 itens sem vínculo de variante. Dez pendentes, quatro pagos e dez cancelados. Duas referências de pagamento remoto. | Separar classificação de teste de obrigações reais. Consultar privadamente as duas referências no provedor antes da abertura; rótulo legado do meio não prova estado financeiro. Nenhuma consulta do provedor nesta rodada. |
| Carteiras | Duas, com saldos 0 e 475; dois movimentos; pending=0. Campos modernos de dívida/accountingReady ausentes no schema de origem. | Não interpretar campo ausente como dívida zero ou carteira conciliada. Validar ledger e classificação antes de ajuste; não reutilizar números históricos como autorização. |
| Estrutura | 40 registros de migrations, 20 nomes distintos repetidos, todos concluídos e com checksums compatíveis. Quinze migrations da candidata ainda não constam aplicadas. Tabelas modernas de operações/fatos/reservas/lotes ausentes; quatro eventos na tabela legada de webhook. | Novo backup e ensaio da cadeia atual em clone. Duplicações no histórico já existiam no inventário antigo; não remover registros. Não aplicar somente a migration de boleto na origem antiga. |

As contagens e divergências agregadas coincidem com o inventário anterior, mas não foi demonstrada igualdade integral entre as linhas antigas e atuais. Foram guardadas impressões para comparação futura; esta leitura não substitui backup ou captura no cutoff. O schema legado não permite inferir ausência de obrigações pela ausência de filas modernas. Os estados dos pedidos são locais, sem confirmação financeira nova.

**Próxima ação G2:** preparar backup fresco e ensaio da cadeia atual em clone isolado, junto da conferência privada das obrigações e da prova de recuperação por operador alternativo. A abertura exige comparação antes/depois, responsável e janela definidos. Main/banco de origem não receberam migrations, classificação, ajustes de estoque/pontos ou qualquer outra mutação nesta rodada. Nenhum teste de recuperação foi repetido agora e G2 permanece aberto. As seções abaixo conservam os detalhes dos ensaios históricos.

Revisão de 16/10/2026. Complementa o [checklist G1–G8](CHECKLIST_PRODUCAO_G1_G8.md), o [procedimento de implantação](../diversos/AUDITORIAS/operations/operations/DEPLOYMENT-RUNBOOK.md) e o [procedimento de recuperação](../diversos/AUDITORIAS/operations/operations/BACKUP-RESTORE-RUNBOOK.md). **Preparação e ensaio em clone; abertura produtiva não executada.**

## Identidades e limites

| Referência | Identidade / uso |
|---|---|
| Código de origem consultado | `origin/main` `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, somente leitura. |
| Código candidato revisado | `55a300313570f2a504a8f042ba7f228cd7382e58`, CI aprovada; publicação dessa candidata pendente. |
| Banco de abertura | Banco existente indicado pelo operador, ligado à main. Identidade/configuração atuais devem ser conferidas no cutoff; não substituir pela conexão de homologação. |
| Snapshot usado nos ensaios | Origem capturada em 15/10/2026 às 18:43:55.572 UTC. Backup restaurável SHA-256 `51f0d8d7f80fb9910114928450753e46cfd86ac571e9acdd711d745fda1a65f9`. Não representa estado atual nem RPO da futura implantação. |
| Loja desse snapshot | `536bfa58-0531-49e8-9209-3a046281e516`. Os IDs abaixo pertencem a essa origem. |
| Loja de homologação | `3a82b33c-3646-4272-9a89-80bb1ba327a5`. Possui pedidos financeiros #1–#8 e identidades próprias; não aplicar a seleção da origem nela. |
| Cloud Run conhecido | Homologação: projeto `continental-511812`, região `southamerica-east1`. Não comprova identificação/configuração do futuro serviço produtivo. |

Não foi acessado banco remoto nesta revisão. Os scripts revisados exigem clone local descartável e identidade de execução. Não remover essas proteções, trocar suas URLs nem reutilizá-los como executores genéricos de produção.

**Novo ensaio aprovado na candidata atual:** de **19:33:33 a 19:35:07 BRT em 16/10**, run `b90a3a5a7c3960def95338ec1a97d716`. Reutilizado o backup criptografado, sem reconectar à origem; dois restores equivalentes, sanitização/restore do clone, histórico de migrations e upgrade aprovados, dados/sequências preservados e diff vazio. Retirada de quatro produtos/dez variantes, abertura de duas carteiras e classificação de 24 pedidos aprovadas; replay de carteiras e classificação sem duplicação. Nove verificações HTTP, três testes de relatórios no clone e cinco testes de proteção do executor passaram. Contêiner principal do ensaio removido e ausência conferida. [Evidência sanitizada e hashes do código](evidencias/L-G2-REVISAO-ABERTURA-2026-10-16.json).

Este novo ensaio cobre o dashboard e a API de fidelidade atuais sobre o histórico restaurado/classificado. Os 20 comandos de legado e a compra nova completa do ensaio de abertura anterior continuam evidência separada; não foram contados como nova execução nessa rodada. Duração de aproximadamente 94 segundos mede apenas este ensaio local, sem representar RTO produtivo.

## 1. Produtos e estoque: seleção exata

A decisão do operador já está registrada: indisponibilizar os quatro produtos de teste, preservando histórico. A imagem e os vínculos identificam o aspirador vermelho, mesmo que seu nome na origem seja apenas “Aspirador de Pó”.

| Produto no snapshot de origem | ID | Variantes | Estoque do produto / soma das variantes observados |
|---|---|---:|---:|
| Aspirador de Pó — automotivo vermelho | `6a6e98eb-98c3-4ba2-aede-a357d43893cf` | 1 | 1 / 10 |
| Calça Jeans | `622731a7-0158-486c-9626-0a739b3ddb91` | 3 | 13 / 30 |
| Camisa Branca | `6178ba96-b383-4e50-be1d-93a506912011` | 3 | 16 / 30 |
| Camisa Preta | `fdd4cc6a-c8e4-4a58-b45c-04a6d5c07e13` | 3 | 8 / 30 |

**Tratamento ensaiado:** definir `retiredAt` no produto e nas variantes, incrementando versões correspondentes. Não zerar/recalcular estoque nem excluir registros. A divergência numérica de estoque desses testes permanece preservada e não é apresentada como saldo disponível para venda.

**Critério de conferência:** somente esses quatro produtos/dez variantes ficam indisponíveis; os demais preços, estoques, IDs, vínculos e históricos permanecem iguais ao baseline. O clone passou de 522 para 518 produtos ativos; essa contagem é histórica e deve ser recalculada se o inventário mudar.

Proteção explícita dos três aspiradores comerciais e dois acessórios, como conjunto:

```text
c6b3097f-6174-44f1-86c9-e06aba7c9733
0486f861-4e39-426a-81ce-8b39f60a177f
5e86739a-6114-4df1-a15a-df88b7a349c3
7fd834af-d2be-4ea5-8d30-9790bd48a79e
bc076f2d-740c-45f3-84c5-9d0fb8657d84
```

Fontes: [identidade e ensaio dos produtos](evidencias/L-BANCO-PRODUTOS-TESTE-2026-10-15.json), [auditoria de estoque e vínculos](evidencias/L-BANCO-TRATAMENTO-2026-10-15.json), `scripts/lib/restored-test-products.mjs`.

**Pendente para abertura:** revalidar essas identidades, imagens, variantes e vínculos na fotografia atual e confirmar o saldo comercial dos produtos que continuarão disponíveis. Um saldo de banco sem divergência aritmética não comprova contagem física. Não restaurar ao estoque os itens dos pedidos legados para “corrigir” o saldo.

## 2. Pedidos históricos: preservar e classificar

O snapshot contém **24 pedidos e 33 itens**. Nos itens sem vínculo de variante: 16 não têm produto presente; 16 possuem candidato atual com dimensões e um tem candidato com dimensão histórica incompleta. Compatibilidade atual não comprova qual variante foi vendida, nem autoriza preenchimento automático ou movimentação de estoque.

O ensaio usa `OrderReportingExclusion` com motivo `USER_CLASSIFIED_TEST_DATA`, lote identificado e uma auditoria por pedido. Resultado esperado para esse snapshot: 24 classificações, 24 auditorias, zero pedidos comerciais antigos e todos os 24 pedidos ainda consultáveis no histórico. Repetir o mesmo lote não duplica registros.

O classificador exige hash do backup, quantidade e impressão dos pedidos exatos; não classifica por data, nome, ausência de intenção ou status `PAID`. Uma venda nova não classificada continua comercial. As migrations apenas criam a estrutura; não fazem essa classificação.

Fontes: [classificação e replay](evidencias/L-INDICADORES-CLASSIFICACAO-CLONE-2026-10-16.json), `scripts/lib/restored-order-reporting.mjs`, `tests/clone/restored-reporting.test.ts`.

**Pendente para abertura:** manifesto privado com IDs e impressões frescos, identificação de qualquer atividade nova, conciliação/isolamento das obrigações e executor final revisado para o destino autorizado. Classificação de relatório não neutraliza gateways, filas, saldos ou obrigações por si só. Não fabricar `FinancialFact`, intenção, reserva, vínculo histórico ou estorno para encerrar legado.

## 3. Carteiras: ajuste auditado, sem apagar movimentos

No snapshot: duas carteiras legadas, saldos **0 e 475**, dois movimentos originais, nenhum lote; `accountingReady=false`, sem pendências/dívidas ou leases de expiração. Esses valores não são saldos atuais da homologação.

O ensaio confere esse baseline dentro da transação e recusa diferenças. Registra dois ajustes administrativos identificados (inclusive o ajuste de valor zero), duas auditorias e abre as carteiras com saldo/pending/dívida/lifetime zero e `accountingReady=true`. Os dois movimentos originais permanecem. Nenhuma origem de lote ou validade é inventada; o ajuste é encerramento de dados de teste, não estorno de pedido.

**Critério de conferência:** redução de exatamente 475 pontos de teste nesse snapshot, dois ajustes, duas auditorias, preservação dos movimentos originais e replay sem duplicação. Qualquer lote, dívida, pendência, movimento moderno ou saldo novo exige revisão; não adaptar os números para forçar o ensaio a passar.

Fontes: [abertura e compra nova](evidencias/L-BANCO-ABERTURA-CLONE-2026-10-15.json), `scripts/lib/restored-opening.mjs`. A proteção de pedidos legados foi exercitada no ensaio anterior com 20 comandos recusados; o relatório comercial separado não substitui essa proteção.

**Pendente para abertura:** inventário fresco das carteiras e revisão do executor/auditoria final. A autorização para preservar e tratar testes não permite apagar eventual saldo comercial surgido depois do snapshot.

## 4. Migrations e comparação antes/depois

A cadeia deve ser derivada do histórico real do destino e dos arquivos da release; não fixar “13 migrations pendentes” a partir de um ensaio antigo. A migration `20261016193000_order_reporting_exclusion` foi aplicada à homologação por Vanderlei, mas isso não a aplica ao banco principal.

| Etapa | Antes | Resultado verificável depois |
|---|---|---|
| Migrations | Histórico/checksums, constraints, contagens, sequências e impressão dos dados; nenhuma migration falha sem investigação. | Histórico atualizado, diff vazio, constraints esperadas, dados/sequências preservados; segunda aplicação sem trabalho novo. |
| Indisponibilidade de testes | IDs, imagem do aspirador, variantes, versões, vínculos e produtos protegidos. | Alterações só nos campos previstos dos alvos; indisponibilidade na aplicação e preservação dos demais registros. |
| Carteiras | IDs privados, versão, ledger, lotes, pendências/dívidas/leases, classificação explícita. | Ajustes/auditorias identificados, conservação histórica e replay sem duplicação. |
| Classificação de pedidos | Manifesto completo dos pedidos de teste, hash, loja e ausência/isolamento de novas obrigações. | Uma classificação/auditoria por alvo; histórico acessível; nenhuma exclusão inferida para pedidos novos. |
| Leitura da aplicação | Revisão/configuração e tenant conhecidos. | Catálogo correto, históricos preservados, métricas no escopo correto, recusas de acesso indevido e recuperação de pedidos. |

Conter e drenar os escritores conforme o runbook antes de uma janela real. `CHECKOUT_PAUSED` sozinho não congela usuários, carrinho, Admin, webhook ou scripts. A sanitização feita no clone é exclusiva do ensaio: **não sanitizar o banco real nem restaurar o dump sanitizado como recuperação comercial**.

## 5. Roteiro de recuperação por operador alternativo

Esta prova ainda depende de um segundo operador. Copiar `key.dpapi` não torna a chave independente da conta Windows original. O tempo do ensaio local também não é RTO comercial.

1. Registrar operador principal/alternativo, backup escolhido, cutoff, cobertura, retenção, RPO/RTO acordados e mecanismo de acesso independente. Reutilizar recursos existentes confirmados; localização/permissões ainda não demonstradas ficam pendentes.
2. Disponibilizar o artefato criptografado e acesso à chave pelo mecanismo aprovado, fora do Git/chat. Registrar somente referências e versões. Nenhum upload para serviço novo é realizado por este pacote.
3. O operador alternativo obtém acesso, valida a integridade e restaura em banco novo, vazio e isolado, sem gateway, e-mail, consumidores ou integrações reais. Registrar início, fim e dificuldades de acesso.
4. Conferir schema, contagens/impressões, sequências, constraints, histórico de migrations e invariantes de pedidos/estoque/pontos. Cobrir separadamente roles/grants, arquivos externos e configuração, pois não estão integralmente no dump do schema `public`.
5. Registrar ponto recuperado e tempos de acesso, restauração, validação e conciliação. Comparar com RPO/RTO acordados; não declarar sucesso operacional só pelo download ou `pg_restore` concluído.
6. Documentar como conciliar eventos financeiros posteriores ao cutoff antes de qualquer promoção. Restore do banco não desfaz cobrança/estorno no provedor e não autoriza reenviá-los.

| Campo do relatório do segundo operador | Preenchimento nesta etapa |
|---|---|
| Operador alternativo e mecanismo independente usados | Pendente |
| ID/referência do backup, hash e cutoff | Escolher backup da janela; referência histórica acima é apenas ensaio |
| Destino isolado / ambiente de origem confirmado | Pendente |
| Integridade, dados, sequências e configuração | Pendente prova independente |
| Tempos e ponto recuperado / RPO / RTO | Pendente medição e aceite |
| Cobertura externa: arquivos, roles, segredos, eventos | Pendente verificação |
| Decisão e revisão | Pendente; nenhuma promoção decorrente deste roteiro |

## 6. O que ainda separa este pacote da execução produtiva

- **Leno:** baseline fresco e manifesto final por identidade, saldos comerciais e obrigações; comparação com este ensaio; revisão do tratamento final. Main/banco continuam somente leitura para o assistente.
- **Vanderlei com Leno:** recuperação independente, contenção de todos os escritores, destino/configuração da abertura e janela coordenada.
- **Executor final do tratamento:** ainda precisa ser preparado e revisado para uma execução especificamente autorizada. Os scripts atuais são de clone, com validações e auditorias próprias de ensaio; não basta trocar a conexão. Preservar releitura sob bloqueio, precondições, transação, auditoria e idempotência no procedimento final.
- **Operador responsável:** aplicar somente após essas condições, verificar antes/depois e registrar a decisão. G2 só fecha com evidências do destino; não fecha pela existência deste documento.

As decisões já tomadas sobre os quatro produtos, o banco existente e preservação de histórico não precisam ser solicitadas novamente. Lacunas reais são evidência atual, estoque comercial, execução final específica e recuperação independente.
