import { getCurrentUser } from "@/lib/session";
import { err } from "@/lib/api-response";

// Kept as an explicit denial for older clients. No flag can enable uploads.
export async function POST(_request: Request) {
  const user = await getCurrentUser();
  const response = user
    ? err("O envio de arquivos não é permitido.", 403, "UPLOAD_NOT_ALLOWED")
    : err("Não autorizado.", 401, "UNAUTHORIZED");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
