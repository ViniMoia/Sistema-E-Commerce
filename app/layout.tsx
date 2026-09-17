import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { ConditionalHeader } from "@/components/ConditionalHeader";
import { CartProvider } from "@/components/providers/CartProvider";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { getLojaFromHeaders } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const loja = await getLojaFromHeaders();
  return {
    title: loja?.name || "Continental Produtos Estéticos Automotivos",
    description: loja?.description || "Construindo interfaces reais com movimento.",
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
        <CartProvider>
          <ConditionalHeader>
            <Header />
          </ConditionalHeader>
          {children}
          <WhatsAppButton phoneNumber={loja?.whatsappNumber} />
        </CartProvider>
      </body>
    </html>
  );
}
