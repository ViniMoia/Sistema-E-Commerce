# Atribuições de Vanderlei — etapa 2

**Data:** 23/10/2026 · **Fuso:** Brasília (America/Sao_Paulo) · **Ambiente:** homologação.

**Objetivo:** preparar a operação dos consumidores financeiros no GCP e o próximo ensaio de compra no Asaas Sandbox, enquanto Vinícius e seu agente revisam a reserva do pedido nº 8 e a integração SMB Store → Nuvemshop → Plataforma Continental.

Este guia atualiza as prioridades do [guia 1.0](../1.0/ATRIBUICOES_VANDERLEI_PREPARACAO_PRODUCAO_2026-10-22.md). A preparação, as consultas administrativas e os testes em banco descartável podem começar agora. A execução de Jobs financeiros, a ativação de agendas e novos testes que alterem pedidos, cobranças ou estoque compartilhados ficam para uma etapa coordenada com Vinícius, com cenário e versão identificados.

## 1. Estado de partida

Referências consultadas para esta publicação:

- `origin/homologacao_teste`: `a12a471ca6e6ce4f33d2eaab046142a307c39351`.
- `origin/main`: `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, somente leitura. O guia histórico de configuração Asaas foi consultado; ele não comprova a configuração efetiva dos consumidores atuais.
- [Retomada GCP de 23/10](../../../RETOMADA_GCP_JANELA_2026-10-23.md) e [evidência correspondente](../../V-RETOMADA-GCP-2026-10-23.json), publicados na revisão de homologação acima.

| Frente | Último estado conhecido | Implicação para esta etapa |
| --- | --- | --- |
| GCP | Retomada consolidada por Vanderlei às 14h40 de 23/10; acesso e controles anteriores restaurados; 42 sondas aprovadas; nenhum Job executado. Checkout e capacidades financeiras permaneciam desligados. | Reaproveitar as evidências e reconferir o estado atual. Não repetir a manutenção ou promover outra revisão por rotina. |
| Vercel | Vinícius desativou a manutenção, fez redeploy e desativou a regra temporária de bloqueio de Preview. A loja respondeu HTTP 200. | Acessibilidade não comprova funcionamento financeiro completo. |
| Asaas Sandbox | Webhook ativo e fila retomada, conferidos por API. Logs apresentados por Vinícius mostram respostas 200 em 16 e 17/10. | Os logs históricos não comprovam uma nova compra após a retomada. |
| Cloudflare | Última inspeção disponível: consumidor desativado e sem agendamentos. Não foi reativado nesta retomada. | Reconferência administrativa pertence a Vinícius; não presumir exclusividade global apenas pelo inventário GCP. |
| Vínculos Nuvemshop | 517 variantes vinculadas e verificadas na homologação; IDs, estoque e pedidos preservados. | Não reaplicar o lote. Vínculos não comprovam exportação de pedidos ou baixa na SMB. |
| Pedido nº 8 | Evento `PAYMENT_OVERDUE` processado isoladamente às 16h46 de 23/10: inbox `COMPLETED`, cobrança `OVERDUE`, pedido `PENDING`; uma unidade continua reservada, sem prazo registrado. | Não reenviar o evento, cancelar a cobrança ou liberar a reserva. A revisão dessa reserva está com Vinícius. |
| Pedido nº 3 | Revisão de estorno cancelado preservada: `PAYMENT_REFUND_CANCELLED_REVIEW`. | Não rearmar estorno nem usar esse pedido como teste de recuperação. |

As informações de Vercel, Asaas, vínculos e processamento do nº 8 acima resumem as verificações da frente de Vinícius; não são uma inspeção independente de Vanderlei. Os arquivos locais `L-PROCESSAMENTO-EVENTO-PEDIDO8-2026-10-23.json` e `L-EXECUTOR-EVENTO-FINANCEIRO-ISOLADO-2026-10-23.json` não acompanham esta publicação. Usar este resumo para coordenação e aguardar sua disponibilização para revisão detalhada.

## 2. Prioridade 1 — conferir a configuração efetiva do GCP

Usar o projeto `continental-511812`, região `southamerica-east1`, serviço `continental-hml` e os Jobs `continental-hml-payments` e `continental-hml-supervision` já existentes.

1. Registrar revisão/imagem, distribuição de tráfego, tags acessíveis e destino efetivo de cada Job. Confirmar se cada destino executa a versão esperada; o último commit do Git não implica que todas as revisões tenham sido atualizadas.
2. Conferir conta de serviço, permissões necessárias e referência/versão dos segredos, sem revelar os valores.
3. Registrar os controles efetivos de manutenção, pausa de checkout, processamento remoto, consumidor e expiração: `APP_MAINTENANCE_MODE`, `CHECKOUT_PAUSED`, `PAYMENT_REMOTE_ENABLED`, `PAYMENT_WORKER_ENABLED` e `PAYMENT_EXPIRATION_ENABLED`, conforme existentes em cada componente.
4. Confirmar ambiente Sandbox e conta lógica correspondente, sem copiar credenciais da main. Se uma variável estiver ausente, registrar a ausência e o comportamento padrão do código daquela revisão.
5. Conferir execuções recentes/em andamento, agendas e outros acionadores sob sua administração. Se uma API estiver desabilitada e impedir o inventário, registrar essa limitação; não habilitá-la apenas para completar a tabela.
6. Consultar contagens de filas, revisões e leases somente por leitura, sem drenar ou rearmar registros. Se o banco divergir deste guia, registrar a diferença e comunicar Vinícius.

**Entrega:** inventário datado, com recurso, revisão, controle, valor não sensível, evidência, divergência e responsável. Separar estado verificado agora, evidência histórica e recurso sem acesso.

## 3. Prioridade 2 — preparar ativação e interrupção dos consumidores

Preparar o procedimento; manter a ativação para a execução coordenada.

- Reaproveitar o plano existente e os Jobs já criados. Documentar o responsável pela agenda de pagamentos e pela supervisão, considerando que Vercel pode receber o webhook enquanto GCP processa a fila.
- Propor um único acionador periódico responsável por cada rotina. Alinhar com Vinícius a situação de Vercel e Cloudflare antes de declarar exclusividade. Acesso ao receptor de webhook não equivale a consumidor financeiro ativo.
- Identificar destino, revisão, autenticação, limite de lote, duração, concorrência, política de tentativas e condição de parada. Considerar o orçamento atual; não contratar recursos pagos ou iniciar carga recorrente nesta preparação.
- Explicitar que `/api/cron/payments?limit=1` também chama conciliação, expiração e outbox: **isso não seleciona um pedido específico**.
- Definir como acompanhar fila, erros, tentativas, revisões e leases; diferenciar recebimento do evento, processamento financeiro e efeito comercial.
- Preparar interrupção e retorno a partir de snapshots da configuração real. Definir tratamento de requisições em andamento e eventos pendentes. Não declarar uma operação desconhecida como falha definitiva nem repetir cobrança/estorno para tentar resolver a fila.

**Entrega:** sequência de ativação, observação e interrupção, com comandos propostos sanitizados, responsável por etapa, critérios de sucesso e condições de parada. Apontar o que depende de Vinícius. Não executar os comandos de ativação nesta etapa.

## 4. Prioridade 3 — preparar o roteiro de compra no Sandbox

Preparar um caso novo e identificado, com revisão, conta Sandbox, produto/variante, quantidade, valor e forma de pagamento. Não reutilizar os pedidos nº 3 ou nº 8. Não criar cobrança ou pedido compartilhado apenas para preencher o roteiro.

| Etapa a comprovar | Evidência esperada no ensaio coordenado |
| --- | --- |
| Checkout | Pedido e tentativa vinculados, identificação estável da variante e reserva correspondente. |
| Cobrança Sandbox | Identificador e referência externa correspondentes ao pedido, método e valor corretos. |
| Webhook | Autenticação, recebimento persistido e resposta HTTP; código 200 sozinho não prova processamento. |
| Consumidor | Evento selecionado/processado, resultado, erro ou revisão explícitos. |
| Efeitos comerciais | Estado do pedido, fatos financeiros, estoque e reserva antes/depois, conforme o cenário. |
| Repetição controlada | Evidência de que a mesma entrega não duplica efeitos, preferencialmente validada primeiro em banco descartável. |
| Comunicação | Resultado do envio de confirmação, distinguindo fila criada de mensagem efetivamente entregue. |
| Nuvemshop/SMB | Identificação de quem verificará a exportação e a baixa no ERP; execução alinhada com a frente de integração de Vinícius. |

**Entrega:** roteiro preenchido com pré-condições, passos, resultado esperado, forma de coleta, parada e recuperação. Marcar como “não executado” o que ainda não foi ensaiado. Registrar separadamente a validação da integração SMB: Sandbox financeiro não transforma a loja comercial Nuvemshop/SMB em ambiente descartável.

## 5. Prioridade 4 — revisar o processamento de evento específico

Vinícius implementou localmente `processPaymentInboxEvent`, com conferência de evento, pedido, loja e conta Asaas. A suíte de execução financeira passou em 60 testes em PostgreSQL descartável; tipos e lint também passaram. A função foi usada localmente contra a homologação para concluir somente o evento do nº 8. **O código ainda não foi publicado por esta entrega e não está automaticamente disponível na máquina de Vanderlei ou nas revisões GCP.**

Esta revisão depende de Vinícius disponibilizar o commit/PR e as evidências. Não impede o avanço das prioridades 1 a 3.

Quando o código estiver disponível, conferir:

- Seleção por ID exato, pedido, loja, conta, cobrança e referência, sem recorrer à fila geral quando o alvo não confere.
- Respeito a bloqueios ativos, prazos de nova tentativa e revisões; recuperação segura de bloqueio expirado.
- Repetição e concorrência sem duplicar efeitos; preservação de outros pedidos, estoque, reservas e revisões.
- Reutilização da inspeção do provedor e das transações financeiras existentes.
- Ausência de chamada implícita aos Jobs gerais, expiração, envio de mensagens ou comandos remotos de cobrança/estorno.

**Entrega:** revisão com SHA analisado, verificações executadas, resultados e eventuais ajustes propostos. Testes devem usar infraestrutura descartável, sem credenciais ou banco compartilhado.

## 6. Divisão de trabalho e devolutiva

| Responsável | Frente |
| --- | --- |
| Vanderlei | Inventário GCP, preparação dos consumidores, roteiro financeiro e revisão técnica quando o código chegar. |
| Vinícius e seu agente | Reserva do nº 8, tratamento coordenado das revisões financeiras e integração Nuvemshop/SMB; administração de Vercel, Cloudflare e Asaas; disponibilização das alterações locais. |
| Ambos | Escolha da versão e do cenário, liberação da execução coordenada e conferência do resultado completo. |

Enviar uma devolutiva contendo:

1. Horário BRT/UTC, commit local, revisão remota e recursos efetivamente consultados.
2. Entregas concluídas, pendências e itens sem acesso, com evidência sanitizada.
3. Estado atual dos Jobs, agendas e controles; registrar explicitamente se nenhuma execução foi iniciada.
4. Procedimento proposto e dependências de Vinícius, sem solicitar novamente dados já disponíveis nos documentos.
5. Resultado da revisão do executor ou a indicação “aguardando publicação do código”.

Main e seu banco permanecem somente leitura. Preservar alterações locais ao atualizar o repositório; não usar `reset --hard` para obter este guia. Não publicar `.env`, tokens, URLs com bypass, documentos de clientes ou payloads completos. Esta entrega permite começar a preparação; não declara produção aprovada nem autoriza ativar consumidores gerais, reaplicar vínculos ou mudar estoque.
