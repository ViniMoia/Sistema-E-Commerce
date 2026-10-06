import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getLojaFromHeaders, TenantContext } from "@/lib/tenant";

export type AuthedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
export type GuardResult<T = AuthedUser> = { user: T; tenant?: TenantContext | null } | NextResponse;

/**
 * Exige que a requisição possua uma sessão ativa (status ACTIVE).
 * Retorna { user } para sessões válidas ou uma resposta NextResponse pronta com erro 401.
 */
export async function requireAuth(_req?: Request): Promise<GuardResult> {
  const user = await getCurrentUser();

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized", message: "Não autenticado." }, { status: 401 });
  }

  return { user };
}

/**
 * Exige que a requisição pertença a um usuário com papel ADMIN e status ACTIVE.
 * Retorna { user } ou NextResponse com erro 401/403.
 */
export async function requireAdmin(_req?: Request): Promise<GuardResult> {
  const user = await getCurrentUser();

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized", message: "Não autenticado." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden", message: "Acesso negado." }, { status: 403 });
  }

  return { user };
}

/** Purchase administration must agree with the storefront resolved by the host. */
export async function requirePurchaseAdmin(req?: Request): Promise<GuardResult> {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const tenant = await getLojaFromHeaders();
  if (!tenant) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
  if (tenant.id !== auth.user.lojaID) return NextResponse.json({ error: 'Sessão não autorizada para esta loja.' }, { status: 403 });
  return { ...auth, tenant };
}

/**
 * Exige tenant válido resolvido pelos cabeçalhos autoritativos da requisição (Fail-Closed).
 */
export async function requireTenant(): Promise<{ tenant: TenantContext } | NextResponse> {
  const tenant = await getLojaFromHeaders();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found", message: "Loja não encontrada." }, { status: 404 });
  }
  return { tenant };
}
