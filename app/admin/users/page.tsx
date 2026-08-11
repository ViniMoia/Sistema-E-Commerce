"use client";

import { useEffect, useState } from "react";
import { UserRoleBadge } from "@/components/admin/UserRoleBadge";
import { RoleManagerModal } from "@/components/admin/RoleManagerModal";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-12 text-[#e5e5e5]">
      <div className="max-w-7xl mx-auto space-y-8 animate-on-scroll [animation:animationIn_0.8s_ease-out_0.1s_both] animate">
        
        <div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-2">Usuários</h1>
          <p className="text-sm md:text-base text-neutral-400 max-w-xl">
            Gerencie as permissões e níveis de acesso da plataforma.
          </p>
        </div>

        <div className="glass-panel border border-white/5 rounded-none overflow-hidden bg-neutral-900/60 ring-1 ring-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-neutral-500 font-mono tracking-widest bg-black/40 border-b border-white/5">
                <tr>
                  <th className="px-6 py-5 font-medium">Nome</th>
                  <th className="px-6 py-5 font-medium">Email</th>
                  <th className="px-6 py-5 font-medium">Permissão</th>
                  <th className="px-6 py-5 font-medium">Status</th>
                  <th className="px-6 py-5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-neutral-500 mx-auto" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 font-mono text-sm">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 font-medium text-white">{user.name}</td>
                      <td className="px-6 py-4 text-neutral-400">{user.email}</td>
                      <td className="px-6 py-4">
                        <UserRoleBadge role={user.role} />
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="border-white/10 text-neutral-400 font-mono text-xs tracking-wider">
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <RoleManagerModal user={user} onSuccess={fetchUsers} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
