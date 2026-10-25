# Continuidade no notebook — 25/10/2026

Publicação solicitada por Vinícius para continuar o trabalho em outra máquina. Reúne a homologação com a entrega de Vanderlei `ce0ac2a`, o código do PR nº 15 `34ab8ea`, os documentos G2/G3 e as alterações locais de recuperação e evidências. A CI do PR nº 15 terminou com sucesso; a revisão independente de Vanderlei ainda não consta no GitHub. Esta transferência do código foi solicitada posteriormente pelo usuário e não representa aceite operacional ou autorização para ativar jobs.

## Obter o projeto

Em um clone existente sem alterações locais:

```powershell
git fetch origin
git switch homologacao_teste
git pull --ff-only origin homologacao_teste
npm ci
npx prisma generate
```

Para um clone novo:

```powershell
git clone --branch homologacao_teste https://github.com/ViniMoia/Sistema-E-Commerce.git
cd Sistema-E-Commerce
npm ci
npx prisma generate
```

Use a versão de Node definida em `.nvmrc`. Se o clone existente tiver alterações, preserve-as antes de atualizar; não use `reset --hard`. Docker é necessário para os testes isolados. Não execute importações, migrations ou scripts financeiros como parte da instalação do notebook.

## Arquivos privados

Os `.env`, credenciais, backups criptografados, chaves age/DPAPI, anexos brutos em `diversos/RESULTADOS` e scripts operacionais privados em `.git` não fazem parte do GitHub público. Transfira a configuração necessária por um canal privado, sem colocá-la no repositório. A `.env.example` documenta os campos; ela não contém as credenciais efetivas. Não inicialize o servidor com acesso ao banco compartilhado antes de conferir o ambiente e os acionadores.

Os resultados revisados dos anexos brutos estão em `evidencias/L-G2-RECUPERACAO-OUTRA-MAQUINA-2026-10-21.json`. Os localizadores de arquivos privados nas evidências são históricos e não indicam arquivos disponíveis após o clone. Uma chave DPAPI vinculada à conta Windows original não deve ser tratada como chave portátil.

## Estado para retomar

- Pedido nº 8: evento de vencimento processado, cancelamento confirmado no Asaas Sandbox e unidade liberada. Não repetir a operação. Ver `evidencias/L-EXPIRACAO-PEDIDO8-2026-10-23.json`.
- PR nº 15: executores por alvo e respectivos testes incluídos. Revisão independente e versão efetiva de web/consumidores continuam a conferir; incorporar código não comprova atualização do GCP. Ver `EXECUTORES_FINANCEIROS_2026-10-23.md`.
- Pedido nº 3: revisão de estorno cancelado permanece pendente. Não rearmar o estorno ou a fila para tentar encerrá-la.
- Catálogo: 517 vínculos de variantes aplicados. Isso não comprova sincronização automática SMB → Nuvemshop → Continental, exportação de novas vendas ou baixa no ERP.
- Vanderlei: preservar a entrega `DEVOLUTIVA_VANDERLEI_ETAPA2_2026-10-23.md` e conferir pendências em conjunto. Os documentos mais antigos mantêm o histórico; prevalecem as evidências datadas posteriores no respectivo escopo.
- G2: recuperação técnica comprovada no escopo registrado; metas operacionais, custódia/acesso e abertura final não se tornam concluídas por esta publicação. Ver `FECHAMENTO_G2.md`.

Próxima ação: consultar CI desta publicação e devolutiva de revisão, confirmar a candidata implantada e continuar a análise da integração. Nenhum controle financeiro, webhook, estoque ou banco remoto foi alterado para transferir o projeto. A publicação em homologação pode disparar a CI e o preview Vercel já configurados.
