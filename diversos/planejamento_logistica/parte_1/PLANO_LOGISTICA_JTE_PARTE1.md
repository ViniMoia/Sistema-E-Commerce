# Plano de Implementação: Configuração de Logística e Frete Real (J&T Express & CEP 67140615)
**E-Commerce Continental Produtos Estéticos Automotivos**  
*Etapa: 1.2. Configuração de Logística e Frete Real*  
*Origem das Entregas: Ananindeua / PA (CEP: 67140-615)*  
*Transportadora Oficial: J&T Express (Tabela Comercial TF2026)*

---

## 1. Contexto e Parâmetros Operacionais

### 1.1. Dados de Origem (Centro de Expedição)
* **CEP de Origem**: `67140-615` (Ananindeua - PA, Região Metropolitana de Belém).
* **UF / Região**: Pará (Norte) - GEOCOM de Origem: `PA-CAP`.
* **Retirada Presencial**: Habilitada (`enablePickup = true`) com custo zero para clientes locais.

### 1.2. Especificações da Tabela J&T Express (`TABELA_COMERCIAL_OFICIAL_TF2026 (1).xlsx`)
* **Abrangência**: Nacional, com 158 colunas de GEOCOMs distribuídas nas 5 macrorregiões (`SUDESTE`, `SUL`, `NORDESTE`, `NORTE`, `CENTRO OESTE`).
* **Faixas de Peso**: 32 faixas tabeladas (de `0 a 0,25 kg` até `29,001 a 30 kg`), com valor específico de **Kg Adicional** para pacotes com peso superior a 30 kg.
* **Fator de Cubagem**: `167 kg/m³` (fórmula volumétrica padrão de logística expressa: $\frac{\text{Comprimento} \times \text{Largura} \times \text{Altura}}{6000}$).
* **Regra de Peso**: $\text{Peso Tributável} = \max(\text{Peso Real}, \text{Peso Cubado})$.
* **Limites de Dimensões**: Máximo de 120 cm no maior dos lados e soma das 3 dimensões ($C + L + A$) de até 240 cm.
* **Encargos e Taxas de Segurança**:
  * **Ad-Valorem (Seguro de Carga)**: 0,2% sobre o valor total dos produtos.
  * **GRIS (Gerenciamento de Risco)**: 0,4% sobre o valor total dos produtos.
  * **Zonas de Risco**: Ad-Valorem de 0,3% e GRIS de 1,0% quando aplicável.

---

## 2. Matriz de Utilização dos MCPs Instalados no Projeto

Neste projeto dispomos de uma suíte especializada de MCPs. Cada um será acionado com responsabilidades bem definidas nesta implementação:

| MCP | Servidor Oficial | Como será utilizado na implementação do Frete J&T Express |
| :--- | :--- | :--- |
| **`postgres`** | `@modelcontextprotocol/server-postgres` | • **Configuração de Origem**: Atualização atômica na tabela `Loja` com `originCep = '67140615'`, `originCity = 'Ananindeua'` e `originState = 'PA'`.<br>• **Modelagem**: Criação das tabelas `JtExpressRate` e `JtExpressGeocom` no PostgreSQL (Supabase).<br>• **Ingestão**: Carga em lote (ETL) das 158 colunas x 32 faixas de peso da planilha oficial.<br>• **Auditoria de Performance**: Validação das consultas de índice composto para tempo de resposta < 50ms no checkout. |
| **`sequential-thinking`** | `@modelcontextprotocol/server-sequential-thinking` | • **Algoritmo de Cubagem**: Modelagem matemática da cubagem volumétrica em comparação ao peso físico do carrinho.<br>• **Resolução de CEP**: Lógica de de-para para classificar qualquer CEP brasileiro no GEOCOM correspondente (`CAP`, `INT1..4`, `RED`).<br>• **Composição de Preço**: Orquestração do cálculo (Tarifa Base + Ad-Valorem 0,2% + GRIS 0,4% + margem operacional da loja). |
| **`git`** | `@modelcontextprotocol/server-git` | • **Branch Isolation**: Criação da branch dedicada `feature/logistics-jt-express`.<br>• **Rastreabilidade**: Commits semânticos atômicos para cada componente (banco de dados, serviço de cálculo, rotas de API e componentes visuais).<br>• **Segurança**: Garantia de diffs limpos e sem quebra da branch principal. |
| **`memory`** | `@modelcontextprotocol/server-memory` | • **Persistência de Conhecimento**: Criação da entidade `Logistics_Engine_JT_Express` no Grafo de Conhecimento permanente.<br>• **Relações de Negócio**: Documentação das dependências entre Loja Continental, CEP `67140615` e regras da J&T para referência dos agentes. |
| **`puppeteer`** | `@modelcontextprotocol/server-puppeteer` | • **Testes E2E no Frontend**: Simulação de digitação de CEP no carrinho e na tela de checkout.<br>• **Inspeção Visual**: Verificação da exibição correta dos cards de entrega (J&T Express e Retirada no Local) com preços e prazos.<br>• **Screenshots de Evidência**: Registro visual do layout em desktop e mobile. |

---

## 3. Passo a Passo da Implementação

```
  FASE 1 (Postgres + Memory)     FASE 2 (Sequential Thinking)    FASE 3 (Git + Código)         FASE 4 (Puppeteer)
┌────────────────────────────┐  ┌────────────────────────────┐  ┌────────────────────────────┐  ┌────────────────────────────┐
│ • Atualizar originCep      │  │ • Algoritmo de Cubagem     │  │ • Branch Git dedicada      │  │ • Testes E2E no Checkout   │
│ • Modelar tabelas J&T      │  │ • Mapeamento CEP -> GEOCOM │  │ • Serviço jt-express.ts    │  │ • Simulação de CEPs locais │
│ • Ingerir dados do Excel   │  │ • Cálculo Ad-Valorem/GRIS  │  │ • API /api/freight/quote   │  │   e interestaduais         │
│ • Persistir no Memory MCP  │  │ • Regras de Frete Grátis   │  │ • Componente UI de Frete   │  │ • Screenshots de Validação │
└────────────────────────────┘  └────────────────────────────┘  └────────────────────────────┘  └────────────────────────────┘
```

---

### Fase 1: Atualização Cadastral e Ingestão da Tabela J&T (Postgres + Memory MCPs)

1. **Configuração da Loja via `postgres` MCP**:
   * Atualizar os parâmetros da loja padrão para o centro de expedição em Ananindeua:
     ```sql
     UPDATE "Loja" 
     SET "originCep" = '67140615',
         "originCity" = 'Ananindeua',
         "originState" = 'PA',
         "enablePickup" = true,
         "additionalDays" = 1
     WHERE slug = 'loja-padrao';
     ```

2. **Modelagem de Dados no Prisma / PostgreSQL**:
   * Adicionar no `schema.prisma`:
     * Modelo `JtExpressRate`: armazena os valores da matriz (`geocom`, `weightMin`, `weightMax`, `basePrice`, `additionalKgPrice`).
     * Modelo `JtExpressGeocom`: mapeia faixas de CEP para o GEOCOM da transportadora (`state`, `cepStart`, `cepEnd`, `geocomCode`, `deliveryDays`).

3. **ETL de Ingestão da Planilha Excel**:
   * Criar script de migração (`scripts/seed_jt_rates.ts`) que lê a aba `PROPOSTA PADRÃO` do arquivo `TABELA_COMERCIAL_OFICIAL_TF2026 (1).xlsx` e popula a tabela com as 158 colunas de GEOCOMs x 32 faixas de peso.

4. **Registro no Grafo de Conhecimento via `memory` MCP**:
   * Registrar as entidades e relações no Memory MCP:
     * `Continental_Store` -(SHIPS_FROM)-> `CEP_67140615_Ananindeua`
     * `Continental_Store` -(USES_CARRIER)-> `JT_Express`
     * `JT_Express` -(APPLIES_CUBAGE)-> `Factor_167_kg_m3`

---

### Fase 2: Modelagem do Motor de Frete (Sequential Thinking MCP)

Utilizar o `sequential-thinking` para estruturar a resolução matemática precisa de cada cotação:

1. **Resolução de CEP ➔ GEOCOM**:
   * O CEP de destino informado pelo cliente (ex: `66085-000`) é consultado na base de faixas.
   * Retorna o GEOCOM correspondente (ex: `PA-CAP`) e o prazo base de transporte (ex: 2 dias úteis).

2. **Cálculo Volumétrico e Peso Tributável**:
   * Para os itens presentes no carrinho:
     $$\text{Volume (cm³)} = \sum (\text{Comprimento}_i \times \text{Largura}_i \times \text{Altura}_i \times \text{Qtd}_i)$$
     $$\text{Peso Cubado} = \frac{\text{Volume (cm³)}}{6000}$$
     $$\text{Peso Tributável} = \max(\sum \text{Peso Físico}, \text{Peso Cubado})$$

3. **Determinação da Tarifa Base**:
   * Enquadramento na faixa de peso da J&T para o GEOCOM de destino:
     * Se peso $\le 30\text{ kg}$: valor direto da célula correspondente.
     * Se peso $> 30\text{ kg}$: $\text{Valor Faixa 30kg} + ((\text{Peso Final} - 30) \times \text{Kg Adicional})$.

4. **Aplicação de Encargos e Impostos**:
   * $\text{Ad-Valorem} = \text{Valor dos Produtos} \times 0{,}002$ (0,2% de seguro).
   * $\text{GRIS} = \text{Valor dos Produtos} \times 0{,}004$ (0,4% de gestão de risco).
   * $\text{Valor Final do Frete J&T} = \text{Tarifa Base} + \text{Ad-Valorem} + \text{GRIS}$.

5. **Estimativa de Prazo de Entrega**:
   * $\text{Prazo Total} = \text{Prazo J&T (dias úteis)} + \text{additionalDays da Loja}$ (margem para separação e embalagem).

---

### Fase 3: Desenvolvimento no Sistema (Git MCP + Next.js)

1. **Isolamento de Código via `git` MCP**:
   * Criar a branch de trabalho: `feature/logistics-jt-express`.

2. **Implementação do Serviço (`lib/services/freight.service.ts`)**:
   * Serviço TypeScript de alta performance com cache em memória para cotações repetidas de mesmo CEP e peso.

3. **Criação da Rota de API (`app/api/freight/quote/route.ts`)**:
   * Endpoint público consumido pelo frontend do carrinho e checkout.
   * Retorno estruturado:
     ```json
     {
       "success": true,
       "origin": { "cep": "67140615", "city": "Ananindeua", "state": "PA" },
       "destination": { "cep": "66085000", "geocom": "PA-CAP" },
       "options": [
         {
           "id": "jt-express",
           "name": "J&T Express",
           "service": "Entrega Padrão",
           "price": 17.15,
           "deliveryDays": 3,
           "description": "Entrega expressa com rastreamento J&T Express"
         },
         {
           "id": "pickup",
           "name": "Retirada no Local",
           "service": "Balcão Continental",
           "price": 0.00,
           "deliveryDays": 0,
           "description": "Retire pessoalmente no galpão em Ananindeua/PA"
         }
       ]
     }
     ```

4. **Integração na Interface do Carrinho e Checkout**:
   * Inclusão do componente de simulação de frete com cálculo instantâneo ao digitar o CEP.
   * Seleção por botões de rádio e soma automática do frete ao total do pedido.

---

### Fase 4: Validação E2E e Inspeção Visual (Puppeteer MCP)

1. **Cenários de Teste Abrangentes**:
   * **Teste 1 (Local - Região Metropolitana de Belém)**: CEP `66085-000` (PA-CAP) com produto de 0,5 kg.
   * **Teste 2 (Interior do Pará)**: CEP `68500-000` (Marabá / PA-INT1).
   * **Teste 3 (Interestadual - São Paulo)**: CEP `01310-100` (SP-CAP1).
   * **Teste 4 (Retirada no Local)**: Selecionar a opção de Retirada Grátis e verificar se o frete fica zerado no checkout.
2. **Inspeção com `puppeteer`**:
   * Simular usuário real no navegador, validar interações e salvar capturas de tela (screenshots) atestando que os valores e prazos são calculados com exatidão.

---

## 4. Estrutura de Arquivos Resultante

```
material/
└── tabela_J&T/
    └── TABELA_COMERCIAL_OFICIAL_TF2026 (1).xlsx    # Tabela física de origem
scripts/
└── seed_jt_rates.ts                                # ETL de carga das taxas
lib/
├── services/
│   ├── freight.service.ts                          # Motor central de frete
│   └── geocom-resolver.service.ts                  # Resolutor de CEP -> GEOCOM
└── validators/
    └── freight.validators.ts                       # Validação com Zod
app/
├── api/
│   └── freight/
│       └── quote/route.ts                          # Endpoint REST de cotação
└── checkout/
    └── page.tsx                                    # Interface com seleção de frete
prisma/
└── schema.prisma                                   # Modelagem de tabelas
```

---

## 5. Resumo e Próximos Passos

Este plano estabelece todas as bases necessárias para que o seu e-commerce passe a calcular frete real com a transportadora **J&T Express**, utilizando as tarifas comerciais oficiais negociadas e o centro de distribuição em **Ananindeua/PA (CEP 67140-615)**.

Quando quiser dar início à execução prática da **Fase 1**, basta autorizar!
