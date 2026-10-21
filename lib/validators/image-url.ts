import { z } from "zod";

// Image fields store external references, never data:/blob: payloads or files.
// Preserve existing CDN URLs rather than imposing an unverified host allowlist.
export const externalImageUrlSchema = z.string().url("Informe uma URL externa de imagem válida").refine(value => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Utilize uma URL HTTP ou HTTPS, sem arquivo embutido ou credenciais");
