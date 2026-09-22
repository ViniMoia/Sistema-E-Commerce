import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

let adminClientInstance: SupabaseClient | null = null;

/**
 * Retorna uma instância autoritativa do cliente Supabase utilizando a chave Service Role.
 * Usada estritamente no backend para gerenciamento de Storage.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no servidor."
    );
  }

  adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClientInstance;
}

export interface UploadStorageOptions {
  bucket: "products" | "avatars" | string;
  path: string;
  buffer: Buffer | Uint8Array;
  contentType: string;
}

/**
 * Faz upload de um buffer para o Supabase Storage e retorna a URL pública permanente.
 */
export async function uploadFileToStorage({
  bucket,
  path,
  buffer,
  contentType,
}: UploadStorageOptions): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });

  if (error || !data) {
    console.error(`[SupabaseStorage] Erro ao fazer upload para o bucket '${bucket}':`, error);
    throw new Error(error?.message || "Falha ao salvar arquivo no Supabase Storage.");
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);

  if (!publicUrlData?.publicUrl) {
    throw new Error("Não foi possível gerar a URL pública para o arquivo enviado.");
  }

  return publicUrlData.publicUrl;
}

/**
 * Remove um arquivo do bucket especificado no Supabase Storage.
 */
export async function deleteFileFromStorage(
  bucket: string,
  path: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.warn(`[SupabaseStorage] Aviso ao remover arquivo '${path}':`, error.message);
  }
}
