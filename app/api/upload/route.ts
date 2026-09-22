import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { ok, err } from "@/lib/api-response";
import {
  uploadFileToStorage,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/supabase/storage";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return err("Não autorizado. Faça login para enviar arquivos.", 401, "UNAUTHORIZED");
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "products";

    if (!file) {
      return err("Nenhum arquivo enviado.", 400, "NO_FILE");
    }

    // Controle de acesso por bucket
    if (bucket === "products" && user.role !== "ADMIN") {
      return err("Permissão negada. Apenas administradores podem enviar imagens de produtos.", 403, "FORBIDDEN");
    }

    // Validação de formato (MIME)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return err(
        "Formato de imagem inválido. Formatos suportados: JPG, PNG, WEBP e GIF.",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    // Validação de tamanho (5MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return err(
        "O arquivo excede o limite máximo permitido de 5MB.",
        400,
        "FILE_TOO_LARGE"
      );
    }

    // Determinar extensão segura
    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = mimeToExt[file.type] || "jpg";
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    const storagePath = `${user.lojaID}/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const publicUrl = await uploadFileToStorage({
      bucket,
      path: storagePath,
      buffer,
      contentType: file.type,
    });

    return ok({ url: publicUrl });
  } catch (error: any) {
    logger.error("Falha ao processar upload da imagem", error, {
      action: "API_UPLOAD_POST",
      userId: user.id,
      tenantId: user.lojaID,
    });
    return err(error.message || "Falha ao processar upload da imagem.", 500, "UPLOAD_ERROR");
  }
}
