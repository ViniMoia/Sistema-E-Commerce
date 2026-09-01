import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase SSR (Auxiliar / Storage / Auth Opcional)
 * NOTA DE SEGURANÇA (Finding DB-004):
 * Toda a persistência de banco de dados da aplicação é realizada de forma autoritativa
 * via Prisma Client no backend Next.js.
 * A Data API (PostgREST) pública do Supabase deve permanecer desativada ou protegida
 * com RLS (Row Level Security) via `prisma/migrations/supabase_rls_hardening.sql`.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key'

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    }
  )
}