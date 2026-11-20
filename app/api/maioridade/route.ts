import { NextRequest, NextResponse } from "next/server";
import { COOKIE_MAIORIDADE, DURACAO_COOKIE, emitirComprovante, verificarNascimento } from "@/lib/maioridade";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return NextResponse.json({ mensagem: "Formato de solicitação inválido." }, { status: 415 });
  }

  const dados = await request.json().catch(() => null);
  const idade = verificarNascimento(dados?.nascimento);
  if (idade !== "maior") {
    const resposta = NextResponse.json({
      mensagem: idade === "menor" ? "Acesso permitido apenas a pessoas com 18 anos ou mais." : "Informe uma data de nascimento válida.",
    }, { status: idade === "menor" ? 403 : 400 });
    resposta.cookies.delete(COOKIE_MAIORIDADE);
    return resposta;
  }

  const comprovante = emitirComprovante();
  if (!comprovante) {
    return NextResponse.json({ mensagem: "A confirmação de idade está indisponível. Tente mais tarde." }, { status: 503 });
  }

  const resposta = NextResponse.json({ confirmado: true });
  resposta.cookies.set(COOKIE_MAIORIDADE, comprovante, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_COOKIE,
  });
  return resposta;
}
