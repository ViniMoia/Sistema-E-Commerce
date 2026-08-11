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
    <div className="p-6 md:p-10 space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] text-[#DDAF02] font-mono tracking-[0.25em] uppercase mb-1">
            Catálogo
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
            Produtos
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Gerencie o catálogo de produtos da loja.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#DDAF02] text-black text-sm font-bold tracking-wide hover:bg-[#c49a00] transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-[#DDAF02]/50 focus:ring-1 focus:ring-[#DDAF02]/30 transition-all"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#DDAF02]" />
        </div>
      ) : products.length === 0 ? (
        <div className="glass-panel rounded-xl border border-white/5 py-20 flex flex-col items-center gap-4 text-center">
          <div className="p-4 rounded-full bg-[#DDAF02]/10 border border-[#DDAF02]/20">
            <PackageSearch className="w-8 h-8 text-[#DDAF02]" />
          </div>
          <div>
            <p className="text-white font-medium">Nenhum produto encontrado</p>
            <p className="text-zinc-500 text-sm mt-1">
              {search
                ? `Nenhum resultado para "${search}"`
                : "Cadastre o primeiro produto da sua loja."}
            </p>
          </div>
          <Link
            href="/admin/products/new"
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#DDAF02]/10 border border-[#DDAF02]/20 text-[#DDAF02] text-sm font-medium hover:bg-[#DDAF02]/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Produto
          </Link>
        </div>
      ) : (
        <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-3 border-b border-white/5 bg-black/20">
            <p className="text-xs font-mono text-zinc-500 tracking-widest uppercase">
              {products.length} produto{products.length !== 1 ? "s" : ""}{" "}
              encontrado{products.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="divide-y divide-white/5">
            {products.map((product) => {
              const totalVariantStock = product.productVariants.reduce(
                (acc, v) => acc + v.stock,
                0
              );
              const displayStock =
                product.productVariants.length > 0
                  ? totalVariantStock
                  : product.stock;

              return (
                <div
                  key={product.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Image */}
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                    {product.imageUrl ? (
                      <img
                        src={getOptimizedImageUrl(product.imageUrl, 80, 80)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-zinc-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {product.name}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-xs">
                      {product.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] font-mono text-zinc-600">
                        {product.productVariants.length} variante
                        {product.productVariants.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="shrink-0 text-right hidden sm:block">
                    <p className="text-[#DDAF02] font-bold text-sm">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(product.price)}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        displayStock <= 0
                          ? "text-red-400"
                          : displayStock <= 5
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {displayStock <= 0
                        ? "Sem estoque"
                        : `${displayStock} em estoque`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setDeleteTarget(product)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir produto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isDeleting && setDeleteTarget(null)}
          />
          <div className="relative glass-panel rounded-xl border border-white/10 p-6 max-w-sm w-full animate-in">
            <h3 className="text-white font-semibold text-lg mb-2">
              Excluir produto?
            </h3>
            <p className="text-zinc-400 text-sm mb-6">
              Tem certeza que deseja excluir{" "}
              <span className="text-white font-medium">{deleteTarget.name}</span>
              ? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg border border-white/10 text-zinc-400 text-sm hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
