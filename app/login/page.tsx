import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = {
  title: "Login | Continental Produtos Estéticos",
  description: "Acesse sua conta para continuar.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-catalog-bg text-catalog-text flex flex-col relative overflow-hidden selection:bg-catalog-gold/30">
      {/* Background radial glow and ambient gradient */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none" 
        style={{ 
          background: "radial-gradient(circle at 50% 45%, rgba(240, 180, 14, 0.07) 0%, rgba(5, 5, 5, 0.8) 60%, #000000 100%)" 
        }} 
      />
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#F0B40E]/[0.03] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#F0B40E]/[0.02] rounded-full blur-[140px] pointer-events-none" />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center pt-28 pb-16 px-4 md:px-6 relative z-10 w-full h-full fade-in">
        <LoginForm />
      </main>
    </div>
  );
}
