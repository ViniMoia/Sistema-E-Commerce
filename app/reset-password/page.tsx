import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Definir Nova Senha | Continental Produtos Estéticos",
  description: "Crie uma nova senha de acesso para sua conta.",
};

function ResetPasswordFallback() {
  return (
    <div className="w-full max-w-md mx-auto bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center text-white flex flex-col items-center justify-center space-y-3">
      <Loader2 className="w-6 h-6 animate-spin text-[#dbb501]" />
      <p className="text-sm text-neutral-400">Validando link de acesso...</p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5] flex flex-col relative overflow-hidden selection:bg-[#dbb501]/30">
      {/* Background glow elements */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#050505]/50 to-[#050505] pointer-events-none" />
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#dbb501]/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#dbb501]/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center pt-24 pb-16 px-4 md:px-6 relative z-10 w-full h-full fade-in">
        <Suspense fallback={<ResetPasswordFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
