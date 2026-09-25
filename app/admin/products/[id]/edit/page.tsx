import { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { getCurrentUser } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import * as productService from "@/services/product.service";

export const metadata: Metadata = {
  title: "Editar Produto | Painel Administrativo",
  description: "Edição de produto e variantes no catálogo Continental.",
};

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;

  let product;
  try {
    product = await productService.getProductById(id, user.lojaID);
  } catch (error) {
    notFound();
  }

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-catalog-bg text-catalog-text p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="border-b border-catalog-gold/20 pb-6">
          <span className="text-[10px] text-catalog-gold font-mono tracking-[0.25em] uppercase border border-catalog-gold/45 px-2.5 py-1 rounded inline-block mb-2 font-bold">
            Edição de Registro
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase font-mono">
            Editar Produto: {product.name}
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Atualize as informações, fotos, preços e variantes de grade do produto.
          </p>
        </div>

        <ProductForm
          lojaID={user.lojaID}
          productId={product.id}
          initialData={{
            id: product.id,
            name: product.name,
            description: product.description,
            price: Number(product.price),
            imageUrl: product.imageUrl,
            stock: product.stock,
            galleryUrls: product.galleryUrls,
            productVariants: product.productVariants,
          }}
        />
      </div>
    </div>
  );
}
