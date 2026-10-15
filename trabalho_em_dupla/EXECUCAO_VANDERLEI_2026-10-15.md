# Continuidade de Vanderlei — 15/10/2026

Base recebida: `8632514f03bded8ca0143f0ac053fa8ceadade30`, branch `homologacao_teste`. Origem consultada somente em leitura: `origin/main`, `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`. Prioridades: seções 27–35 do replanejamento, especialmente a seção 34. Não foram alterados serviços financeiros, schema, migrations ou dados remotos.

## Entregas desta rodada

### V-08 — correção do bloqueio da CI

A [CI de `8632514`](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38771509109) falhou: seis testes da home e duas rejeições não tratadas. O mock de `useCartStore` ignorava o seletor recebido e não expunha `getState`, embora o componente já utilizasse ambos. Isso fazia o teste interpretar um objeto como `isMutating=true` e falhar na guarda de inclusão.

O mock agora segue o contrato consumido pela home; handlers assíncronos são aguardados. Dois novos casos verificam mutação iniciada depois do render e orientação ao usuário diante de resultado incerto. A proteção da aplicação foi preservada. A suíte passou com nove testes, e os unitários completos passaram com 774 testes em 88 arquivos.

A [aprovação de `bfaf1a1`](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38622639139) continua válida como histórico de 14/10, incluindo carga e Linux; não aprova automaticamente as revisões recebidas depois. A publicação desta rodada exige sua própria CI.

### V-02/V-03 — confirmação, cópia e abertura de instruções

- PIX e linha digitável agora anunciam sucesso somente depois da conclusão de `clipboard.writeText`.
- Clipboard ausente ou recusado gera mensagem acessível e permite nova tentativa, sem rejeição não tratada ou falso “Copiado”.
- A operação pendente e o temporizador são invalidados quando o código muda ou o componente é removido; resposta tardia não altera uma compra já cancelada.
- O botão do boleto tem nome acessível e feedback de sucesso para leitores de tela.
- Boleto e WhatsApp abrem com `noopener,noreferrer`.
- A nova suíte `payment-confirmation-browser` entrou na seleção compartilhada do harness/CI. Exercita desktop e mobile emulado, vencimento civil em outro fuso, callback com parâmetros falsos de sucesso, reload do mesmo pedido, falha/recuperação de consulta, cancelamento, estorno, vencimento e clipboard ausente/recusado/atrasado.

Os estados dessa nova suíte são DTOs controlados dentro do Next isolado; não comprovam aprovação do provedor. Não há criação de pagamento por callback nem habilitação de débito. Os testes existentes de checkout/carrinho e execução durável continuam verificando o contrato real com PostgreSQL descartável e transporte simulado.

## Revisão das entregas recebidas de Leno

| Cenário | Situação na documentação recebida | Parecer e limite desta revisão |
|---|---|---|
| #4 — crédito 12x | Seção 35: estorno integral de R$ 360,72, 12 parcelas/históricos DONE, seis unidades devolvidas, −149 pontos uma vez; 12 webhooks e outbox concluídos. | Encerrado no Sandbox segundo as evidências registradas por Leno/operador. Não repetir REFUND ou executor para esse pedido. Não constitui replay deliberado nem devolução física. |
| #5 — crédito 1x/pontos/frete | Estorno integral já revisado em 14/10. | Preservado; sem nova operação ou repetição do ensaio. |
| #6 — boleto pago | Seção 30: emissão, pagamento, ganho de 24 pontos e e-mail concluídos. | Não continuar listando emissão/pagamento/e-mail como ausentes. Estorno de boleto pago permanece separado. |
| #7 — boleto cancelado sem pagamento | Seção 32: exclusão remota confirmada, reserva liberada uma vez, sem ganho de pontos. | Encerrado conforme registro; não repetir cancelamento. Não comprova vencimento ou pagamento tardio. |
| #8 — boleto aguardando vencimento | Limite externo em 17/10 às 00:00 BRT; elegibilidade da reserva em 20/10 às 00:00 BRT, após 72 h. | Preservado. Nenhum prazo foi antecipado e nenhuma compra, pagamento, cancelamento ou rodada remota foi executada. A habilitação de expiração informada pelo operador não comprova agendamento automático. |
| Débito e devolução de boleto pago | Contratos e confirmação do Asaas ainda pendentes. | Permanecem com Leno; a UI de débito depende do contrato final. Testes de retorno não habilitam o método. |

Essa revisão distingue os registros documentais de Leno de consulta independente ao estado remoto atual. Não foram disponibilizados novos snapshots JSON do #4 equivalentes aos arquivos do #5 para repetir uma comparação offline dos saldos finais. Os testes do executor parcelado são isolados e não substituem esses snapshots ou uma consulta autorizada.

## V-06/V-07 — impedimentos externos revalidados

- Docker Desktop foi iniciado; engine Linux 29.8.2 respondeu e o harness usou PostgreSQL descartável. Não foi necessária reinstalação.
- O Preview registrado retornou novamente HTTP 302 para `vercel.com`. Catálogo real, domínio/proxy, login e integrações externas continuam sem validação independente nesta sessão.
- `gcloud projects list` continua mostrando apenas os dois projetos já vistos em 14/10 (engenharia e Gemini). Nenhum foi assumido como destino da loja. Foi solicitado o projeto correto e acesso/configuração do Preview.
- O runbook da main e `infra/cloudrun/README.md` foram consultados. Manifestos, cadência proposta e exemplos não foram tratados como recursos implantados. Nenhuma API, Job, Scheduler, secret ou política IAM foi alterada.
- Para concluir executor permanente/alertas, ainda são necessários destino, domínio/TLS, IAM/billing, referências de secrets/e-mail/Storage e limites acordados com Leno. Configuração/aplicação externa e observação exigem essas entradas.

## Verificação e evidências

- Unitários: 774 aprovados em 88 arquivos.
- TypeScript aprovado; lint dos arquivos alterados sem erros. O aviso preexistente de imagem do QR permanece.
- A primeira rodada otimizada passou nos 80 testes selecionados, mas o harness recusou emitir evidência final porque arquivos de teste/harness mudaram durante a execução. Esse resultado não é apresentado como aprovação da revisão final.
- A revisão final passou em **80 testes em seis suítes**, standalone realocado com duas instâncias, Node 22.23.3 e PostgreSQL 16. Inclui confirmação (cinco casos), checkout (sete), carrinho (quatro), execução durável/estorno parcelado (55) e runtime/assets (nove). Fontes, scripts, testes e pacote identificados por hash na [evidência desta rodada](evidencias/V-CONTINUACAO-2026-10-15.json).
- Nenhum contêiner descartável com label `logic-audit.run-id` permaneceu após os ensaios; recursos preexistentes foram preservados.
- Logs locais: `artifacts/validation/vanderlei-2026-10-15/`, ignorados pelo Git. Não contêm credenciais remotas.

## Pendências para a próxima etapa

1. Identificar o projeto e disponibilizar acesso autorizado ao Preview; concluir V-06/V-07 e smoke externo.
2. Conferir catálogo real, Admin/variantes, frete/expedição, identidade e mobile no candidato acessível.
3. Receber contratos de débito/devolução de boleto e procedimentos de dados de Leno; integrar apenas as capacidades aprovadas.
4. Acompanhar o #8 nos marcos reais, sem reabrir os casos encerrados, e obter os aceites conjuntos do candidato.

WF-18/WF-19 e a implantação de produção permanecem abertos. Nenhuma aprovação local foi convertida em aceite externo.
