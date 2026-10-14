# Cartão em 1x, resgate de pontos e entrega — ensaio do pedido #5

**Resultado em 14/10/2026:** cenário de aprovação do pedido #5 concluído no recorte testado. Proposta e cobrança de R$ 57,20 em 1x, juros zero, resgate de 100 pontos, ganho de 22 e carteira final 208; reserva confirmada e estoques 93/43. Consultas posteriores ao consumo do evento preservaram os mesmos movimentos, cobrança e reserva. Inbox e três tarefas da outbox concluídas, sem erros, na leitura de 14:01:47 UTC. O operador confirmou recebimento do e-mail e apresentou imagem com pedido #5, Cartão de Crédito, 1x de R$ 57,20, juros R$ 0,00, Data da Confirmação de 14/10/2026 às 10:45, J&T Express Standard (estimativa de 2 dias úteis), variante e quantidade corretas e ganho de 22 pontos. A imagem não discrimina separadamente o valor do frete e o desconto de pontos; esses componentes foram conferidos na proposta e no banco. Não houve teste de postagem/entrega física, devolução integral ou endereço de cobrança diferente do destino neste caso. Este resultado não encerra os demais gates de produção. As instruções abaixo ficam preservadas como roteiro do ensaio realizado.

Preparado em 13/10/2026 após a aprovação em 12x do pedido #4. Candidato de referência: `bb3414f`, Preview da branch `homologacao_teste`, conta financeira `sandbox-hml`. Este roteiro não encerra o gate de cartão, pontos ou entrega. Não presumir que o novo pedido será #5.

## 1. Estado anterior e proposta

**Frete desbloqueado em 13/10/2026, 22:12 UTC:** importação autorizada somente em homologação, com 5.181 tarifas J&T, 58 faixas de CEP e origem `67140615`. O endpoint do Preview respondeu HTTP 200 para uma unidade da variante do ensaio e destino `67140180`: **J&T Express Standard, R$ 12,30, prazo informado de 2 dias**, subtotal R$ 49,90 e cotação assinada. Recalcular na sessão do comprador; a cotação de diagnóstico é temporária e pertence a outra sessão. Sob a política de pontos descrita abaixo, o total de referência passa a **R$ 57,20** (49,90 − 5,00 + 12,30), sujeito à revisão efetiva no checkout. Correios/SEDEX continuam pendentes de configuração e ensaio; esta importação não os habilita. A classificação de risco, ICMS e diferenças de cubagem da J&T continuam registradas no replanejamento para validação antes de produção.

1. Executar `L-04-PREPARAR_CARTAO_1X_PONTOS_ENTREGA.sql` no banco/branch efetivos do Preview e guardar o JSON. A consulta é somente leitura e usa o cliente do #4, sem expor sua identidade pessoal. Conferir política habilitada, carteira contabilizada, pontos não expirados, ausência de dívida e variante disponível/não retirada.
2. No mesmo usuário do #4, preparar carrinho com **uma unidade** do Aspirador de Pó automotivo, **Pequeno/Vermelho**, sem outro item ou desconto adicional. Conferir preço atual; a referência anterior é R$ 49,90. Não alterar estoque/preço para fazer o ensaio passar.
3. Escolher **entrega**, informar endereço de teste válido para cotação e selecionar uma opção realmente oferecida pela configuração da loja. Registrar serviço, valor e prazo. Este ensaio cobre apenas o serviço/destino escolhido; outros provedores e falhas de cotação continuam na matriz. Se não houver cotação, registrar a falha antes de prosseguir; não trocar para retirada para declarar entrega validada.
4. Escolher **cartão de crédito, 1x**, habilitar fidelidade e informar **100 pontos**. Usar exclusivamente os dados fictícios de cartão Sandbox já utilizados; não transcrever cartão/CVV, credenciais ou endereço completo nas evidências.
5. Clicar uma vez em **Revisar proposta de compra**. Registrar o resumo calculado pelo servidor: mercadorias, desconto e pontos resgatados, frete, total financeiro, juros e pontos previstos. **Ainda não clicar em Confirmar proposta e concluir compra**: enviar o JSON inicial e o resumo sem dados sensíveis para conferência conjunta. Se a proposta expirar, gerar outra revisão antes de eventual confirmação, sem reutilizar valores antigos.

Valores condicionais, não medições atuais: se política continuar em R$ 0,05/ponto, ganho 0,5 ponto/R$ e preço R$ 49,90, 100 pontos geram desconto de **R$ 5,00**; mercadoria líquida **R$ 44,90**; juros em 1x **zero**; total financeiro **R$ 44,90 + frete cotado**; ganho previsto **22 pontos**, excluindo frete/juros. Com saldo inicial 286, após resgate de 100 e crédito único de 22 o saldo seria **208**, se não houver outros movimentos ou expiração. A política efetiva, elegibilidade e proposta prevalecem sobre essas referências.

## 2. Execução após conferir a proposta

Confirmar uma vez no checkout Sandbox. Registrar ID/número efetivos, total, método, parcela e estado exibido. Se ficar em verificação, preservar a tentativa; não refazer a compra. Obter diagnóstico específico vinculado ao novo ID antes de processar filas. Os scripts antigos de pedido #3 e #4 não auditam automaticamente este novo pedido.

Processamento, quando indicado: usar o executor existente, que atua globalmente. A revisão conhecida do #3 permanece separada; não redefinir sua operação. Consolidar os resultados por rodada e evitar confirmações intermediárias sem mudança ou erro material.

## 3. Critérios de saída

- Uma cobrança/contrato correspondente ao pedido, cartão 1x, total igual à proposta, juros zero, endereço de cobrança distinto da entrega quando aplicável.
- Resgate de 100 e ganho calculado sobre mercadoria líquida apenas uma vez; carteira, lotes e alocações consistentes; reprocessamento sem novo débito/crédito.
- Reserva de uma unidade vinculada ao item/variante e saldos coerentes com a leitura anterior. Com referência 94/44 e sem outra movimentação, saldos após compra 93/43; não presumir antes da nova leitura.
- Entrega, serviço, custo, prazo e destino persistidos corretamente. Cotação não comprova postagem/rastreio; estas etapas continuam separadas.
- Inbox/outbox do novo pedido concluídas e e-mail recebido mostrando **Cartão de Crédito**, **1x**, total correto e **Data da Confirmação**, sem PIX ou afirmação de liquidação. Não reenviar o e-mail antigo do #4.
- Guardar evidências antes/depois, configuração e limite do ensaio. Não manipular diretamente saldo, pedido ou reserva via SQL para obter resultado esperado.

Devolução integral continua obrigatória em ensaio próprio; a detecção de estorno cancelado no #3 não comprova devolução concluída. Boleto, débito, recusa/análise, executor permanente, demais provedores de entrega e gates de produção continuam pendentes conforme o replanejamento.
