"use client";

import { UserProfile } from "../types";

export function ProfileForm({ user }: { user: UserProfile }) {
  return (
    <form className="space-y-6 animate-in">
      <h2 className="text-2xl font-semibold mb-6">Informações Pessoais</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Nome Completo</label>
          <input 
            type="text" 
            defaultValue={user.name} 
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">E-mail</label>
          <input 
            type="email" 
            defaultValue={user.email} 
            disabled
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white opacity-70 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Telefone</label>
          <input 
            type="tel" 
            defaultValue={user.phone || ""} 
            placeholder="Não informado"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
      </div>
      
      <div className="pt-4">
        <button type="button" className="bg-[var(--primary)] text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-[var(--primary)]/90 transition-colors">
          Salvar Alterações
        </button>
      </div>
    </form>
  );
}
