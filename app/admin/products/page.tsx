"use client";

import React from "react";
import Link from "next/link";
import { getOptimizedImageUrl } from "@/lib/utils";
import {
  Plus,
  Search,
  PackageSearch,
  Loader2,
  Package,
  Edit,
  Trash2,
  AlertCircle,
  Tag,
} from "lucide-react";

interface ProductVariant {
  id: string;
  size: string;
  color: string;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  createdAt: string;
  productVariants: ProductVariant[];
}

export default function AdminProductsPage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const fetchProducts = React.useCallback(async (searchTerm: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchTerm) params.set("name", searchTerm);
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar produtos");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => fetchProducts(search), 350);
    return () => clearTimeout(timer);
  }, [search, fetchProducts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/products/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao excluir produto");
      setDeleteTarget(null);
      fetchProducts(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 min-h-screen bg-catalog-bg text-catalog-text">
      {/* Header Operacional */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-catalog-gold/20 pb-6">
        <div>
          <span className="text-[10px] text-catalog-gold font-mono tracking-[0.25em] uppercase border border-catalog-gold/45 px-2.5 py-1 rounded inline-block mb-2 font-bold">
            Gestão de Catálogo
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase font-mono">
            Produtos & Variantes
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Controle de estoque, formulações químicas, especificações e precificação.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="btn-shimmer inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(240,180,14,0.3)] border border-[#F5BD1E]/40 shrink-0 transition-transform hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4 text-[#010E31]" />
          <span>Novo Produto</span>
        </Link>
      </div>

      {/* Barra de Filtro e Busca Técnica */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-catalog-gold" />
          <input
            type="text"
            placeholder="Buscar por nome, marca ou formulação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#0B132B]/70 border border-catalog-gold/30 rounded-xl text-white placeholder-gray-400 text-xs sm:text-sm font-mono focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-catalog-muted self-end sm:self-auto">
          <span>Total cadastrado:</span>
          <span className="font-bold text-catalog-gold px-2 py-0.5 rounded-full bg-catalog-gold/15 border border-catalog-gold/40">
            {products.length} {products.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
      </div>

      {/* Erro ao Carregar */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabela de Produtos Canônica Continental */}
      <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#050B14] border-b border-catalog-gold/30">
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  Produto / Foto
                </th>
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  Preço Base
                </th>
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  Estoque Geral
                </th>
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  Variantes de Grade
                </th>
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-catalog-gold/15 text-xs font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-catalog-gold mx-auto mb-2" />
                    <span className="text-catalog-muted uppercase tracking-wider text-[11px]">
                      Carregando catálogo Continental...
                    </span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <PackageSearch className="w-10 h-10 text-catalog-muted mx-auto mb-3 opacity-40" />
                    <p className="text-white font-bold uppercase tracking-wide">Nenhum produto localizado</p>
                    <p className="text-catalog-muted text-xs mt-1">
                      {search ? "Tente alterar os termos da busca técnica." : "Inicie o cadastro clicando em 'Novo Produto'."}
                    </p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const totalVariantStock = (p.productVariants || []).reduce(
                    (acc, v) => acc + (v.stock || 0),
                    0
                  );
                  const effectiveStock = (p.productVariants && p.productVariants.length > 0)
                    ? totalVariantStock
                    : p.stock;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Foto sobre Palco Branco + Nome */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3.5">
                          <div className="w-14 h-14 bg-white rounded-xl p-1.5 object-contain shrink-0 shadow-sm border border-white/10 flex items-center justify-center overflow-hidden">
                            {p.imageUrl ? (
                              <img
                                src={getOptimizedImageUrl(p.imageUrl, 100)}
                                alt={p.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-slate-800" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white uppercase tracking-tight group-hover:text-catalog-gold transition-colors truncate max-w-md">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-catalog-muted truncate max-w-sm mt-0.5 font-light">
                              {p.description || "Sem descrição técnica informada."}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Preço em Destaque Ouro */}
                      <td className="py-3.5 px-6">
                        <span className="text-sm font-bold text-catalog-gold tracking-tight">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(Number(p.price) || 0)}
                        </span>
                      </td>

                      {/* Estoque */}
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                            effectiveStock > 10
                              ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/50"
                              : effectiveStock > 0
                              ? "bg-catalog-gold/15 text-catalog-gold border-catalog-gold/50"
                              : "bg-red-950/60 text-red-400 border-red-500/50"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              effectiveStock > 10
                                ? "bg-emerald-400"
                                : effectiveStock > 0
                                ? "bg-catalog-gold"
                                : "bg-red-400"
                            }`}
                          />
                          {effectiveStock > 0 ? `${effectiveStock} un.` : "Esgotado"}
                        </span>
                      </td>

                      {/* Variantes de Grade */}
                      <td className="py-3.5 px-6">
                        {p.productVariants && p.productVariants.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {p.productVariants.slice(0, 3).map((v) => (
                              <span
                                key={v.id}
                                className="px-2 py-0.5 rounded-md bg-[#0B132B]/80 border border-catalog-gold/30 text-[10px] text-slate-300"
                              >
                                {v.size} {v.color !== "Padrão" && `• ${v.color}`} ({v.stock})
                              </span>
                            ))}
                            {p.productVariants.length > 3 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[#0B132B]/50 text-[10px] text-catalog-muted">
                                +{p.productVariants.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-catalog-muted text-[11px] italic">Produto Único</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${p.id}/edit`}
                            className="w-9 h-9 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/70 hover:bg-catalog-gold/15 text-slate-300 hover:text-catalog-gold transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                            title="Editar Produto"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            className="w-9 h-9 rounded-xl border border-red-500/30 bg-red-950/40 hover:bg-red-900/40 text-red-400 transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                            title="Excluir Produto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-catalog-card border border-catalog-gold/45 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase font-mono tracking-tight">
                  Excluir Produto
                </h3>
                <p className="text-xs text-catalog-muted mt-0.5">
                  Esta ação desvinculará o produto do catálogo ativo.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B132B]/70 border border-catalog-gold/25 text-xs font-mono text-slate-300">
              <p className="font-bold text-white uppercase truncate">{deleteTarget.name}</p>
              <p className="text-catalog-gold mt-1">
                Preço: {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(deleteTarget.price) || 0)}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-full border border-catalog-gold/30 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-mono uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
