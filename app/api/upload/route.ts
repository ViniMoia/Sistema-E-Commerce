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
  if (user.role !== "ADMIN") {
    return err("Permissão negada. Apenas administradores podem enviar imagens de produtos.", 403, "FORBIDDEN");
  }

  // Feature gate conservativo: Upload direto em standby temporário.
  // A aplicação opera com imagens por URLs externas (Nuvemshop/CDNs). Código preservado para futuro S3/R2.
  if (process.env.ENABLE_DIRECT_UPLOAD !== "true" && process.env.NODE_ENV !== "test") {
    return err(
      "O upload direto de arquivos está temporariamente desativado. Por favor, utilize a inserção de imagens através de URL externa.",
      503,
      "FEATURE_TEMPORARILY_DISABLED"
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requestedBucket = formData.get("bucket");
    const bucket = typeof requestedBucket === "string" ? requestedBucket : "products";

    if (!file) {
      return err("Nenhum arquivo enviado.", 400, "NO_FILE");
    }

    // O bucket é uma decisão do servidor, não um namespace arbitrário do cliente.
    if (bucket !== "products") {
      return err("Bucket de upload inválido.", 400, "INVALID_BUCKET");
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
    return err("Falha ao processar upload da imagem.", 500, "UPLOAD_ERROR");
  }
}
