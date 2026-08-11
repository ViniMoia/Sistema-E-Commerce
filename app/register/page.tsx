import { RegisterForm } from "@/components/forms/RegisterForm";
import Link from "next/link";

export const metadata = {
  title: "Registro | Pernambuco Confecções",
  description: "Crie sua conta para acessar ofertas exclusivas.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5] flex flex-col relative overflow-hidden selection:bg-[#dbb501]/30">
      {/* Background elements for aesthetic similar to homepage */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#050505]/50 to-[#050505] pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#dbb501]/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#dbb501]/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      


      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center pt-32 pb-16 px-4 md:px-6 relative z-10 w-full h-full fade-in">
        <RegisterForm />
      </main>
    </div>
  );
}
