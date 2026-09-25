"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2, Sparkles, Check, ArrowLeft, Layers, Image as ImageIcon, DollarSign } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const productSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres"),
  price: z.number().min(0.01, "Preço deve ser maior que R$ 0,00"),
  imageUrl: z.string().url("Insira uma URL de imagem válida"),
  stock: z.number().int().min(0, "Estoque inválido"),
  variants: z
    .array(
      z.object({
        size: z.string().min(1, "Obrigatório"),
        color: z.string().min(1, "Obrigatória"),
        stock: z.number().int().min(0, "Inválido"),
      })
    )
    .min(1, "Adicione pelo menos uma variante"),
  galleryUrls: z.array(z.object({ url: z.string().url("Insira uma URL válida") })),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductInitialData {
  id?: string;
  name: string;
  description: string;
  price: number | string | { toNumber?: () => number };
  imageUrl: string;
  stock: number;
  galleryUrls?: string[];
  productVariants?: Array<{
    id?: string;
    size: string;
    color: string;
    stock: number;
  }>;
}

interface ProductFormProps {
  lojaID: string;
  productId?: string;
  initialData?: ProductInitialData | null;
}

export function ProductForm({ lojaID, productId, initialData }: ProductFormProps) {
  const isEditing = Boolean(productId);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const formattedInitialPrice = initialData?.price
    ? typeof initialData.price === "object" && typeof initialData.price.toNumber === "function"
      ? initialData.price.toNumber()
      : Number(initialData.price)
    : 0;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      price: formattedInitialPrice,
      imageUrl: initialData?.imageUrl ?? "",
      stock: initialData?.stock ?? 0,
      variants:
        initialData?.productVariants && initialData.productVariants.length > 0
          ? initialData.productVariants.map((v) => ({
              size: v.size,
              color: v.color,
              stock: v.stock,
            }))
          : [{ size: "Padrão", color: "Padrão", stock: 10 }],
      galleryUrls: initialData?.galleryUrls?.map((url) => ({ url })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "variants",
    control: form.control,
  });

  const {
    fields: galleryFields,
    append: appendGallery,
    remove: removeGallery,
  } = useFieldArray({
    name: "galleryUrls",
    control: form.control,
  });

  const onSubmit = async (data: ProductFormValues) => {
    setIsLoading(true);

    try {
      const payload = {
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        stock: data.stock,
        lojaID: lojaID,
        variants: data.variants.map((v) => ({
          size: v.size,
          color: v.color,
          stock: v.stock,
        })),
        galleryUrls: data.galleryUrls.map((g) => g.url),
      };

      const url = isEditing ? `/api/products/${productId}` : "/api/products";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        let errorDetails = "";
        if (json.details?.fieldErrors) {
          const errors = Object.entries(json.details.fieldErrors)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
            .join(" | ");
          if (errors) errorDetails = ` (${errors})`;
        }
        throw new Error((json.error || json.message || "Falha ao salvar produto") + errorDetails);
      }

      toast({
        title: isEditing ? "Produto atualizado" : "Produto cadastrado",
        description: `O produto "${data.name}" foi salvo com sucesso no catálogo.`,
      });

      router.push("/admin/products");
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Ocorreu um erro ao comunicar com a API.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productId) return;
    setIsDeletingProduct(true);

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || json.message || "Falha ao excluir produto");
      }

      toast({
        title: "Produto excluído",
        description: `O produto "${form.getValues("name") || initialData?.name || ""}" foi removido com sucesso.`,
      });

      setShowDeleteConfirm(false);
      router.push("/admin/products");
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Ocorreu um erro ao comunicar com a API.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingProduct(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Seção 1: Dados Cadastrais Principais */}
        <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-xl">
          <div className="border-b border-catalog-gold/20 pb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-catalog-gold" />
              <span>Identificação & Formulação Técnica</span>
            </h3>
            <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded">
              Geral
            </span>
          </div>

          <div className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                    Nome Comercial do Produto
                  </FormLabel>
                  <FormControl>
                    <input
                      placeholder="Ex: V-LUB LUBRIFICANTE PARA CLAY BAR 500ML VONIXX"
                      {...field}
                      className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold transition-all"
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-mono text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                    Descrição Técnica & Instruções de Aplicação
                  </FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Descreva a finalidade técnica, modo de uso, superfícies indicadas e rendimento..."
                      rows={4}
                      {...field}
                      className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-500 text-sm rounded-xl p-4 focus:outline-none focus:border-catalog-gold transition-all resize-none font-mono"
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-mono text-red-400" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                      Preço de Venda (R$)
                    </FormLabel>
                    <FormControl>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="49.90"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono transition-all"
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-mono text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                      Estoque Geral Central
                    </FormLabel>
                    <FormControl>
                      <input
                        type="number"
                        placeholder="100"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono transition-all"
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-mono text-red-400" />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Seção 2: Imagem Principal & Palco Branco */}
        <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-xl">
          <div className="border-b border-catalog-gold/20 pb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-catalog-gold" />
              <span>Imagem de Destaque no Catálogo</span>
            </h3>
            <span className="text-[10px] text-catalog-gold uppercase tracking-[0.2em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded">
              Palco Branco
            </span>
          </div>

          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ProductImageUpload
                    value={field.value}
                    onChange={field.onChange}
                    label="Foto Principal"
                  />
                </FormControl>
                <FormMessage className="text-xs font-mono text-red-400" />
              </FormItem>
            )}
          />
        </div>

        {/* Seção 3: Grade de Variantes (Tamanho, Volume, Cor, Estoque) */}
        <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-xl">
          <div className="border-b border-catalog-gold/20 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-catalog-gold" />
                <span>Grade de Variantes (Embalagens & Litragens)</span>
              </h3>
              <p className="text-xs text-catalog-muted font-light mt-0.5">
                Defina opções como 500ml, 1,5L, 3L, 5L ou versões de cor/acabamento.
              </p>
            </div>

            <button
              type="button"
              onClick={() => append({ size: "500ml", color: "Padrão", stock: 10 })}
              className="px-4 py-2 rounded-full border border-catalog-gold/40 bg-catalog-gold/15 text-catalog-gold hover:bg-catalog-gold/25 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Variante</span>
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-4 rounded-xl bg-[#0B132B]/60 border border-catalog-gold/20"
              >
                <div className="sm:col-span-5">
                  <label className="text-[10px] font-mono text-catalog-gold uppercase font-bold block mb-1">
                    Volume / Tamanho
                  </label>
                  <input
                    {...form.register(`variants.${index}.size`)}
                    placeholder="Ex: 500ml, 1.5L, 5L"
                    className="w-full bg-[#050B14] border border-catalog-gold/30 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-catalog-gold"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="text-[10px] font-mono text-catalog-gold uppercase font-bold block mb-1">
                    Variação / Acabamento
                  </label>
                  <input
                    {...form.register(`variants.${index}.color`)}
                    placeholder="Ex: Padrão, Concentrado"
                    className="w-full bg-[#050B14] border border-catalog-gold/30 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-catalog-gold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-mono text-catalog-gold uppercase font-bold block mb-1">
                    Estoque
                  </label>
                  <input
                    type="number"
                    {...form.register(`variants.${index}.stock`, { valueAsNumber: true })}
                    placeholder="10"
                    className="w-full bg-[#050B14] border border-catalog-gold/30 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-catalog-gold"
                  />
                </div>

                <div className="sm:col-span-1 flex items-center justify-end pt-3 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="w-8 h-8 rounded-lg border border-red-500/30 bg-red-950/40 text-red-400 hover:bg-red-900/40 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remover variante"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé de Ações Finais */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-catalog-gold/20">
          <Link
            href="/admin/products"
            className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer self-start sm:self-auto"
          >
            <span className="group-hover:-translate-x-1 transition-transform duration-300">
              <ArrowLeft className="w-4 h-4 text-catalog-gold" />
            </span>
            <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
              Voltar aos Produtos
            </span>
          </Link>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading || isDeletingProduct}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-red-500/30 bg-red-950/40 text-red-400 hover:bg-red-900/40 hover:text-red-300 font-bold text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Excluir Produto</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || isDeletingProduct}
              className="btn-shimmer inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(240,180,14,0.4)] border border-[#F5BD1E]/40 cursor-pointer transition-transform hover:scale-105 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#010E31]" />
              ) : (
                <Check className="w-4 h-4 text-[#010E31]" />
              )}
              <span>{isEditing ? "Salvar Alterações do Produto" : "Concluir Cadastro do Produto"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && (
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
              <p className="font-bold text-white uppercase truncate">
                {form.getValues("name") || initialData?.name || "Produto selecionado"}
              </p>
              <p className="text-catalog-muted mt-1 text-[11px]">
                Esta ação é irreversível e removerá o item e suas variantes.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingProduct}
                className="px-5 py-2.5 rounded-full border border-catalog-gold/30 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isDeletingProduct}
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {isDeletingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </Form>
  );
}
