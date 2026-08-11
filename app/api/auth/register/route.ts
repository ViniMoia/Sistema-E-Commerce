import { registerUser } from "@/services/auth.service";
import { getLojaFromHeaders } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const activeLoja = await getLojaFromHeaders();
    if (!activeLoja) {
      return Response.json(
        { message: "Loja não encontrada para este domínio" },
        { status: 404 }
      );
    }

    const user = await registerUser({
      ...body,
      lojaID: activeLoja.id,
    });

    return Response.json(user);
  } catch (error: any) {
    console.error("API Error in /api/auth/register:", error);
    return Response.json(
      { message: error.message || "Erro interno do servidor" },
      { status: 400 }
    );
  }
}
