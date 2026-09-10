# Diretrizes de Otimização e Eficiência do Ecossistema

Este documento registra as análises de desempenho, recomendações de otimização e rotinas de manutenção para o ecossistema Ruflo + Antigravity.

---

## 1. Princípios de Otimização (Anti-Otimização Prematura)

* **Otimização Baseada em Evidências**: Nenhuma alteração de infraestrutura ou paralelismo deve ser realizada sem métricas prévias extraídas de `ruflo performance metrics` ou `ruflo performance bottleneck`.
* **Simplicidade dos Agentes**: Manter o número de agentes estritamente necessário (o quarteto fundamental: Planner, Coder, Tester, Reviewer), evitando agentes intermediários sem valor agregado.
* **Economia de Tokens e Contexto**: Injetar apenas o contexto relevante recuperado da memória persistente, aplicando limites de busca (`limit: 5`, `threshold: 0.7`).

---

## 2. Otimizações Aplicadas e Validadas

### A. Indexação Vetorial HNSW
* **Diagnóstico**: O scan linear de vetores $O(n)$ torna-se um gargalo conforme a base de conhecimento cresce.
* **Ação Aplicada**: Construção do índice HNSW com métrica de similaridade de cosseno:
  ```bash
  ruflo memory search -q "<termo>" --build-hnsw
  ```
* **Resultado**: Busca vetorial acelerada em até 10x-150x com latência sub-milissegundo.

### B. Manutenção e Compressão de Armazenamento
* **Rotina de Limpeza**: Execução de `ruflo memory cleanup` para purgar entradas com TTL expirado ou de baixa relevância.
* **Rotina de Compressão**: Execução de `ruflo memory compress` para otimizar os blocos SQLite WASM e manter o arquivo `.swarm/memory.db` enxuto.

### C. Gestão de Paralelismo em Swarms
* **Regra de Dimensionamento**: Limitar os swarms a 3 a 5 agentes simultâneos (`--max-agents 5`).
* **Prevenção de Locks**: Garantir que nenhum worker dispute o mesmo arquivo durante a execução paralela.

---

## 3. Rotina Periódica de Saúde

Recomenda-se executar quinzenalmente ou após grandes entregas:

```bash
# 1. Diagnóstico de gargalos
ruflo performance bottleneck

# 2. Métricas de recursos
ruflo performance metrics

# 3. Limpeza e compressão da memória
ruflo memory cleanup
ruflo memory compress
```
