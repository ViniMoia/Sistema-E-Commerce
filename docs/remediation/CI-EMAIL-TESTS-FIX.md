# Correção dos testes de e-mail no CI — 29/09/2026

O [pipeline da main no commit c2d34d7](https://github.com/ViniMoia/Sistema-E-Commerce/actions/runs/36629406834) falhou em dois testes unitários: os cenários sem chave do Resend em `order-payment-email.test.ts` e `password-recovery.test.ts`. O lint passou com os 15 avisos já registrados.

**Causa:** os testes construíam o provedor com chave vazia, mas o construtor utiliza `RESEND_API_KEY` como alternativa. No CI essa variável contém uma chave fictícia. Assim, os testes percorriam o caminho de envio/rejeição, em vez de comprovar ausência de configuração. A validação local anterior tinha usado a variável vazia, ocultando essa diferença de ambiente.

**Correção:** os cenários sem configuração passam a definir a variável vazia com `vi.stubEnv`. As suites do provedor substituem `fetch` por um mock e restauram as variáveis e os globais após cada teste. Os dois cenários também verificam que `fetch` não foi chamado. O comportamento da aplicação e o contrato do provedor não foram alterados.

**Validação local:** a reprodução com chave fictícia presente e rede externa bloqueada falhou nos dois casos antes da correção, com 20 dos 22 testes aprovados. Após a correção, a suite completa passou: 93 arquivos e 622 testes. Typecheck, lint dos arquivos alterados, scanner de segredos e `git diff --check` também passaram. Node 22.22.1; configuração fictícia explícita; nenhum e-mail externo enviado na reprodução local.

A execução completa no GitHub Actions é necessária para confirmar as etapas que o primeiro pipeline não alcançou: integrações PostgreSQL, build e imagem Docker. O resultado remoto deve ser consultado na execução vinculada ao commit desta correção.

Falhas de pull requests do Dependabot são independentes: por exemplo, a atualização isolada de `@prisma/client` para 7.10.0 não foi aplicada à main nem faz parte desta correção. Nenhuma atualização de dependências foi aceita automaticamente.
