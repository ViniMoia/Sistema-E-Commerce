"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import prisma from "@/lib/prisma";
import {
  uploadFileToStorage,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/supabase/storage";
import { randomUUID } from "crypto";

export async function uploadAvatarAction(formData: FormData): Promise<{
  success: boolean;
  avatarUrl?: string;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Não autorizado. Sessão expirada." };
    }

    // Feature gate conservativo: Upload direto em standby temporário.
    if (process.env.ENABLE_DIRECT_UPLOAD !== "true" && process.env.NODE_ENV !== "test") {
      return {
        success: false,
        error: "O upload direto de fotos está temporariamente desativado. Utilize a imagem por URL externa.",
      };
    }

    const file = formData.get("avatar") as File | null;
    if (!file) {
      return { success: false, error: "Nenhum arquivo de imagem foi enviado." };
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        success: false,
        error: "Formato inválido. Envie imagens JPG, PNG ou WEBP.",
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: "A imagem excede o limite máximo permitido de 5MB.",
      };
    }

    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = mimeToExt[file.type] || "jpg";
    const filename = `${user.id}-${Date.now()}-${randomUUID()}.${extension}`;
    const storagePath = `${user.lojaID}/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const publicUrl = await uploadFileToStorage({
      bucket: "avatars",
      path: storagePath,
      buffer,
      contentType: file.type,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarImageUrl: publicUrl },
    });

    revalidatePath("/profile");

    return { success: true, avatarUrl: publicUrl };
  } catch (error: any) {
    console.error("[uploadAvatarAction] Falha ao fazer upload do avatar:", error);
    return {
      success: false,
      error: error?.message || "Ocorreu um erro ao atualizar sua foto de perfil.",
    };
  }
}
