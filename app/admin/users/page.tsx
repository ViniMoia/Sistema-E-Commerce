"use client";

import { useEffect, useState, useMemo } from "react";
import { UserRoleBadge } from "@/components/admin/UserRoleBadge";
import { RoleManagerModal } from "@/components/admin/RoleManagerModal";
import {
  Users,
  ShieldCheck,
  UserCheck,
  Search,
  Loader2,
  Mail,
  ShieldAlert,
  KeyRound
} from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
  status: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data?.customers || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const adminCount = useMemo(() => users.filter((u) => u.role === "ADMIN").length, [users]);
  const customerCount = useMemo(() => users.filter((u) => u.role === "CUSTOMER").length, [users]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  return (
    <div className="flex-1 space-y-8 p-6 md:p-10 max-w-7xl mx-auto">
      {/* Cabeçalho Canônico Continental */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-catalog-gold/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-catalog-gold text-xs font-mono uppercase tracking-widest mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Segurança & Controle de Acesso</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-continental-display tracking-tight text-white">
            Usuários & Permissões
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Gerenciamento de papéis administrativos, controle de privilégios e auditoria de contas.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-catalog-muted self-start sm:self-auto">
          <span>Total cadastrado:</span>
          <span className="font-bold text-catalog-gold px-2.5 py-0.5 rounded-full bg-catalog-gold/15 border border-catalog-gold/40">
            {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
          </span>
        </div>
      </div>

      {/* 3 StatCards de Resumo de Acessos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Geral */}
        <div className="p-4 rounded-xl bg-catalog-card border border-catalog-gold/25 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-muted">
              Total de Contas
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {users.length}
            </div>
            <p className="text-[10px] text-catalog-muted font-mono mt-0.5">Base global de autenticação</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-catalog-gold/10 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Administradores */}
        <div className="p-4 rounded-xl bg-catalog-card border border-catalog-gold/35 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-gold font-semibold">
              Administradores
            </span>
            <div className="text-2xl font-bold font-mono text-catalog-gold mt-1">
              {adminCount}
            </div>
            <p className="text-[10px] text-catalog-muted font-mono mt-0.5">Acesso administrativo total</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-catalog-gold/20 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Clientes */}
        <div className="p-4 rounded-xl bg-catalog-card border border-catalog-gold/20 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-muted">
              Clientes Registrados
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {customerCount}
            </div>
            <p className="text-[10px] text-catalog-muted font-mono mt-0.5">Compradores com conta ativa</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-catalog-gold absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail do usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
          />
        </div>

        {searchTerm && (
          <div className="text-xs font-mono text-catalog-muted">
            Encontrados: <span className="text-catalog-gold font-bold">{filteredUsers.length}</span>
          </div>
        )}
      </div>

      {/* Tabela Canônica de Usuários */}
      <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#050B14] border-b border-catalog-gold/30">
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  Usuário
                </th>
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  Email
                </th>
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  Nível de Acesso
                </th>
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  Status
                </th>
                <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-catalog-gold/15 text-xs font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-catalog-gold mx-auto mb-2" />
                    <span className="text-catalog-muted uppercase tracking-wider text-[11px]">
                      Carregando usuários Continental...
                    </span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center space-y-2">
                    <Users className="w-8 h-8 text-catalog-gold/60 mx-auto" />
                    <p className="text-white font-semibold">Nenhum usuário encontrado</p>
                    <p className="text-catalog-muted text-[11px] max-w-sm mx-auto font-light">
                      Verifique os termos da busca ou limpe o campo para ver todos os registros.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const initials = user.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Usuário / Nome */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0B132B] to-[#1E293B] border border-catalog-gold/40 flex items-center justify-center text-catalog-gold font-bold text-xs shrink-0 shadow-[0_0_10px_rgba(240,180,14,0.15)]">
                            {initials}
                          </div>
                          <div>
                            <span className="font-semibold text-white block group-hover:text-catalog-gold transition-colors">
                              {user.name}
                            </span>
                            <span className="text-[10px] text-catalog-muted font-mono sm:hidden">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-6 text-neutral-300">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <Mail className="w-3.5 h-3.5 text-catalog-gold/70 shrink-0" />
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* Papel / Role */}
                      <td className="py-4 px-6">
                        <UserRoleBadge role={user.role} />
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {user.status || "Ativo"}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-6 text-right">
                        <RoleManagerModal user={user} onSuccess={fetchUsers} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
