"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Validação Client-Side com Zod
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

interface ProductFormProps {
  lojaID: string;
}

export function ProductForm({ lojaID }: ProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      stock: 0,
      variants: [{ size: "", color: "", stock: 0 }],
      galleryUrls: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "variants",
    control: form.control,
  });

  const { fields: galleryFields, append: appendGallery, remove: removeGallery } = useFieldArray({
    name: "galleryUrls",
    control: form.control,
  });

  async function onSubmit(data: ProductFormValues) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          galleryUrls: data.galleryUrls?.map(g => g.url) || [],
          lojaID,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar produto");
      }

      toast({
        title: "Sucesso!",
        description: "Produto cadastrado com sucesso.",
      });

      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível cadastrar o produto.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="glass-panel p-6 rounded-xl animate-in">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Camiseta Básica" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço Base (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque Geral</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Imagem</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição detalhada do produto..."
                      className="resize-none h-24 text-black"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Galeria de Imagens Extras */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-lg font-medium text-[var(--primary)]">
                Imagens Adicionais (Opcional)
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendGallery({ url: "" })}
                className="border-[var(--primary)]/50 hover:bg-[var(--primary)]/10 text-[var(--primary)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Imagem
              </Button>
            </div>

            <div className="space-y-4">
              {galleryFields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-4 flashlight-card p-4 rounded-lg fade-in">
                  <FormField
                    control={form.control}
                    name={`galleryUrls.${index}.url`}
                    render={({ field: formField }) => (
                      <FormItem className="flex-1">
                        <FormLabel>URL da Imagem Extra</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...formField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGallery(index)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 shrink-0 mb-0.5"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              ))}
              {galleryFields.length === 0 && (
                <p className="text-sm text-neutral-500 italic px-2">
                  Clique no botão acima para adicionar fotos complementares à página do produto.
                </p>
              )}
            </div>
          </div>

          {/* Variantes do Produto */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-lg font-medium text-[var(--primary)]">
                Variantes (Grade)
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ size: "", color: "", stock: 0 })}
                className="border-[var(--primary)]/50 hover:bg-[var(--primary)]/10 text-[var(--primary)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Variante
              </Button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col md:flex-row items-start md:items-end gap-4 flashlight-card p-4 rounded-lg fade-in"
                >
                  <FormField
                    control={form.control}
                    name={`variants.${index}.size`}
                    render={({ field }) => (
                      <FormItem className="flex-1 w-full">
                        <FormLabel>Tamanho</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: P, M, G, 42..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`variants.${index}.color`}
                    render={({ field }) => (
                      <FormItem className="flex-1 w-full">
                        <FormLabel>Cor</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Preto, Azul..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`variants.${index}.stock`}
                    render={({ field }) => (
                      <FormItem className="flex-1 w-full">
                        <FormLabel>Estoque desta variante</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            name={field.name}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 shrink-0 mb-0.5 disabled:opacity-30"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-white/10">
            {/* Botão com o efeito shimmer do globals.css */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-shimmer-wrap disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="btn-shimmer-content text-[var(--primary)] font-medium transition-colors group-hover:text-white">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Cadastrar Produto"
                )}
              </div>
              <div className="btn-shimmer-effect" />
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
