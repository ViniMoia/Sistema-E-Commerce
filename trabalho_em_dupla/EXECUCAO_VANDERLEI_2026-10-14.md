# Execução e parecer de Vanderlei — continuação de 14/10/2026

Base: `576ad893527a38d947f3cbbc2db0d0126fd72e5c`, branch `homologacao_teste`. Main consultada: `7f9b26e062ec2654420fecffb6dd78ad3ba1e017`, somente leitura. Escopo: frentes 26.1 do replanejamento, preservando atribuições financeiras e de dados de Leno.

## Achados corrigidos

1. **V-08 / CI:** a [execução de 576ad89](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/38604120358) falhou no lint: `@next/next/no-assign-module-variable` em `scripts/import-main-hml-catalog.mjs`. Renomeado apenas o objeto local de compilação para `variantModule`, sem alterar normalização, conexão, importação ou regras de estoque. O mesmo erro afetou a execução de `7b26b14`; a CI de `31f2d78` estava aprovada na consulta.
2. **V-01/V-05 / filtros:** descrição com nome de outra marca ou categoria fazia um produto aparecer no filtro errado, mesmo tendo classificação persistida. A classificação cadastrada agora prevalece; heurísticas continuam apenas para registros sem classificação. Contagens de marca usam a mesma regra e não recuperam uma contagem antiga quando o resultado atual é zero.
3. **V-01/V-05 / navegação:** abrir/recarregar uma URL com marca e página 2 restaurava os filtros e depois voltava à página 1. O reset agora ocorre nas ações de edição de filtro, preservando a página restaurada pela URL e pelo histórico.
4. **V-02/V-04 / frete no produto:** resposta atrasada podia exibir a cotação do CEP anterior depois de o cliente editar o campo. Consultas antigas são abortadas e suas respostas ignoradas; CEP/produto/variante/loja invalidam opções e localidade anteriores. O checkout continua usando seu contrato autoritativo, sem alteração financeira.
5. **V-01/V-05 / moeda:** vitrine e detalhe exibiam `R$ 25.00`; agora usam formatação brasileira `R$ 25,00`, coerente com o carrinho.

A nova suíte `catalog-navigation-browser` entrou na seleção compartilhada do harness e da CI. Usa 519 produtos **sintéticos**, 18 marcas e 10 categorias; não importa snapshot privado nem acessa bancos remotos.

## Parecer por frente da seção 26.1

| Frente | Executado / evidência | Limite restante |
|---|---|---|
| **1 — Catálogo e navegação** | Regressão desktop 1280×900 e mobile emulado 390×844; busca, marca/categoria, página, reload, Voltar, detalhe e preço. Quatro falhas reproduzidas antes das correções; casos aprovados depois. | Conferência dos produtos/imagens efetivos no Preview depende de acesso à proteção Vercel. Base sintética não aprova os 519 produtos reais individualmente. |
| **2 — Admin e variantes** | Suítes `inventory-admin-browser` e `inventory-admin-integrity` aprovadas em PostgreSQL descartável; IDs, ajustes, rascunho e auditoria exercitados com fixtures próprias. | Aceite comercial e estoque físico de abertura continuam com os responsáveis. Nenhum ajuste foi aplicado aos produtos dos ensaios remotos. |
| **3 — Frete** | Suíte de autoridade aprovada; nova regressão reproduziu a cotação obsoleta e passou após correção. Consulta direta do provider Correios para `66010000` e `01001000`, origem `67140615`, falhou por timeout nos dois destinos. | Não há cotação PAC/SEDEX homologada. Novas cotações J&T no Preview com catálogo real dependem de acesso. Tarifa/configuração importadas e prazo de três dias são evidências anteriores de Leno, não nova cotação desta rodada. |
| **4 — Checkout e revisão financeira** | Suítes de checkout, carrinho, expedição/retirada e métricas aprovadas. Revisão independente dos arquivos do #5 passou em nove verificações. Crédito 12x/#4 e e-mail correto/#5 têm evidência documental nas seções 19–23. | Sem repetição de compra, estorno, envio de e-mail ou processamento remoto. Débito, boleto e demais ciclos continuam exigindo entrega/aceite de Leno. |
| **5 — Segurança e infraestrutura** | Docker reiniciado e disponível; testes operacionais, tipos/lint e regressão executados. GitHub CLI instalado para consultar a CI. Runbooks de main reutilizados, sem copiar exemplos como recursos reais. | Preview protegido; projeto Cloud Run ainda não identificado. Nenhum recurso cloud, cron ou capacidade financeira ativados. |

## Revisão do estorno #5

Comando somente de leitura local: `node scripts/review-leno-order5-evidence.mjs`.

Foram comparados os snapshots anteriores, de conclusão e após webhook, além da resposta remota arquivada. Conferências: mesma identidade de pedido/cobrança; composição R$ 49,90 − R$ 5,00 + R$ 12,30 = R$ 57,20; um estorno integral `DONE`; operação e fato únicos; cancelamento uma vez; reserva devolvida à mesma variante; compensações −22/+100 únicas; carteira/lotes 286; ausência de alterações nos efeitos após o webhook; filas do pedido concluídas.

**Parecer:** evidências consistentes para crédito 1x, devolução integral e produto não enviado. O prazo histórico de dois dias permanece preservado no pedido. Não comprova retorno físico, estorno parcelado, PIX/#3, boleto ou débito, nem constitui consulta atual à conta remota.

Resultado com hashes dos quatro arquivos: [revisão do pedido #5](evidencias/V-REVISAO-PEDIDO-5-2026-10-14.json).

## Verificações externas e impedimentos concretos

- A URL de homologação registrada nos scripts retornou HTTP 302 para SSO Vercel em `/`, `/api/products`, `/api/brands` e `/api/categories`. Foi solicitado acesso de automação autorizado por arquivo local ou URL acessível. Nenhum token foi solicitado no chat e nenhuma proteção foi removida.
- A consulta `gcloud projects list` encontrou apenas dois projetos com nomes que não identificam a loja. A listagem de Cloud Run retornou um serviço do projeto de engenharia; no outro projeto, a API Cloud Run está desabilitada. Nenhum serviço de e-commerce foi identificado nessas consultas. Foi solicitada confirmação do projeto correto; o projeto já selecionado no CLI não foi adotado por conveniência e nenhuma API foi habilitada.
- PAC/SEDEX encerraram no timeout de aproximadamente 3,5 s do provider, sem credenciais e com pacote sintético de 300 g / 16×11×4 cm. Isso é um diagnóstico deste ambiente/horário, não prova de indisponibilidade universal dos Correios. [Resultado registrado](evidencias/V-CORREIOS-2026-10-14.json).
- As decisões de origem, preparação, fidelidade, parcelas e tarifas recuperadas da main foram mantidas. Não foram solicitadas novamente nem reaplicadas as cargas já concluídas.

## Validação local

- 739 testes unitários aprovados em 84 arquivos.
- 15 testes operacionais aprovados.
- TypeScript aprovado; lint final sem erros, 17 avisos.
- 53 testes de integração em oito suítes aprovados na primeira rodada dirigida; a versão final da nova suíte passou em cinco testes após a correção adicional de frete e moeda. Os totais se sobrepõem.
- Logs de reprodução e validação em `artifacts/validation/vanderlei-continuacao-576ad89/`, ignorados pelo Git.

- Build otimizado: compilação, TypeScript e geração das 55 páginas aprovados.
- Standalone realocado, duas instâncias, PostgreSQL 16 e Chrome: **72 testes aprovados em 11 suítes**, incluindo navegação, frete atrasado, segurança/tenant, Admin, checkout, métricas e assets. Fontes, scripts, testes e pacote identificados por hash.
- Prontidão local medida novamente em desktop/mobile emulado, com mídia externa bloqueada; metas até 5 s na primeira amostra e p95 quente até 3 s atendidas. Não é medição de Cloud Run ou do catálogo real protegido.

- Imagem Linux construída e verificada: duas instâncias UID 1000, mesma versão, sentinela, home/assets, cron autenticado, consumidor e reinício aprovados. Imagem local `continental-vanderlei:continuacao-576ad89`, identificada no JSON; não é imagem publicada no registry de produção.
- Recursos descartáveis removidos ao encerrar; nenhum contêiner com label `logic-audit.run-id` permaneceu. O PostgreSQL preexistente foi preservado.

[Evidência estruturada desta continuação](evidencias/V-CONTINUACAO-2026-10-14.json). Aprovações históricas de outras revisões não são transferidas automaticamente. A publicação desta correção dispara uma nova CI; sua conclusão deve ser conferida pelo SHA, sem reutilizar a aprovação de `31f2d78`.

## Trabalho restante

Vanderlei: validar Preview autenticado e produtos efetivos, concluir PAC/SEDEX ou registrar serviço indisponível conforme contrato comercial, conferir novas cotações J&T, identificar destino Cloud Run/domínio e recursos, validar operação permanente/alertas/custo e concluir o candidato final. Leno: contrato de débito, cenários financeiros restantes, banco/carga de abertura e procedimentos finais. Ambos: revisão recíproca, gates e janela de implantação.

Esta rodada não altera schema, migrations, checkout financeiro, serviços de pagamento ou carteira. A única alteração no importador de Leno é nominal para corrigir o lint. Não houve compra, estorno, processamento de fila, importação ou alteração nos bancos remotos; main foi preservada. WF-18/WF-19 permanecem abertos e não houve implantação de produção.
