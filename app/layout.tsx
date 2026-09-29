import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { ConditionalHeader } from "@/components/ConditionalHeader";
import { CartProvider } from "@/components/providers/CartProvider";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { Toaster } from "@/components/ui/toaster";
import { getLojaFromHeaders, getTenantCanonicalOrigin } from "@/lib/tenant";
import { toAbsoluteHttpUrl } from "@/lib/web-seo";

export async function generateMetadata(): Promise<Metadata> {
  const loja = await getLojaFromHeaders();
  const canonicalOrigin = loja ? getTenantCanonicalOrigin(loja) : null;
  const title = loja?.name || "Continental Produtos Estéticos Automotivos";
  const description = loja?.description || "Produtos para estética e cuidado automotivo.";
  const socialImage = canonicalOrigin
    ? toAbsoluteHttpUrl(loja?.coverImageUrl || "/brand/continental-symbol-square.png", canonicalOrigin)
    : null;

  return {
    ...(canonicalOrigin ? { metadataBase: new URL(canonicalOrigin) } : {}),
    title,
    description,
    alternates: canonicalOrigin ? { canonical: "/" } : undefined,
    robots: canonicalOrigin
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: canonicalOrigin
      ? {
          type: "website",
          locale: "pt_BR",
          siteName: title,
          title,
          description,
          url: "/",
          images: socialImage ? [{ url: socialImage, alt: title }] : undefined,
        }
      : undefined,
    twitter: canonicalOrigin
      ? {
          card: "summary_large_image",
          title,
          description,
          images: socialImage ? [socialImage] : undefined,
        }
      : undefined,
    icons: {
      icon: "/brand/continental-symbol-square.png",
      shortcut: "/brand/continental-symbol-square.png",
      apple: "/brand/continental-symbol-square.png",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loja = await getLojaFromHeaders();

  const themeStyle = {
    "--primary": loja?.primaryColor || "#DDAF02",
    "--secondary": loja?.secondaryColor || "#050505",
  } as React.CSSProperties;

  return (
    <html lang="pt-BR" className="dark" style={themeStyle}>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Ir para o conteúdo principal
        </a>
        <CartProvider>
          <ConditionalHeader>
            <Header />
          </ConditionalHeader>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <WhatsAppButton phoneNumber={loja?.whatsappNumber} />
          <Toaster />
        </CartProvider>
      </body>
    </html>
  );
}
