import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  uploadFileToStorage,
  getSupabaseAdmin,
} from "@/lib/supabase/storage";
import { POST } from "@/app/api/upload/route";
import { uploadAvatarAction } from "@/app/profile/actions";
import { getCurrentUser } from "@/lib/session";
import prisma from "@/lib/prisma";

// Mock Supabase
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        remove: mockRemove,
      })),
    },
  })),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Módulo de Armazenamento Supabase Storage (ACT-P2-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-key";
  });

  describe("1. Constantes e Configurações de Validação", () => {
    it("deve permitir formatos padrão de imagem web", () => {
      expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
      expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
      expect(ALLOWED_IMAGE_TYPES).toContain("image/webp");
      expect(ALLOWED_IMAGE_TYPES).toContain("image/gif");
    });

    it("deve limitar o tamanho do arquivo a 5MB", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });
  });

  describe("2. Serviço de Armazenamento (uploadFileToStorage)", () => {
    it("deve realizar upload e retornar a URL pública", async () => {
      mockUpload.mockResolvedValueOnce({
        data: { path: "test.jpg" },
        error: null,
      });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: "https://mock.supabase.co/storage/v1/object/public/products/test.jpg" },
      });

      const url = await uploadFileToStorage({
        bucket: "products",
        path: "test.jpg",
        buffer: Buffer.from("image-content"),
        contentType: "image/jpeg",
      });

      expect(url).toBe("https://mock.supabase.co/storage/v1/object/public/products/test.jpg");
      expect(mockUpload).toHaveBeenCalledWith(
        "test.jpg",
        expect.any(Buffer),
        expect.objectContaining({ contentType: "image/jpeg", upsert: true })
      );
    });

    it("deve lançar erro se o upload do Supabase falhar", async () => {
      mockUpload.mockResolvedValueOnce({
        data: null,
        error: { message: "Bucket storage quota exceeded" },
      });

      await expect(
        uploadFileToStorage({
          bucket: "products",
          path: "fail.jpg",
          buffer: Buffer.from("image-content"),
          contentType: "image/jpeg",
        })
      ).rejects.toThrow("Bucket storage quota exceeded");
    });
  });

  describe("3. Rota de API (/api/upload)", () => {
    it("deve retornar 401 se usuário não estiver autenticado", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const formData = new FormData();
      const req = new Request("http://localhost/api/upload", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.code).toBe("UNAUTHORIZED");
    });

    it("deve retornar 403 se usuário comum tentar enviar imagem para produtos", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "cust-1",
        role: "CUSTOMER",
        lojaID: "loja-1",
      } as any);

      const formData = new FormData();
      const fakeFile = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
      formData.append("file", fakeFile);
      formData.append("bucket", "products");

      const req = new Request("http://localhost/api/upload", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.code).toBe("FORBIDDEN");
    });

    it("deve rejeitar arquivo com tipo MIME inválido", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "admin-1",
        role: "ADMIN",
        lojaID: "loja-1",
      } as any);

      const formData = new FormData();
      const fakePdf = new File(["fake"], "doc.pdf", { type: "application/pdf" });
      formData.append("file", fakePdf);
      formData.append("bucket", "products");

      const req = new Request("http://localhost/api/upload", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.code).toBe("INVALID_FILE_TYPE");
    });

    it("deve fazer upload com sucesso para ADMIN no bucket products", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "admin-1",
        role: "ADMIN",
        lojaID: "loja-1",
      } as any);

      mockUpload.mockResolvedValueOnce({
        data: { path: "loja-1/photo.jpg" },
        error: null,
      });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: "https://mock.supabase.co/storage/v1/object/public/products/loja-1/photo.jpg" },
      });

      const formData = new FormData();
      const fakeImg = new File(["image-bytes"], "photo.png", { type: "image/png" });
      formData.append("file", fakeImg);
      formData.append("bucket", "products");

      const req = new Request("http://localhost/api/upload", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.url).toContain("photo.jpg");
    });
  });

  describe("4. Server Action de Avatar (uploadAvatarAction)", () => {
    it("deve retornar erro se usuário não autenticado", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const formData = new FormData();
      const result = await uploadAvatarAction(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Não autorizado");
    });

    it("deve salvar avatar no Supabase e atualizar User no Prisma", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "user-123",
        role: "CUSTOMER",
        lojaID: "loja-1",
      } as any);

      mockUpload.mockResolvedValueOnce({
        data: { path: "avatar.jpg" },
        error: null,
      });
      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: "https://mock.supabase.co/storage/v1/object/public/avatars/user-123.jpg" },
      });

      const formData = new FormData();
      const fakeImg = new File(["bytes"], "avatar.webp", { type: "image/webp" });
      formData.append("avatar", fakeImg);

      const result = await uploadAvatarAction(formData);

      expect(result.success).toBe(true);
      expect(result.avatarUrl).toBe("https://mock.supabase.co/storage/v1/object/public/avatars/user-123.jpg");
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-123" },
          data: { avatarImageUrl: "https://mock.supabase.co/storage/v1/object/public/avatars/user-123.jpg" },
        })
      );
    });
  });

  describe("5. Feature Gate de Desativação Conservativa (Migração Neon)", () => {
    it("deve retornar 503 com mensagem amigável quando NODE_ENV !== 'test' e ENABLE_DIRECT_UPLOAD !== 'true'", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "admin-1",
        role: "ADMIN",
        lojaID: "loja-1",
      } as any);

      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = "production";
        const formData = new FormData();
        const fakeFile = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
        formData.append("file", fakeFile);
        formData.append("bucket", "products");

        const req = new Request("http://localhost/api/upload", {
          method: "POST",
          body: formData,
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(503);
        expect(json.code).toBe("FEATURE_TEMPORARILY_DISABLED");
        expect(json.error).toContain("temporariamente desativado");
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it("deve retornar erro amigável em uploadAvatarAction quando NODE_ENV !== 'test'", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "user-123",
        role: "CUSTOMER",
        lojaID: "loja-1",
      } as any);

      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = "production";
        const formData = new FormData();
        const fakeImg = new File(["bytes"], "avatar.webp", { type: "image/webp" });
        formData.append("avatar", fakeImg);

        const result = await uploadAvatarAction(formData);

        expect(result.success).toBe(false);
        expect(result.error).toContain("temporariamente desativado");
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });
  });
});
