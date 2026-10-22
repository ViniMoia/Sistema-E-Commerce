# Execução da frente operacional de Vanderlei — 21/10/2026

> Correção posterior, 22/10: o `401 restricted_api_key` de GET `/domains` não
> comprova que a chave não possa enviar. As recomendações abaixo de substituir/
> fornecer chave válida eram uma interpretação insuficiente dessa consulta e
> estão superadas. Conferir permissão de envio/remetente pelo uso necessário,
> conforme a [devolutiva atual](DEVOLUTIVA_VANDERLEI_PREPARACAO_PRODUCAO_2026-10-22.md).
> Recursos, horários e demais resultados abaixo permanecem como histórico de 21/10.

Execução por Codex, solicitada pelo operador para avançar e-mail/reset e G6.
**Preparação de infraestrutura implantada; ensaio e aceite G6 ainda pendentes.**
Consultas e alterações entre 09:34 e 09:39 BRT. A candidata continua
`continental-hml-ae9ec9c-review`, sem promoção de tráfego.

[Evidência sanitizada](evidencias/V-PREPARACAO-OPERACIONAL-2026-10-21.json).
Artefatos e baseline privado: `artifacts/vanderlei-operacional-20261021/`,
ignorados pelo Git. Nenhum valor de segredo integra a evidência versionada.

## Referências e escopo

- Base de trabalho: `homologacao_teste`, `d8cbcfbfc779e49893f4f986db17d26a1cf5908c`.
- `origin/main` local consultada somente leitura:
  `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, incluindo o plano de e-mail.
  O plano é uma orientação histórica, não comprovação de remetente configurado.
  Não houve consulta ou escrita no banco principal nem atualização dessa referência.
- Destino: projeto `continental-511812`, região `southamerica-east1`.
- Imagem do Job: mesmo digest Linux/amd64 da candidata aprovada,
  `sha256:0165e678e299c6f6fc6169ca675fa9f6f42f7bc11c5840bbf9803944759788b0`.
- Consultas de status e webhook foram somente GET. Nenhum processamento financeiro,
  reenvio, alteração de pedido, migration ou modificação de webhook foi executado.

## E-mail e recuperação de senha

A revisão continua sem bindings de `RESEND_API_KEY` e `EMAIL_FROM`.
O arquivo privado `.env.homologacao` contém chave, mas não remetente.
Consulta GET `/domains` ao Resend, às 09:34:32 BRT, retornou **401**.
Não foi cadastrado um segredo com essa chave nem enviado e-mail de teste.

Para continuar, o operador precisa disponibilizar uma chave válida e
`EMAIL_FROM` verificado no arquivo privado, além da conta/destinatário do ensaio.
A escolha de um domínio não pode ser inferida do fallback do código ou do plano da main.

Sequência restante: validar a credencial e o remetente; cadastrar versões dos
segredos; conceder leitura apenas à conta web; vincular os dois segredos em nova
revisão sem tráfego, preservando os demais bindings/flags; verificar a origem dos
links; comprovar recebimento e consumo do reset, rejeição de reutilização e login
com a nova senha. Não registrar tokens, links de reset ou senhas na evidência.
Os testes isolados aprovados abaixo não substituem esse ensaio.

## G6: recursos efetivamente criados

| Recurso | Estado conferido |
|---|---|
| API Resource Manager | Habilitada para permitir a leitura da política IAM do projeto |
| Conta `continental-hml-consumer` | Criada; sem papéis no projeto e sem chaves gerenciadas pelo usuário |
| Acesso ao segredo de cron | `roles/secretmanager.secretAccessor` somente no segredo `continental-hml-cron-secret`; binding anterior da conta web preservado |
| Job `continental-hml-supervision` | `Ready=True`; modo `supervision`, zero execuções e nenhuma agenda criada |
| Métrica `continental-hml-supervision-completed` | Criada; filtro exato de projeto, região, Job e `consumer_completed` |
| Canal `3617580342119339067` | Criado **desabilitado**, usando o contato do operador já registrado no inventário privado de 20/10 |
| Política de ausência `16768859373754969259` | Criada **desabilitada**, ausência de conclusão por 600 segundos |
| Política de falha/atenção `2245739515294212144` | Criada **desabilitada**, intervalo de notificação de 300 segundos |

O Job usa 1 vCPU/512 MiB, uma tarefa, `parallelism=1`, zero retentativas,
timeout total de 60 segundos e timeout HTTP de 30 segundos. Recebe apenas a
versão 1 do segredo de cron, sem banco, Asaas ou e-mail. O destino é a URL da
tag `review-ae9ec9c`. Sua política IAM não contém bindings públicos.
Permissões herdadas de administradores do projeto continuam aplicáveis.

Os limites de timeout/lotes foram reduzidos em relação ao manifesto geral
para a preparação do observador: uma consulta GET, um lote e duração limitada.
Não foram provisionados Jobs de pagamentos/pontos nem conta de Scheduler.
A API Scheduler continua desabilitada; seu inventário de agendas permanece
não conferido. A criação desses recursos não comprova execução automática.

A primeira criação da política de ausência retornou 404 porque a métrica
recém-criada ainda não estava visível no Monitoring. Após propagação, a criação
foi concluída; ambas as políticas foram consultadas e comparadas com seus
filtros/canal esperados. Nenhum alerta foi provocado ou recebido nesta rodada.

O segredo de cron continua compartilhado com rotas de processamento:
`supervision` é um contrato do programa, não uma credencial restrita a GET.
`parallelism=1` também não impede duas execuções independentes simultâneas.

## Inventário e segurança

- Webhook Sandbox continua habilitado na Vercel, com fila não interrompida.
  Isso não comprova fila vazia nem ausência de chamadas em voo.
- Snapshot de status: inbox READY=1, outbox DEAD_LETTER=1, REFUND PENDING=1,
  revisão vencida=1 e operação retida=1. Nenhum caso foi rearmado ou resolvido
  por essa consulta; Leno continua responsável pela triagem financeira.
- A política IAM do projeto agora foi lida. Há um binding `roles/editor` para
  a conta Compute padrão e um `roles/owner`. A revisão das necessidades desses
  acessos continua pendente; nenhum acesso preexistente foi revogado.
- Vercel/Cloudflare, invocações manuais, rotação do bypass e autenticação efetiva
  do webhook continuam com as lacunas do inventário anterior. Não foram
  considerados aprovados por ausência de acesso ou por este provisionamento.

## Validação e continuidade

- Comparação do serviço antes/depois: `spec` e distribuição de tráfego idênticas;
  mesma revisão pronta, checkout pausado e controles financeiros desligados.
- Job, permissões do segredo, ausência de chaves da conta consumer, zero
  execuções, canal, métrica e políticas conferidos por leitura após criação.
- 27 testes operacionais e 36 testes unitários de e-mail/reset aprovados.
  Lint do gerador sem erros. O gerador deixou de mencionar Storage como
  requisito de prontidão e registra imagens externas/bloqueio de upload.
- Nenhuma nova imagem web foi construída/publicada; o ajuste do gerador é local.

| Dependência restante | Responsável / próxima ação |
|---|---|
| Chave Resend válida, remetente e conta de teste | Operador: preencher arquivo privado; Vanderlei: bindings e ensaio real |
| Responsável nominal, substituto e disponibilidade | Operador: informar nomes/janela; contato anterior foi reaproveitado, sem presumir escala aceita |
| Janela, cadência, custo e baseline | Vanderlei + Leno + operador: fechar condições do piloto de supervisão |
| Primeiro ensaio | Ativar canal/políticas na janela; emitir série inicial, demonstrar atenção/falha, ausência e recuperação; registrar recebimento humano e atendimento |
| Inventário externo e transferência financeira | Administradores Vercel/Cloudflare + Leno: conferir acionadores/em voo e coordenar exclusividade antes de qualquer processador novo |
| Frete, capacidade e restauração por outro operador | Mantêm os responsáveis e critérios do checklist G1–G8; não foram ensaiados nesta rodada |

O ensaio de supervisão não encerra os testes dos consumidores de pagamentos e
pontos. Ativação recorrente e abertura comercial continuam dependentes dos
aceites correspondentes. Para manter a contenção desta preparação, conservar
canal/políticas desabilitados e não criar agenda ou executar o Job. Não há
necessidade de excluir recursos para aguardar as entradas restantes.

Referências técnicas usadas: [criação de Jobs sem execução automática](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/create),
[canais de notificação](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.notificationChannels),
[políticas de alerta](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.alertPolicies)
e [consulta de domínios Resend](https://resend.com/docs/api-reference/domains/list-domains).
