import { NextResponse, type NextRequest } from "next/server";
import { supabaseSessao } from "@/lib/supabase-auth";

export async function GET(request: NextRequest) {
  const destino = new URL("/conta", request.url);
  const codigo = request.nextUrl.searchParams.get("code");
  const token = request.nextUrl.searchParams.get("token_hash");
  const tipo = request.nextUrl.searchParams.get("type");
  const supabase = await supabaseSessao(true);

  if (supabase && codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (error) destino.searchParams.set("erro", "confirmacao");
  } else if (supabase && token && (tipo === "email" || tipo === "signup")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: tipo });
    if (error) destino.searchParams.set("erro", "confirmacao");
  } else {
    destino.searchParams.set("erro", "confirmacao");
  }

  return NextResponse.redirect(destino, {
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
