# Parecer de Vanderlei sobre a entrega de Leno

Base examinada: `d66a416` / entrega de 13/10/2026. Responsável por este parecer:
Vanderlei. Este documento não substitui o aceite financeiro de Leno.

## Contratos preservados e revisão

- A declaração `PAYMENT_DEPLOYMENT_ENVIRONMENT` distingue Sandbox de produção
  mesmo com runtime otimizado fora da Vercel. Os testes dirigidos cobrem declaração
  inválida, escopo ausente e incompatibilidade de URL/prefixo de chave. A configuração
  Cloud Run adota esse contrato; nenhum marcador Vercel é artificialmente definido.
- Checkout separa instrumento transitório de cartão da intenção persistida.
  Webhook usa schema de campos permitidos, sem transportar atributos arbitrários
  do provedor para a inbox. Outbox comercial identifica o pedido/intenção, sem PAN/CVV.
  Isso é revisão do caminho implementado, não certificação de serviços externos.
- O consumidor chama APIs existentes; não cria operações financeiras nem rearma
  CANCEL/REFUND. O tratamento de resposta incerta continua no domínio de Leno.
- A regressão local preserva os testes de idempotência, concorrência, planos,
  conservação de estoque/pontos, dados legados e recuperação administrativa.
- O caso #3 permanece histórico de estorno cancelado/revisão. Não executamos scripts
  de retomada, novos estornos, replays de homologação nem alterações no Preview.

## Condições de implantação e encaminhamentos para Leno

1. **Banco/conta:** `receivePaymentEvent` documenta uma conta Asaas por instalação.
   `paymentBacklog` agrega tabelas sem filtrar cada consulta por conta e retorna o
   escopo configurado; `claimWork` seleciona trabalho antes da conferência de conta
   em `drainPaymentInbox`. Portanto o campo `accountScope` da supervisão não prova
   sozinho que o banco contém exclusivamente aquela conta. Exigir banco separado,
   inventário e ausência de filas de outra conta; se houver necessidade de coexistência,
   Leno deve definir e implementar o filtro/contrato. Não tratar isso como suporte
   multi-conta já existente. Achado de inspeção, sem ensaio misturando contas reais.
2. **Contenção:** webhook recusa recepção quando `PAYMENT_WORKER_ENABLED` é false.
   Não usar essa flag como interrupção geral de novas compras. Leno deve fornecer
   o controle de contenção que preserve obrigações já abertas e sua evidência.
3. **Métodos:** configuração de loja participa das capacidades. A seção 17 do
   replanejamento de 13/10 amplia o escopo para PIX, crédito até 12x, boleto e débito.
   Ela substitui o adiamento anterior de boleto. Boleto tem contrato local, mas
   ainda precisa de homologação externa. Débito não consta em `PaymentMethod` nem
   no adapter Asaas: Leno deve confirmar suporte da conta/provedor e entregar o
   contrato financeiro antes da integração de UI. PIX manual não substitui métodos
   obrigatórios. A carga/configuração da base limpa pertence a Leno.
   Fixtures locais usam métodos manuais em alguns testes e não representam a oferta
   comercial aprovada do lançamento.
4. **Devolução/chargeback:** a evidência histórica de #3 não fecha devolução integral.
   Permanecem necessários os ensaios externos de PIX/cartão/parcelamento, devolução
   concluída, tratamento de revisão/contestação e procedimento de devolução física.
5. **Prazos e custos:** aprovar cadência, tamanho de lote, timeouts e atraso admissível
   com os resultados medidos no destino. Jobs podem sobrepor execuções; leases não
   substituem orçamento de conexões/compute. Não aprovar Neon Free por estimativa
   de polling vazio nem interromper trabalho durável durante a madrugada.

Não foi alterado código de `services/payment/`, `services/asaas/`, checkout no
servidor, carteira, estoque, schema ou migrations. Mudanças nessa frente exigem
entrega do responsável e regressão do contrato afetado. Resultados finais de testes
e limites constam no relatório consolidado do Vanderlei.

**Parecer:** contratos locais adequados à preparação e aos ensaios isolados;
liberação comercial permanece condicionada às provas e aos gates acima.
