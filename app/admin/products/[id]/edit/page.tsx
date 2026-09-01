import { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { getCurrentUser } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import * as productService from "@/services/product.service";

export const metadata: Metadata = {
  title: "Editar Produto | Painel Administrativo",
  description: "Edição de produto e variantes no catálogo.",
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
    <div className="container mx-auto py-10 max-w-4xl fade-in">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-main)]">
          Editar Produto
        </h1>
        <p className="text-[var(--text-main)]/60">
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
          price: product.price,
          imageUrl: product.imageUrl,
          stock: product.stock,
          galleryUrls: product.galleryUrls,
          productVariants: product.productVariants,
        }}
      />
    </div>
  );
}
