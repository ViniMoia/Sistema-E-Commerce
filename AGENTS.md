<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Regras de domínio: variantes de produto

- Produtos sem variação utilizam size: "Único" e color: "Padrão". Na leitura, aceitar também termos neutros legados ("Padrão", "default"), ignorando caixa, espaço e acento.
- Use lib/product-variants.ts para normalização, combinação e resolução da seleção; exija somente dimensões com opções distintas e nunca selecione uma variante sem estoque.
- O ID persistido deve sobreviver ao estado, à validação e ao payload do Admin. Mantenha a chave interna do useFieldArray separada desse ID.
- Atualizações reconciliam por ID pertencente ao produto ou, na ausência de ID, pela combinação normalizada. Não crie duplicatas nem aceite combinações repetidas no payload.
- Leia e reconcilie dentro da transação, após bloquear a linha do produto. Variantes removidas com carrinhos ou pedidos devem manter seus vínculos e ficar indisponíveis; exclua apenas as sem vínculos.
- Saneamentos exigem auditoria dos vínculos e backup antes das mutações. scripts/repair-product-variants.mjs executa somente auditoria, salvo quando chamado com --apply.
