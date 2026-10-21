"use server";

import { getCurrentUser } from "@/lib/session";

// Older clients may still invoke this action; never read or persist their file.
export async function uploadAvatarAction(_formData: FormData): Promise<{
  success: false;
  code: string;
  error: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, code: "UNAUTHORIZED", error: "Não autorizado. Sessão expirada." };
  }
  return { success: false, code: "UPLOAD_NOT_ALLOWED", error: "O envio de fotos de perfil não é permitido." };
}
