import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Definir Nova Senha | Continental Produtos Estéticos",
  description: "Crie uma nova senha de acesso para sua conta.",
};

function ResetPasswordFallback() {
  return (
    <div className="w-full max-w-md mx-auto bg-catalog-card border border-catalog-gold/45 rounded-[2rem] p-8 text-center text-white flex flex-col items-center justify-center space-y-3">
      <Loader2 className="w-6 h-6 animate-spin text-catalog-gold" />
      <p className="text-sm font-mono text-catalog-muted">Validando link de acesso...</p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-catalog-bg text-catalog-text flex flex-col relative overflow-hidden selection:bg-catalog-gold/30">
      {/* Background glow elements */}
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
        <Suspense fallback={<ResetPasswordFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
