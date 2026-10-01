# Runbook de backup, PITR e restauração

Estado: procedimento preparado; capacidade real permanece **REQUIRES INFRASTRUCTURE VERIFICATION**.

## Decisões que o responsável externo deve aprovar

- RPO e RTO por pedidos, pagamentos, estoque, pontos, arquivos e configuração.
- Retenção, região/cópia independente, criptografia, imutabilidade e acesso break-glass.
- Cobertura do banco, storage de imagens/documentos, secrets/configuração e metadados de DNS/deploy.
- Frequência de restore drill e owner de reconciliação financeira.

Ausência dessas decisões não significa que backup inexista; significa que recuperabilidade não foi demonstrada.

## Verificação periódica sem restauração destrutiva

1. Consultar o painel/API autorizado e registrar somente IDs, horários, status e política — nunca strings de conexão.
2. Confirmar último snapshot/PITR, falhas, retenção, região e alerta.
3. Verificar que a conta de restauração é separada e de menor privilégio.
4. Escolher timestamp anterior a uma fixture fictícia e criar banco **novo e isolado**, com nome inequívoco de restore drill.
5. Restaurar nesse destino vazio. Não usar `--clean`, `--create`, `DROP`, `TRUNCATE` ou destino compartilhado sem autorização explícita.

Exemplo conceitual, usando service names/secret manager para não expor senha em argumento:

```sh
pg_dump --dbname "$PGSERVICE_SOURCE" --format=custom --file restore-drill.dump
createdb --maintenance-db "$PGSERVICE_TARGET" restore_drill_<timestamp>
pg_restore --dbname "$PGSERVICE_TARGET_RESTORE_DB" --exit-on-error --no-owner restore-drill.dump
```

Os comandos são modelos; não foram executados contra serviço real. O arquivo de dump deve ficar criptografado, fora do repositório, com expiração controlada.

## Validação do restore

1. Aplicar somente as migrations esperadas e confirmar `prisma migrate status`/diff.
2. Comparar contagens por tabela, constraints, FKs e amostras por hash; não exportar PII ao relatório.
3. Executar smoke local/read-only e regressões de pedido, estoque e ledger com fixtures descartáveis.
4. Conferir continuidade entre pedido, pagamento, inbox de webhook, estoque e pontos no timestamp escolhido.
5. Medir tempo total e distância do ponto recuperado; comparar com RTO/RPO aprovados.
6. Confirmar que a restauração não disparou e-mail, webhook, cron ou gateway real.

## Promoção após desastre

- Congelar escrita ou definir fila de reconciliação antes de trocar tráfego.
- Rotacionar credenciais do destino e validar roles/RLS/grants.
- Reaplicar eventos externos posteriores ao ponto de restauração por procedimento idempotente; nunca marcar pagamentos por suposição.
- Trocar conexão/DNS apenas com dupla aprovação e plano de retorno.
- Manter o ambiente restaurado isolado até o encerramento formal do incidente.

## Encerramento objetivo do drill

Restore concluído em destino isolado, integridade aprovada, RPO/RTO medidos, dependências externas mantidas desativadas, evidência registrada e ações corretivas atribuídas. A remoção do banco/dump de drill é operação destrutiva e exige autorização explícita conforme a política local.
